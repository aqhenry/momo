// Math items. Pictures are built by repeating library pictures (art/*.png), so a new count never needs new art.
//   calc    — an equation with blanks: □ for a number, ○ for a sign. Mental maths, missing numbers, > < =,
//             picture → equation, word problems. Optional `scene` picture above it.
//   craft   — number bonds on a crafting table: a + b → total, one of them missing.
//   pattern — boxes that grow by a rule (crops each day); fill in the next one.
import { h, shake, promptEl, wait } from '../ui.js';
import { sfx } from '../audio.js';
import { mathArt } from './math-explore.js';
import { writePad } from '../writepad.js';
import { S } from '../phrases.js';

// ---------- pictures ----------
function icon(name) {
  return name === 'circle' ? h('span.m-circle') : mathArt(name);
}

function groupEl(art, n, { cross = 0, gone = 0, goneArt, tap = false, size } = {}) {
  const g = h('div.m-group');
  if (size) g.classList.add(size);
  for (let i = 0; i < n; i++) {
    const isGone = i >= n - gone;
    const cell = h('span.m-cell', icon(isGone && goneArt ? goneArt : art));
    if (i >= n - cross) cell.classList.add('crossed');
    if (tap) {
      cell.classList.add('tappable');
      cell.addEventListener('click', () => { cell.classList.toggle('crossed'); sfx.tap(); });
    }
    g.append(cell);
  }
  return g;
}

// scene: {groups:[{art,n},...], op} | {art, n, cross, gone, goneArt, tap} | {pairs:[{art,n},{art,n}]}
export function sceneEl(sc) {
  if (!sc) return null;
  if (sc.groups) {
    // a group with `hide` is a closed box with "?" (the unknown part); `total` labels the whole under a brace
    const row = h('div.m-scene');
    sc.groups.forEach((gr, i) => {
      if (i && sc.op) row.append(h('div.m-op', sc.op));
      row.append(gr.hide ? h('div.m-group.m-unknown', icon(gr.art), h('span.m-q', '?')) : groupEl(gr.art, gr.n, gr));
    });
    if (sc.total === undefined) return row;
    return h('div.m-whole', row, h('div.m-brace'), h('div.m-total', String(sc.total)));
  }
  if (sc.pairs) {
    const max = Math.max(...sc.pairs.map(p => p.n));
    const box = h('div.m-pairs');
    for (const p of sc.pairs) {
      const row = h('div.m-pair-row');
      for (let i = 0; i < max; i++) row.append(i < p.n ? h('span.m-cell', icon(p.art)) : h('span.m-cell.empty'));
      box.append(row);
    }
    return box;
  }
  return h('div.m-scene', groupEl(sc.art, sc.n, sc));
}

// ---------- number pad ----------
function numpad(max, onKey) {
  const pad = h('div.m-pad');
  for (let d = 0; d <= max; d++) pad.append(h('button.mc-btn.m-key', { onclick: () => onKey(String(d)) }, String(d)));
  pad.append(h('button.mc-btn.m-key.back', { onclick: () => onKey('back') }, '⌫'));
  return pad;
}
function signpad(signs, onKey) {
  return h('div.m-pad.signs', signs.map(s => h('button.mc-btn.m-key.sign', { onclick: () => onKey(s) }, s)));
}

// ---------- equation checking ----------
const TOKEN = /(\d+|□|○|[+\-=<>])/g;
function sideValue(tokens) {
  let v = Number(tokens[0]);
  for (let i = 1; i < tokens.length; i += 2) v = tokens[i] === '+' ? v + Number(tokens[i + 1]) : v - Number(tokens[i + 1]);
  return v;
}
function isTrue(tokens) {
  const k = tokens.findIndex(t => t === '=' || t === '<' || t === '>');
  if (k < 1) return false;
  const l = sideValue(tokens.slice(0, k)), r = sideValue(tokens.slice(k + 1));
  return tokens[k] === '=' ? l === r : tokens[k] === '>' ? l > r : l < r;
}

