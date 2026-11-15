"""Clear, textbook-shaped tones for single pinyin syllables (the sound a tone question asks about).

In a full sentence the voice flattens a syllable's tone ("听一听：è。" — the 4th tone barely falls), so a level
with `"toneSounds": true` plays the syllable on its own instead: items name it in `sound`, and read/recite
taps use it too. For each syllable this tool
  1. records it alone with the level's approved voice (Fish, phoneme tag so it is read as pinyin),
  2. keeps the voice but replaces its pitch with an exaggerated textbook contour (WORLD vocoder):
       一声 55 high and flat · 二声 35 clear rise · 三声 214 dip then rise · 四声 51 steep fall,
  3. checks the result: measured pitch must follow the contour, and an audio model must hear the syllable,
  4. writes audio/<id>.m4a and audio/tones.json {"♪è": id} (js/audio.js plays "♪…" lines from it).

    .venv/bin/pip install pyworld soundfile numpy
    .venv/bin/python tools/tone_build.py           # syllables used by toneSounds levels
"""
import hashlib
import json
import pathlib
import re
import subprocess
import sys
import tempfile

import numpy as np
import pyworld as pw
import soundfile as sf

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from tts_samples import api_key  # noqa: E402
from tts_check import check  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent
AUDIO = ROOT / 'audio'
OUT = AUDIO / 'tones.json'
SHAPE = 'v1'   # bump to re-make every clip after changing the contours below

TONED = {c: (b, i + 1) for b, g in (('a', 'āáǎà'), ('o', 'ōóǒò'), ('e', 'ēéěè'), ('i', 'īíǐì'), ('u', 'ūúǔù'), ('ü', 'ǖǘǚǜ')) for i, c in enumerate(g)}

# Chao tone letters as (position 0..1, level 1..5); one level = 3 semitones, so 5→1 is a 12-semitone fall
CONTOUR = {1: [(0, 5), (1, 5)], 2: [(0, 3), (0.2, 3), (1, 5)], 3: [(0, 2), (0.45, 1), (0.6, 1), (1, 4)], 4: [(0, 5), (0.15, 5), (1, 1)]}
LENGTH = {1: 0.55, 2: 0.6, 3: 0.75, 4: 0.45}   # seconds of voiced sound
STEP = 3.0


def numeric(syl):
    """'è' -> ('e4', 4), 'mō' -> ('mo1', 1), 'ǚ' -> ('v3', 3)"""
    tone, out = 0, ''
    for c in syl:
        if c in TONED:
            base, tone = TONED[c]
            out += base
        else:
            out += c
    return out.replace('ü', 'v') + str(tone), tone


def collect():
    sounds = set()
    for meta in json.loads((ROOT / 'levels' / 'index.json').read_text()):
        level = json.loads((ROOT / meta['path']).read_text())
        if not level.get('toneSounds'):
            continue
        for stage in level['stages']:
            for it in stage['items']:
                if it.get('sound'):
                    sounds.add(it['sound'])
                if it['type'] in ('read', 'recite'):
                    sounds.update(t for t in ' '.join(it['py']).split() if numeric(t)[1])
    return sorted(sounds)


def synth(key, cfg, syl, path):
    body = {k: cfg[k] for k in ('model', 'voice', 'instructions')}
    body.update(input=f'<|phoneme_start|>{numeric(syl)[0]}<|phoneme_end|>', response_format='mp3')
    p = subprocess.run(['curl', '-sS', '--max-time', '120', '-o', str(path), '-w', '%{http_code}', 'https://openrouter.ai/api/v1/audio/speech',
                        '-H', f'Authorization: Bearer {key}', '-H', 'Content-Type: application/json', '--data-binary', '@-'],
                       input=json.dumps(body).encode(), capture_output=True)
    if p.stdout != b'200':
        raise RuntimeError(f'HTTP {p.stdout.decode()} {path.read_text(errors="replace")[:200]}')


def target_f0(n, tone, base):
    pts = CONTOUR[tone]
    xs = np.linspace(0, 1, n)
    levels = np.interp(xs, [p for p, _ in pts], [l for _, l in pts])
    return base * 2 ** ((levels - 3) * STEP / 12)


