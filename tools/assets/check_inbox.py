# -*- coding: utf-8 -*-
"""Checks generated images in assets-inbox/ against brief 15 and cuts out the chroma-green background.

Run after a batch arrives: python tools/assets/check_inbox.py
Writes assets-inbox/_report.md and, for every file on green, assets-inbox/_ready/<name>.webp (alpha) plus a preview on grey.
"""
import math
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

from PIL import Image

INBOX = Path('assets-inbox')
READY = INBOX / '_ready'
REPORT = INBOX / '_report.md'
IMAGE_SUFFIXES = {'.png', '.jpg', '.jpeg', '.webp'}
ANALYSIS_WIDTH = 1024
WEBP_QUALITY = 86
PREVIEW_GREY = (128, 128, 128)

FLAG_ATTACH_PX = (160, 160)
FLAG_ATTACH_TOLERANCE_PX = 20
FLAG_ANGLE_TOLERANCE_DEG = 5
FLAG_POLE_MAX_WIDTH_PX = 24
FLAG_ATTACHED_EDGE_TO_LENGTH = 0.6
FREE_CORNER_SHARE_DIVISOR = 50
FLAG_FRAMES_MIN_OVERLAP = 0.6
FLAG_FRAMES_MAX_OVERLAP = 0.97
POSITION_TOLERANCE = 0.03
ASPECT_TOLERANCE = 0.05
SEAM_MAX_COLOUR_STEP = 18
HORIZON_MAX_WOBBLE = 0.01
EMPTY_GREEN_SHARE = 0.98
BORDER_GREEN_SHARE = 0.95


def is_chroma_green(pixel):
    red, green, blue = pixel[:3]
    return green > 150 and green - max(red, blue) > 70


@dataclass
class Check:
    name: str
    is_passed: bool
    detail: str


@dataclass
class Verdict:
    path: Path
    task: str
    checks: list = field(default_factory=list)
    is_on_green: bool = False

    @property
    def is_passed(self):
        return all(check.is_passed for check in self.checks)

    def add(self, name, is_passed, detail):
        self.checks.append(Check(name, is_passed, detail))


@dataclass(frozen=True)
class Spec:
    min_size: tuple
    aspect: float
    is_on_green: bool = False
    is_tileable: bool = False
    is_exact_size: bool = False


SPECS = {
    'G1': Spec((4096, 1024), 4, is_tileable=True),
    'G2': Spec((4096, 1024), 4, is_on_green=True, is_tileable=True),
    'G3': Spec((6144, 1536), 4, is_tileable=True),
    'G4': Spec((6144, 1024), 6, is_on_green=True, is_tileable=True),
    'F1': Spec((1024, 1024), 1, is_on_green=True, is_exact_size=True),
    'F2-trolley': Spec((1536, 1024), 1.5, is_on_green=True, is_exact_size=True),
    'F2-rail': Spec((4096, 512), 8, is_on_green=True, is_tileable=True),
    'I1': Spec((2400, 1000), 2.4, is_on_green=True, is_exact_size=True),
    'I2': Spec((2400, 1000), 2.4, is_on_green=True, is_exact_size=True),
    'U1': Spec((1024, 1024), 1, is_exact_size=True),
    'U2': Spec((512, 512), 1, is_on_green=True),
}
FLAG_NAME = re.compile(r'^F1-[a-z]+-(?P<angle>0|25|45|65|80)-(?P<frame>[ab])$')


def task_of(stem):
    code = stem.split('-', 1)[0]
    if code == 'F2':
        return 'F2-rail' if 'rail' in stem else 'F2-trolley'
    return code if code in SPECS else None


def downsampled(image):
    if image.width <= ANALYSIS_WIDTH:
        return image.copy()
    height = max(1, round(image.height * ANALYSIS_WIDTH / image.width))
    return image.resize((ANALYSIS_WIDTH, height), Image.BILINEAR)


def green_mask(image):
    width, height = image.size
    pixels = list(image.convert('RGB').getdata())
    return [[is_chroma_green(pixels[y * width + x]) for x in range(width)] for y in range(height)]


def share(values):
    values = list(values)
    return sum(values) / len(values) if values else 0