// ---------- calc ----------
export function renderCalc(root, item, ctx) {
  const tokens = item.eq.match(TOKEN);
  const blanks = [];
  const eqEl = h('div.m-eq');
  tokens.forEach((t, i) => {
    if (t === '□' || t === '○') {
      const b = { i, kind: t === '□' ? 'num' : 'sign', el: h(`span.m-box.blank.${t === '□' ? 'num' : 'sign'}`), val: '' };
      blanks.push(b);
      eqEl.append(b.el);
    } else if (/\d/.test(t)) eqEl.append(h('span.m-box', t));
    else eqEl.append(h('span.m-sign', t));
  });
  // `mid`: 连加连减 — write the result of the first two numbers first (the box under them on the worksheet)
  const midB = item.mid ? { i: 2.5, kind: 'num', mid: true, el: h('span.m-box.blank.num'), val: '' } : null;
  const midLabel = h('span.m-mid-label');
  if (midB) { blanks.push(midB); blanks.sort((a, b) => a.i - b.i); }
  const midRow = midB ? h('div.m-mid', h('span.m-mid-tag', '先算'), midLabel, midB.el) : null;
  const valAt = i => blanks.find(b => b.i === i)?.val || tokens[i];
  const midValue = () => (/^\d+$/.test(valAt(0)) && /^\d+$/.test(valAt(2)) ? sideValue([valAt(0), valAt(1), valAt(2)]) : null);
  let revealed = false;
  const hasSign = blanks.some(b => b.kind === 'sign');
  const signs = item.signs || (tokens.includes('=') ? ['>', '<', '='] : ['+', '-']);
  const hasNum = blanks.some(b => b.kind === 'num');
  const numPad = !hasNum ? null : ctx.write ? writePad(key, { expect: expectHere, say: () => ctx.say(S.writeConfirm) }) : numpad(item.pad ?? 5, key);
  const sgnPad = hasSign ? signpad(signs, key) : null;

  const scene = sceneEl(item.scene);
  if (ctx.write && numPad) {
    // writing layout: picture + equation on the left, the big writing box on the right
    root.classList.add('write-body');
    root.append(h('div.m-write', h('div.m-write-left', promptEl(item.prompt, ctx), scene ? h('div.frame.m-frame', scene) : null, eqEl, midRow, sgnPad), numPad));
  } else {
    root.append(promptEl(item.prompt, ctx));
    if (scene) root.append(h('div.frame.m-frame', scene));
    root.append(eqEl, midRow, h('div.m-pads', sgnPad, numPad));
  }
  let busy = false;
  paint();
  ctx.reveal = () => {
    busy = revealed = true;
    const answer = item.accept?.[0]?.match(TOKEN) || solveAll();
    if (!answer) return;
    blanks.forEach(b => {
      b.val = b.mid ? String(sideValue(answer.slice(0, 3))) : answer[b.i];
      b.el.textContent = b.val; b.el.classList.remove('wrong', 'now'); b.el.classList.add('right');
    });
    if (midB) midLabel.textContent = `${answer[0]}${answer[1]}${answer[2]}=`;
  };
  // one true filling of all blanks (for showing the answer); numbers 0..20, signs from the sign pad
  const choicesFor = b => (b.kind === 'num' ? Array.from({ length: 21 }, (_, v) => String(v)) : signs);
  // could the blanks in `fixed` ({index: value}) be part of a right answer, whatever goes in the other blanks?
  function fits(fixed) {
    if (item.accept) return item.accept.some(a => { const t = a.match(TOKEN); return Object.entries(fixed).every(([i, v]) => t[i] === v); });
    const free = blanks.filter(b => !b.mid && !(b.i in fixed));
    const cur = [...tokens];
    for (const [i, v] of Object.entries(fixed)) cur[i] = v;
    const fill = k => {
      if (k === free.length) return isTrue(cur);
      for (const v of choicesFor(free[k])) { cur[free[k].i] = v; if (fill(k + 1)) return true; }
      cur[free[k].i] = '□';
      return false;
    };
    return fill(0);
  }
  function solveAll() {
    const real = blanks.filter(b => !b.mid);
    const fill = (k, cur) => {
      if (k === real.length) return isTrue(cur) ? cur : null;
      for (const v of choicesFor(real[k])) { const c = [...cur]; c[real[k].i] = v; const r = fill(k + 1, c); if (r) return r; }
      return null;
    };
    return fill(0, [...tokens]);
  }

  function next() { return blanks.find(b => b.val === ''); }
  // values that would be right in the current blank (lets the writing pad trust a so-so read of the right answer)
  function expectHere() {
    const n = next();
    if (!n || n.kind !== 'num') return null;
    if (n.mid) return midValue() === null ? null : [String(midValue())];
    const filledAt = v => tokens.map((t, i) => (i === n.i ? v : blanks.find(b => b.i === i)?.val || t));
    if (blanks.filter(b => b.val === '').length === 1) {
      const vals = [];
      for (let v = 0; v <= 20; v++) {
        const f = filledAt(String(v));
        if (item.accept ? item.accept.includes(f.join('')) : isTrue(f)) vals.push(String(v));
      }
      return vals;
    }
    return item.accept ? [...new Set(item.accept.map(a => a.match(TOKEN)[n.i]))] : null;
  }
  function paint() {
    const n = next();
    blanks.forEach(b => {
      b.el.textContent = b.val;
      b.el.classList.toggle('now', b === n);
    });
    if (midB && !revealed) midLabel.textContent = `${valAt(0) === '□' ? '?' : valAt(0)}${valAt(1)}${valAt(2) === '□' ? '?' : valAt(2)}=`;
    numPad?.classList.toggle('off', !n || n.kind !== 'num');
    sgnPad?.classList.toggle('off', !n || n.kind !== 'sign');
  }
  let pending = null;   // a number written while the last wrong answer was still showing: used once it clears
  async function key(k) {
    if (busy) { if (k !== 'back' && !revealed) pending = k; return; }
    if (k === 'back') {
      const filled = blanks.filter(b => b.val !== '');
      if (filled.length) { filled.at(-1).val = ''; sfx.dig(); paint(); }
      return;
    }
    const n = next();
    if (!n) return;
    if ((n.kind === 'num') !== /\d/.test(k)) return;
    n.val = k;
    sfx.tap();
    paint();
    if (!next()) await check();
  }
  async function check() {
    const filled = tokens.map((t, i) => blanks.find(b => b.i === i)?.val ?? t);
    const str = filled.join('');
    const midOk = !midB || Number(midB.val) === midValue();
    const mainOk = item.accept ? item.accept.includes(str) : isTrue(filled);
    const ok = midOk && mainOk;
    if (ok) {
      busy = true;
      blanks.forEach(b => b.el.classList.add('right'));
      ctx.right(item.after);
      return;
    }
    busy = true;
    // only the blanks that cannot be right are cleared; the rest of his answer stays
    const real = blanks.filter(b => !b.mid);
    let bad = mainOk ? [] : real.filter(b => !fits({ [b.i]: b.val }));
    if (!mainOk && !bad.length) bad = real;
    if (!midOk) bad.push(midB);
    bad.forEach(b => b.el.classList.add('wrong'));
    shake(eqEl);
    ctx.wrong(str, item.hint);
    await wait(1000);
    if (revealed) return;                 // the answer is showing now (challenge mode)
    bad.forEach(b => { b.val = ''; b.el.classList.remove('wrong'); });
    busy = false;
    paint();
    if (pending) { const k = pending; pending = null; key(k); }
  }
}

