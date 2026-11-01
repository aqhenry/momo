"""Pre-record every line the game speaks.

Collects spoken text from js/phrases.js and every level in levels/index.json, records any line
that has no clip yet with Gemini TTS (via OpenRouter), has an audio model check that the clip says
the script correctly (pinyin and tones included), re-records failures, and writes:

    audio/<id>.m4a        one clip per line (id depends on text + voice, so changing VOICE re-records)
    audio/manifest.json   {text: id}, read by js/audio.js

    python3 tools/tts_build.py            # record what's missing
    python3 tools/tts_build.py --list     # just print the lines
    python3 tools/tts_build.py --no-check # skip the pronunciation check
    python3 tools/tts_build.py --fallback # MiniMax + homophones + Qwen audio check, missing lines only
    python3 tools/tts_build.py --profile jqx-b # approved Fish voice for its configured levels + shared feedback
"""
import concurrent.futures as cf
import fcntl
import hashlib
import json
import pathlib
import re
import subprocess
import sys
import tempfile

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from tts_samples import api_key, synth  # noqa: E402
from tts_check import check  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent
AUDIO = ROOT / 'audio'
REPORT = ROOT / 'samples' / 'tts-report.json'
FALLBACKS = AUDIO / 'fallbacks.json'

MODEL = 'google/gemini-3.8-flash-tts'
VOICE = 'Leda'
INSTRUCTIONS = '用温柔、亲切、清楚的幼儿园老师语气，说标准普通话，语速稍慢。'
ATTEMPTS = 5
CJK = re.compile(r'[一-鿿]')


def code_lines():
    src = (ROOT / 'js' / 'phrases.js').read_text()
    src = re.sub(r'//.*', '', src)
    cn = re.search(r'export const CN = (\[[^\]]*\]);', src)
    numbers = json.loads(cn.group(1).replace("'", '"'))[1:]
    src = src.replace(cn.group(0), '')
    lines = [s for s in re.findall(r"'([^'\n]+)'", src) if CJK.search(s)]
    for tpl in re.findall(r'`([^`]+)`', src):
        lines += [tpl.replace('${n}', n) for n in numbers]
    return lines


def level_lines(level):
    out = [level.get('intro'), *level.get('speech', {}).values()]
    for stage in level['stages']:
        for it in stage['items']:
            out += [it.get('say'), it.get('after'), it.get('hint'), it.get('read'), (it.get('prompt') or {}).get('picSay')]
            out += it.get('strokes', []) + it.get('pieces', [])
            if it.get('listen'):
                out += [o if isinstance(o, str) else o.get('say') or o.get('text') for o in it['options']]
            if it['type'] == 'read':   # tapping a character says its pinyin
                over = it.get('tapSay', {})
                out += [over.get(p, p) for p in ' '.join(it['py']).split()]
    return out


def all_lines():
    lines = code_lines()
    for meta in json.loads((ROOT / 'levels' / 'index.json').read_text()):
        level = json.loads((ROOT / meta['path']).read_text())
        if not level.get('audioProfile'):
            lines += level_lines(level)
    seen, out = set(), []
    for t in lines:
        if t and t.strip() and t not in seen:
            seen.add(t)
            out.append(t)
    return out


def clip_id(text):
    return hashlib.sha1(f'{MODEL}|{VOICE}|{INSTRUCTIONS}|{text}'.encode()).hexdigest()[:16]


