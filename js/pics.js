// Picture specs used in level data:
//   "🐓"            emoji (any text)
//   "block:dirt"    a pixel block texture
//   "svg:waterfall" a hand-drawn SVG below
//   "sprite:book"   a pixel icon from js/sprites.js
import { blockEl } from './blocks.js';
import { spriteEl } from './sprites.js';

const SVGS = {
  waterfall: `<svg viewBox="0 0 120 100"><rect width="120" height="100" fill="#bfe6ff"/>
    <path d="M0 30 L35 18 L50 30 L50 100 L0 100Z" fill="#6b8f5a"/><path d="M120 26 L84 16 L72 30 L72 100 L120 100Z" fill="#5f7f4f"/>
    <rect x="50" y="26" width="22" height="64" fill="#5aa9e6"/>
    <g stroke="#e8f6ff" stroke-width="2.5"><line x1="55" y1="28" x2="55" y2="88"/><line x1="61" y1="30" x2="61" y2="86"/><line x1="67" y1="28" x2="67" y2="88"/></g>
    <ellipse cx="61" cy="90" rx="30" ry="8" fill="#ffffff" opacity=".85"/><rect x="0" y="92" width="120" height="8" fill="#3d7fb8"/></svg>`,
  dam: `<svg viewBox="0 0 120 100"><rect width="120" height="100" fill="#cfeaff"/>
    <path d="M0 40 L30 28 L45 40Z M80 40 L104 24 L120 34 L120 40Z" fill="#6b8f5a"/>
    <rect x="0" y="40" width="120" height="16" fill="#4d93d1"/>
    <rect x="0" y="52" width="120" height="30" fill="#b9b9b9"/><rect x="0" y="50" width="120" height="5" fill="#8f8f8f"/>
    <g fill="#e6f4ff"><rect x="12" y="58" width="10" height="22"/><rect x="36" y="58" width="10" height="22"/><rect x="60" y="58" width="10" height="22"/><rect x="84" y="58" width="10" height="22"/><rect x="108" y="58" width="8" height="22"/></g>
    <rect x="0" y="82" width="120" height="18" fill="#3d7fb8"/></svg>`,
  painting: `<svg viewBox="0 0 120 100"><rect x="18" y="4" width="84" height="92" fill="#8a5a2b"/><rect x="24" y="10" width="72" height="80" fill="#f4ecd8"/>
    <path d="M24 70 L44 34 L58 56 L72 28 L96 70Z" fill="#5c6e5a"/><path d="M60 90 Q66 74 80 70 L96 70 L96 90Z" fill="#7bb0d8"/>
    <circle cx="40" cy="78" r="6" fill="#e86a8a"/><circle cx="48" cy="80" r="5" fill="#f19ab0"/><path d="M70 40 l5 -3 l5 3" stroke="#333" fill="none" stroke-width="1.5"/></svg>`,
};

export function picEl(spec, cls = '') {
  if (!spec) return document.createElement('span');
  if (spec.startsWith('block:')) {
    const el = blockEl(spec.slice(6), `pic ${cls}`);
    return el;
  }
  if (spec.startsWith('sprite:')) {
    const el = document.createElement('div');
    el.className = `pic pic-sprite ${cls}`;
    el.append(spriteEl(spec.slice(7)));
    return el;
  }
  if (spec.startsWith('svg:')) {
    const el = document.createElement('div');
    el.className = `pic pic-svg ${cls}`;
    el.innerHTML = SVGS[spec.slice(4)] || '';
    return el;
  }
  const el = document.createElement('div');
  el.className = `pic pic-emoji ${cls}`;
  el.textContent = spec;
  return el;
}
