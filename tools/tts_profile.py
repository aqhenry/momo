"""Build a reviewed per-adventure voice without replacing existing recordings."""
import concurrent.futures as cf
import fcntl
import hashlib
import json
import pathlib
import subprocess
import tempfile

from tts_build import ROOT, AUDIO, code_lines, level_lines
from tts_check import check
from tts_samples import api_key


def build(name):
    config = json.loads((ROOT / 'tools' / 'voices' / f'{name}.json').read_text())
    lines = code_lines()
    for level in config['levels']:
        lines += level_lines(json.loads((ROOT / 'levels' / level / 'level.json').read_text()))
    lines = list(dict.fromkeys(t for t in lines if t and t.strip()))
    ids = {t: hashlib.sha1(json.dumps([config['model'], config['voice'], config['instructions'],
                                     config.get('pronunciation', {}).get(t, t)], ensure_ascii=False).encode()).hexdigest()[:16]
           for t in lines}
    cache = ROOT / '.cache' / 'tts-profiles'
    cache.mkdir(parents=True, exist_ok=True)
    lock = (cache.parent / 'tts-build.lock').open('w')
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        raise SystemExit('Another TTS build is already running.')
    report_path = cache / f'{name}.json'
    report = json.loads(report_path.read_text()) if report_path.exists() else {}
    review = ROOT / 'samples' / f'tts-{name}-review'
    review.mkdir(parents=True, exist_ok=True)
    key = api_key()

    def record(text):
        target = AUDIO / f'{ids[text]}.m4a'
        if target.exists() and report.get(text, {}).get('id') == ids[text] and report[text].get('ok'):
            return report[text]
        attempts = []
        with tempfile.TemporaryDirectory() as tmp:
            raw = pathlib.Path(tmp) / 'clip.mp3'
            headers = pathlib.Path(tmp) / 'headers'
            for attempt in range(1, 4):
                body = {k: config[k] for k in ('model', 'voice', 'instructions')}
                body.update(input=config.get('pronunciation', {}).get(text, text), response_format='mp3')
                p = subprocess.run(['curl', '-sS', '--max-time', '180', '-D', str(headers), '-o', str(raw),
                                    '-w', '%{http_code}', 'https://openrouter.ai/api/v1/audio/speech',
                                    '-H', f'Authorization: Bearer {key}', '-H', 'Content-Type: application/json',
                                    '-H', 'X-Title: momo-jqx-approved-voice', '--data-binary', '@-'],
                                   input=json.dumps(body).encode(), capture_output=True)
                if p.returncode or p.stdout != b'200' or raw.stat().st_size < 1000:
                    attempts.append({'error': f'HTTP {p.stdout.decode()} {raw.read_text(errors="replace")[:250]}'})
                    continue
                generation = next((s.split(':', 1)[1].strip() for s in headers.read_text().splitlines()
                                   if s.lower().startswith('x-generation-id:')), None)
                verdicts = []
                for model in config['check_models']:
                    try:
                        verdict = check(key, text, raw, model=model)
                    except Exception as error:
                        verdict = {'ok': False, 'problems': f'Checker unavailable: {error}'}
                    verdicts.append({'model': model, **verdict})
                    if verdict.get('ok'):
                        break
                attempts.append({'generation': generation, 'checks': verdicts})
                if any(v.get('ok') for v in verdicts):
                    subprocess.run(['afconvert', str(raw), str(target), '-f', 'm4af', '-d', 'aac',
                                    '-b', '48000', '-c', '1'], check=True, capture_output=True)
                    return {'ok': True, 'id': ids[text], 'attempts': attempts}
                (review / f'{ids[text]}-{attempt}.mp3').write_bytes(raw.read_bytes())
                print(f'  retry {attempt}: {text} -- {verdicts}', flush=True)
        return {'ok': False, 'id': ids[text], 'attempts': attempts}

    todo = [t for t in lines if not ((AUDIO / f'{ids[t]}.m4a').exists()
            and report.get(t, {}).get('ok') and report[t].get('id') == ids[t])]
    print(f'{name}: {len(lines)} lines, {len(todo)} to record', flush=True)
    with cf.ThreadPoolExecutor(5) as pool:
        jobs = {pool.submit(record, t): t for t in todo}
        for n, future in enumerate(cf.as_completed(jobs), 1):
            text = jobs[future]
            try:
                report[text] = future.result()
            except Exception as error:
                report[text] = {'ok': False, 'error': str(error)}
            report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
            print(f'[{n}/{len(todo)}] {"OK" if report[text]["ok"] else "FAIL"} {text}', flush=True)
    failed = [t for t in lines if not report.get(t, {}).get('ok') or not (AUDIO / f'{ids[t]}.m4a').exists()]
    if failed:
        raise SystemExit(f'{len(failed)} unverified clips; profile manifest was not changed. See {report_path}')
    output = AUDIO / 'profiles' / f'{name}.json'
    output.parent.mkdir(exist_ok=True)
    pending = output.with_suffix('.tmp')
    pending.write_text(json.dumps(ids, ensure_ascii=False, indent=2) + '\n')
    pending.replace(output)
    print(f'Published {len(ids)} verified clips to {output}', flush=True)
