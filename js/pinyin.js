// Pinyin helpers and 四线三格 rendering.
export const INITIALS = ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w'];

const TONED = {
  ā: 'a', á: 'a', ǎ: 'a', à: 'a', ō: 'o', ó: 'o', ǒ: 'o', ò: 'o', ē: 'e', é: 'e', ě: 'e', è: 'e',
  ī: 'i', í: 'i', ǐ: 'i', ì: 'i', ū: 'u', ú: 'u', ǔ: 'u', ù: 'u', ǖ: 'ü', ǘ: 'ü', ǚ: 'ü', ǜ: 'ü',
};
const TONES = { a: 'āáǎà', o: 'ōóǒò', e: 'ēéěè', i: 'īíǐì', u: 'ūúǔù', ü: 'ǖǘǚǜ' };

export const stripTone = s => [...s].map(c => TONED[c] || c).join('');

export function toneOf(s) {
  for (const c of s) {
    if (TONED[c]) return TONES[TONED[c]].indexOf(c) + 1;
  }
  return 0;
}

// The toned vowel in a syllable, e.g. 'mǎ' -> 'ǎ'.
export function withTone(final, tone) {
  const base = stripTone(final);
  if (!tone) return base;
  // tone goes on a > o > e > the last of i/u/ü
  const order = ['a', 'o', 'e'];
  let idx = -1;
  for (const v of order) { idx = base.indexOf(v); if (idx >= 0) break; }
  if (idx < 0) for (let k = base.length - 1; k >= 0; k--) if ('iuü'.includes(base[k])) { idx = k; break; }
  if (idx < 0) return base;
  return base.slice(0, idx) + TONES[base[idx]][tone - 1] + base.slice(idx + 1);
}

export function split(syl) {
  const plain = stripTone(syl);
  const ini = INITIALS.find(i => plain.startsWith(i) && plain.length > i.length) || '';
  return { initial: ini, final: syl.slice(ini.length) };
}

// --- 四线三格 ---
let xhRatio = 0.5;   // x-height / font-size for the pinyin font, measured once fonts load
export async function measureFont() {
  try { await document.fonts.load('400 100px Andika'); await document.fonts.ready; } catch (e) {}
  const c = document.createElement('canvas').getContext('2d');
  c.font = '100px Andika, sans-serif';
  const m = c.measureText('x');
  if (m.actualBoundingBoxAscent) xhRatio = m.actualBoundingBoxAscent / 100;
}

const measureCtx = document.createElement('canvas').getContext('2d');
function textWidth(text, size) {
  measureCtx.font = `${size}px Andika, sans-serif`;
  return measureCtx.measureText(text).width;
}

// Returns an <svg> showing `text` on four lines. `band` = height of one of the three spaces.
export function gridSVG(text, band = 28, { minWidth = 0, color = '#1b1b1b', pad = 0.35 } = {}) {
  const size = band / xhRatio;
  const w = Math.max(minWidth, textWidth(text, size) + band * pad * 2);
  const h = band * 3;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', w);
  svg.setAttribute('height', h + 2);
  svg.setAttribute('viewBox', `0 -1 ${w} ${h + 2}`);
  svg.classList.add('grid4');
  for (let i = 0; i < 4; i++) {
    const l = document.createElementNS(ns, 'line');
    l.setAttribute('x1', 0); l.setAttribute('x2', w);
    l.setAttribute('y1', i * band); l.setAttribute('y2', i * band);
    l.setAttribute('class', i === 2 ? 'gl gl-base' : 'gl');
    svg.appendChild(l);
  }
  if (text) {
    const t = document.createElementNS(ns, 'text');
    t.setAttribute('x', w / 2);
    t.setAttribute('y', band * 2);
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('font-size', size);
    t.setAttribute('fill', color);
    t.setAttribute('class', 'py');
    t.textContent = text;
    svg.appendChild(t);
  }
  return svg;
}
