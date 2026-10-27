// Picture specs used in level data:
//   "🐓"            emoji (any text)
//   "block:dirt"    a pixel block texture
//   "sprite:book"   a pixel icon from js/sprites.js
//   "art:apple"     a picture from the pixel-art library (art/*.png, see tools/art_build.py)
//   "text:8"        big pixel-font text (numbers, signs)
import { blockEl } from './blocks.js';
import { spriteEl } from './sprites.js';

export function picEl(spec, cls = '') {
  if (!spec) return document.createElement('span');
  if (spec.startsWith('block:')) {
    const el = blockEl(spec.slice(6), `pic ${cls}`);
    return el;
  }
  if (spec.startsWith('art:')) return artEl(spec.slice(4), `pic pic-art ${cls}`);
  if (spec.startsWith('text:')) {
    const el = document.createElement('div');
    el.className = `pic pic-text ${cls}`;
    el.textContent = spec.slice(5);
    return el;
  }
  if (spec.startsWith('sprite:')) {
    const el = document.createElement('div');
    el.className = `pic pic-sprite ${cls}`;
    el.append(spriteEl(spec.slice(7)));
    return el;
  }
  const el = document.createElement('div');
  el.className = `pic pic-emoji ${cls}`;
  el.textContent = spec;
  return el;
}

export function artEl(name, cls = 'art') {
  const img = document.createElement('img');
  img.className = cls;
  img.src = `art/${name}.png`;
  img.alt = '';
  img.draggable = false;
  return img;
}
