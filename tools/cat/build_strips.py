"""Build the cat's sprite strips from the CC0 "Cat & Dog - Free Sprites" PNGs (OpenGameArt, pzUH).

    python3 tools/cat/build_strips.py <folder with 'Idle (1).png'...> public/img/cat

Every frame is cropped to one shared box (so the feet sit at the same spot in every animation) and
scaled to 336x288. Also draws new frames the pack doesn't have: idle/walk with closed eyes (blink)
idle with happy ^^ eyes (purring, eating, being petted), and sad / mad / heart-eyes / star-eyes faces.
"""
import colorsys
import glob
import os
import re
import sys

from PIL import Image, ImageDraw

SRC, OUT = sys.argv[1], sys.argv[2]
CROP = (6, 10, 538, 466)  # union of every frame; feet centre ends up at 47% x, 98.5% y
SIZE = (336, 288)
ANIMS = {'idle': 'Idle', 'walk': 'Walk', 'run': 'Run', 'jump': 'Jump', 'fall': 'Fall', 'slide': 'Slide', 'hurt': 'Hurt', 'dead': 'Dead'}


def frames(name):
    files = sorted(glob.glob(os.path.join(SRC, f'{name} (*).png')), key=lambda f: int(re.search(r'\((\d+)\)', f)[1]))
    return [Image.open(f).convert('RGBA') for f in files]


def eyes(im):
    """Bounding boxes of the two cyan irises, or [] when the eyes aren't open."""
    px = im.load()
    w, h = im.size
    pts = []
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 200:
                continue
            H, S, V = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if S > 0.45 and V > 0.45 and 0.47 < H < 0.6:
                pts.append((x, y))
    if len(pts) < 200:
        return []
    mid = (min(p[0] for p in pts) + max(p[0] for p in pts)) / 2
    out = []
    for side in ([p for p in pts if p[0] < mid], [p for p in pts if p[0] >= mid]):
        if len(side) < 60:
            return []
        out.append((min(p[0] for p in side), min(p[1] for p in side), max(p[0] for p in side), max(p[1] for p in side)))
    return out


def close_eyes(im, happy):
    im = im.copy()
    boxes = eyes(im)
    if not boxes:
        return im
    px = im.load()
    d = ImageDraw.Draw(im)
    for x0, y0, x1, y1 in boxes:
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        r = max(x1 - x0, y1 - y0) / 2 + 2.5
        # the darker socket ring just above the iris is the "eyelid" colour
        lid = px[int(cx), int(cy - r - 3)]
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=lid)
        lw = max(4, round(r / 4.2))
        if happy:  # ^ ^
            d.arc((cx - r * 0.85, cy - r * 0.35, cx + r * 0.85, cy + r * 1.2), 200, 340, fill=(28, 28, 32, 255), width=lw)
        else:  # relaxed closed lids
            d.arc((cx - r * 0.85, cy - r * 0.9, cx + r * 0.85, cy + r * 0.45), 20, 160, fill=(28, 28, 32, 255), width=lw)
    return im


INK = (28, 28, 32, 255)


def face(im, kind):
    """Expressions drawn onto the open-eyed idle face: sad, mad (brows), love (heart eyes), star (star eyes)."""
    im = im.copy()
    boxes = eyes(im)
    if not boxes:
        return im
    px = im.load()
    d = ImageDraw.Draw(im)
    for side, (x0, y0, x1, y1) in enumerate(boxes):
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        r = max(x1 - x0, y1 - y0) / 2 + 2.5
        lw = max(4, round(r / 4.2))
        inner = 1 if side == 0 else -1  # which way the nose is
        top = cy - r - 4
        if kind in ('sad', 'mad'):
            lift = r * 0.5 if kind == 'sad' else -r * 0.15
            drop = 0 if kind == 'sad' else r * 0.45
            d.line((cx - inner * r * 0.95, top - drop * 0.2, cx + inner * r * 0.75, top - lift + drop), fill=INK, width=lw)
            if kind == 'sad':  # a little tear at the outer corner
                tx, ty = cx - inner * r * 0.75, cy + r * 0.55
                d.ellipse((tx - r * 0.22, ty, tx + r * 0.22, ty + r * 0.5), fill=(150, 175, 255, 255))
                d.polygon([(tx - r * 0.2, ty + r * 0.18), (tx + r * 0.2, ty + r * 0.18), (tx, ty - r * 0.3)], fill=(150, 175, 255, 255))
        else:
            lid = px[int(cx), int(cy - r - 3)]
            d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=lid)
            if kind == 'love':
                k = r * 0.95
                col = (255, 84, 128, 255)
                d.ellipse((cx - k, cy - k * 0.75, cx, cy + k * 0.2), fill=col)
                d.ellipse((cx, cy - k * 0.75, cx + k, cy + k * 0.2), fill=col)
                d.polygon([(cx - k * 0.97, cy - k * 0.15), (cx + k * 0.97, cy - k * 0.15), (cx, cy + k * 0.95)], fill=col)
                d.ellipse((cx - k * 0.62, cy - k * 0.5, cx - k * 0.3, cy - k * 0.18), fill=(255, 255, 255, 230))
            else:
                import math
                pts = []
                for i in range(10):
                    a = -math.pi / 2 + i * math.pi / 5
                    rr = r * 1.05 if i % 2 == 0 else r * 0.45
                    pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
                d.polygon(pts, fill=(255, 205, 60, 255), outline=INK)
                d.line(pts + [pts[0]], fill=INK, width=max(2, lw // 2))
    return im


def strip(imgs, name):
    out = Image.new('RGBA', (SIZE[0] * len(imgs), SIZE[1]))
    for i, im in enumerate(imgs):
        out.alpha_composite(im.crop(CROP).resize(SIZE, Image.LANCZOS), (i * SIZE[0], 0))
    path = os.path.join(OUT, f'{name}.webp')
    out.save(path, 'WEBP', quality=86, method=6)
    print(f'{name:12} {len(imgs):2} frames  {os.path.getsize(path) // 1024} KB')


os.makedirs(OUT, exist_ok=True)
for key, name in ANIMS.items():
    strip(frames(name), key)
strip([close_eyes(f, False) for f in frames('Idle')], 'idle-blink')
strip([close_eyes(f, True) for f in frames('Idle')], 'idle-happy')
strip([close_eyes(f, False) for f in frames('Walk')], 'walk-blink')
for kind in ('sad', 'mad', 'love', 'star'):
    strip([face(f, kind) for f in frames('Idle')], f'idle-{kind}')
