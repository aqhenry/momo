# 墨然的方块世界

Game-style learning levels for a 6-year-old (grade 1, Shenzhen; 统编语文 / 北师大数学 / 沪教牛津英语) played on a 2020 iPad Pro (finger only, no Pencil) as a home-screen web app. Minecraft/LEGO feel, original art only — no official assets or logos. Only the nickname 墨然 appears in the app; the repo is public.

Plain static site, no build step. Deployed with GitHub Pages from `main`. Preview locally with `python3 tools/devserver.py 8766` (no-cache server).

## Adding a level (the usual job)

The parent sends homework / teacher notes → make one level:

1. `levels/<id>/level.json` with `stages[]`, each stage `{id, title, icon, items[]}`.
2. Add `{id, subject, title, subtitle, date, path}` to the **front** of `levels/index.json` (newest first).
3. Hanzi used by `stroke` items need data: download `https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0.1/<char>.json` into `vendor/hanzi/`.
4. Don't commit the teacher's PDFs or photos.

Kid can't read much yet: every item needs a `say` (spoken by the iPad's zh-CN voice). Never put Latin pinyin letters in spoken text — TTS reads them as English. Use a Chinese character with that sound instead (a→啊, o→喔, e→鹅, i→衣, u→乌, ü→鱼, b→波, p→坡, m→摸, f→佛, d→得, t→特, n→讷, l→勒).

## Item types (`js/items/`)

All items take optional `q` (short label shown on the parent page), `say`, `after` (spoken after a correct answer), `hint` (spoken after a wrong one).

- `choice` — `prompt {pic, label, text, py, context, card, picSay}`, `options[]` (string, or `{text, py, grid, pic, big, say}`), `answer` (index into options as written), `fixed` (keep order), `listen` (tap reads option aloud, then confirm), `cols`.
- `blend` — `parts: [initial, final, syllable]`, `missing: 0|1|2`, optional `options`.
- `spell` — `word: "ní tǔ"` (space-separated syllables), `prompt`; builds 声母+韵母 on 四线三格. Neutral tone = untoned final (`"bà ba"`).
- `stroke` — `char`, `strokes: ["横", ...]` (spoken per stroke), `prompt`.
- `read` — `lines[]`, `py[]` (one pinyin token per Han char), `read` (text to speak).
- `tapText` — `lines`, `py`, `rule: {base: "da"} | {final: "e"}`.
- `order` — `pieces[]` in correct order.

Pictures: emoji string, `block:<type>` (see `js/blocks.js`), or `svg:<name>` (see `js/pics.js`). `context` text uses `▢` for blanks (first one highlighted) and `{pinyin}` for inline pinyin.

Progress lives in `localStorage` (`momo.v1`) on the iPad; parent page = long-press the faint ⚙︎ on the home screen.
