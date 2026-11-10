# -*- coding: utf-8 -*-
"""python -m unittest tools/assets/test_check_inbox.py"""
import math
import sys
import unittest
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).parent))
import check_inbox as inbox  # noqa: E402

GREEN = (0, 255, 0)
FLAG_RED = (224, 72, 47)
POLE_DARK = (30, 30, 30)
FLAG_LENGTH_PX = 600
FLAG_WIDTH_PX = 360
FOLDS_WIDTH_PX = 60


def flag_image(angle_deg, attach=(160, 160), wave_px=0):
    image = Image.new('RGB', (1024, 1024), GREEN)
    draw = ImageDraw.Draw(image)
    attach_x, attach_y = attach
    draw.rectangle([attach_x - 4, 0, attach_x + 4, 1023], fill=POLE_DARK)
    direction = (math.sin(math.radians(angle_deg)), math.cos(math.radians(angle_deg)))
    top = (attach_x + 5, attach_y)
    bottom = (attach_x + 5, attach_y + FLAG_WIDTH_PX)
    far_top = (top[0] + FLAG_LENGTH_PX * direction[0], top[1] + FLAG_LENGTH_PX * direction[1] + wave_px)
    far_bottom = (bottom[0] + FLAG_LENGTH_PX * direction[0], bottom[1] + FLAG_LENGTH_PX * direction[1] + wave_px)
    if angle_deg == 0:
        draw.rectangle([top[0], top[1], top[0] + FOLDS_WIDTH_PX, top[1] + FLAG_LENGTH_PX], fill=FLAG_RED)
    else:
        draw.polygon([top, far_top, far_bottom, bottom], fill=FLAG_RED)
    return image


def verdict():
    return inbox.Verdict(Path('x.png'), 'test')


def failed(checks_verdict):
    return {check.name for check in checks_verdict.checks if not check.is_passed}


class FlagTest(unittest.TestCase):
    def test_flag_at_its_angle_and_attach_passes(self):
        for angle in (0, 25, 45, 65, 80):
            result = verdict()
            inbox.check_flag(result, flag_image(angle), f'F1-flag-{angle}-a')
            self.assertEqual(failed(result), set(), (angle, [check.detail for check in result.checks]))

    def test_wrong_angle_fails(self):
        result = verdict()
        inbox.check_flag(result, flag_image(45), 'F1-flag-25-a')
        self.assertEqual(failed(result), {'угол'})

    def test_moved_attach_fails(self):
        result = verdict()
        inbox.check_flag(result, flag_image(45, attach=(220, 160)), 'F1-flag-45-a')
        self.assertIn('крепление', failed(result))

    def test_bad_name_fails(self):
        result = verdict()
        inbox.check_flag(result, flag_image(45), 'F1-flag-40-a')
        self.assertEqual(failed(result), {'имя'})

    def test_frames_of_one_state_differ_only_in_phase(self):
        first, second = verdict(), verdict()
        flags = [(inbox.check_flag(first, flag_image(45), 'F1-flag-45-a'), first),
                 (inbox.check_flag(second, flag_image(45, wave_px=20), 'F1-flag-45-b'), second)]
        inbox.check_flag_frames(flags, [first, second])
        self.assertEqual(failed(first), set())

    def test_identical_or_missing_frames_fail(self):
        first, second = verdict(), verdict()
        flags = [(inbox.check_flag(first, flag_image(45), 'F1-flag-45-a'), first),
                 (inbox.check_flag(second, flag_image(45), 'F1-flag-45-b'), second)]
        inbox.check_flag_frames(flags, [first, second])
        self.assertIn('пара кадров', failed(first))
        lonely = verdict()
        inbox.check_flag_frames([(inbox.check_flag(lonely, flag_image(65), 'F1-flag-65-a'), lonely)], [lonely])
        self.assertIn('пара кадров', failed(lonely))


