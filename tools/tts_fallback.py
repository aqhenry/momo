"""Pronunciation text for the explicit MiniMax fallback in tts_build.py.

Use homophones for isolated pinyin because this voice can otherwise read Latin
letters or skip diacritics. The manifest still uses the original game text, and
the audio checker checks against that original text, including every tone.
Unknown Latin tokens fail rather than silently producing English pronunciation.
"""
import re

MODEL = 'minimax/speech-2.8-hd'
VOICE = 'female-tianmei'
SPEED = 0.85
CHECK_MODEL = 'qwen/qwen3.8-omni-flash'

READINGS = {
    'j': '鸡', 'q': '七', 'x': '西', 'n': '呢(ne1)', 'l': '勒(le1)',
    'a': '啊', 'i': '衣', 'u': '乌', 'ü': '迂',
    'ā': '啊(a1)', 'á': '啊(a2)', 'ǎ': '啊(a3)', 'à': '啊(a4)',
    'ī': '衣', 'í': '姨', 'ǐ': '椅', 'ì': '意',
    'ū': '乌', 'ú': '吴', 'ǔ': '五', 'ù': '物',
    'ǖ': '迂', 'ǘ': '鱼', 'ǚ': '雨', 'ǜ': '玉',
    'jī': '鸡', 'jí': '吉', 'jǐ': '己', 'jì': '记',
    'qī': '七', 'qí': '棋', 'qǐ': '起', 'qì': '气',
    'xī': '西', 'xí': '习', 'xǐ': '喜', 'xì': '戏',
    'jiā': '家', 'jiá': '颊', 'jiǎ': '甲', 'jià': '架',
    'qiā': '掐', 'qià': '恰',
    'xiā': '虾', 'xiá': '霞', 'xià': '下',
    'jū': '居', 'jú': '菊', 'jǔ': '举', 'jù': '句',
    'qū': '区', 'qú': '渠', 'qǔ': '取', 'qù': '去',
    'xū': '虚', 'xú': '徐', 'xǔ': '许', 'xù': '序',
    'nǚ': '女', 'lǜ': '绿', 'dǎ': '打', 'gǔ': '鼓', 'dā': '搭', 'mù': '木',
}
TOKEN = re.compile(r'[a-züāáǎàōóǒòēéěèīíǐìūúǔùǖǘǚǜ]+')


def spoken_text(text):
    def replace(match):
        token = match.group()
        if token not in READINGS:
            raise ValueError(f'No reviewed fallback pronunciation for {token!r}')
        return READINGS[token]
    return TOKEN.sub(replace, text)
