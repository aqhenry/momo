"""Generate side-by-side TTS samples from several OpenRouter speech models.

Reads OPENROUTER_API_KEY from the environment or from ./.env (never committed).
Writes samples/tts/*.mp3|wav and samples/tts/index.html to listen and compare.

    python3 tools/tts_samples.py
"""
import concurrent.futures as cf
import html
import json
import os
import pathlib
import struct
import subprocess
import time
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'samples' / 'tts'

TEACHER = '用温柔、亲切、清楚的幼儿园老师语气，说标准普通话，语速稍慢。'

# (label, model, voice, extra fields)
CANDIDATES = [
    ('MiniMax HD · 甜美女声', 'minimax/speech-2.8-hd', 'female-tianmei', {}),
    ('MiniMax HD · 女童', 'minimax/speech-2.8-hd', 'lovely_girl', {}),
    ('MiniMax HD · 少女', 'minimax/speech-2.8-hd', 'female-shaonv', {}),
    ('Seed Audio (字节)', 'bytedance-seed/seed-audio-1-0', None, {}),
    ('Fish Audio S2.1', 'fish-audio/s2.1-pro', None, {'instructions': TEACHER}),
    ('Gemini 3.8 Flash · Leda', 'google/gemini-3.8-flash-tts', 'Leda', {'instructions': TEACHER}),
]

SENTENCES = [
    ('题目', '这是小鹿的鹿。鹿，是第几声？选一选。'),
    ('表扬', '太棒了！公鸡打鸣，喔，喔，喔。'),
    ('声调口诀', '一声平，二声扬，三声拐弯，四声降。'),
    ('古诗', '远看山有色，近听水无声。春去花还在，人来鸟不惊。'),
    ('多音字', '打败哪吒三太子，乐得悟空笑哈哈。'),
    ('笔画', '九的第二笔是横折弯钩。'),
    ('直接读拼音', '声母 b，韵母 ā，拼成 bā。m，ú，mú。'),
    ('单个字母', 'a，o，e，i，u，ü。'),
]

# `python3 tools/tts_samples.py gemini`: Gemini voices on the pinyin cases the game needs.
if sys.argv[1:] == ['gemini']:
    OUT = ROOT / 'samples' / 'tts-gemini'
    CANDIDATES = [(f'Gemini Flash · {v}', 'google/gemini-3.8-flash-tts', v, {'instructions': TEACHER})
                  for v in ('Leda', 'Kore', 'Aoede', 'Zephyr', 'Sulafat', 'Puck')]
    CANDIDATES.append(('Gemini Flash Lite · Leda', 'google/gemini-3.8-flash-lite-tts', 'Leda', {'instructions': TEACHER}))
    SENTENCES = [
        ('单韵母', 'a，o，e，i，u，ü。'),
        ('声母', 'b，p，m，f，d，t，n，l。'),
        ('拼读', 'm，ú，mú。d，ǎ，dǎ。n，ǚ，nǚ。'),
        ('没有字的音节', 'l，ě，lě。'),
        ('四个声调', 'lū，lú，lǔ，lù。'),
        ('词语拼音', 'lǎ ba，lǐ fà，mǔ nǚ。'),
        ('字母藏在图里', '公鸡喔喔叫，o，o，o。'),
        ('表扬加讲解', '太棒了！女，女孩的女。n 和 ü 拼，小鱼的两点眼睛要保留。'),
    ]


def api_key():
    key = os.environ.get('OPENROUTER_API_KEY')
    env = ROOT / '.env'
    if not key and env.exists():
        for line in env.read_text().splitlines():
            if line.strip().startswith('OPENROUTER_API_KEY='):
                key = line.split('=', 1)[1].strip().strip('"\'')
    if not key:
        raise SystemExit('Put OPENROUTER_API_KEY=... in .env (it is gitignored) or export it.')
    return key


