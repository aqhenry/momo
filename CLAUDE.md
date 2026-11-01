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

If the Gemini provider is unavailable, `python3 tools/tts_build.py --fallback` records only missing lines with MiniMax and checks them against the original script with Qwen audio. `tools/tts_fallback.py` supplies reviewed homophones / explicit pronunciation for pinyin; extend its dictionary for new tokens. `audio/fallbacks.json` maps the original clip IDs to verified fallback IDs, so subsequent normal builds retain those recordings. Failed checks never publish a new clip. Keep existing recordings and voice IDs intact.

The jqx adventure uses its approved Fish Drama 3 adult Mandarin voice and slightly lively teacher delivery. Its exact voice and instructions live in `tools/voices/jqx-b.json`; run `python3 tools/tts_build.py --profile jqx-b` after changing its spoken text. This records the adventure and shared feedback into `audio/profiles/jqx-b.json`, checks pronunciation, and publishes the profile only when every line has passed. `audioProfile` on the level and catalog selects those clips for introductions, questions, feedback, rewards, and paper practice. The ordinary build skips profiled levels and preserves their audio files. Do not replace the approved voice or rewrite pinyin as homophones without reviewing the result.

Adventures (`levels/index.json`): newest first, each with `chapter` (第N大关), `subject`, `block` (home icon). A level's `blockSet` adds its own collectible blocks to the drop pool (blocks with that `set` in `js/blocks.js`, e.g. the math adventure's number blocks); give each new adventure a few new blocks.

Rewards (`js/rewards.js`): ~50 blocks in 5 rarities (`js/blocks.js`, keys are saved on the iPad — never rename one). Harder items drop rarer blocks (`difficulty` 1–3 is inferred from the item type; set it on an item to override), every 3 first-try answers in a row give a bonus block, stage chests are wood/iron/gold by stars, and replaying a finished stage gives a smaller chest. Build mode is 3D (`js/build3d.js`, three.js in `vendor/three`). Preview on the iPad without publishing: `python3 tools/devserver.py 8770 --lan`, then open `http://<Mac IP>:8770` on the same Wi-Fi.

## Item types (`js/items/`)

All items take optional `q` (short label shown on the parent page), `say`, `after` (spoken after a correct answer), `hint` (spoken after a wrong one).

- `choice` — `prompt {pic, label, text, py, context, card, picSay}`, `options[]` (string, or `{text, py, grid, pic, big, say}`), `answer` (index into options as written), `fixed` (keep order), `listen` (tap reads option aloud, then confirm), `cols`.
- `blend` — `parts: [initial, final, syllable]`, `missing: 0|1|2`, optional `options`.
- `spell` — `word: "ní tǔ"` (space-separated syllables), `prompt`; builds 声母+韵母 on 四线三格. Neutral tone = untoned final (`"bà ba"`).
- `stroke` — `char`, `strokes: ["横", ...]` (spoken per stroke), `prompt`.
- `read` — `lines[]`, `py[]` (one pinyin token per Han char), `read` (text to speak). Tapping a character says its pinyin; `tapSay: {"né": "哪吒的哪，né"}` overrides syllables TTS misreads alone.
- `tapText` — `lines`, `py`, `rule: {base: "da"} | {final: "e"}`.
- `order` — `pieces[]` in correct order.
- `calc` (`js/items/math.js`) — `eq` with blanks: `□` a number, `○` a sign (`"3+2=□"`, `"5+□=5"`, `"2+3○4"`, `"□○□=□"`). Correct = the filled equation is true, or is listed in `accept` (use it when the numbers must match a picture). `signs` for the sign keypad, `pad` = highest digit (default 5). Optional `scene`: `{groups:[{art,n},…], op}`, `{art, n, cross, gone, goneArt, tap}` (tap lets him cross out; `art: "circle"` draws ○), `{pairs:[{art,n},{art,n}]}` (one-to-one matching).
- `craft` — number bonds on a crafting table: `a`, `b`, `total`, `blank: "a"|"b"|"total"`, `art`.
- `pattern` — `seq` with one `null`, `answer`, `art`, optional `labels`.
- `letterHunt` (`js/items/pinyin-challenge.js`) — `target`, `letters[]`: find every occurrence; repeated taps on an already-found tile do not count.
- `pinyinLab` — `parts: [initial, tonedFinal]` or `[initial, medial, tonedFinal]`, `word` (written result). Only the highlighted slot accepts a choice. Correct parts advance after a short animation; after the last part, the result and spoken explanation appear automatically. `joinSounds()` applies ü → u after j/q/x while retaining the tone; n/l retain ü. Existing `split()` continues to operate on written letters.
- `dictation` — `word` (space-separated syllables), audio-only `say`, optional `prompt` for guided picture practice. One syllable at a time: choose an initial from a fixed lesson bank, add vowels (always both u and ü), then use the green arrow to choose and confirm a tone. Tone choices show the child's own spelling, never supply missing letters. Correct syllables advance automatically. A single back/erase button supports free editing; incomplete input cannot be submitted. Answers are compared exactly, without automatic ü correction. Do not put the answer in `say` as letter names, a visible prompt, or the stage note for a listening test.

Third adventure: `yuwen-jqx` / 拼音秘境·小 ü 的冒险 (2026-11-01), 7 stages / 47 items. Based on the **2024 revised** 人教版一年级上 P34–35: jī/qì/xī, jiā/qiā/xiá, jū/qū/xū, 打鼓/下棋/搭积木. Additional tones and n/l comparisons are labelled as practice, separately from textbook items. The final stage has `shuffle: true`. A level can set `paperStage` to a dictation stage ID to expose optional paper listening practice on the map; answers stay hidden until requested, and this self-check practice awards no automatic stars or blocks. New item `source` and stage `note` are shown as short learning labels.

Revision 3 retains hunt → two-part syllables → ü spelling → three-part syllables → words → mixed correction → dictation, with stable stage IDs for existing progress. `pinyinLab.choices` supplies three focused options per slot, shuffled once per question. `shuffleWithinPhase` randomizes words inside their `phase` while preserving the order of picture support followed by audio-only practice. The adventure's `rewardPolicy: "practice"` awards three stars after all answers are completed/corrected; retries do not reduce block quality, completion streaks, or replay chests. `firstTry` and `mistakes` remain accurate for parents; older adventures retain their existing scoring. Play screens use icon actions, large spaced targets, a single replay speaker, a 240 ms double-tap guard, a 450 ms question-transition guard, and a resumable pause screen before leaving. Level-specific interaction speech lives in `speech` and is included by the voice builder; retain the approved jqx-b voice and delivery.

Pictures: `art:<name>` from the pixel-art library (preferred — add entries to `art/library.json`, then `.venv/bin/python tools/art_build.py` generates and normalises them; review `samples/art-qc.html`), `block:<type>`, `sprite:<name>`, `text:8`. Avoid emoji. Math counting pictures repeat one library picture N times (`scene` in `js/items/math.js`), so new numbers never need new art. `context` text uses `▢` for blanks (first one highlighted) and `{pinyin}` for inline pinyin.

Progress lives in `localStorage` (`momo.v1`) on the iPad; parent page = long-press the faint ⚙︎ on the home screen.