// ---------- craft (number bonds) ----------
export function renderCraft(root, item, ctx) {
  const want = item[item.blank];
  const slot = (key, art, n, out = false) => {
    const missing = key === item.blank;
    const el = h(`div.m-slot${out ? '.out' : ''}${missing ? '.missing' : ''}`,
      art ? h('div.m-slot-art', missing ? null : groupEl(art, n, { size: 'tiny' })) : null,
      h('div.m-slot-num', missing ? '?' : String(n)));
    return el;
  };
  const sa = slot('a', item.art, item.a), sb = slot('b', item.art, item.b);
  const st = slot('total', item.outArt || item.art, item.total, true);
  const table = h('div.m-craft',
    h('div.m-craft-in', sa, h('div.m-plus', '+'), sb),
    h('div.m-arrow', '➜'),
    st);
  const target = { a: sa, b: sb, total: st }[item.blank];
  const table2 = h('div.mc-panel.m-table', h('div.panel-title', '合成台'), table);
  if (ctx.write) {
    root.classList.add('write-body');
    root.append(h('div.m-write', h('div.m-write-left', promptEl(item.prompt, ctx), table2),
      writePad(key, { expect: () => [String(want)], say: () => ctx.say(S.writeConfirm) })));
  } else root.append(promptEl(item.prompt, ctx), table2, numpad(item.pad ?? 5, key));
  let busy = false, revealed = false;
  ctx.reveal = () => {
    busy = revealed = true;
    target.querySelector('.m-slot-num').textContent = String(want);
    target.classList.remove('missing', 'wrong');
    target.classList.add('right');
  };

  async function key(k) {
    if (busy || k === 'back') return;
    sfx.tap();
    const v = Number(k);
    const num = target.querySelector('.m-slot-num');
    num.textContent = k;
    if (v === want) {
      busy = true;
      target.classList.remove('missing');
      target.classList.add('right');
      if (target.querySelector('.m-slot-art')) {
        const art = target === st ? (item.outArt || item.art) : item.art;
        target.querySelector('.m-slot-art').append(groupEl(art, v, { size: 'tiny' }));
      }
      table.classList.add('crafted');
      ctx.right(item.after);
    } else {
      busy = true;
      target.classList.add('wrong');
      shake(target);
      ctx.wrong(k, item.hint);
      await wait(900);
      if (revealed) return;
      target.classList.remove('wrong');
      num.textContent = '?';
      busy = false;
    }
  }
}

