"""Pixel-art picture library: generate once, reuse everywhere.

art/library.json lists every picture: {"apple": {"zh": "苹果", "prompt": "a shiny red apple with a green leaf"}}.
For each entry without a PNG yet, this asks an image model (via OpenRouter) for one object in a fixed pixel-art
style on a magenta background, then normalises it so every picture matches:
  remove background -> crop -> fit into a SIZE x SIZE grid (true pixels) -> shared palette limit -> 1px dark outline.

    .venv/bin/python tools/art_build.py              # make what's missing
    .venv/bin/python tools/art_build.py apple egg    # (re)make these
    .venv/bin/python tools/art_build.py --sheet      # contact sheet only (samples/art.html)
"""
import base64
import concurrent.futures as cf
import io
import json
import pathlib
import subprocess
import sys
import time

from PIL import Image

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from tts_samples import api_key  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent
ART = ROOT / 'art'
LIB = ART / 'library.json'
RAW = ROOT / 'samples' / 'art-raw'
MODEL = 'google/gemini-3.1-flash-image'
SIZE = 32          # pixels per side of every picture
COLORS = 24        # max colours per picture

STYLE = ('Pixel art game sprite, in the style of Minecraft item icons: exactly ONE {subject} (only one object, never a group or a pair), '
         'chunky square pixels on a 32x32 grid, bold dark outline, simple two-tone shading, bright cheerful colours, '
         'cute and simple shapes a 6-year-old recognises instantly, centered, facing the viewer, filling most of the frame. '
         'Plain solid magenta background (#FF00FF) everywhere around the object. No text, no ground, no shadow, no frame.')


def request(key, prompt, tries=4):
    body = {'model': MODEL, 'modalities': ['image', 'text'],
            'messages': [{'role': 'user', 'content': prompt}]}
    err = ''
    for attempt in range(tries):
        p = subprocess.run(
            ['curl', '-sS', '--max-time', '180', 'https://openrouter.ai/api/v1/chat/completions',
             '-H', f'Authorization: Bearer {key}', '-H', 'Content-Type: application/json', '--data-binary', '@-'],
            input=json.dumps(body).encode(), capture_output=True)
        try:
            msg = json.loads(p.stdout)['choices'][0]['message']
            url = msg['images'][0]['image_url']['url']
            return base64.b64decode(url.split(',', 1)[1])
        except Exception:
            err = p.stdout[:300].decode(errors='replace') or p.stderr[:200].decode(errors='replace')
            time.sleep(6 * (attempt + 1))   # rate limits: back off
    raise RuntimeError(err)


def is_bg(px):
    r, g, b = px[:3]
    magenta = r > 150 and b > 150 and g < 120 and abs(r - b) < 90
    blank = r > 236 and g > 236 and b > 236          # letterbox bars some outputs come with
    return magenta or blank


def clear_background(img):
    # flood fill from the border so white/pink parts inside the object survive
    w, h = img.size
    px = img.load()
    seen = set()
    stack = [(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)]
    while stack:
        x, y = stack.pop()
        if (x, y) in seen or not (0 <= x < w and 0 <= y < h):
            continue
        seen.add((x, y))
        if not is_bg(px[x, y]):
            continue
        px[x, y] = (0, 0, 0, 0)
        stack += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
    # leftover magenta specks inside (anti-aliasing halos)
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a and r > 150 and b > 150 and g < 120:
                px[x, y] = (0, 0, 0, 0)


def normalise(png_bytes):
    img = Image.open(io.BytesIO(png_bytes)).convert('RGBA')
    # 1. background -> transparent
    clear_background(img)
    # 2. crop to the object, pad to a square
    box = img.getbbox()
    img = img.crop(box)
    side = max(img.size)
    sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    sq.paste(img, ((side - img.width) // 2, (side - img.height) // 2))
    # 3. down to the pixel grid (leave a 2px margin for the outline)
    inner = SIZE - 4
    small = sq.resize((inner, inner), Image.Resampling.BOX)
    # hard alpha edges
    small.putdata([(r, g, b, 255) if a >= 110 else (0, 0, 0, 0) for r, g, b, a in small.getdata()])
    # 4. limit the palette so pixels read as flat colours
    rgb = small.convert('RGB').quantize(colors=COLORS, method=Image.Quantize.MEDIANCUT).convert('RGB')
    alpha = small.getchannel('A')
    small = Image.merge('RGBA', (*rgb.split(), alpha))
    out = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    out.paste(small, (2, 2))
    # 5. 1px dark outline around the shape
    px = out.load()
    edge = []
    for y in range(SIZE):
        for x in range(SIZE):
            if px[x, y][3] == 0 and any(0 <= x + dx < SIZE and 0 <= y + dy < SIZE and px[x + dx, y + dy][3] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                edge.append((x, y))
    for x, y in edge:
        px[x, y] = (34, 26, 22, 255)
    return out


def make(key, name, entry):
    prompt = STYLE.format(subject=entry['prompt'])
    raw = request(key, prompt)
    RAW.mkdir(parents=True, exist_ok=True)
    (RAW / f'{name}.png').write_bytes(raw)
    normalise(raw).save(ART / f'{name}.png', optimize=True)
    return name


def sheet(lib):
    cells = ''.join(
        f'<div><img src="../art/{n}.png"><img class="raw" src="art-raw/{n}.png"><b>{e["zh"]}</b><i>{n}</i></div>'
        for n, e in lib.items() if (ART / f'{n}.png').exists())
    (ROOT / 'samples').mkdir(exist_ok=True)
    (ROOT / 'samples' / 'art.html').write_text(f'''<!doctype html><meta charset="utf-8"><title>像素图库</title>
<style>body{{background:#c6c6c6;font:14px -apple-system,sans-serif;display:flex;flex-wrap:wrap;gap:14px;padding:16px}}
div{{display:flex;flex-direction:column;align-items:center;gap:4px;background:#fbf5e2;padding:10px;box-shadow:0 0 0 3px #3b2a14}}
img{{width:128px;height:128px;image-rendering:pixelated}}img.raw{{width:64px;height:64px;image-rendering:auto;opacity:.8}}i{{color:#888;font-size:11px}}</style>
{cells}''')


def main():
    lib = json.loads(LIB.read_text())
    if '--sheet' not in sys.argv:
        names = [a for a in sys.argv[1:] if not a.startswith('-')] or [n for n in lib if not (ART / f'{n}.png').exists()]
        key = api_key()
        with cf.ThreadPoolExecutor(3) as pool:
            futs = {pool.submit(make, key, n, lib[n]): n for n in names}
            for f in cf.as_completed(futs):
                try:
                    print('✓', f.result(), flush=True)
                except Exception as e:
                    print('✗', futs[f], e, flush=True)
    sheet(lib)
    print('sheet: samples/art.html')


if __name__ == '__main__':
    main()
