// 排顺序: tap the pieces in the right order (e.g. lines of a poem).
import { h, shuffle, shake, promptEl } from '../ui.js';
import { sfx } from '../audio.js';
import { S } from '../phrases.js';

export function render(root, item, ctx) {
  const pieces = item.pieces.map((text, i) => ({ text, i }));
  const built = h('div.order-built');
  const pool = h('div.order-pool');
  let next = 0;
  let firstMiss = true;

  item.pieces.forEach(() => built.append(h('div.order-slot')));
  for (const p of shuffle(pieces)) {
    const btn = h('button.order-piece', { onclick: () => tap(p, btn) }, p.text);
    pool.append(btn);
  }
  root.append(promptEl(item.prompt, ctx), built, pool);

  function tap(p, btn) {
    if (btn.disabled) return;
    if (p.i === next) {
      sfx.place();
      btn.disabled = true;
      btn.classList.add('used');
      const slot = built.children[next];
      slot.textContent = p.text;
      slot.classList.add('filled');
      ctx.say(p.text);
      next++;
      if (next === pieces.length) ctx.right(item.after);
    } else {
      shake(btn);
      ctx.wrong(p.text, firstMiss ? (item.hint || S.orderWrong) : S.orderAgain);
      firstMiss = false;
    }
  }
}
