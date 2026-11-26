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


@pic
def bun():
    p = Pic()
    p.ellipse((3, 10, 28, 28), '#f6f0e2')
    p.ellipse((9, 6, 22, 18), '#fbf7ee')
    for a, b in (((16, 7), (16, 14)), ((12, 9), (15, 14)), ((20, 9), (17, 14))):
        p.line([a, b], '#d9ccb0')
    return p.finish()


@pic
def dolphin():
    p = Pic()
    p.ellipse((3, 10, 25, 22), '#6aa8d8')
    p.poly([(22, 13), (30, 8), (29, 17), (24, 18)], '#6aa8d8')     # tail
    p.poly([(11, 11), (15, 4), (17, 11)], '#4f8fc4')                 # fin
    p.poly([(1, 16), (5, 14), (5, 18)], '#6aa8d8')                   # nose
    p.ellipse((5, 16, 18, 22), '#dceefa', bevel=False)               # belly
    p.px([(7, 14)], '#1d2a3a')
    return p.finish()


@pic
def lollipop():
    p = Pic()
    p.rect((15, 17, 16, 30), '#f4f4f4')
    p.ellipse((6, 2, 25, 21), '#ff6f9a')
    for box in ((9, 5, 22, 18), (12, 8, 19, 15)):
        p.ellipse(box, '#ffe3ec' if box[0] == 9 else '#ff6f9a', bevel=False)
    p.ellipse((14, 10, 17, 13), '#ffe3ec', bevel=False)
    return p.finish()


@pic
def peach():
    p = Pic()
    p.ellipse((5, 8, 27, 29), '#ffb38a')
    p.ellipse((7, 10, 18, 24), '#ff8f8f', bevel=False)
    p.line([(16, 10), (14, 26)], '#e8786a')
    p.poly([(16, 9), (22, 2), (25, 6)], '#5aaa3a')
    p.poly([(15, 9), (9, 3), (8, 7)], '#4f9a30')
    return p.finish()


@pic
def mushroom():
    p = Pic()
    p.rect((12, 16, 19, 28), '#f4ecd8')
    p.layer(lambda d, c: d.pieslice((2, 3, 29, 28), 180, 360, fill=c), '#e0353a')
    for box in ((7, 8, 11, 12), (15, 5, 18, 8), (21, 9, 25, 13)):
        p.ellipse(box, '#ffffff', bevel=False)
    return p.finish()


@pic
def tomato():
    p = Pic()
    p.ellipse((3, 7, 28, 29), '#e33a2e')
    p.ellipse((7, 11, 12, 16), '#ff8a7a', bevel=False)
    p.poly([(16, 4), (11, 9), (16, 8), (21, 9)], '#4f9a30')
    p.line([(16, 2), (16, 6)], '#3f7a25', width=2)
    return p.finish()


@pic
def bird():
    p = Pic()
    p.ellipse((5, 10, 24, 26), '#5ab0e8')
    p.ellipse((16, 5, 27, 16), '#5ab0e8')
    p.poly([(27, 9), (31, 11), (27, 13)], '#ffb020')
    p.poly([(6, 14), (15, 16), (8, 22)], '#3f8fc8')
    p.poly([(3, 18), (7, 15), (7, 22)], '#3f8fc8')
    p.px([(23, 9)], '#1d2a3a')
    return p.finish()


@pic
def banana():
    p = Pic()
    p.layer(lambda d, c: d.arc((3, 0, 29, 26), 30, 160, fill=c, width=7), '#ffd23a')
    p.line([(26, 16), (29, 13)], '#6a4a20', width=2)
    p.px([(4, 16), (4, 17)], '#6a4a20')
    return p.finish()


@pic
def books():
    p = Pic()
    for k, (col, y) in enumerate((('#d6343a', 22), ('#3f8fd8', 16), ('#4f9a30', 10))):
        x0 = 4 + (k % 2) * 2
        p.rect((x0, y, x0 + 22, y + 5), col)
        p.rect((x0 + 2, y + 1, x0 + 20, y + 1), '#f8f4e8', bevel=False)
    return p.finish()


