"""Subset the two Chinese fonts to the characters the game actually uses.

    fonts/pixel.woff2  Fusion Pixel 12px (OFL) — UI: titles, buttons, labels
    fonts/kai.woff2    LXGW WenKai Medium (OFL) — learning content: characters, poems, sentences

Source fonts live in .cache/fonts-src (gitignored; see README lines below to re-download).
Run after adding a level:   .venv/bin/python tools/font_build.py

Re-download sources if missing:
    gh release download -R TakWolf/fusion-pixel-font -p 'fusion-pixel-font-12px-proportional-ttf.woff2-*.zip'  (unzip, use the zh_hans file)
    gh release download -R lxgw/LxgwWenKai -p 'LXGWWenKai-Medium.ttf'
"""
import json
import pathlib
import re

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / '.cache' / 'fonts-src'
FONTS = {
    'pixel.woff2': SRC / 'fusion-pixel-12px-proportional-zh_hans.ttf.woff2',
    'kai.woff2': SRC / 'LXGWWenKai-Medium.ttf',
}


def strings(obj):
    if isinstance(obj, str):
        yield obj
    elif isinstance(obj, dict):
        for k, v in obj.items():
            yield k
            yield from strings(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from strings(v)


def used_chars():
    text = ''.join(chr(c) for c in range(0x20, 0x7f))
    text += '，。！？、：；“”‘’（）《》【】—…·～￥①②③④⑤０１２３４５６７８９'
    for f in [ROOT / 'index.html', *ROOT.glob('js/**/*.js')]:
        text += f.read_text()
    for f in ROOT.glob('levels/**/*.json'):
        text += ''.join(strings(json.loads(f.read_text())))
    return sorted(set(c for c in text if not c.isspace() or c == ' '))


def main():
    chars = used_chars()
    cjk = [c for c in chars if re.match(r'[一-鿿]', c)]
    for out, src in FONTS.items():
        font = TTFont(src)
        opts = subset.Options()
        opts.flavor = 'woff2'
        opts.layout_features = ['*']
        opts.name_IDs = ['*']
        opts.notdef_outline = True
        sub = subset.Subsetter(opts)
        sub.populate(text=''.join(chars))
        sub.subset(font)
        dest = ROOT / 'fonts' / out
        font.flavor = 'woff2'
        font.save(dest)
        print(f'{out}: {dest.stat().st_size // 1024} KB')
    print(f'{len(chars)} characters ({len(cjk)} hanzi)')


if __name__ == '__main__':
    main()
