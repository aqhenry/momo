// 排顺序: tap the pieces in the right order (e.g. lines of a poem).
import { h, shuffle, shake, promptEl } from '../ui.js';
import { sfx } from '../audio.js';
import { S } from '../phrases.js';

export function render(root, item, ctx) {
  const pieces = item.pieces.map((text, i) => ({ text, i }));
  const long = item.pieces.some(p => p.length > 8);
  // en: spelling an English word from its letters (Andika, no letter names spoken; `after` says the word)
  const en = item.en ? '.en' : '';
  const built = h(`div.order-built${long ? '.long' : ''}${en}`);
  const pool = h(`div.order-pool${long ? '.long' : ''}${en}`);
  let next = 0;
  let firstMiss = true;

  item.pieces.forEach(() => built.append(h('div.order-slot')));
  for (const p of shuffle(pieces)) {
    const btn = h('button.order-piece', { onclick: () => tap(p, btn) }, p.text);
    pool.append(btn);
  }
  root.append(promptEl(item.prompt, ctx), built, pool);
  ctx.reveal = () => {
    item.pieces.forEach((t, k) => { built.children[k].textContent = t; built.children[k].classList.add('filled'); });
    pool.querySelectorAll('button').forEach(b => { b.disabled = true; b.classList.add('used'); });
  };

  function tap(p, btn) {
    if (btn.disabled) return;
    if (p.text === item.pieces[next]) {   // equal pieces (the two e's in bee) are interchangeable
      sfx.place();
      btn.disabled = true;
      btn.classList.add('used');
      const slot = built.children[next];
      slot.textContent = p.text;
      slot.classList.add('filled');
      if (!item.en) ctx.say(p.text);
      next++;
      if (next === pieces.length) ctx.right(item.after);
    } else {
      shake(btn);
      ctx.wrong(p.text, firstMiss ? (item.hint || S.orderWrong) : S.orderAgain);
      firstMiss = false;
    }
  }
}
