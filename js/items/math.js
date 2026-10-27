// Math items. Pictures are built by repeating library pictures (art/*.png), so a new count never needs new art.
//   calc    — an equation with blanks: □ for a number, ○ for a sign. Mental maths, missing numbers, > < =,
//             picture → equation, word problems. Optional `scene` picture above it.
//   craft   — number bonds on a crafting table: a + b → total, one of them missing.
//   pattern — boxes that grow by a rule (crops each day); fill in the next one.
import { h, shake, promptEl, wait } from '../ui.js';
import { artEl } from '../pics.js';
import { sfx } from '../audio.js';

// ---------- pictures ----------
function icon(name) {
  return name === 'circle' ? h('span.m-circle') : artEl(name, 'm-art');
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
    const row = h('div.m-scene');
    sc.groups.forEach((gr, i) => {
      if (i) row.append(h('div.m-op', sc.op || '+'));
      row.append(groupEl(gr.art, gr.n, gr));
    });
    return row;
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
  const hasSign = blanks.some(b => b.kind === 'sign');
  const signs = item.signs || (tokens.includes('=') ? ['>', '<', '='] : ['+', '-']);
  const numPad = blanks.some(b => b.kind === 'num') ? numpad(item.pad ?? 5, key) : null;
  const sgnPad = hasSign ? signpad(signs, key) : null;

  const scene = sceneEl(item.scene);
  root.append(promptEl(item.prompt, ctx));
  if (scene) root.append(h('div.frame.m-frame', scene));
  root.append(eqEl, h('div.m-pads', sgnPad, numPad));
  let busy = false;
  paint();

  function next() { return blanks.find(b => b.val === ''); }
  function paint() {
    const n = next();
    blanks.forEach(b => {
      b.el.textContent = b.val;
      b.el.classList.toggle('now', b === n);
    });
    numPad?.classList.toggle('off', !n || n.kind !== 'num');
    sgnPad?.classList.toggle('off', !n || n.kind !== 'sign');
  }
  async function key(k) {
    if (busy) return;
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
    const ok = item.accept ? item.accept.includes(str) : isTrue(filled);
    if (ok) {
      busy = true;
      blanks.forEach(b => b.el.classList.add('right'));
      ctx.right(item.after);
      return;
    }
    busy = true;
    blanks.forEach(b => b.el.classList.add('wrong'));
    shake(eqEl);
    ctx.wrong(str, item.hint);
    await wait(1000);
    blanks.forEach(b => { b.val = ''; b.el.classList.remove('wrong'); });
    busy = false;
    paint();
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
  root.append(promptEl(item.prompt, ctx), h('div.mc-panel.m-table', h('div.panel-title', '合成台'), table), numpad(item.pad ?? 5, key));
  let busy = false;

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