class StripTest(unittest.TestCase):
    def test_seam_of_uniform_strip_passes_and_gradient_fails(self):
        uniform, gradient = verdict(), verdict()
        inbox.check_seam(uniform, Image.new('RGB', (400, 100), (120, 110, 80)))
        strip = Image.linear_gradient('L').rotate(90).resize((400, 100)).convert('RGB')
        inbox.check_seam(gradient, strip)
        self.assertEqual(failed(uniform), set())
        self.assertEqual(failed(gradient), {'стык краёв'})

    def test_horizon_straight_passes_wavy_fails(self):
        straight = Image.new('RGB', (600, 100), GREEN)
        ImageDraw.Draw(straight).rectangle([0, 40, 599, 99], fill=(120, 110, 80))
        wavy = Image.new('RGB', (600, 100), GREEN)
        ImageDraw.Draw(wavy).polygon([(0, 20), (300, 70), (599, 20), (599, 99), (0, 99)], fill=(120, 110, 80))
        straight_verdict, wavy_verdict = verdict(), verdict()
        inbox.check_straight_edge(straight_verdict, inbox.green_mask(straight), 'горизонт', None)
        inbox.check_straight_edge(wavy_verdict, inbox.green_mask(wavy), 'горизонт', None)
        self.assertEqual(failed(straight_verdict), set())
        self.assertEqual(failed(wavy_verdict), {'горизонт'})

    def test_rail_must_be_at_sixty_percent(self):
        high = Image.new('RGB', (800, 100), GREEN)
        ImageDraw.Draw(high).rectangle([0, 40, 799, 99], fill=(90, 90, 90))
        result = verdict()
        inbox.check_straight_edge(result, inbox.green_mask(high), 'рельс', 0.6)
        self.assertEqual(failed(result), {'рельс'})

    def test_grass_top_must_be_empty(self):
        empty, busy = Image.new('RGB', (400, 100), GREEN), Image.new('RGB', (400, 100), GREEN)
        ImageDraw.Draw(empty).rectangle([0, 60, 399, 99], fill=(160, 140, 80))
        ImageDraw.Draw(busy).rectangle([0, 20, 399, 99], fill=(160, 140, 80))
        empty_verdict, busy_verdict = verdict(), verdict()
        inbox.check_empty_top(empty_verdict, inbox.green_mask(empty), 0.45)
        inbox.check_empty_top(busy_verdict, inbox.green_mask(busy), 0.45)
        self.assertEqual(failed(empty_verdict), set())
        self.assertEqual(failed(busy_verdict), {'пустой верх'})


class FrameTest(unittest.TestCase):
    def test_trolley_placement(self):
        placed = Image.new('RGB', (300, 200), GREEN)
        ImageDraw.Draw(placed).rectangle([100, 50, 199, 159], fill=(70, 70, 70))
        shifted = Image.new('RGB', (300, 200), GREEN)
        ImageDraw.Draw(shifted).rectangle([20, 80, 119, 189], fill=(70, 70, 70))
        placed_verdict, shifted_verdict = verdict(), verdict()
        inbox.check_trolley(placed_verdict, inbox.green_mask(placed))
        inbox.check_trolley(shifted_verdict, inbox.green_mask(shifted))
        self.assertEqual(failed(placed_verdict), set())
        self.assertEqual(failed(shifted_verdict), {'низ колёс', 'верх стойки', 'по центру'})

    def test_size_exact_and_minimum(self):
        exact, small = verdict(), verdict()
        inbox.check_size(exact, Image.new('RGB', (1024, 1024)), inbox.SPECS['F1'])
        inbox.check_size(small, Image.new('RGB', (2048, 1024)), inbox.SPECS['G1'])
        self.assertEqual(failed(exact), set())
        self.assertEqual(failed(small), {'размер', 'пропорции'})

    def test_icon_without_transparency(self):
        opaque, transparent = verdict(), verdict()
        inbox.check_icon(opaque, Image.new('RGB', (64, 64)))
        inbox.check_icon(transparent, Image.new('RGBA', (64, 64), (0, 0, 0, 0)))
        self.assertEqual(failed(opaque), set())
        self.assertEqual(failed(transparent), {'без прозрачности'})

    def test_cutout_clears_green_and_keeps_subject(self):
        image = Image.new('RGB', (4, 1), GREEN)
        image.putpixel((1, 0), FLAG_RED)
        cut = inbox.cutout(image)
        self.assertEqual(cut.getpixel((0, 0))[3], 0)
        self.assertEqual(cut.getpixel((1, 0)), FLAG_RED + (255,))

    def test_task_of_name(self):
        self.assertEqual(inbox.task_of('F2-rail-a'), 'F2-rail')
        self.assertEqual(inbox.task_of('F2-cart-a'), 'F2-trolley')
        self.assertEqual(inbox.task_of('G1-ground-a'), 'G1')
        self.assertIsNone(inbox.task_of('ground-a'))


if __name__ == '__main__':
    unittest.main()
