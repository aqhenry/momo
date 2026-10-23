// 拼积木: initial brick + final brick = syllable brick, one of the three is missing.
import { h, shuffle, shake } from '../ui.js';
import { gridSVG, split, toneOf, withTone } from '../pinyin.js';

const CONFUSE = { b: ['d', 'p'], d: ['b', 't'], p: ['b', 'm'], m: ['n', 'f'], n: ['m', 'l'], l: ['n', 't'], t: ['f', 'd'], f: ['t', 'b'], y: ['w'], w: ['y'] };

function autoOptions(parts, missing) {
  const [ini, fin, syl] = parts;
  const set = new Set([parts[missing]]);
  if (missing === 0) (CONFUSE[ini] || ['b', 'd']).forEach(x => set.add(x));
  if (missing === 1) {
    const t = toneOf(fin);
    [1, 2, 3, 4].filter(k => k !== t).slice(0, 2).forEach(k => set.add(withTone(fin, k)));
  }
  if (missing === 2) {
    const t = toneOf(syl);
    set.add(ini + withTone(fin, t === 4 ? 3 : t + 1));
    set.add((CONFUSE[ini] || ['b'])[0] + fin);
  }
  return [...set];
}

export function render(root, item, ctx) {
  const parts = item.parts || (() => { const s = split(item.syllable); return [s.initial, s.final, item.syllable]; })();
  const missing = item.missing ?? 2;
  const options = shuffle(item.options || autoOptions(parts, missing));
  let locked = false;

  const brick = (text, cls) => h(`div.brick.${cls}`, text === null ? h('div.qmark', '?') : gridSVG(text, 40, { minWidth: 110 }));
  const slots = [brick(missing === 0 ? null : parts[0], 'ini'), brick(missing === 1 ? null : parts[1], 'fin'), brick(missing === 2 ? null : parts[2], 'syl')];
  const col = (tag, cls, slot) => h('div.brick-col', h(`span.tag.${cls}`, tag), slot);
  const row = h('div.blend-row', col('声母', 'ini', slots[0]), h('div.op', '+'), col('韵母', 'fin', slots[1]), h('div.op', '='), col('音节', 'syl', slots[2]));

  const tiles = h('div.tiles');
  for (const o of options) {
    const t = h('button.tile', { onclick: () => pick(o, t) }, gridSVG(o, 34, { minWidth: 90 }));
    tiles.append(t);
  }
  root.append(row, tiles);

  function pick(o, t) {
    if (locked || t.disabled) return;
    if (o === parts[missing]) {
      locked = true;
      const slot = slots[missing];
      slot.innerHTML = '';
      slot.append(gridSVG(o, 40, { minWidth: 110 }));
      slot.classList.add('filled');
      row.classList.add('snap');
      t.classList.add('right');
      ctx.right(item.after);
    } else {
      t.classList.add('wrong');
      t.disabled = true;
      shake(t);
      ctx.wrong(o, item.hint || (missing === 1 ? '听听声调，再找一找。' : retryHint(parts, missing)));
    }
  }
}

function retryHint(parts, missing) {
  if (missing === 0) return '看看拼出来的音节，它开头是哪个声母？';
  return '声母和韵母拼在一起，声调跟着韵母走哦。';
}
