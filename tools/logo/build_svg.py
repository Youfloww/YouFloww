"""Rebuild ChatGPT concept 3 (tools/logo/chatgpt-concept.webp): a timer ring flowing into waves.

Usage: python3 build_svg.py out.svg [mask|apple]   (then rsvg-convert to PNG; og.html renders the share image)
"""
import math, sys

OUT = sys.argv[1]
MODE = sys.argv[2] if len(sys.argv) > 2 else ''
MASK = MODE == 'mask'  # full-bleed square, symbol inside the safe zone


def squircle(size=512, n=5.0, pts=96):
    a = size / 2
    p = []
    for i in range(pts):
        t = 2 * math.pi * i / pts
        c, s = math.cos(t), math.sin(t)
        x = a + a * math.copysign(abs(c) ** (2 / n), c)
        y = a + a * math.copysign(abs(s) ** (2 / n), s)
        p.append((x, y))
    # Catmull-Rom through the points -> smooth cubic path
    d = f'M{p[0][0]:.1f} {p[0][1]:.1f}'
    for i in range(pts):
        p0, p1, p2, p3 = p[i - 1], p[i], p[(i + 1) % pts], p[(i + 2) % pts]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d += f'C{c1[0]:.1f} {c1[1]:.1f} {c2[0]:.1f} {c2[1]:.1f} {p2[0]:.1f} {p2[1]:.1f}'
    return d + 'Z'


CX, CY, R = 222, 248, 125


def on_ring(deg):
    t = math.radians(deg)
    return CX + R * math.cos(t), CY + R * math.sin(t)


def f(p):
    return f'{p[0]:.1f} {p[1]:.1f}'


dot = on_ring(228.5)
top_a, top_b = on_ring(252), on_ring(365)  # over the top to 3 o'clock
left_a, left_b = on_ring(205), on_ring(150)  # down the left side, then away into the wave
tx, ty = math.sin(math.radians(150)), -math.cos(math.radians(150))  # tangent leaving the ring

ring_top = f'M{f(top_a)}A{R} {R} 0 0 1 {f(top_b)}'
ring_wave = (
    f'M{f(left_a)}A{R} {R} 0 0 0 {f(left_b)}'
    f'C{f((left_b[0] + 40 * tx, left_b[1] + 40 * ty))} 165 366 205 366'
    'C250 366 273 306 318 306'
    'C368 306 383 335 423 335'
)
wave2 = 'M240.8 401C265.8 383.4 286.5 354 318 354C368 354 383 383 423 383'  # wave 1, 48px lower

W = 34
sym = (
    f'<g fill="none" stroke="#fff" stroke-width="{W}" stroke-linecap="round" stroke-linejoin="round">'
    f'<path d="{ring_top}"/><path d="{ring_wave}"/><path d="{wave2}"/></g>'
    f'<circle cx="{dot[0]:.1f}" cy="{dot[1]:.1f}" r="24" fill="#fff"/>'
)
# centre the symbol's bounding box on the tile
place = 'translate(0 -6)'
if MASK:
    place = 'translate(256 256) scale(.8) translate(-260 -262)'

tile = '<rect width="512" height="512"/>' if MODE in ('mask', 'apple') else f'<path d="{squircle()}"/>'

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<defs>
<linearGradient id="b" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#FFC06C"/><stop offset=".5" stop-color="#FF76A9"/><stop offset="1" stop-color="#8A5CF6"/>
</linearGradient>
<radialGradient id="h" cx=".28" cy=".22" r=".7">
<stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
</radialGradient>
<filter id="s" x="-10%" y="-10%" width="120%" height="130%">
<feDropShadow dx="0" dy="6" stdDeviation="7" flood-color="#6a2a86" flood-opacity=".16"/>
</filter>
</defs>
<g fill="url(#b)">{tile}</g>
<g fill="url(#h)">{tile}</g>
<g filter="url(#s)" transform="{place}">{sym}</g>
</svg>
'''
open(OUT, 'w').write(svg)
print(OUT, len(svg), 'bytes')