def record(key, text, do_check, fallback=False):
    """Returns (ok, problems, attempts, id). Only verified clips are published."""
    problems = ''
    model, voice, spoken, extra, checker = MODEL, VOICE, text, {'instructions': INSTRUCTIONS}, None
    target_id = clip_id(text)
    if fallback:
        import tts_fallback as fb
        model, voice, spoken, extra, checker = fb.MODEL, fb.VOICE, fb.spoken_text(text), {'speed': fb.SPEED}, fb.CHECK_MODEL
        target_id = hashlib.sha1(f'{target_id}|{model}|{voice}|{extra}|{spoken}'.encode()).hexdigest()[:16]
    with tempfile.TemporaryDirectory() as tmp:
        for attempt in range(1, ATTEMPTS + 1):
            data, fmt = synth(key, model, voice, extra, spoken)
            source = pathlib.Path(tmp) / f'clip.{fmt}'
            source.write_bytes(data)
            ok = True
            if do_check:
                try:
                    verdict = check(key, text, source, **({'model': checker} if checker else {}))
                    ok, problems = bool(verdict.get('ok')), verdict.get('problems', '')
                except Exception as e:
                    # A failed checker cannot approve a new teaching clip.
                    ok, problems = False, f'check failed: {e}'
                if not ok:
                    print(f'  retry {attempt}/{ATTEMPTS}: {text} -- {problems}', flush=True)
            if ok:
                subprocess.run(['afconvert', str(source), str(AUDIO / f'{target_id}.m4a'),
                                '-f', 'm4af', '-d', 'aac', '-b', '48000', '-c', '1'], check=True)
                return ok, problems, attempt, target_id
        return False, problems, ATTEMPTS, None


def main():
    if '--profile' in sys.argv:
        from tts_profile import build
        build(sys.argv[sys.argv.index('--profile') + 1])
        return
    lines = all_lines()
    if '--list' in sys.argv:
        print('\n'.join(lines))
        print(f'{len(lines)} lines')
        return
    lock_path = ROOT / '.cache' / 'tts-build.lock'
    lock_path.parent.mkdir(exist_ok=True)
    lock = lock_path.open('w')
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        raise SystemExit('Another TTS build is already running. Wait for it to finish.')
    AUDIO.mkdir(exist_ok=True)
    fallbacks = json.loads(FALLBACKS.read_text()) if FALLBACKS.exists() else {}
    def available_id(text):
        primary = clip_id(text)
        if (AUDIO / f'{primary}.m4a').exists():
            return primary
        other = fallbacks.get(primary)
        return other if other and (AUDIO / f'{other}.m4a').exists() else None
    todo = [t for t in lines if not available_id(t)]
    print(f'{len(lines)} lines, {len(todo)} to record')
    key = api_key()
    report = json.loads(REPORT.read_text()) if REPORT.exists() else {}
    with cf.ThreadPoolExecutor(6 if '--fallback' in sys.argv else 3) as pool:
        futs = {pool.submit(record, key, t, '--no-check' not in sys.argv, '--fallback' in sys.argv): t for t in todo}
        for i, fut in enumerate(cf.as_completed(futs), 1):
            t = futs[fut]
            try:
                ok, problems, attempts, target_id = fut.result()
                report[t] = {'ok': ok, 'problems': problems, 'attempts': attempts}
                if ok and '--fallback' in sys.argv:
                    fallbacks[clip_id(t)] = target_id
                    FALLBACKS.write_text(json.dumps(fallbacks, indent=2) + '\n')
                REPORT.parent.mkdir(exist_ok=True)
                REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=1))
                mark = '✓' if ok else '✗'
                print(f'[{i}/{len(todo)}] {mark} {t}' + (f'  ({attempts}x)' if attempts > 1 else '') + ('' if ok else f'  -- {problems}'), flush=True)
            except Exception as e:
                print(f'[{i}/{len(todo)}] ERROR {t}: {e}', flush=True)

    manifest = {t: available_id(t) for t in lines if available_id(t)}
    (AUDIO / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=0))
    keep = set(manifest.values())
    for profile in (AUDIO / 'profiles').glob('*.json'):
        keep.update(json.loads(profile.read_text()).values())
    stale = [f for f in AUDIO.glob('*.m4a') if f.stem not in keep]
    for f in stale:
        f.unlink()
    if FALLBACKS.exists():
        FALLBACKS.write_text(json.dumps({k: v for k, v in fallbacks.items() if v in keep}, indent=2) + '\n')
    REPORT.parent.mkdir(exist_ok=True)
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=1))
    bad = [t for t in lines if report.get(t, {}).get('ok') is False]
    print(f'manifest: {len(manifest)}/{len(lines)} clips, removed {len(stale)} stale, {len(bad)} still failing check')
    for t in bad:
        print('  ✗', t, '--', report[t]['problems'])
    if len(manifest) != len(lines) or any(report.get(t, {}).get('ok') is False for t in todo):
        raise SystemExit(1)


if __name__ == '__main__':
    main()
