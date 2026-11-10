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
  root.append(h('div.challenge-title', item.title || '听声音，挖出藏好的声母'), counter, grid);
}

const labels = { ini: '声母', med: '介母', fin: '韵母' };

export function renderLab(root, item, ctx) {
  root.classList.add('lab-body');
  const slots = item.parts.map((want, i) => ({
    want, got: null, kind: i === 0 ? 'ini' : i === item.parts.length - 1 ? 'fin' : 'med',
    options: shuffle(item.choices?.[i] || [want]),
  }));
  let active = 0, locked = false, settling = false;
  const row = h('div.lab-recipe');
  const pool = h('div.lab-pool');
  const result = h('div.lab-result', { hidden: true });
  slots.forEach((slot, i) => {
    if (i) row.append(h('span.lab-plus', '+'));
    slot.el = h(`div.lab-slot.${slot.kind}`, { 'aria-label': labels[slot.kind] });
    row.append(h('div.lab-column', h(`span.tag.${slot.kind}`, labels[slot.kind]), slot.el));
  });
  root.append(h('div.challenge-title', '拼一拼'), row, pool, result);
  paint();

  function paint() {
    slots.forEach((s, i) => {
      s.el.replaceChildren(s.got ? gridSVG(s.got, 30, { minWidth: 70 }) : h('span.qmark', '?'));
      s.el.classList.toggle('now', i === active && !locked);
      s.el.classList.toggle('right', !!s.got);
    });
    pool.replaceChildren();
    if (locked) return;
    const slot = slots[active];
    for (const value of slot.options) {
      const button = h(`button.tile.${slot.kind}`, { 'aria-label': value, onclick: () => {
        if (locked || settling || button.disabled) return;
        if (value !== slot.want) {
          button.disabled = true;
          button.classList.add('try-again');
          ctx.wrong(value, item.hint);
          return;
        }
        settling = true;
        slot.got = value;
        sfx.place();
        slot.el.replaceChildren(gridSVG(value, 30, { minWidth: 70 }));
        slot.el.classList.add('right');
        setTimeout(() => {
          if (!root.isConnected) return;
          active++;
          settling = false;
          locked = active === slots.length;
          paint();
          if (!locked) return;
          pool.hidden = true;
          const joined = joinSounds(slots.map(s => s.got));
          result.append(h('span.lab-arrow', '→'), h('div.paper', gridSVG(joined, 32, { minWidth: 180 })));
          if (/[üǖǘǚǜ]/.test(item.parts.at(-1))) {
            result.append(h('div.umlaut-note', /^[jqx]$/.test(item.parts[0]) ? '省去两点，声调保留' : '遇到 n、l，两点保留'));
          }
          result.hidden = false;
          ctx.right(item.after);
        }, 360);
      } }, gridSVG(value, 30, { minWidth: 84 }));
      pool.append(button);
    }
  }
}

// A fixed bank for the lesson, split by task rather than by the answer. Both u
// and ü are always offered; no letters or tones are supplied automatically.
const INITIALS = ['j', 'q', 'x', 'd', 'g', 'm', 'n', 'l'];
const VOWELS = ['a', 'i', 'u', 'ü'];