// ---------- pattern ----------
export function renderPattern(root, item, ctx) {
  const boxes = item.seq.map((n, i) => {
    const day = h('div.m-day-label', item.labels?.[i] || `第${'一二三四五六'[i]}天`);
    const body = n === null ? h('div.m-day-body.missing', h('span.m-q', '?')) : h('div.m-day-body', groupEl(item.art, n, { size: 'small' }));
    const count = h('div.m-day-count', n === null ? '' : String(n));
    return { n, el: h('div.m-day', day, body, count), body, count };
  });
  const hole = boxes.find(b => b.n === null);
  const want = item.answer;
  root.append(promptEl(item.prompt, ctx), h('div.m-days', boxes.map(b => b.el)), numpad(item.pad ?? 9, key));
  let busy = false;

  async function key(k) {
    if (busy || k === 'back') return;
    sfx.tap();
    hole.count.textContent = k;
    if (Number(k) === want) {
      busy = true;
      hole.body.classList.remove('missing');
      hole.body.innerHTML = '';
      hole.body.append(groupEl(item.art, want, { size: 'small' }));
      hole.el.classList.add('right');
      ctx.right(item.after);
    } else {
      busy = true;
      hole.el.classList.add('wrong');
      shake(hole.el);
      ctx.wrong(k, item.hint);
      await wait(900);
      hole.el.classList.remove('wrong');
      hole.count.textContent = '';
      busy = false;
    }
  }
}

