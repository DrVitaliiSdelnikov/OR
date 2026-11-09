# -*- coding: utf-8 -*-
"""Prepares the generated scene photos (docs/design/img) for the scope renderer (public/scene).

Run once after new photos arrive: python tools/scene/prepare.py
It prints the measured geometry; scene-layout.ts constants come from that output.
"""
from pathlib import Path

from PIL import Image, ImageFilter

SOURCE = Path('docs/design/img')
TARGET = Path('public/scene')
FILES = {
    'sky': 'Gemini_Generated_Image_e87ywue87ywue87y(4).jpg',
    'berm': 'Gemini_Generated_Image_1iaghz1iaghz1iag.jpg',
    'ground': 'Gemini_Generated_Image_e87ywue87ywue87y(3).jpg',
    'gong': 'Gemini_Generated_Image_e87ywue87ywue87y(1).jpg',
    'marks': 'Gemini_Generated_Image_1iaghz1iaghz1iag(1).jpg',
    'grass': 'Gemini_Generated_Image_e87ywue87ywue87y(2).jpg',
}
WEBP_QUALITY = 86
# The paint around the generated marks is light grey; it must turn pure white, or 'multiply' darkens the plate in a square.
MARK_PAINT_LEVEL = 222


def load(key):
    return Image.open(SOURCE / FILES[key]).convert('RGB')


def save(image, name):
    TARGET.mkdir(parents=True, exist_ok=True)
    image.save(TARGET / f'{name}.webp', 'WEBP', quality=WEBP_QUALITY, method=6)


def brightness(pixel):
    return sum(pixel) / 3


def row_mean(image, y):
    width = image.width
    return sum(brightness(image.getpixel((x, y))) for x in range(0, width, 8)) / len(range(0, width, 8))


def first_row(image, predicate, start=0, step=1):
    y = start
    while 0 <= y < image.height:
        if predicate(y):
            return y
        y += step
    raise ValueError('edge not found')


def is_earth(pixel):
    red, green, blue = pixel
    return red > green * 1.04 and blue > red * 0.5


def earth_share(image, y):
    xs = range(0, image.width, 8)
    return sum(is_earth(image.getpixel((x, y))) for x in xs) / len(xs)


def berm_edges(image):
    top = first_row(image, lambda y: row_mean(image, y) < 200)
    base = first_row(image, lambda y: earth_share(image, y) < 0.5, start=top + 20)
    return top, base


def sky_to_alpha(image, top):
    rgba = image.convert('RGBA')
    pixels = rgba.load()
    for y in range(min(top + 6, image.height)):
        for x in range(image.width):
            red, green, blue, _ = pixels[x, y]
            whiteness = min(red, green, blue)
            if whiteness > 200:
                pixels[x, y] = (red, green, blue, 0)
            elif whiteness > 170:
                pixels[x, y] = (red, green, blue, int(255 * (200 - whiteness) / 30))
    return rgba


def chroma_to_alpha(image):
    rgba = image.convert('RGBA')
    pixels = rgba.load()
    for y in range(image.height):
        for x in range(image.width):
            red, green, blue, _ = pixels[x, y]
            spill = green - max(red, blue)
            if spill > 60:
                pixels[x, y] = (red, max(red, blue), blue, 0)
            elif spill > 15:
                alpha = int(255 * (60 - spill) / 45)
                pixels[x, y] = (red, max(red, blue), blue, alpha)
    return rgba


PLATE_ROW_MIN_PIXELS = 40


def is_plate_paint(pixel):
    red, green, blue, alpha = pixel
    return alpha > 200 and min(red, green, blue) > 150 and max(red, green, blue) - min(red, green, blue) < 30


def plate_box(gong):
    pixels = gong.load()
    plate_rows = {}
    for y in range(gong.height):
        xs = [x for x in range(gong.width) if is_plate_paint(pixels[x, y])]
        if len(xs) >= PLATE_ROW_MIN_PIXELS:
            plate_rows[y] = (min(xs), max(xs))
    top, bottom = min(plate_rows), max(plate_rows)
    middle = (top + bottom) // 2
    centre_x = sum(plate_rows[middle]) // 2
    left = centre_x
    while left > 0 and is_plate_paint(pixels[left - 1, middle]):
        left -= 1
    right = centre_x
    while right < gong.width - 1 and is_plate_paint(pixels[right + 1, middle]):
        right += 1
    return left, top, right, bottom


def prepare_berm():
    image = load('berm')
    top, base = berm_edges(image)
    crop = sky_to_alpha(image, top).crop((0, max(0, top - 8), image.width, image.height))
    save(crop, 'berm')
    print(f'berm: {image.width}x{image.height}, top {top}, base {base}, height {base - top} px, crop starts at {max(0, top - 8)}')


def prepare_ground():
    image = load('ground')
    top = first_row(image, lambda y: row_mean(image, y) < 200)
    base = first_row(image, lambda y: row_mean(image, y) > 140, start=top + 20)
    save(image.crop((0, base, image.width, image.height)), 'ground')
    print(f'ground: berm in source {base - top} px tall (top {top}, base {base}); ground band {image.height - base} px')


def prepare_sky():
    image = load('sky')
    horizon = first_row(image, lambda y: row_mean(image, y) < 175, start=image.height // 3)
    save(image.crop((0, 0, image.width, max(1, horizon - 12))), 'sky')
    print(f'sky: horizon at {horizon} of {image.height}')


def prepare_gong():
    gong = chroma_to_alpha(load('gong'))
    bbox = gong.getbbox()
    gong = gong.crop(bbox)
    left, top, _, bottom = plate_box(gong)
    save(gong, 'gong')
    diameter = bottom - top
    centre_x, centre_y = left + diameter / 2, (top + bottom) / 2
    stand_bottom = max(y for y in range(gong.height) if any(gong.getpixel((x, y))[3] > 200 for x in range(0, gong.width, 4)))
    print(f'gong: {gong.width}x{gong.height}, plate diameter {diameter} px (by height; the right side is shaded), '
          f'centre {centre_x:.0f},{centre_y:.0f}, stand bottom {stand_bottom} -> ground {(stand_bottom - centre_y) / diameter:.2f} diameters below centre')
    check = gong.copy()
    from PIL import ImageDraw
    ImageDraw.Draw(check).ellipse((centre_x - diameter / 2, top, centre_x + diameter / 2, bottom), outline=(255, 0, 0, 255), width=2)
    check.save(Path('tools/scene') / 'gong-check.png')


def prepare_marks():
    image = load('marks')
    scale = image.width / 2000
    centres = [206, 628, 1030, 1442, 1854]
    half = int(180 * scale)
    centre_y = int(245 * scale)
    for index, centre in enumerate(centres):
        x = int(centre * scale / 1.03 * 1.03)
        mark = image.crop((x - half, centre_y - half, x + half, centre_y + half))
        save(mark.point(lambda value: min(255, value * 255 // MARK_PAINT_LEVEL)), f'mark-{index}')
    print(f'marks: {len(centres)} sprites {half * 2}x{half * 2} px')


def prepare_grass():
    grass = chroma_to_alpha(load('grass'))
    grass = grass.filter(ImageFilter.GaussianBlur(6))
    save(grass, 'grass')
    print(f'grass: {grass.width}x{grass.height}, blurred')


if __name__ == '__main__':
    prepare_sky()
    prepare_berm()
    prepare_ground()
    prepare_gong()
    prepare_marks()
    prepare_grass()
