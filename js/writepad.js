// Big finger-writing box that stands in for the number keypad. He writes a number; after a short pause it is
// recognised (js/digits.js). It never marks him wrong on a doubtful read:
//   - confident, or the best guesses include a value that would be correct here -> filled in
//   - otherwise the top two guesses appear as big buttons ("是 7 吗？") next to an erase button
// onKey(value) fills the current blank (same contract as the keypad); onKey('back') clears the last filled blank.
import { h } from './ui.js';
import { recognise, loadDigits } from './digits.js';
import { spriteEl } from './sprites.js';
import { sfx } from './audio.js';

const SURE = 0.85;      // top guess this likely -> just take it
const NEAR = 0.2;       // a correct value at least this likely -> take it

export function writePad(onKey, { expect = () => null, say } = {}) {
  loadDigits();
  const SIZE = 300;
  const canvas = h('canvas.wp-canvas');
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = canvas.height = SIZE * dpr;
  const g = canvas.getContext('2d');
  g.scale(dpr, dpr);
  const choices = h('div.wp-choices');
  const erase = h('button.mc-btn.wp-erase', { 'aria-label': '擦掉', onclick: () => {
    sfx.dig();
    if (strokes.length || choices.childElementCount) clear(); else onKey('back');
  } }, spriteEl('erase'));
  const box = h('div.wp', h('div.wp-board', canvas), h('div.wp-side', erase, choices));
  let strokes = [], cur = null, timer = null, busy = false;

  function paint() {
    g.clearRect(0, 0, SIZE, SIZE);
    g.lineCap = g.lineJoin = 'round';
    g.lineWidth = 14;
    g.strokeStyle = '#26303a';
    for (const s of strokes) {
      g.beginPath();
      s.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
      if (s.length === 1) g.lineTo(s[0].x + 0.1, s[0].y);
      g.stroke();
    }
  }
  function clear() {
    strokes = []; cur = null; clearTimeout(timer);
    choices.replaceChildren();
    paint();
  }
  const pos = e => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * SIZE / r.width, y: (e.clientY - r.top) * SIZE / r.height }; };
  canvas.addEventListener('pointerdown', e => {
    if (busy || box.classList.contains('off')) return;
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* synthetic or lost pointer */ }
    clearTimeout(timer);
    choices.replaceChildren();
    cur = [pos(e)];
    strokes.push(cur);
    paint();
  });
  canvas.addEventListener('pointermove', e => {
    if (!cur) return;
    e.preventDefault();
    const evs = e.getCoalescedEvents?.();
    for (const ev of evs?.length ? evs : [e]) cur.push(pos(ev));
    paint();
  });
  const up = () => {
    if (!cur) return;
    cur = null;
    clearTimeout(timer);
    timer = setTimeout(read, 800);
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);

  async function read() {
    if (!strokes.length) return;
    // a stray tap or tiny scribble is not a digit
    const pts = strokes.flat(), xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    if (Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) < SIZE * 0.08) { clear(); return; }
    busy = true;
    let digits;
    try { digits = await recognise(strokes, SIZE * 0.04); } catch (e) { busy = false; return; }
    busy = false;
    if (!digits.length || digits.length > 2) { clear(); return; }
    const best = digits.map(c => c[0].d).join('');
    const sure = digits.every(c => c[0].p >= SURE);
    // every reading whose digits are all at least NEAR likely (top two per digit)
    const readings = digits.reduce((acc, c) => acc.flatMap(a => c.slice(0, 2).filter(x => x.p >= NEAR).map(x => a + x.d)), ['']);
    const ok = expect();
    const fit = ok && readings.find(r => ok.includes(r));
    if (fit) return take(fit);
    if (sure) return take(best);
    // not sure: offer the top readings to tap
    const offer = [...new Set([best, ...readings])].slice(0, 2);
    choices.replaceChildren(...offer.map(v => h('button.mc-btn.wp-choice', { onclick: () => take(v) }, v)));
    say?.();
  }
  function take(v) {
    sfx.tap();
    clear();
    onKey(v);
  }
  return box;
}