def reshape(src_wav, dst_wav, tone):
    x, fs = sf.read(src_wav)
    x = x.astype(np.float64)
    period = 5.0
    f0, sp, ap = pw.wav2world(x, fs, frame_period=period)
    voiced = np.nonzero(f0 > 0)[0]
    if len(voiced) < 10:
        raise RuntimeError('no voiced sound')
    # keep the longest voiced run (the vowel); anything before it (an initial like m, f, d) stays as it is
    runs = np.split(voiced, np.nonzero(np.diff(voiced) > 3)[0] + 1)
    run = max(runs, key=len)
    v0, v1 = run[0], run[-1] + 1
    energy = np.log(np.maximum(sp.sum(1), 1e-12))
    loud = np.nonzero(energy > energy.max() - 9)[0]
    start = max(0, min(v0, loud[0]) - 2)
    base = float(np.median(f0[v0:v1]))
    n = int(LENGTH[tone] * 1000 / period)
    idx = np.linspace(v0, v1 - 1, n)                       # stretch the vowel to the textbook length
    sp_v = np.array([sp[int(round(i))] for i in idx])
    ap_v = np.array([ap[int(round(i))] for i in idx])
    f_v = target_f0(n, tone, base)
    # a gentle fade over the last frames so the tone ends cleanly
    fade = np.ones(n)
    fade[-12:] = np.linspace(1, 0.25, 12)
    sp_v = sp_v * fade[:, None] ** 2
    sp_all = np.concatenate([sp[start:v0], sp_v])
    ap_all = np.concatenate([ap[start:v0], ap_v])
    f_all = np.concatenate([np.zeros(v0 - start), f_v])
    y = pw.synthesize(np.ascontiguousarray(f_all), np.ascontiguousarray(sp_all), np.ascontiguousarray(ap_all), fs, period)
    y = y / max(1e-6, np.abs(y).max()) * 0.7
    pad = np.zeros(int(0.12 * fs))
    sf.write(dst_wav, np.concatenate([pad, y, pad]), fs)
    return base


def measure(wav, tone):
    """Pitch contour of the result (semitones from its median) and whether it follows the tone."""
    x, fs = sf.read(wav)
    f0, _ = pw.harvest(x.astype(np.float64), fs, f0_floor=70, f0_ceil=600, frame_period=10)
    f = f0[f0 > 0]
    if len(f) < 8:
        return False, 'no pitch'
    f = f[int(len(f) * 0.1):int(len(f) * 0.92)]           # onset/offset frames are unreliable
    s = 12 * np.log2(f / np.median(f))
    s = s[np.abs(s) < 8]                                    # octave errors
    q = [float(np.mean(s[int(len(s) * a):max(int(len(s) * a) + 1, int(len(s) * b))])) for a, b in ((0, .2), (.4, .6), (.8, 1))]
    ok = {1: np.percentile(s, 90) - np.percentile(s, 10) < 2,
          2: q[2] - q[0] > 4,
          3: q[1] < q[0] - 1.5 and q[2] > q[1] + 3,
          4: q[0] - q[2] > 6}[tone]
    return bool(ok), ' '.join(f'{v:+.1f}' for v in q)


def main():
    cfg = json.loads((ROOT / 'tools' / 'voices' / 'jqx-b.json').read_text())
    key = api_key()
    sounds = collect()
    tones = json.loads(OUT.read_text()) if OUT.exists() else {}
    print(f'{len(sounds)} syllables')
    failed = []
    for syl in sounds:
        cid = hashlib.sha1(json.dumps([cfg['model'], cfg['voice'], SHAPE, syl], ensure_ascii=False).encode()).hexdigest()[:16]
        if tones.get('♪' + syl) == cid and (AUDIO / f'{cid}.m4a').exists():
            continue
        tone = numeric(syl)[1]
        done = False
        with tempfile.TemporaryDirectory() as tmp:
            tmp = pathlib.Path(tmp)
            for attempt in range(1, 4):
                try:
                    synth(key, cfg, syl, tmp / 'raw.mp3')
                    subprocess.run(['afconvert', str(tmp / 'raw.mp3'), str(tmp / 'raw.wav'), '-f', 'WAVE', '-d', 'LEI16@24000', '-c', '1'], check=True, capture_output=True)
                    reshape(tmp / 'raw.wav', tmp / 'out.wav', tone)
                except Exception as e:
                    print(f'  {syl} attempt {attempt}: {e}')
                    continue
                ok, shape = measure(tmp / 'out.wav', tone)
                if not ok:
                    print(f'  {syl} attempt {attempt}: pitch {shape} does not follow tone {tone}')
                    continue
                verdicts = []
                for model in cfg['check_models']:
                    try:
                        v = check(key, syl, tmp / 'out.wav', model=model)
                    except Exception as e:
                        v = {'ok': False, 'problems': str(e)}
                    verdicts.append(v)
                    if v.get('ok'):
                        break
                if not any(v.get('ok') for v in verdicts):
                    print(f'  {syl} attempt {attempt}: {[v.get("problems") for v in verdicts]}')
                    continue
                subprocess.run(['afconvert', str(tmp / 'out.wav'), str(AUDIO / f'{cid}.m4a'), '-f', 'm4af', '-d', 'aac', '-b', '48000', '-c', '1'], check=True)
                tones['♪' + syl] = cid
                print(f'OK {syl} tone {tone}  pitch {shape}', flush=True)
                done = True
                break
        if not done:
            failed.append(syl)
        OUT.write_text(json.dumps(tones, ensure_ascii=False, indent=0) + '\n')
    tones = {k: v for k, v in tones.items() if k[1:] in sounds}
    OUT.write_text(json.dumps(tones, ensure_ascii=False, indent=0) + '\n')
    print(f'{len(tones)}/{len(sounds)} clear tone clips' + (f'; failed: {" ".join(failed)}' if failed else ''))
    if failed:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
