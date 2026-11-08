"""Hand-drawn pixel pictures for the art library, for when image generation is unavailable.

Each picture is built from flat shapes (or from an existing library picture, recoloured / with extras),
then given the same finish as tools/art_build.py: a light/dark bevel per shape and a 1px dark outline.

    .venv/bin/python tools/art_draw.py            # draw every picture defined here that has no PNG yet
    .venv/bin/python tools/art_draw.py pear yurt  # (re)draw these
"""
import colorsys
import pathlib
import sys

from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parent.parent
ART = ROOT / 'art'
SIZE = 32
OUTLINE = (34, 26, 22, 255)


def hexc(c):
    c = c.lstrip('#')
    return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4)) + (255,)


def shade(col, k):
    return tuple(max(0, min(255, round(v * k))) for v in col[:3]) + (255,)


class Pic:
    def __init__(self, base=None):
        self.img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
        if base:
            self.img.alpha_composite(base)

    def layer(self, draw_fn, color, bevel=True):
        """Draw one flat shape on its own layer, bevel it, and put it on top."""
        lay = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
        draw_fn(ImageDraw.Draw(lay), hexc(color))
        if bevel:
            px = lay.load()
            on = lambda x, y: 0 <= x < SIZE and 0 <= y < SIZE and px[x, y][3] > 0
            out = lay.copy()
            po = out.load()
            for y in range(SIZE):
                for x in range(SIZE):
                    if not px[x, y][3]:
                        continue
                    if not on(x, y - 1) or not on(x - 1, y):
                        po[x, y] = shade(px[x, y], 1.18)
                    elif not on(x, y + 1) or not on(x + 1, y):
                        po[x, y] = shade(px[x, y], 0.78)
            lay = out
        self.img.alpha_composite(lay)
        return self

    # shape helpers: each takes a colour and draws one layer
    def rect(self, box, color, bevel=True):
        return self.layer(lambda d, c: d.rectangle(box, fill=c), color, bevel)

    def ellipse(self, box, color, bevel=True):
        return self.layer(lambda d, c: d.ellipse(box, fill=c), color, bevel)

    def poly(self, pts, color, bevel=True):
        return self.layer(lambda d, c: d.polygon(pts, fill=c), color, bevel)

    def line(self, pts, color, width=1, bevel=False):
        return self.layer(lambda d, c: d.line(pts, fill=c, width=width), color, bevel)

    def px(self, pts, color):
        p = self.img.load()
        for x, y in pts:
            p[x, y] = hexc(color)
        return self

    def finish(self):
        px = self.img.load()
        edge = [(x, y) for y in range(SIZE) for x in range(SIZE)
                if px[x, y][3] == 0 and any(0 <= x + dx < SIZE and 0 <= y + dy < SIZE and px[x + dx, y + dy][3]
                                            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
        for x, y in edge:
            px[x, y] = OUTLINE
        return self.img


def library(name):
    return Image.open(ART / f'{name}.png').convert('RGBA')


def strip_outline(img):
    """Remove the 1px outline so a recoloured / extended picture can be outlined again."""
    px = img.load()
    for y in range(SIZE):
        for x in range(SIZE):
            if px[x, y][3] and px[x, y][:3] == OUTLINE[:3]:
                px[x, y] = (0, 0, 0, 0)
    return img


def recolor(img, rule):
    px = img.load()
    for y in range(SIZE):
        for x in range(SIZE):
            r, g, b, a = px[x, y]
            if a:
                new = rule(x, y, (r, g, b))
                if new is not None:
                    px[x, y] = new
    return img


def hsv(c):
    return colorsys.rgb_to_hsv(*(v / 255 for v in c))


# ---------- pictures ----------
DRAW = {}


def pic(fn):
    DRAW[fn.__name__] = fn
    return fn


@pic
def pencil():
    p = Pic()
    p.line([(7, 25), (23, 9)], '#f2c230', width=5)
    p.line([(9, 26), (24, 11)], '#c99a1c', width=1)
    p.poly([(23, 5), (27, 4), (26, 8)], '#e9c79a')              # sharpened wood
    p.px([(26, 4), (27, 4), (27, 5)], '#3a3a3a')                 # graphite
    p.line([(5, 27), (7, 25)], '#c9c9c9', width=5)               # metal band
    p.ellipse((1, 25, 6, 30), '#f08aa8')                         # eraser
    return p.finish()


@pic
def eraser():
    p = Pic()
    p.rect((5, 11, 26, 22), '#f4f1ea')
    p.rect((13, 11, 26, 22), '#3f7fd8')
    p.rect((15, 14, 24, 19), '#9cc4f5', bevel=False)
    return p.finish()


@pic
def ruler():
    p = Pic()
    p.rect((2, 11, 29, 20), '#f2c94c')
    for x in range(4, 29, 2):
        p.line([(x, 12), (x, 13 if x % 4 else 15)], '#3a2c10')
    return p.finish()


@pic
def pencil_case():
    p = Pic()
    p.layer(lambda d, c: d.rounded_rectangle((2, 9, 29, 24), radius=4, fill=c), '#3a72c8')
    p.line([(4, 12), (27, 12)], '#c9c9c9')
    p.rect((25, 10, 28, 14), '#e0e0e0')                          # zip pull
    p.rect((7, 15, 15, 20), '#f7f7f0', bevel=False)              # name label
    p.line([(2, 23), (29, 23)], '#c8344a')
    return p.finish()


@pic
def soap():
    p = Pic()
    p.layer(lambda d, c: d.rounded_rectangle((4, 15, 27, 26), radius=3, fill=c), '#f29bb8')
    p.rect((8, 18, 23, 21), '#f8c4d6', bevel=False)
    for box in ((6, 8, 11, 13), (13, 4, 19, 10), (20, 9, 24, 13)):
        p.ellipse(box, '#e8f6ff')
    p.px([(8, 9), (15, 5), (21, 10)], '#ffffff')
    return p.finish()


@pic
def towel():
    p = Pic()
    p.rect((4, 8, 27, 25), '#3f8fd8')
    p.rect((4, 8, 27, 11), '#6fb0ee')                            # fold
    for y in (19, 22):
        p.line([(4, y), (27, y)], '#f4f4f4')
    return p.finish()


@pic
def pear():
    p = Pic()
    p.ellipse((7, 13, 25, 30), '#f2d23c')
    p.ellipse((10, 6, 21, 19), '#f2d23c')
    p.px([(12, 9), (12, 10), (11, 16), (11, 17)], '#fff2a0')
    p.line([(16, 2), (16, 6)], '#6a4020', width=2)
    p.poly([(18, 3), (24, 1), (21, 6)], '#5aaa3a')
    return p.finish()


@pic
def cabbage():
    p = Pic()
    p.ellipse((9, 9, 23, 30), '#f2f2e6')                         # white stem
    p.ellipse((7, 2, 25, 20), '#8fd060')                         # leafy top
    p.ellipse((5, 6, 14, 22), '#79bd4c')
    p.ellipse((18, 6, 27, 22), '#79bd4c')
    for x in (13, 16, 19):
        p.line([(x, 18), (16, 28)], '#d8e8c0')
    p.line([(16, 4), (16, 16)], '#b8e090')
    return p.finish()


@pic
def scissors():
    p = Pic()
    p.line([(9, 22), (26, 3)], '#c9ccd2', width=3)
    p.line([(22, 22), (5, 3)], '#aeb2ba', width=3)
    p.ellipse((3, 20, 13, 30), '#d6343a')
    p.ellipse((18, 20, 28, 30), '#d6343a')
    p.ellipse((6, 23, 10, 27), '#000000')
    p.ellipse((21, 23, 25, 27), '#000000')
    img = p.img
    px = img.load()
    for y in range(SIZE):                                        # finger holes see-through
        for x in range(SIZE):
            if px[x, y][:3] == (0, 0, 0) and px[x, y][3]:
                px[x, y] = (0, 0, 0, 0)
    return p.finish()


@pic
def willow():
    p = Pic()
    p.rect((14, 14, 17, 30), '#7a5230')
    p.ellipse((5, 2, 26, 16), '#5fae3c')
    for i, x in enumerate(range(5, 27, 2)):
        bottom = 22 + (i * 5) % 7
        p.line([(x, 10), (x + (1 if x > 16 else -1), bottom)], '#78c850' if i % 2 else '#4f9a30', width=1)
    p.px([(10, 5), (11, 4), (18, 4), (20, 6)], '#a8e080')
    return p.finish()


@pic
def yurt():
    p = Pic()
    p.rect((1, 27, 30, 29), '#6cc04a')
    p.rect((5, 17, 26, 27), '#f2efe6')
    p.layer(lambda d, c: d.pieslice((4, 6, 27, 29), 180, 360, fill=c), '#f8f6ef')
    p.line([(5, 17), (26, 17)], '#d6343a', width=2)
    p.line([(9, 11), (22, 11)], '#d6343a')
    p.rect((13, 20, 18, 27), '#9a5a2a')
    p.rect((14, 4, 17, 6), '#9a5a2a')
    return p.finish()


@pic
def grandma():
    # from the library's mum: grey hair with a bun, purple cardigan, no stray background bits
    img = strip_outline(library('mom'))

    def rule(x, y, c):
        h, s, v = hsv(c)
        if (x < 7 or x > 22) and y > 6:
            return (0, 0, 0, 0)                                  # leftover background shapes
        if v < 0.32:
            if y > 15 and (x < 11 or x > 20):
                return (0, 0, 0, 0)                              # short hair, not down to the shoulders
            return shade((196, 196, 204), 0.85 + v)              # hair -> grey
        if s > 0.45 and (h < 0.05 or h > 0.9) and y > 17:
            return shade((140, 92, 200), 0.6 + v * 0.5)          # top -> purple
        return None
    p = Pic(recolor(img, rule))
    p.ellipse((13, 2, 18, 6), '#c4c4cc')
    return p.finish()


def kid_with(extra):
    p = Pic(strip_outline(library('kid')))
    extra(p)
    return p.finish()


@pic
def kid_cold():
    def extra(p):
        p.layer(lambda d, c: d.pieslice((9, 1, 22, 14), 180, 360, fill=c), '#d6343a')   # woolly hat
        p.rect((9, 6, 22, 7), '#f4f4f4', bevel=False)
        p.ellipse((14, 0, 17, 3), '#f4f4f4')
        p.rect((10, 13, 21, 15), '#3f8fd8')                       # scarf
        p.rect((17, 15, 19, 19), '#3f8fd8')
        for x, y in ((3, 4), (27, 6), (4, 15), (28, 18), (2, 25), (27, 27)):
            p.px([(x, y), (x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)], '#cfeaff')
    return kid_with(extra)


@pic
def kid_hot():
    def extra(p):
        for a, b in (((22, 1), (31, 10)), ((22, 10), (31, 1)), ((26, 0), (26, 11)), ((21, 5), (31, 5))):
            p.line([a, b], '#ff9a20')                             # sun rays
        p.ellipse((23, 2, 29, 8), '#ffd23a')
        p.ellipse((5, 6, 8, 10), '#7fd0ff')                       # sweat drops
        p.ellipse((23, 11, 26, 15), '#7fd0ff')
        p.px([(11, 11), (20, 11)], '#ff7a6a')                     # red cheeks
    return kid_with(extra)


@pic
def kid_thirsty():
    def extra(p):
        p.line([(18, 11), (27, 2)], '#9fd8f5', width=4)            # water bottle at the mouth
        p.rect((25, 1, 28, 3), '#3f8fd8')
        p.line([(19, 10), (25, 4)], '#d8f2ff')
        p.ellipse((5, 4, 8, 8), '#7fd0ff')
    return kid_with(extra)


@pic
def kid_hungry():
    def extra(p):
        p.ellipse((20, 0, 31, 11), '#ffffff')                     # thought bubble with a rice bowl
        p.layer(lambda d, c: d.pieslice((21, 1, 30, 10), 0, 180, fill=c), '#3f8fd8')
        p.ellipse((22, 3, 29, 7), '#fffbe8')
        p.px([(22, 10), (21, 12)], '#ffffff')
        p.rect((12, 17, 19, 19), '#f2c094')                       # hands on the tummy
    return kid_with(extra)


def main():
    names = sys.argv[1:] or [n for n in DRAW if not (ART / f'{n}.png').exists()]
    for n in names:
        DRAW[n]().save(ART / f'{n}.png')
        print('drew', n)


if __name__ == '__main__':
    main()