@pic
def schoolbag():
    p = Pic()
    p.layer(lambda d, c: d.rounded_rectangle((5, 8, 26, 29), radius=5, fill=c), '#e0353a')
    p.layer(lambda d, c: d.rounded_rectangle((8, 18, 23, 27), radius=3, fill=c), '#c22a30')
    p.layer(lambda d, c: d.arc((10, 2, 21, 14), 180, 360, fill=c, width=3), '#7a2020')
    p.rect((14, 21, 17, 23), '#ffd23a')
    return p.finish()


# ---------- English unit 5: animals and people ----------
def heart(p, x, y, col='#ff4f7a'):
    p.px([(x, y), (x + 2, y), (x - 1, y + 1), (x, y + 1), (x + 1, y + 1), (x + 2, y + 1), (x + 3, y + 1),
          (x, y + 2), (x + 1, y + 2), (x + 2, y + 2), (x + 1, y + 3)], col)


@pic
def dog():
    p = Pic()
    p.poly([(22, 22), (28, 15), (29, 17), (24, 25)], '#d89a52')                 # tail
    p.ellipse((9, 15, 23, 29), '#e2a862')                                        # body
    p.ellipse((12, 19, 20, 28), '#fbf1de', bevel=False)                          # chest
    p.ellipse((8, 3, 24, 18), '#e2a862')                                         # head
    p.ellipse((5, 5, 11, 16), '#8a5a2e')                                         # floppy ears
    p.ellipse((21, 5, 27, 16), '#8a5a2e')
    p.ellipse((12, 10, 20, 17), '#fbf1de', bevel=False)                          # muzzle
    p.rect((15, 11, 17, 12), '#2a1d18', bevel=False)                             # nose
    p.px([(12, 8), (19, 8), (12, 9), (19, 9)], '#2a1d18')                        # eyes
    p.px([(15, 14), (16, 14), (16, 15)], '#ff7a8a')                              # tongue
    p.rect((10, 26, 13, 28), '#e2a862'); p.rect((19, 26, 22, 28), '#e2a862')     # paws
    return p.finish()


@pic
def hamster():
    p = Pic()
    p.ellipse((5, 8, 27, 29), '#e0a060')                                         # round body
    p.ellipse((10, 15, 22, 28), '#fbf1de', bevel=False)                          # belly
    p.ellipse((6, 5, 12, 11), '#e0a060'); p.ellipse((20, 5, 26, 11), '#e0a060')  # ears
    p.ellipse((8, 7, 10, 9), '#ffb0b8', bevel=False); p.ellipse((22, 7, 24, 9), '#ffb0b8', bevel=False)
    p.ellipse((7, 13, 12, 17), '#ffb0a0', bevel=False); p.ellipse((20, 13, 25, 17), '#ffb0a0', bevel=False)  # cheeks
    p.px([(11, 12), (20, 12), (11, 13), (20, 13)], '#2a1d18')                    # eyes
    p.px([(15, 14), (16, 14)], '#ff7a8a')                                        # nose
    p.rect((14, 18, 17, 22), '#7cc04a')                                          # green snack in its paws
    p.rect((12, 19, 13, 21), '#f0c8a0', bevel=False); p.rect((18, 19, 19, 21), '#f0c8a0', bevel=False)
    return p.finish()


@pic
def tiger():
    p = Pic()
    p.ellipse((4, 4, 11, 11), '#f08a24'); p.ellipse((21, 4, 28, 11), '#f08a24')  # ears
    p.ellipse((6, 6, 9, 9), '#fbf1de', bevel=False); p.ellipse((23, 6, 26, 9), '#fbf1de', bevel=False)
    p.ellipse((4, 6, 28, 29), '#f08a24')                                         # big head
    for pts in (((15, 7), (15, 11)), ((17, 7), (17, 11)), ((12, 8), (13, 11)), ((20, 8), (19, 11)),
                ((5, 15), (9, 16)), ((5, 19), (9, 19)), ((27, 15), (23, 16)), ((27, 19), (23, 19))):
        p.line(list(pts), '#2a1d18', width=1)                                    # stripes
    p.ellipse((9, 17, 23, 28), '#fbf1de', bevel=False)                           # white muzzle
    p.px([(11, 14), (12, 14), (20, 14), (21, 14)], '#3a8a2a')                    # green eyes
    p.px([(11, 15), (12, 15), (20, 15), (21, 15)], '#2a1d18')
    p.rect((14, 18, 18, 19), '#d0505a', bevel=False)                             # nose
    p.line([(16, 20), (16, 22)], '#2a1d18'); p.line([(13, 23), (16, 22), (19, 23)], '#2a1d18')
    return p.finish()


