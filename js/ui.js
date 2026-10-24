import { picEl } from './pics.js';
import { gridSVG } from './pinyin.js';

// Tiny element builder: h('div.cls', {onclick}, child, 'text', ...)
export function h(tag, props, ...kids) {
  const [name, ...cls] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (cls.length) el.className = cls.join(' ');
  if (props && (typeof props !== 'object' || props instanceof Node || Array.isArray(props))) {
    kids.unshift(props);
    props = null;
  }
  for (const [k, v] of Object.entries(props || {})) {
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else if (v !== undefined && v !== null && v !== false) el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

export const shuffle = arr => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export const wait = ms => new Promise(r => setTimeout(r, ms));

export function shake(el) {
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
}

// Text with ▢ placeholders: the first ▢ becomes the highlighted "current" blank.
export function contextLine(text) {
  const el = h('div.context');
  let first = true;
  for (const part of text.split(/(▢)/)) {
    if (part === '▢') {
      el.append(h(first ? 'span.blank.now' : 'span.blank', '　'));
      first = false;
    } else if (part) {
      // segments wrapped in {…} are pinyin
      for (const seg of part.split(/(\{[^}]*\})/)) {
        if (/^\{.*\}$/.test(seg)) el.append(h('span.py.inline', seg.slice(1, -1)));
        else if (seg) el.append(seg);
      }
    }
  }
  return el;
}

// Shared prompt block: picture, label, big text, pinyin on grid, info card, context sentence.
export function promptEl(p = {}, ctx) {
  const box = h('div.prompt');
  if (p.card) box.append(h('div.card', p.card.map(line => h('div', line))));
  if (p.pic) {
    const frame = h('div.frame', picEl(p.pic, 'big'));
    if (p.picSay) {
      frame.classList.add('tappable');
      frame.addEventListener('click', () => ctx.say(p.picSay));
    }
    box.append(frame);
  }
  if (p.label) box.append(h('div.label', p.label));
  if (p.text) box.append(h('div.ptext', p.text));
  if (p.py) box.append(h('div.paper', gridSVG(p.py, 36, { minWidth: 180 })));
  if (p.context) box.append(h('div.paper', contextLine(p.context)));
  return box;
}
