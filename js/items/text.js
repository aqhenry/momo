// Reading items over a passage with pinyin above each character.
//   type 'read'    : listen + read along, then tap "我读好了"
//   type 'tapText' : tap every syllable that matches a rule, e.g. {base:'da'}, {final:'e'} or {finals:['ai','ei']}
//   type 'recite'  : the passage is hidden under blocks; he recites aloud and can dig a block to peek
import { h, shake, promptEl } from '../ui.js';
import { blockURL } from '../blocks.js';
import { split, stripTone } from '../pinyin.js';
import { sfx } from '../audio.js';
import { S, tapMissing, tapTotal } from '../phrases.js';

const isHan = c => /\p{Script=Han}/u.test(c);

// Pair characters with pinyin tokens (punctuation gets none).
function cells(lines, py) {
  return lines.map((line, li) => {
    const toks = py[li].trim().split(/\s+/);
    let k = 0;
    return [...line].map(c => ({ c, p: isHan(c) ? toks[k++] : null }));
  });
}

function passage(item, onTap) {
  const wrap = h('div.passage');
  const rows = cells(item.lines, item.py);
  rows.forEach(row => {
    const line = h('div.pline');
    row.forEach(cell => {
      const el = cell.p
        ? h('button.ruby', { onclick: () => onTap?.(cell, el) }, h('span.rp.py', cell.p), h('span.rc', cell.c))
        : h('span.ruby.punct', h('span.rp'), h('span.rc', cell.c));
      cell.el = el;
      line.append(el);
    });
    wrap.append(line);
  });
  return { wrap, rows };
}

function matches(rule, p) {
  if (!p) return false;
  if (rule.base) return stripTone(p) === rule.base;
  if (rule.final) return stripTone(split(p).final) === rule.final;
  if (rule.finals) return rule.finals.includes(stripTone(split(p).final));
  return false;
}

export function renderRead(root, item, ctx) {
  const { wrap } = passage(item, cell => ctx.say(item.tapSay?.[cell.p] || cell.p, cell.c));
  const again = h('button.mc-btn.small', { onclick: () => ctx.say(item.read || item.lines.join('')) }, '再听一遍');
  const done = h('button.mc-btn.go', { onclick: () => { done.disabled = true; ctx.right(item.after); } }, '我读好了！');
  if (item.title) root.append(h('div.ptitle', item.title));
  root.append(wrap, h('div.row-btns', again, done));
  setTimeout(() => ctx.say(item.read || item.lines.join('')), 900);
}

export function renderTap(root, item, ctx) {
  const picked = new Set();
  const counter = h('div.counter', '找到 0 个');
  const { wrap, rows } = passage(item, (cell, el) => {
    if (finished) return;
    sfx.tap();
    if (picked.has(cell)) picked.delete(cell); else picked.add(cell);
    el.classList.toggle('picked', picked.has(cell));
    counter.textContent = `找到 ${picked.size} 个`;
  });
  let finished = false;
  const all = rows.flat().filter(c => matches(item.rule, c.p));
  const check = h('button.mc-btn.go', { onclick: submit }, '找完了！');
  root.append(promptEl(item.prompt, ctx), wrap, h('div.row-btns', counter, check));

  function submit() {
    const wrongPicks = [...picked].filter(c => !matches(item.rule, c.p));
    const missed = all.filter(c => !picked.has(c));
    if (!wrongPicks.length && !missed.length) {
      finished = true;
      all.forEach(c => c.el.classList.add('right'));
      ctx.right(item.after || tapTotal(all.length));
      return;
    }
    wrongPicks.forEach(c => { c.el.classList.add('wrong'); shake(c.el); picked.delete(c); setTimeout(() => c.el.classList.remove('wrong', 'picked'), 1000); });
    counter.textContent = `找到 ${picked.size} 个`;
    const hint = wrongPicks.length ? S.tapWrong : tapMissing(missed.length);
    ctx.wrong(`选了${picked.size + wrongPicks.length}个，应为${all.length}个`, hint);
  }
}

export function renderRecite(root, item, ctx) {
  let finished = false;
  const { wrap, rows } = passage(item, (cell, el) => {
    if (finished || !el.classList.contains('covered')) return ctx.say(item.tapSay?.[cell.p] || cell.p, cell.c);
    sfx.dig();
    el.classList.remove('covered');
    ctx.say(item.tapSay?.[cell.p] || cell.p, cell.c);
  });
  rows.forEach(row => row.forEach((cell, k) => {
    if (!cell.p || (item.showFirst && k === 0)) return;
    cell.el.classList.add('covered');
    cell.el.style.setProperty('--cover', `url(${blockURL(item.cover || 'grass')})`);
  }));
  const done = h('button.mc-btn.go', { onclick: () => {
    if (finished) return;
    finished = true;
    done.disabled = true;
    rows.flat().forEach(c => c.el.classList.remove('covered'));
    ctx.right(item.after);
  } }, '我背好了！');
  if (item.title) root.append(h('div.ptitle', item.title));
  root.append(wrap, h('div.row-btns', done));
}