export function renderDictation(root, item, ctx) {
  root.classList.add('dictation-body');
  // a level can bring its own letter bank (`dictation: {initials, vowels, bare}`); `bare` allows syllables
  // without an initial (single finals like ǎ), so both rows are offered before anything is written
  const bank = { ...ctx.dictation, ...item.bank };
  const initials = bank.initials || INITIALS, vowels = bank.vowels || VOWELS, bare = !!bank.bare;
  const want = item.word.normalize('NFC').trim().split(/\s+/);
  const got = want.map(() => '');
  const done = want.map(() => false);
  let active = 0, locked = false, phase = 'letters', selectedTone = null, lastChecked = '';
  const word = h('div.dictation-word');
  const heading = h('div.challenge-title', '拼一拼');
  const pool = h('div.dictation-pool');
  const progress = h('div.input-progress', { 'aria-hidden': true },
    h('span.input-dot.letters', '1'), h('span.input-path', '→'), h('span.input-dot.tones', '2'));
  const slots = want.map((_, i) => {
    const slot = h('button.dictation-slot', { 'aria-label': `第 ${i + 1} 个音节`, onclick: () => {
      if (locked || i === active || !done[i]) return;
      active = i;
      phase = 'letters';
      selectedTone = null;
      got[i] = stripTone(got[i]);
      done[i] = false;
      paint();
    } });
    word.append(h('div.dictation-syllable', h('span.dictation-number', String(i + 1)), slot));
    return slot;
  });
  const back = h('button.mc-btn.step-back', { 'aria-label': '退回上一步', onclick: () => {
    if (locked) return;
    if (phase === 'tones') phase = 'letters';
    else got[active] = [...stripTone(got[active])].slice(0, -1).join('');
    got[active] = stripTone(got[active]);
    selectedTone = null;
    paint();
  } }, spriteEl('back'));
  const submit = h('button.mc-btn.go.step-go', { onclick: () => {
    if (locked) return;
    if (phase === 'letters') {
      if (!hasLetters()) return;
      phase = 'tones'; selectedTone = null;
      paint();
      ctx.say(ctx.speech?.chooseTone || S.dictationNoVowel);
      return;
    }
    if (selectedTone === null) return;
    check();
  } });
  root.append(h('div.dictation-heading', promptEl(item.prompt, ctx), item.prompt ? null : heading), word, progress, pool,
    h('div.dictation-actions', back, submit));
  paint();

  function hasLetters() {
    const s = stripTone(got[active]);
    return /[aoeiuü]$/.test(s) && (bare ? /^[a-z]*[aoeiuü]+$/.test(s) : /^[^aoeiuü][aoeiuü]+$/.test(s));
  }

  function paint() {
    root.classList.toggle('dictation-tones', phase === 'tones');
    heading.textContent = phase === 'letters' ? '拼一拼' : '选声调';
    progress.querySelector('.letters').classList.toggle('now', phase === 'letters');
    progress.querySelector('.tones').classList.toggle('now', phase === 'tones');
    slots.forEach((slot, i) => {
      slot.replaceChildren(gridSVG(got[i], 26, { minWidth: want.length > 2 ? 124 : 154 }));
      slot.classList.toggle('now', i === active && !locked);
      slot.classList.toggle('right', done[i]);
      slot.disabled = locked || (i !== active && !done[i]);
    });
    back.disabled = locked || !got[active];
    submit.disabled = locked || (phase === 'letters' ? !hasLetters() : selectedTone === null);
    // Reserve their positions, but show only the action the child can use now.
    back.style.visibility = back.disabled ? 'hidden' : 'visible';
    submit.style.visibility = submit.disabled ? 'hidden' : 'visible';
    back.replaceChildren(spriteEl(phase === 'tones' ? 'back' : 'erase'));
    submit.setAttribute('aria-label', phase === 'letters' ? '选声调' : '检查');
    submit.replaceChildren(spriteEl(phase === 'letters' ? 'forward' : 'confirm'));
    pool.replaceChildren();
    if (locked) return;
    if (phase === 'letters') {
      const rows = got[active] ? [vowels] : bare ? [initials, vowels] : [initials];
      for (const letters of rows) {
      const keys = h(`div.dictation-keys.steps${letters === vowels && rows.length > 1 ? '.vowels' : ''}`);
      for (const letter of letters) keys.append(h('button.letter-key.py', {
        'aria-label': letter, onclick: () => {
          if (locked || [...got[active]].length >= 4) return;
          got[active] += letter;
          selectedTone = null;
          slots[active].classList.remove('try-again');
          sfx.place(); paint();
        },
      }, letter));
      pool.append(keys);
      }
    } else {
      const tones = [1, 2, 3, 4];
      if (want.some(s => toneOf(s) === 0)) tones.push(0);
      pool.append(h('div.tone-keys.steps', tones.map(tone => h(`button.tone-key${selectedTone === tone ? '.selected' : ''}`, {
        'aria-label': ['轻声', '一声', '二声', '三声', '四声'][tone], onclick: () => {
          if (locked) return;
          selectedTone = tone;
          got[active] = withTone(got[active], tone);
          slots[active].classList.remove('try-again');
          sfx.tap(); paint();
        },
      }, h('span.py', withTone(got[active], tone)), h('small', String(tone))))));
    }
  }

  function check() {
    if (got[active].normalize('NFC') !== want[active]) {
      const signature = `${active}:${got[active]}`;
      if (signature !== lastChecked) {
        ctx.wrong(got.map(s => s || '空').join(' '), item.hint || S.dictationCheck);
        lastChecked = signature;
      }
      if (stripTone(got[active]) !== stripTone(want[active])) {
        phase = 'letters'; selectedTone = null; got[active] = stripTone(got[active]);
      }
      paint();
      slots[active].classList.add('try-again');
      return;
    }
    done[active] = true;
    const next = done.indexOf(false);
    if (next >= 0) {
      active = next; phase = 'letters'; selectedTone = null;
      sfx.right(); paint();
      ctx.say(ctx.speech?.nextSyllable || S.dictationEdit);
      return;
    }
    locked = true;
    paint();
    root.querySelectorAll('button').forEach(button => { button.disabled = true; });
    ctx.right(item.after);
  }
}

export function mountPaper(root, items, { profile } = {}) {
  const say = text => speak(text, { profile });
  const order = shuffle(items);
  let i = 0;
  const heading = h('div.challenge-title', '拿出纸和笔，先听再写');
  const note = h('div.challenge-help', '写完再揭晓，和家长一起核对。纸上练习不计星星。');
  const progress = h('div.counter');
  const answer = h('div.paper.paper-answer', { hidden: true });
  const listen = h('button.mc-btn.big', { onclick: () => say(order[i].say) }, spriteEl('speaker'), '听题目');
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
        h('button.mc-btn.go', { onclick: () => mountPaper(root, items, { profile }) }, '再练一轮'));
      return;
    }
    show();
  } }, '下一题');
  root.replaceChildren(heading, note, progress, listen, answer, h('div.row-btns', reveal, next));
  show();
  say(S.paperIntro);

  function show() {
    progress.textContent = `第 ${i + 1} / ${order.length} 题`;
    answer.replaceChildren();
    answer.hidden = next.hidden = true;
    reveal.disabled = false;
  }
}