// ---------- four: 一图四式 ----------
// One picture, several equation rows to fill (`eqs`, e.g. two additions and two subtractions); every row
// must be a different one of `answers` (any order within the same sign). Rows are checked as they are finished.
export function renderFour(root, item, ctx) {
  const rows = item.eqs.map(eq => {
    const tokens = eq.match(TOKEN), el = h('div.m-eq.four-row'), blanks = [];
    tokens.forEach((t, i) => {
      if (t === '□') { const b = { i, el: h('span.m-box.blank.num'), val: '' }; blanks.push(b); el.append(b.el); }
      else el.append(/\d/.test(t) ? h('span.m-box', t) : h('span.m-sign', t));
    });
    return { tokens, el, blanks, done: false };
  });
  const used = new Set();
  let busy = false, revealed = false;
  const cur = () => rows.find(r => !r.done);
  const nextBlank = () => cur()?.blanks.find(b => b.val === '');
  const rowStr = r => r.tokens.map((t, i) => r.blanks.find(b => b.i === i)?.val || t).join('');
  const candidates = r => item.answers.filter(a => !used.has(a) && a.match(TOKEN).length === r.tokens.length && a.match(TOKEN).every((t, i) => r.tokens[i] === '□' || r.tokens[i] === t));
  function expectHere() {
    const r = cur(), b = nextBlank();
    if (!b) return null;
    const fits = candidates(r).filter(a => { const at = a.match(TOKEN); return r.blanks.every(x => x.val === '' || x.val === at[x.i]); });
    return [...new Set(fits.map(a => a.match(TOKEN)[b.i]))];
  }
  const pad = ctx.write ? writePad(key, { expect: expectHere, say: () => ctx.say(S.writeConfirm) }) : numpad(item.pad ?? 9, key);
  const scene = sceneEl(item.scene);
  const eqs = h('div.four-rows', rows.map(r => r.el));
  root.classList.add('four-body');
  if (ctx.write) {
    root.classList.add('write-body');
    root.append(h('div.m-write', h('div.m-write-left', promptEl(item.prompt, ctx), scene ? h('div.frame.m-frame', scene) : null, eqs), pad));
  } else root.append(promptEl(item.prompt, ctx), scene ? h('div.frame.m-frame', scene) : null, eqs, pad);
  paint();

  function paint() {
    const b = nextBlank();
    rows.forEach(r => {
      r.blanks.forEach(x => { x.el.textContent = x.val; x.el.classList.toggle('now', x === b); });
      r.el.classList.toggle('active', r === cur());
    });
  }
  let pending = null;
  async function key(k) {
    if (busy) { if (k !== 'back' && !revealed) pending = k; return; }
    if (k === 'back') {
      const f = cur()?.blanks.filter(x => x.val !== '');
      if (f?.length) { f.at(-1).val = ''; sfx.dig(); paint(); }
      return;
    }
    const b = nextBlank();
    if (!b) return;
    b.val = k; sfx.tap(); paint();
    if (!nextBlank()) await checkRow();
  }
  async function checkRow() {
    const r = cur(), str = rowStr(r);
    if (candidates(r).includes(str)) {
      used.add(str); r.done = true;
      r.blanks.forEach(x => x.el.classList.add('right'));
      sfx.place();
      if (!cur()) { busy = true; ctx.right(item.after); } else paint();
      return;
    }
    busy = true;
    r.blanks.forEach(x => x.el.classList.add('wrong'));
    shake(r.el);
    // a right equation he has already written in another row is a reminder, not a mistake
    if (used.has(str)) ctx.nudge(S.fourSame);
    else ctx.wrong(str, item.hint);
    await wait(1000);
    if (revealed) return;
    r.blanks.forEach(x => { x.val = ''; x.el.classList.remove('wrong'); });
    busy = false;
    paint();
    if (pending) { const k = pending; pending = null; key(k); }
  }
  ctx.reveal = () => {
    busy = revealed = true;
    rows.forEach(r => {
      if (r.done) return;
      const a = candidates(r)[0];
      if (!a) return;
      used.add(a);
      const at = a.match(TOKEN);
      r.blanks.forEach(x => { x.val = at[x.i]; x.el.textContent = x.val; x.el.classList.remove('wrong', 'now'); x.el.classList.add('right'); });
      r.done = true;
    });
  };
}
