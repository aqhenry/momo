// 拼写音节: build each syllable on 四线三格 from 声母 tiles + 带调韵母 tiles.
import { h, shuffle, shake, promptEl, wait } from '../ui.js';
import { gridSVG, split, stripTone, toneOf, withTone } from '../pinyin.js';
import { sfx } from '../audio.js';
import { S } from '../phrases.js';

const CONFUSE = { b: ['d', 'p'], d: ['b', 't'], p: ['b', 'm'], m: ['n'], n: ['m', 'l'], l: ['n'], t: ['f', 'd'], f: ['t'], y: ['w'], w: ['y'] };

// Needed tiles plus a few look-alike distractors, capped so the tray stays readable.
function pools(sylls, item) {
  const needIni = new Set(sylls.map(s => s.initial).filter(Boolean));
  const needFin = new Set(sylls.map(s => s.final));
  const xIni = new Set(item.extraInitials || []), xFin = new Set(item.extraFinals || []);
  for (const s of sylls) {
    (CONFUSE[s.initial] || []).forEach(x => xIni.add(x));
    const t = toneOf(s.final);
    shuffle([1, 2, 3, 4].filter(k => k !== t)).slice(0, 2).forEach(k => xFin.add(withTone(s.final, k)));
  }
  const fill = (need, extra, cap) =>
    shuffle([...need, ...shuffle([...extra].filter(x => !need.has(x))).slice(0, Math.max(2, cap - need.size))]);
  return { ini: fill(needIni, xIni, 5), fin: fill(needFin, xFin, 7) };
}

export function render(root, item, ctx) {
  const sylls = item.word.trim().split(/\s+/).map(split);
  // fill order: [{syl, kind:'ini'|'fin', want, el, got}]
  const slots = [];
  const word = h('div.spell-word');
  sylls.forEach((s, si) => {
    const group = h('div.spell-syl');
    if (s.initial) slots.push({ si, kind: 'ini', want: s.initial });
    slots.push({ si, kind: 'fin', want: s.final });
    for (const slot of slots.filter(x => x.si === si)) {
      slot.el = h(`button.slot.${slot.kind}`, { onclick: () => clear(slot) });
      group.append(slot.el);
    }
    word.append(group);
  });

  const { ini, fin } = pools(sylls, item);
  const tileRow = (list, kind, label) => h('div.tile-row',
    h(`span.tag.${kind}`, label),
    list.map(x => h(`button.tile.${kind}`, { onclick: () => put(x, kind) }, gridSVG(x, 25, { minWidth: 58 }))));

  const prompt = promptEl(item.prompt, ctx);
  if (item.prompt?.pic && (item.prompt.context || item.prompt.label)) prompt.classList.add('row');
  root.append(prompt, word, h('div.tiles.split', tileRow(ini, 'ini', '声母'), tileRow(fin, 'fin', '韵母')));
  slots.forEach(paint);
  let busy = false;

  function paint(slot) {
    slot.el.innerHTML = '';
    slot.el.append(gridSVG(slot.got || '', 40, { minWidth: 80 }));
    const next = slots.find(s => !s.got);
    slots.forEach(s => s.el.classList.toggle('now', s === next));
  }

  function clear(slot) {
    if (busy || !slot.got) return;
    slot.got = null;
    sfx.dig();
    slots.forEach(paint);
  }

  async function put(x, kind) {
    if (busy) return;
    const slot = slots.find(s => !s.got);
    if (!slot) return;
    if (slot.kind !== kind) {
      sfx.wrong();
      shake(slot.el);
      ctx.say(slot.kind === 'ini' ? S.spellIniFirst : S.spellFinNow);
      return;
    }
    slot.got = x;
    sfx.place();
    slots.forEach(paint);
    if (slots.every(s => s.got)) await check();
  }

  async function check() {
    const bad = slots.filter(s => s.got !== s.want);
    if (!bad.length) {
      busy = true;
      slots.forEach(s => s.el.classList.add('right'));
      ctx.right(item.after);
      return;
    }
    busy = true;
    bad.forEach(s => { s.el.classList.add('wrong'); shake(s.el); });
    const got = sylls.map((_, si) => slots.filter(s => s.si === si).map(s => s.got).join('')).join(' ');
    ctx.wrong(got, item.hint || hintFor(bad));
    await wait(1100);
    bad.forEach(s => { s.el.classList.remove('wrong'); s.got = null; });
    slots.forEach(paint);
    busy = false;
  }
}

function hintFor(bad) {
  if (bad.some(s => s.kind === 'ini')) return S.spellBadIni;
  if (bad.every(s => stripTone(s.got) === stripTone(s.want))) return S.spellBadTone;
  return S.spellBadOther;
}