@pic
def snake():
    p = Pic()
    p.layer(lambda d, c: d.arc((6, 14, 26, 29), 200, 520, fill=c, width=5), '#5ab43a')   # coil
    p.layer(lambda d, c: d.arc((10, 4, 22, 20), 90, 300, fill=c, width=5), '#5ab43a')    # neck
    p.ellipse((14, 2, 27, 11), '#6ac44a')                                        # head
    p.ellipse((17, 1, 21, 5), '#ffffff'); p.ellipse((22, 1, 26, 5), '#ffffff')   # eyes
    p.px([(19, 3), (24, 3)], '#2a1d18')
    p.line([(27, 8), (30, 8)], '#e0303a'); p.px([(31, 7), (31, 9)], '#e0303a')   # tongue
    for x, y in ((8, 23), (12, 27), (19, 27), (24, 22), (11, 13)):
        p.px([(x, y), (x + 1, y)], '#c8e85a')                                    # spots
    return p.finish()


def crown(p, x0, y0, w, col='#ffcf30'):
    p.poly([(x0, y0 + 5), (x0, y0 + 1), (x0 + w // 4, y0 + 3), (x0 + w // 2, y0), (x0 + 3 * w // 4, y0 + 3), (x0 + w, y0 + 1), (x0 + w, y0 + 5)], col)
    p.px([(x0 + w // 2, y0 + 3)], '#e0303a')
    p.px([(x0 + 2, y0 + 4), (x0 + w - 2, y0 + 4)], '#3f8fd8')


@pic
def king():
    img = strip_outline(library('kid'))

    def rule(x, y, c):
        h, s, v = hsv(c)
        if y > 13 and 0.5 < h < 0.72 and s > 0.35:
            return shade((214, 40, 48), 0.55 + v * 0.5)                          # blue shirt -> red robe
        return None
    p = Pic(recolor(img, rule))
    p.rect((9, 13, 22, 15), '#f6f2ea')                                           # fur collar
    p.px([(12, 14), (16, 14), (20, 14)], '#2a1d18')
    p.line([(26, 6), (26, 28)], '#e8b020', width=2)                              # sceptre
    p.ellipse((24, 3, 28, 7), '#e0303a')
    crown(p, 10, 0, 11)
    return p.finish()


@pic
def queen():
    img = strip_outline(library('girl'))

    def rule(x, y, c):
        h, s, v = hsv(c)
        if y > 15 and (h > 0.85 or h < 0.04) and s > 0.2 and v > 0.5:
            return shade((150, 60, 170), 0.6 + v * 0.45)                         # pink dress -> purple gown
        return None
    p = Pic(recolor(img, rule))
    p.poly([(9, 26), (22, 26), (25, 30), (6, 30)], '#9a3cb0')                    # long skirt
    p.rect((10, 22, 21, 23), '#ffcf30', bevel=False)                             # gold belt
    crown(p, 10, 0, 11)
    return p.finish()


@pic
def baby():
    p = Pic()
    p.ellipse((9, 18, 22, 29), '#ffffff')                                        # nappy / body
    p.ellipse((5, 18, 10, 23), '#f6c9a0'); p.ellipse((21, 18, 26, 23), '#f6c9a0')  # arms
    p.ellipse((10, 26, 15, 31), '#f6c9a0'); p.ellipse((17, 26, 22, 31), '#f6c9a0')  # legs
    p.ellipse((7, 3, 24, 20), '#f8d2ae')                                         # big head
    p.poly([(14, 4), (16, 0), (19, 4)], '#8a5a2e')                               # curl of hair
    p.px([(12, 11), (19, 11), (12, 12), (19, 12)], '#2a1d18')
    p.px([(10, 14), (21, 14)], '#ff9a9a')
    p.line([(14, 15), (15, 16), (16, 16), (17, 15)], '#c04050')
    p.rect((25, 14, 29, 23), '#e8f4ff'); p.rect((26, 11, 28, 13), '#f0a040')     # bottle
    p.rect((25, 18, 29, 23), '#fffbe8', bevel=False)
    return p.finish()


@pic
def garden():
    p = Pic()
    p.rect((0, 22, 31, 31), '#5aaa3a')                                           # grass
    p.ellipse((22, 1, 30, 9), '#ffd23a')                                         # sun
    for x in range(1, 31, 5):
        p.poly([(x, 22), (x, 13), (x + 1, 11), (x + 3, 13), (x + 3, 22)], '#c08a50')   # fence pickets
    p.rect((0, 15, 31, 16), '#a06a38')
    for x, col in ((4, '#e0303a'), (12, '#ffd23a'), (20, '#ff6fa0'), (27, '#e0303a')):
        p.line([(x, 21), (x, 26)], '#3f7a25')
        p.ellipse((x - 2, 17, x + 2, 21), col)                                   # flowers
    for x in (8, 16, 24):
        p.poly([(x - 1, 27), (x + 2, 27), (x, 31)], '#ff8a20')                   # carrots in the soil
        p.px([(x, 26), (x + 1, 25)], '#4f9a30')
    return p.finish()


@pic
def careful():
    p = Pic()
    p.poly([(16, 2), (30, 28), (2, 28)], '#ffcf30')                              # yellow warning sign
    p.poly([(16, 6), (27, 26), (5, 26)], '#2a1d18', bevel=False)
    p.poly([(16, 9), (25, 25), (7, 25)], '#ffcf30', bevel=False)
    p.rect((15, 12, 17, 20), '#2a1d18', bevel=False)                             # !
    p.rect((15, 22, 17, 23), '#2a1d18', bevel=False)
    return p.finish()


@pic
def lovely():
    img = strip_outline(library('cat'))

    def rule(x, y, c):
        h, s, v = hsv(c)
        if s > 0.3 and 0.03 < h < 0.15:
            return shade((250, 214, 160), 0.7 + v * 0.35)                        # orange -> cream
        return None
    p = Pic(recolor(img, rule))
    p.ellipse((11, 11, 14, 13), '#ff8aa8', bevel=False); p.ellipse((21, 11, 24, 13), '#ff8aa8', bevel=False)  # blush
    heart(p, 2, 3); heart(p, 26, 2, '#ff6f9a'); heart(p, 27, 20, '#ff4f7a')
    return p.finish()


def kid_scene(dx, extra):
    base = strip_outline(library('kid'))
    img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    img.alpha_composite(base, (dx, 0))
    p = Pic(img)
    extra(p)
    return p.finish()


@pic
def fishing():
    def extra(p):
        p.rect((20, 25, 31, 31), '#4fa0e0')                                      # pond
        p.line([(22, 26), (25, 26)], '#bfe6ff'); p.line([(27, 29), (30, 29)], '#bfe6ff')
        p.line([(17, 17), (29, 2)], '#3f6fd0', width=2)                          # rod
        p.line([(30, 2), (30, 23)], '#f4f4f4')                                   # line
        p.ellipse((27, 22, 31, 25), '#e0303a')                                   # little red fish on the hook
        p.layer(lambda d, c: d.pieslice((5, 0, 22, 12), 180, 360, fill=c), '#ffd23a')   # sun hat
        p.rect((4, 5, 23, 6), '#ffd23a')
    return kid_scene(-4, extra)


@pic
def put():
    def extra(p):
        p.layer(lambda d, c: d.rounded_rectangle((19, 17, 30, 30), radius=3, fill=c), '#5aaa5a')   # bag
        p.layer(lambda d, c: d.arc((21, 12, 28, 21), 180, 360, fill=c, width=2), '#2f6a30')
        p.rect((23, 22, 26, 23), '#ffd23a')
        p.rect((17, 9, 23, 16), '#e0303a')                                       # book going in
        p.rect((18, 10, 22, 10), '#ffd0d0', bevel=False)
        p.line([(24, 9), (25, 12)], '#2a1d18'); p.px([(24, 12), (26, 11)], '#2a1d18')   # little arrow
    return kid_scene(-6, extra)


@pic
def animals():
    # four friends together: dog, cat, rabbit, bird at half size
    img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    for name, (x, y) in (('rabbit', (8, 0)), ('bird', (17, 3)), ('dog', (0, 14)), ('cat', (15, 14))):
        small = library(name).resize((17, 17), Image.NEAREST)
        img.alpha_composite(small, (x, y))
    return img


# ---------- 雪地里的小画家 / 秋天 ----------
@pic
def duck():
    p = Pic()
    p.ellipse((5, 14, 26, 28), '#ffd23a')                                        # body
    p.poly([(5, 18), (1, 14), (6, 15)], '#ffd23a')                               # tail
    p.ellipse((15, 4, 27, 16), '#ffd23a')                                        # head
    p.ellipse((9, 17, 19, 24), '#f2b820', bevel=False)                           # wing
    p.rect((26, 10, 31, 12), '#ff8a20')                                          # bill
    p.px([(22, 8), (22, 9)], '#2a1d18')
    p.rect((11, 28, 13, 30), '#ff8a20'); p.rect((18, 28, 20, 30), '#ff8a20')     # feet
    return p.finish()


@pic
def bamboo_leaf():
    # three narrow leaves from one point, like a chick's footprint in the snow
    p = Pic()
    p.line([(16, 30), (16, 22)], '#5a8a30', width=2)
    for pts in ([(16, 22), (12, 14), (6, 3), (9, 13)], [(16, 22), (18, 12), (16, 1), (14, 12)], [(16, 22), (21, 14), (27, 4), (23, 15)]):
        p.poly(pts, '#5aaa3a')
    return p.finish()


@pic
def plum_flower():
    # five round petals, like a puppy's paw print
    p = Pic()
    for cx, cy in ((16, 7), (25, 13), (22, 24), (10, 24), (7, 13)):
        p.ellipse((cx - 6, cy - 6, cx + 6, cy + 6), '#ff6f9a')
    p.ellipse((12, 12, 20, 20), '#ffd23a')
    p.px([(16, 14), (14, 16), (18, 16)], '#c06a10')
    return p.finish()


@pic
def maple_leaf():
    p = Pic()
    p.poly([(16, 1), (19, 9), (26, 5), (24, 13), (31, 14), (25, 19), (27, 24), (19, 22), (17, 27),
            (15, 27), (13, 22), (5, 24), (7, 19), (1, 14), (8, 13), (6, 5), (13, 9)], '#e8502a')
    p.line([(16, 27), (16, 31)], '#8a3a1a', width=2)
    p.line([(16, 26), (16, 8)], '#b83a1a')
    p.line([(16, 18), (24, 12)], '#b83a1a'); p.line([(16, 18), (8, 12)], '#b83a1a')
    return p.finish()


@pic
def crescent():
    # a crescent moon, like a horse's hoof print
    p = Pic()
    p.layer(lambda d, c: (d.ellipse((3, 3, 29, 29), fill=c), d.ellipse((10, 0, 33, 26), fill=(0, 0, 0, 0))), '#ffd23a')
    return p.finish()


@pic
def geese():
    # wild geese flying south in a 人 shape
    p = Pic()
    for x, y in ((15, 4), (11, 9), (7, 14), (3, 19), (19, 9), (23, 14), (27, 19)):
        p.line([(x - 2, y + 1), (x, y), (x + 2, y + 1)], '#4a4a52', width=1)
        p.px([(x, y + 1)], '#4a4a52')
    p.px([(15, 3)], '#4a4a52')
    return p.finish()


def main():
    names = sys.argv[1:] or [n for n in DRAW if not (ART / f'{n}.png').exists()]
    for n in names:
        DRAW[n]().save(ART / f'{n}.png')
        print('drew', n)


if __name__ == '__main__':
    main()
