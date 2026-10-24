# 墨然的方块世界

Game-style learning levels for a 6-year-old (grade 1, Shenzhen; 统编语文 / 北师大数学 / 沪教牛津英语) played on a 2020 iPad Pro (finger only, no Pencil) as a home-screen web app. Minecraft/LEGO feel, original art only — no official assets or logos. Only the nickname 墨然 appears in the app; the repo is public.

Plain static site, no build step. Deployed with GitHub Pages from `main`. Preview locally with `python3 tools/devserver.py 8766` (no-cache server).

## Adding a level (the usual job)

The parent sends homework / teacher notes → make one level:

1. `levels/<id>/level.json` with `stages[]`, each stage `{id, title, icon, items[]}`.
2. Add `{id, subject, title, subtitle, date, path}` to the **front** of `levels/index.json` (newest first).
3. Hanzi used by `stroke` items need data: download `https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0.1/<char>.json` into `vendor/hanzi/`.
4. Don't commit the teacher's PDFs or photos.
5. Run `python3 tools/tts_build.py` (voice clips) and `.venv/bin/python tools/font_build.py` (re-subsets the pixel UI font and the 楷体 content font to every character used; first time: `python3 -m venv .venv && .venv/bin/pip install fonttools brotli`, source fonts download instructions are in the script).

Look: Minecraft-style GUI (stone buttons `.mc-btn`, gray `.mc-panel`, inventory `.inv-slot`, hotbar + XP bar while playing), pixel landscape background (`js/scene.js`), pixel icons drawn in code (`js/sprites.js`; stage `icon: "sprite:book"`). UI text uses the pixel font (`--ui`); anything the child reads to learn (characters, poems, sentences) uses 楷体 (`--kai`) and pinyin uses Andika.

Kid can't read much yet: every item needs a `say`. All spoken lines are pre-recorded with Gemini TTS, which reads tone-marked pinyin correctly, so spoken text may contain pinyin (`"d，ǎ，dǎ，打鼓的打。"`). After adding or changing a level run `python3 tools/tts_build.py` (needs `OPENROUTER_API_KEY` in env or `.env`): it records only new lines, has an audio model check each clip's pronunciation, re-records failures, and rewrites `audio/manifest.json`. Lines with no clip fall back to the iPad's built-in voice, which reads pinyin badly. Sentences spoken from code live in `js/phrases.js` (templates may use only `${n}`).

## Item types (`js/items/`)

All items take optional `q` (short label shown on the parent page), `say`, `after` (spoken after a correct answer), `hint` (spoken after a wrong one).

- `choice` — `prompt {pic, label, text, py, context, card, picSay}`, `options[]` (string, or `{text, py, grid, pic, big, say}`), `answer` (index into options as written), `fixed` (keep order), `listen` (tap reads option aloud, then confirm), `cols`.
- `blend` — `parts: [initial, final, syllable]`, `missing: 0|1|2`, optional `options`.
- `spell` — `word: "ní tǔ"` (space-separated syllables), `prompt`; builds 声母+韵母 on 四线三格. Neutral tone = untoned final (`"bà ba"`).
- `stroke` — `char`, `strokes: ["横", ...]` (spoken per stroke), `prompt`.
- `read` — `lines[]`, `py[]` (one pinyin token per Han char), `read` (text to speak). Tapping a character says its pinyin; `tapSay: {"né": "哪吒的哪，né"}` overrides syllables TTS misreads alone.
- `tapText` — `lines`, `py`, `rule: {base: "da"} | {final: "e"}`.
- `order` — `pieces[]` in correct order.

Pictures: emoji string, `block:<type>` (see `js/blocks.js`), or `svg:<name>` (see `js/pics.js`). `context` text uses `▢` for blanks (first one highlighted) and `{pinyin}` for inline pinyin.

Progress lives in `localStorage` (`momo.v1`) on the iPad; parent page = long-press the faint ⚙︎ on the home screen.