def check_size(verdict, image, spec):
    width, height = image.size
    min_width, min_height = spec.min_size
    if spec.is_exact_size:
        verdict.add('размер', (width, height) == spec.min_size, f'{width}×{height}, нужно {min_width}×{min_height}')
    else:
        verdict.add('размер', width >= min_width and height >= min_height, f'{width}×{height}, нужно ≥ {min_width}×{min_height}')
    aspect = width / height
    verdict.add('пропорции', abs(aspect - spec.aspect) / spec.aspect <= ASPECT_TOLERANCE, f'{aspect:.2f} : 1, нужно {spec.aspect:g} : 1')


def check_seam(verdict, image):
    rgb = image.convert('RGB')
    width, height = rgb.size
    steps = []
    for y in range(0, height, max(1, height // 64)):
        left = rgb.getpixel((0, y))
        right = rgb.getpixel((width - 1, y))
        if is_chroma_green(left) and is_chroma_green(right):
            continue
        steps.append(sum(abs(a - b) for a, b in zip(left, right)) / 3)
    mean_step = share(steps)
    verdict.add('стык краёв', mean_step <= SEAM_MAX_COLOUR_STEP, f'разница левого и правого края {mean_step:.0f} из 255, допустимо ≤ {SEAM_MAX_COLOUR_STEP}')


def check_border_green(verdict, mask):
    height, width = len(mask), len(mask[0])
    border = [mask[0][x] for x in range(width)] + [mask[y][0] for y in range(height)] + [mask[y][width - 1] for y in range(height)]
    border_share = share(border)
    verdict.add('фон #00FF00', border_share >= BORDER_GREEN_SHARE, f'зелёного по краям кадра {border_share:.0%}, нужно ≥ {BORDER_GREEN_SHARE:.0%}')


def check_empty_top(verdict, mask, empty_fraction):
    height = len(mask)
    rows = mask[: int(height * empty_fraction)]
    top_share = share(cell for row in rows for cell in row)
    verdict.add('пустой верх', top_share >= EMPTY_GREEN_SHARE, f'верхние {empty_fraction:.0%} зелёные на {top_share:.0%}, нужно ≥ {EMPTY_GREEN_SHARE:.0%}')


def edge_rows_by_column(mask):
    height, width = len(mask), len(mask[0])
    edges = []
    for x in range(width):
        edge = next((y for y in range(height) if not mask[y][x]), None)
        if edge is not None:
            edges.append(edge)
    return edges


def check_straight_edge(verdict, mask, name, expected_fraction):
    height = len(mask)
    edges = edge_rows_by_column(mask)
    if not edges:
        verdict.add(name, False, 'нет ничего, кроме зелёного')
        return
    mean_edge = share(edges)
    wobble = math.sqrt(share((edge - mean_edge) ** 2 for edge in edges)) / height
    is_level = wobble <= HORIZON_MAX_WOBBLE
    detail = f'линия на {mean_edge / height:.0%} высоты, разброс {wobble:.1%}'
    if expected_fraction is not None:
        is_level = is_level and abs(mean_edge / height - expected_fraction) <= POSITION_TOLERANCE
        detail += f', нужно {expected_fraction:.0%} ± {POSITION_TOLERANCE:.0%} и разброс ≤ {HORIZON_MAX_WOBBLE:.0%}'
    verdict.add(name, is_level, detail)


def subject_bounds(mask):
    rows = [y for y, row in enumerate(mask) if not all(row)]
    columns = [x for x in range(len(mask[0])) if not all(mask[y][x] for y in range(len(mask)))]
    if not rows or not columns:
        return None
    return columns[0], rows[0], columns[-1], rows[-1]


def check_trolley(verdict, mask):
    height, width = len(mask), len(mask[0])
    bounds = subject_bounds(mask)
    if not bounds:
        verdict.add('тележка', False, 'нет ничего, кроме зелёного')
        return
    left, top, right, bottom = bounds
    bottom_fraction, top_fraction = (bottom + 1) / height, top / height
    centre_offset = abs((left + right) / 2 / width - 0.5)
    verdict.add('низ колёс', abs(bottom_fraction - 0.8) <= POSITION_TOLERANCE, f'на {bottom_fraction:.0%} высоты, нужно 80%')
    verdict.add('верх стойки', abs(top_fraction - 0.25) <= POSITION_TOLERANCE, f'на {top_fraction:.0%} высоты, нужно 25%')
    verdict.add('по центру', centre_offset <= POSITION_TOLERANCE, f'сдвиг центра {centre_offset:.0%} ширины')


def pole_column(mask, image):
    height, width = len(mask), len(mask[0])
    rgb = image.convert('RGB')
    best_column, best_dark_share = None, 0
    for x in range(width // 2):
        dark = share(not mask[y][x] and sum(rgb.getpixel((x, y))) / 3 < 90 for y in range(0, height, 4))
        if dark > best_dark_share:
            best_column, best_dark_share = x, dark
    return best_column if best_dark_share >= 0.6 else None


def flag_pixels(mask, pole_x):
    height, width = len(mask), len(mask[0])
    start = pole_x + FLAG_POLE_MAX_WIDTH_PX // 2
    return [(x, y) for y in range(height) for x in range(start, width) if not mask[y][x]]


def free_corner_angle_from_vertical(points, attach):
    attach_x, attach_y = attach
    by_distance = sorted(points, key=lambda point: (point[0] - attach_x) ** 2 + (point[1] - attach_y) ** 2)
    free_corner = by_distance[-max(1, len(points) // FREE_CORNER_SHARE_DIVISOR):]
    free_x = share(x for x, _ in free_corner)
    free_y = share(y for _, y in free_corner)
    return math.degrees(math.atan2(free_x - attach_x, free_y - attach_y))


def expected_free_corner_angle(flag_angle_deg):
    """The farthest point is the lower free corner: a whole attached edge below the upper one, so it reads steeper than the cloth."""
    flag_angle = math.radians(flag_angle_deg)
    return math.degrees(math.atan2(math.sin(flag_angle), math.cos(flag_angle) + FLAG_ATTACHED_EDGE_TO_LENGTH))


def flag_measure(image):
    mask = green_mask(image)
    pole_x = pole_column(mask, image)
    if pole_x is None:
        return None
    points = flag_pixels(mask, pole_x)
    if not points:
        return None
    attach = (pole_x, min(y for _, y in points))
    return {'attach': attach, 'free_corner_angle': free_corner_angle_from_vertical(points, attach), 'points': set(points)}


def check_flag(verdict, image, stem):
    match = FLAG_NAME.match(stem)
    if not match:
        verdict.add('имя', False, 'нужно F1-<имя>-<0|25|45|65|80>-<a|b>, например F1-flag-45-a')
        return None
    measure = flag_measure(image)
    if not measure:
        verdict.add('шест и полотнище', False, 'не нашёл тёмный шест в левой половине или полотнище справа от него')
        return None
    attach_x, attach_y = measure['attach']
    expected_x, expected_y = FLAG_ATTACH_PX
    is_attached = abs(attach_x - expected_x) <= FLAG_ATTACH_TOLERANCE_PX and abs(attach_y - expected_y) <= FLAG_ATTACH_TOLERANCE_PX
    verdict.add('крепление', is_attached, f'({attach_x}, {attach_y}) px, нужно ({expected_x}, {expected_y}) ± {FLAG_ATTACH_TOLERANCE_PX}')
    flag_angle = int(match['angle'])
    measured, expected = measure['free_corner_angle'], expected_free_corner_angle(flag_angle)
    verdict.add('угол', abs(measured - expected) <= FLAG_ANGLE_TOLERANCE_DEG, f'нижний свободный угол на {measured:.0f}° от шеста, для полотнища {flag_angle}° нужно {expected:.0f}° ± {FLAG_ANGLE_TOLERANCE_DEG}')
    return match['angle'], match['frame'], measure


def check_flag_frames(flags, verdicts):
    by_angle = {}
    for (angle, frame, measure), verdict in flags:
        by_angle.setdefault(angle, {})[frame] = (measure, verdict)
    for angle, frames in sorted(by_angle.items(), key=lambda item: int(item[0])):
        if set(frames) != {'a', 'b'}:
            missing = ({'a', 'b'} - set(frames)).pop()
            next(iter(frames.values()))[1].add('пара кадров', False, f'нет кадра {missing} для {angle}°')
            continue
        (first, first_verdict), (second, _) = frames['a'], frames['b']
        overlap = len(first['points'] & second['points']) / len(first['points'] | second['points'])
        is_same_state = FLAG_FRAMES_MIN_OVERLAP <= overlap <= FLAG_FRAMES_MAX_OVERLAP
        first_verdict.add('пара кадров', is_same_state, f'кадры a и b совпадают на {overlap:.0%}: нужно {FLAG_FRAMES_MIN_OVERLAP:.0%}–{FLAG_FRAMES_MAX_OVERLAP:.0%} (то же состояние, другая фаза)')


def check_icon(verdict, image):
    has_transparency = image.mode in ('RGBA', 'LA') and image.getextrema()[-1][0] < 255
    verdict.add('без прозрачности', not has_transparency, 'есть прозрачные пиксели' if has_transparency else 'непрозрачная')


def cutout(image):
    rgba = image.convert('RGBA')
    pixels = []
    for red, green, blue, alpha in rgba.getdata():
        if is_chroma_green((red, green, blue)):
            pixels.append((0, 0, 0, 0))
            continue
        spill_free_green = min(green, max(red, blue))
        pixels.append((red, spill_free_green, blue, alpha))
    rgba.putdata(pixels)
    return rgba


def save_ready(path, image):
    READY.mkdir(parents=True, exist_ok=True)
    cut = cutout(image)
    cut.save(READY / f'{path.stem}.webp', 'WEBP', quality=WEBP_QUALITY, method=6)
    preview = Image.new('RGBA', cut.size, PREVIEW_GREY + (255,))
    preview.alpha_composite(cut)
    downsampled(preview.convert('RGB')).save(READY / f'{path.stem}-preview.png')


def check_file(path):
    task = task_of(path.stem)
    verdict = Verdict(path, task or '?')
    if task is None:
        verdict.add('код задания', False, 'имя начинается не с кода из брифа 15 (G1–G4, F1, F2, I1, I2, U1, U2)')
        return verdict, None, None
    spec = SPECS[task]
    verdict.is_on_green = spec.is_on_green
    image = Image.open(path)
    image.load()
    check_size(verdict, image, spec)
    small = downsampled(image)
    mask = green_mask(small) if spec.is_on_green else None
    if spec.is_tileable:
        check_seam(verdict, small)
    if task == 'G2':
        check_empty_top(verdict, mask, 0.45)
    elif task == 'G4':
        check_straight_edge(verdict, mask, 'горизонт', None)
    elif task == 'F2-rail':
        check_straight_edge(verdict, mask, 'рельс', 0.6)
    elif task == 'F2-trolley':
        check_border_green(verdict, mask)
        check_trolley(verdict, mask)
    elif task in ('I1', 'I2', 'U2'):
        check_border_green(verdict, mask)
    elif task == 'U1':
        check_icon(verdict, image)
    flag = check_flag(verdict, image, path.stem) if task == 'F1' else None
    return verdict, flag, image


def report_lines(verdicts):
    lines = ['# Приёмка картинок (бриф 15)', '']
    for verdict in verdicts:
        mark = '✓' if verdict.is_passed else '✕'
        lines.append(f'## {mark} {verdict.path.relative_to(INBOX).as_posix()} · {verdict.task}')
        lines.append('')
        lines.extend(f'- {"✓" if check.is_passed else "✕"} {check.name}: {check.detail}' for check in verdict.checks)
        lines.append('')
    return lines


def inbox_files():
    return sorted(path for path in INBOX.rglob('*') if path.suffix.lower() in IMAGE_SUFFIXES and READY not in path.parents)


def main():
    files = inbox_files()
    if not files:
        print(f'{INBOX}/ пуст')
        return 0
    verdicts, flags = [], []
    for path in files:
        verdict, flag, image = check_file(path)
        verdicts.append(verdict)
        if flag:
            flags.append((flag, verdict))
        if image is not None and verdict.is_on_green:
            save_ready(path, image)
    check_flag_frames(flags, verdicts)
    lines = report_lines(verdicts)
    REPORT.write_text('\n'.join(lines), encoding='utf-8')
    passed = sum(verdict.is_passed for verdict in verdicts)
    print('\n'.join(lines))
    print(f'принято {passed} из {len(verdicts)} · отчёт {REPORT.as_posix()}')
    return 0 if passed == len(verdicts) else 1


if __name__ == '__main__':
    sys.exit(main())
