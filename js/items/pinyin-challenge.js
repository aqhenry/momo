// jqx practice: find letters, assemble spoken components, and write from sound.
import { h, shuffle, shake, promptEl } from '../ui.js';
import { gridSVG, joinSounds, stripTone, toneOf, withTone } from '../pinyin.js';
import { spriteEl } from '../sprites.js';
import { sfx, speak, stopSpeaking } from '../audio.js';
import { S } from '../phrases.js';

export function renderHunt(root, item, ctx) {
  let found = 0, locked = false;
  const total = item.letters.filter(x => x === item.target).length;
  const counter = h('div.counter', `找到 ${found} / ${total}`);
  const grid = h('div.letter-hunt');
  for (const letter of shuffle(item.letters)) {
    const button = h('button.hunt-cell', { 'aria-label': letter, onclick: () => {
      if (locked || button.disabled) return;
      if (letter !== item.target) {
        shake(button);
        ctx.wrong(letter, item.hint || S.huntWrong);
        return;
      }
      button.disabled = true;
      button.classList.add('found');
      sfx.place();
      counter.textContent = `找到 ${++found} / ${total}`;
      if (found === total) { locked = true; ctx.right(item.after); }
    } }, gridSVG(letter, 24, { minWidth: 64 }));
    grid.append(button);
  }
  root.append(h('div.challenge-title', '听声音，挖出藏好的声母'), counter, grid);
}

const labels = { ini: '声母', med: '介母', fin: '韵母' };

export function renderLab(root, item, ctx) {
  root.classList.add('lab-body');
  const slots = item.parts.map((want, i) => ({
    want, got: null, kind: i === 0 ? 'ini' : i === item.parts.length - 1 ? 'fin' : 'med',
  }));
  let active = 0, locked = false, submitted = false;
  const row = h('div.lab-recipe');
  const pool = h('div.lab-pool');
  const result = h('div.lab-result', { hidden: true });
  const status = h('div.challenge-help', S.labFirst);
  const next = h('button.mc-btn.go', { hidden: true, onclick: () => {
    if (submitted || !root.isConnected) return;
    submitted = true;
    ctx.right();
  } }, '记住了！');

  slots.forEach((slot, i) => {
    if (i) row.append(h('span.lab-plus', '+'));
    slot.el = h(`button.lab-slot.${slot.kind}`, { 'aria-label': labels[slot.kind], onclick: () => {
      if (locked) return;
      active = i;
      slot.got = null;
      paint();
    } });
    row.append(h('div.lab-column', h(`span.tag.${slot.kind}`, labels[slot.kind]), slot.el));
  });
  root.append(h('div.challenge-title', '把拼音积木放上合成台'), row, status, pool, result, next);
  paint();

  function options(slot) {
    if (slot.kind === 'ini') return shuffle([...new Set([slot.want, 'j', 'q', 'x', 'n', 'l'])].slice(0, 5));
    if (slot.kind === 'med') return shuffle(['i', 'u', 'ü']);
    const base = stripTone(slot.want), tone = toneOf(slot.want);
    const confusable = base === 'ü' ? 'u' : base === 'u' ? 'ü' : base === 'a' ? 'i' : 'a';
    return shuffle([...new Set([slot.want, withTone(confusable, tone),
      ...[1, 2, 3, 4].filter(t => t !== tone).slice(0, 2).map(t => withTone(base, t))])]);
  }

  function paint() {
    slots.forEach((s, i) => {
      s.el.replaceChildren(s.got ? gridSVG(s.got, 30, { minWidth: 70 }) : h('span.qmark', '?'));
      s.el.classList.toggle('now', i === active && !locked);
      s.el.classList.toggle('wrong', !!s.got && s.got !== s.want);
    });
    pool.replaceChildren();
    if (locked) return;
    const slot = slots[active];
    pool.append(h(`span.tag.${slot.kind}`, labels[slot.kind]));
    for (const value of options(slot)) {
      pool.append(h(`button.tile.${slot.kind}`, { onclick: () => put(value) }, gridSVG(value, 26, { minWidth: 64 })));
    }
  }

  function put(value) {
    if (locked) return;
    slots[active].got = value;
    sfx.place();
    const blank = slots.findIndex(s => !s.got);
    if (blank >= 0) { active = blank; paint(); return; }
    const bad = slots.findIndex(s => s.got !== s.want);
    if (bad >= 0) {
      active = bad;
      ctx.wrong(slots.map(s => s.got).join(' + '), item.hint);
      paint();
      shake(slots[bad].el);
      return;
    }
    locked = true;
    paint();
    pool.hidden = true;
    slots.forEach(s => s.el.classList.add('right'));
    const joined = joinSounds(slots.map(s => s.got));
    result.append(h('span.lab-arrow', '→'), h('div.paper', gridSVG(joined, 32, { minWidth: 180 })));
    const hasUmlaut = /[üǖǘǚǜ]/.test(item.parts.at(-1));
    if (hasUmlaut) result.append(h('div.umlaut-note', /^[jqx]$/.test(item.parts[0]) ? '省去两点，声调保留' : '遇到 n、l，两点保留'));
    result.hidden = next.hidden = false;
    status.textContent = S.labReady;
    sfx.right();
    ctx.say(item.after);
    next.scrollIntoView({ block: 'nearest' });
  }
}

