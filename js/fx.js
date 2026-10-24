// Little celebrations: block-break bits, XP orbs flying to the XP bar, a block flying into the hotbar.
import { blockURL } from './blocks.js';

let last = { x: innerWidth / 2, y: innerHeight / 2 };
document.addEventListener('pointerdown', e => { last = { x: e.clientX, y: e.clientY }; }, { capture: true });
export const lastTap = () => last;

function el(cls, x, y, style = {}) {
  const d = document.createElement('div');
  d.className = `fx ${cls}`;
  Object.assign(d.style, { left: `${x}px`, top: `${y}px`, ...style });
  document.body.append(d);
  return d;
}

const center = node => {
  const r = node.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

// Square bits bursting out and falling, coloured like the block just earned.
export function burst(type, at = last, n = 14) {
  const tex = blockURL(type);
  for (let i = 0; i < n; i++) {
    const b = el('bit', at.x - 5, at.y - 5, { background: `url(${tex}) ${Math.random() * 100}% ${Math.random() * 100}% / 160px` });
    const dx = (Math.random() - 0.5) * 260, up = 80 + Math.random() * 140;
    b.animate([
      { transform: 'translate(0,0) scale(1)' },
      { transform: `translate(${dx * 0.6}px, ${-up}px) scale(1)`, offset: 0.4 },
      { transform: `translate(${dx}px, ${120}px) scale(.6)`, opacity: 0 },
    ], { duration: 700 + Math.random() * 300, easing: 'cubic-bezier(.2,.6,.4,1)' }).onfinish = () => b.remove();
  }
}

// Green orbs drifting into a target element (the XP bar).
export function orbs(target, at = last, n = 6) {
  if (!target) return;
  const to = center(target);
  for (let i = 0; i < n; i++) {
    const o = el('orb', at.x - 7, at.y - 7);
    const mx = (Math.random() - 0.5) * 160, my = -60 - Math.random() * 80;
    o.animate([
      { transform: 'translate(0,0) scale(.4)' },
      { transform: `translate(${mx}px, ${my}px) scale(1)`, offset: 0.35 },
      { transform: `translate(${to.x - at.x}px, ${to.y - at.y}px) scale(.5)`, opacity: 0.2 },
    ], { duration: 700 + i * 70, easing: 'ease-in', delay: i * 40 }).onfinish = () => o.remove();
  }
}

// One block flies from the tap point into a slot.
export function flyTo(type, target, at = last) {
  if (!target) return Promise.resolve();
  const to = center(target);
  const b = el('flyblock', at.x - 32, at.y - 32, { backgroundImage: `url(${blockURL(type)})` });
  const anim = b.animate([
    { transform: 'translate(0,0) scale(.3) rotate(0)' },
    { transform: 'translate(0,-70px) scale(1.2) rotate(-12deg)', offset: 0.3 },
    { transform: `translate(${to.x - at.x}px, ${to.y - at.y}px) scale(.5) rotate(20deg)` },
  ], { duration: 750, easing: 'cubic-bezier(.3,.1,.3,1)' });
  return new Promise(r => { anim.onfinish = () => { b.remove(); r(); }; });
}