def pcm_to_wav(pcm, rate=24000):
    header = b'RIFF' + struct.pack('<I', 36 + len(pcm)) + b'WAVEfmt ' + struct.pack('<IHHIIHH', 16, 1, 1, rate, rate * 2, 2, 16)
    return header + b'data' + struct.pack('<I', len(pcm)) + pcm


def synth(key, model, voice, extra, text, tries=5):
    """POST via curl (more tolerant of long chunked audio streams than urllib)."""
    pcm_only = model.startswith('google/')
    body = {'model': model, 'input': text, 'response_format': 'pcm' if pcm_only else 'mp3', **extra}
    if voice:
        body['voice'] = voice
    err = ''
    for _ in range(tries):
        p = subprocess.run(
            ['curl', '-sS', '--max-time', '180', '-w', '\n%{http_code}', 'https://openrouter.ai/api/v1/audio/speech',
             '-H', f'Authorization: Bearer {key}', '-H', 'Content-Type: application/json',
             '-H', 'X-Title: momo-tts', '--data-binary', '@-'],
            input=json.dumps(body).encode(), capture_output=True)
        data, _, code = p.stdout.rpartition(b'\n')
        if p.returncode == 0 and code == b'200' and len(data) > 1000:
            return (pcm_to_wav(data), 'wav') if pcm_only else (data, 'mp3')
        err = f'{code.decode()} {data[:200].decode(errors="replace")} {p.stderr.decode()[:120]}'
        time.sleep(3)  # back off on resets / rate limits
    raise RuntimeError(err)


def cached_or_synth(ci, si, key, model, voice, extra, text):
    for ext in ('mp3', 'wav'):
        f = OUT / f'c{ci}_s{si}.{ext}'
        if f.exists():
            return f.read_bytes(), ext
    return synth(key, model, voice, extra, text)


def main():
    key = api_key()
    OUT.mkdir(parents=True, exist_ok=True)
    jobs = {}
    with cf.ThreadPoolExecutor(8) as pool:
        for ci, (label, model, voice, extra) in enumerate(CANDIDATES):
            for si, (_, text) in enumerate(SENTENCES):
                jobs[(ci, si)] = pool.submit(cached_or_synth, ci, si, key, model, voice, extra, text)
        results = {}
        for (ci, si), fut in jobs.items():
            try:
                data, ext = fut.result()
                name = f'c{ci}_s{si}.{ext}'
                (OUT / name).write_bytes(data)
                results[(ci, si)] = name
            except Exception as e:
                results[(ci, si)] = f'ERR {e}'

    blocks = []
    for si, (tag, text) in enumerate(SENTENCES):
        cards = []
        for ci, c in enumerate(CANDIDATES):
            r = results[(ci, si)]
            body = (f'<audio controls preload="none" src="{r}"></audio>' if not r.startswith('ERR')
                    else f'<div class="err">{html.escape(r)}</div>')
            cards.append(f'<div class="card"><b>{html.escape(c[0])}</b>{body}</div>')
        blocks.append(f'<section><h3>{tag}</h3><p>{html.escape(text)}</p><div class="grid">{"".join(cards)}</div></section>')
    (OUT / 'index.html').write_text(f'''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TTS 试听</title>
<style>body{{font-family:-apple-system,sans-serif;margin:16px;max-width:1100px}}section{{border-top:1px solid #ddd;padding:8px 0}}
h3{{margin:4px 0}}p{{font-size:20px;margin:4px 0 10px}}.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}}
.card{{border:1px solid #e3e3e3;border-radius:8px;padding:8px;font-size:13px;display:flex;flex-direction:column;gap:6px}}audio{{width:100%}}.err{{color:#b00;word-break:break-all}}</style>
<h2>TTS 试听对比</h2>{"".join(blocks)}''')
    errs = sum(1 for r in results.values() if r.startswith('ERR'))
    print(f'wrote {len(results) - errs} samples, {errs} errors -> {OUT / "index.html"}')
    for (ci, si), r in results.items():
        if r.startswith('ERR') and si == 0:
            print(CANDIDATES[ci][0], '→', r)


if __name__ == '__main__':
    main()
