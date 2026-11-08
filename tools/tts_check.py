"""Ask an audio-capable model whether a clip says its script correctly (pinyin and tones included).

    python3 tools/tts_check.py "<script>" path/to/clip.(wav|mp3|m4a) [...]

Used by tts_build.py to re-record clips that come out wrong.
"""
import base64
import json
import pathlib
import re
import subprocess
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from tts_samples import api_key  # noqa: E402

CHECK_MODEL = 'google/gemini-3.8-flash'

PROMPT = '''你是小学语文老师，正在检查给一年级小朋友用的配音。
台本：「{script}」
请仔细听音频，判断朗读是否和台本完全一致：
- 每个汉字都读了，读音正确（多音字按语境），没有漏读、多读、读错；
- 台本里的完整拼音音节（例如 mú、lǎ ba、dǎ gǔ）要整体读出，不要逐字母拆读。只有单独出现的声母才读呼读音（如 b 读 bō）；单独韵母按它的声调朗读，不能读成英文字母；
- 拼音可以用同音汉字来生成配音，仅比较实际发音，不因同音汉字的字形不同而判错；三声连读、“一”“不”等正常普通话变调不算错误；
- 台本里的英文单词和句子（如 grandma、I'm cold、This is my mum.）按标准英语读出即可，不按拼音规则判断；
- 语气自然，没有奇怪的杂音或重复。
只输出 JSON：{{"ok": true/false, "problems": "有问题时用中文简短说明哪里不对"}}'''


def check(key, script, path, model=CHECK_MODEL):
    path = pathlib.Path(path)
    fmt = {'.wav': 'wav', '.mp3': 'mp3', '.m4a': 'm4a'}[path.suffix]
    # Some audio checkers confuse Unicode í / ì. State each marked tone explicitly
    # so a correctly spoken fourth-tone ì isn't rejected as a supposed first-tone i.
    tones = {c: i for group in ('āáǎà', 'ōóǒò', 'ēéěè', 'īíǐì', 'ūúǔù', 'ǖǘǚǜ') for i, c in enumerate(group, 1)}
    tokens = re.findall(r'[a-züāáǎàōóǒòēéěèīíǐìūúǔùǖǘǚǜ]+', script)
    guide = '；'.join(dict.fromkeys(f'{t}：第{tones[c]}声' for t in tokens for c in t if c in tones))
    prompt = PROMPT.format(script=script)
    if guide:
        prompt += '\n台本拼音的目标声调（按此表核对实际音频）：' + guide
    sounds = {'j': 'jī（鸡）', 'q': 'qī（七），不是英文字母 Q，也不是 qiū',
              'x': 'xī（西）', 'n': 'nē（讷）', 'l': 'lē（勒）',
              'i': 'ī（衣）', 'u': 'ū（乌）', 'ü': 'ǖ（迂）'}
    isolated = [f'{t} 读 {sounds[t]}' for t in dict.fromkeys(tokens) if t in sounds]
    if isolated:
        prompt += '\n本台本中单独字母的教学呼读音：' + '；'.join(isolated)
    body = {
        'model': model,
        'temperature': 0,
        'response_format': {'type': 'json_object'},
        'messages': [{'role': 'user', 'content': [
            {'type': 'text', 'text': prompt},
            {'type': 'input_audio', 'input_audio': {'data': base64.b64encode(path.read_bytes()).decode(), 'format': fmt}},
        ]}],
    }
    p = subprocess.run(
        ['curl', '-sS', '--max-time', '120', 'https://openrouter.ai/api/v1/chat/completions',
         '-H', f'Authorization: Bearer {key}', '-H', 'Content-Type: application/json', '--data-binary', '@-'],
        input=json.dumps(body).encode(), capture_output=True)
    resp = json.loads(p.stdout)
    if 'choices' not in resp:
        raise RuntimeError(str(resp.get('error', 'Audio checker returned no verdict')))
    text = resp['choices'][0]['message']['content'] or ''
    # Some providers wrap JSON in prose or fences, or emit more than one object.
    # Accept only an explicit boolean verdict; an explanation alone cannot pass.
    decoder = json.JSONDecoder()
    verdicts = []
    for match in re.finditer(r'\{', text):
        try:
            value, _ = decoder.raw_decode(text[match.start():])
        except json.JSONDecodeError:
            continue
        if isinstance(value, dict) and isinstance(value.get('ok'), bool):
            verdicts.append(value)
    if not verdicts:
        raise RuntimeError('Audio checker returned no boolean verdict')
    return verdicts[-1]


if __name__ == '__main__':
    key = api_key()
    script, *paths = sys.argv[1:]
    for p in paths:
        print(p, check(key, script, p))
