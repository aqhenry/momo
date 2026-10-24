"""Ask an audio-capable model whether a clip says its script correctly (pinyin and tones included).

    python3 tools/tts_check.py "<script>" path/to/clip.(wav|mp3|m4a) [...]

Used by tts_build.py to re-record clips that come out wrong.
"""
import base64
import json
import pathlib
import subprocess
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from tts_samples import api_key  # noqa: E402

CHECK_MODEL = 'google/gemini-3.8-flash'

PROMPT = '''你是小学语文老师，正在检查给一年级小朋友用的配音。
台本：「{script}」
请仔细听音频，判断朗读是否和台本完全一致：
- 每个汉字都读了，读音正确（多音字按语境），没有漏读、多读、读错；
- 台本里的拼音（带声调的字母，例如 mú、lǎ ba、ü）要按拼音读出来，声母要读成呼读音（如 b 读 bō），声调必须正确，不能读成英文字母；
- 语气自然，没有奇怪的杂音或重复。
只输出 JSON：{{"ok": true/false, "problems": "有问题时用中文简短说明哪里不对"}}'''


def check(key, script, path):
    path = pathlib.Path(path)
    fmt = {'.wav': 'wav', '.mp3': 'mp3', '.m4a': 'm4a'}[path.suffix]
    body = {
        'model': CHECK_MODEL,
        'temperature': 0,
        'response_format': {'type': 'json_object'},
        'messages': [{'role': 'user', 'content': [
            {'type': 'text', 'text': PROMPT.format(script=script)},
            {'type': 'input_audio', 'input_audio': {'data': base64.b64encode(path.read_bytes()).decode(), 'format': fmt}},
        ]}],
    }
    p = subprocess.run(
        ['curl', '-sS', '--max-time', '120', 'https://openrouter.ai/api/v1/chat/completions',
         '-H', f'Authorization: Bearer {key}', '-H', 'Content-Type: application/json', '--data-binary', '@-'],
        input=json.dumps(body).encode(), capture_output=True)
    resp = json.loads(p.stdout)
    text = resp['choices'][0]['message']['content']
    text = text[text.find('{'): text.rfind('}') + 1]
    return json.loads(text)


if __name__ == '__main__':
    key = api_key()
    script, *paths = sys.argv[1:]
    for p in paths:
        print(p, check(key, script, p))