// The keyboard is identical for every question. It offers both u and ü and never
// inserts or normalises the correct letters for the child. Tones must be supplied too.
const LETTERS = ['b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'a', 'o', 'e', 'i', 'u', 'ü'];

export function renderDictation(root, item, ctx) {
  root.classList.add('dictation-body');
  const want = item.word.normalize('NFC').trim().split(/\s+/);
  const got = want.map(() => '');
  let active = 0, locked = false;
  const word = h('div.dictation-word');
  const help = h('div.challenge-help', S.dictationEdit);
  const slots = want.map((_, i) => {
    const slot = h('button.dictation-slot', { 'aria-label': `第 ${i + 1} 个音节`, onclick: () => {
      if (locked) return;
      active = i;
      paint();
    } });
    word.append(h('div.dictation-syllable', h('span.dictation-number', String(i + 1)), slot));
    return slot;
  });
  const keys = h('div.dictation-keys', LETTERS.map(letter =>
    h('button.letter-key.py', { 'aria-label': letter, onclick: () => {
      if (locked || [...got[active]].length >= 6) return;
      got[active] += letter;
      edited();
    } }, letter)));
  const tones = h('div.tone-keys', [1, 2, 3, 4, 0].map((tone, i) =>
    h('button.tone-key', { 'aria-label': ['一声', '二声', '三声', '四声', '轻声'][i], onclick: () => {
      if (locked) return;
      if (!/[aoeiuü]/.test(stripTone(got[active]))) { ctx.say(S.dictationNoVowel); return; }
      got[active] = withTone(got[active], tone);
      edited();
    } }, h('span.py', ['ā', 'á', 'ǎ', 'à', 'a'][i]), h('small', ['一声', '二声', '三声', '四声', '轻声'][i]))));
  const actions = h('div.dictation-actions',
    h('button.mc-btn.small', { onclick: () => { if (!locked) { got[active] = [...got[active]].slice(0, -1).join(''); edited(); } } }, '退一格'),
    h('button.mc-btn.small', { onclick: () => { if (!locked) { got[active] = ''; edited(); } } }, '重写'),
    want.length > 1 ? h('button.mc-btn.small', { onclick: () => { if (!locked) { active = (active + 1) % got.length; paint(); } } }, '下一音节') : null,
    h('button.mc-btn.go', { onclick: check }, '检查'));
  root.append(promptEl(item.prompt, ctx),
    h('button.mc-btn.small', { onclick: () => { if (!locked) ctx.say(item.say); } }, spriteEl('speaker'), '再听一次'),
    word, help, keys, tones, actions);
  paint();

  function paint() {
    slots.forEach((slot, i) => {
      slot.replaceChildren(gridSVG(got[i], 28, { minWidth: want.length > 2 ? 132 : 154 }));
      slot.classList.toggle('now', i === active && !locked);
    });
  }
  function edited() {
    slots[active].classList.remove('wrong');
    help.textContent = S.dictationEdit;
    sfx.tap();
    paint();
  }
  function check() {
    if (locked) return;
    const bad = want.map((syl, i) => got[i].normalize('NFC') !== syl);
    if (bad.some(Boolean)) {
      slots.forEach((slot, i) => slot.classList.toggle('wrong', bad[i]));
      active = bad.indexOf(true);
      paint();
      shake(slots[active]);
      help.textContent = S.dictationCheck;
      ctx.wrong(got.map(s => s || '空').join(' '), item.hint || S.dictationCheck);
      return;
    }
    locked = true;
    root.querySelectorAll('button').forEach(button => { button.disabled = true; });
    slots.forEach(slot => { slot.classList.remove('wrong', 'now'); slot.classList.add('right'); });
    ctx.right(item.after);
  }
}

export function mountPaper(root, items) {
  const order = shuffle(items);
  let i = 0;
  const heading = h('div.challenge-title', '拿出纸和笔，先听再写');
  const note = h('div.challenge-help', '写完再揭晓，和家长一起核对。纸上练习不计星星。');
  const progress = h('div.counter');
  const answer = h('div.paper.paper-answer', { hidden: true });
  const listen = h('button.mc-btn.big', { onclick: () => speak(order[i].say) }, spriteEl('speaker'), '听题目');
  const reveal = h('button.mc-btn.go', { onclick: () => {
    answer.replaceChildren(gridSVG(order[i].word, 32, { minWidth: 220 }));
    answer.hidden = false;
    reveal.disabled = true;
    next.hidden = false;
  } }, '写好了，看答案');
  const next = h('button.mc-btn', { hidden: true, onclick: () => {
    stopSpeaking();
    i++;
    if (i === order.length) {
      root.replaceChildren(h('div.challenge-title', '纸上听写完成啦！'),
        h('div.challenge-help', '和家长一起看看：小 i、两点、声调，都写对了吗？'),
        h('button.mc-btn.go', { onclick: () => mountPaper(root, items) }, '再练一轮'));
      return;
    }
    show();
  } }, '下一题');
  root.replaceChildren(heading, note, progress, listen, answer, h('div.row-btns', reveal, next));
  show();
  speak(S.paperIntro);

  function show() {
    progress.textContent = `第 ${i + 1} / ${order.length} 题`;
    answer.replaceChildren();
    answer.hidden = next.hidden = true;
    reveal.disabled = false;
  }
}
