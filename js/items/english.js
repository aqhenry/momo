// English 指读 (point-and-read): listen to the sentence, then tap the words one by one from left to right;
// each tap reads that word. Mirrors "Listen, point and repeat" in the textbook.
//   pointRead: lines[] (English sentences), optional pic / n (repeat the picture n times), say, after.
import { h, shake } from '../ui.js';
import { picEl } from '../pics.js';
import { spriteEl } from '../sprites.js';
import { S } from '../phrases.js';

// the word as spoken: punctuation stripped, apostrophes kept (I'm)
export const spokenWord = w => w.replace(/[^A-Za-z']/g, '').replace(/^'+|'+$/g, '');
export const words = lines => lines.flatMap(l => l.split(/\s+/)).filter(w => spokenWord(w));

export function renderPointRead(root, item, ctx) {
  const tiles = [];
  const board = h('div.en-board');
  for (const line of item.lines) {
    const row = h('div.en-line');
    for (const w of line.split(/\s+/).filter(Boolean)) {
      if (!spokenWord(w)) { row.append(h('span.en-punct', w)); continue; }
      const tile = h('button.en-word', { onclick: () => tap(tile) }, w);
      tile.word = spokenWord(w);
      tiles.push(tile);
      row.append(tile);
    }
    board.append(row);
  }
  const finger = spriteEl('finger', 'en-finger');
  let next = 0, done = false, firstMiss = true;

  if (item.pic) {
    const pics = h('div.en-pics');
    for (let k = 0; k < (item.n || 1); k++) pics.append(picEl(item.pic, item.n > 1 ? '' : 'big'));
    root.append(h('div.frame.en-frame', pics));
  }
  root.append(board);
  paint();

  function paint() {
    tiles.forEach((t, k) => { t.classList.toggle('read', k < next); t.classList.toggle('now', k === next && !done); });
    if (!done && tiles[next]) tiles[next].append(finger); else finger.remove();
  }
  function tap(tile) {
    if (done) return;
    const k = tiles.indexOf(tile);
    if (k < next) { ctx.say(tile.word); return; }   // re-hear a word already read
    if (k !== next) {
      shake(tile);
      ctx.wrong(tile.word, firstMiss ? (item.hint || S.pointNext) : null);
      firstMiss = false;
      return;
    }
    ctx.say(tile.word);
    next++;
    if (next === tiles.length) done = true;
    paint();
    if (done) setTimeout(() => ctx.right(item.after || item.lines.join(' ')), 700);
  }
}
