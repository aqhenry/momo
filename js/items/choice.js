// Pick one answer. Options can be pictures, Chinese text, or pinyin (optionally on 四线三格).
// listen: true -> tapping an option reads it aloud and selects it; a confirm button submits.
import { h, shuffle, shake, promptEl } from '../ui.js';
import { picEl } from '../pics.js';
import { gridSVG } from '../pinyin.js';

export function render(root, item, ctx) {
  const opts = item.options.map((o, i) => ({ ...(typeof o === 'string' ? { text: o } : o), i }));
  const order = item.fixed ? opts : shuffle(opts);
  let selected = null;
  let locked = false;

  const grid = h(`div.options.cols-${item.cols || Math.min(order.length, 4)}`);
  const confirm = item.listen ? h('button.mc-btn.go.confirm', { disabled: true, onclick: submit }, '就选它！') : null;

  for (const o of order) {
    const btn = h('button.option', { onclick: () => tap(o, btn) });
    if (o.pic) btn.append(picEl(o.pic));
    if (o.py) btn.append(o.grid ? gridSVG(o.py, item.band || 34, { minWidth: 150 }) : h('div.py.opt-py', o.py));
    if (o.text) btn.append(h(o.big ? 'div.opt-text.big' : 'div.opt-text', o.text));
    o.btn = btn;
    grid.append(btn);
  }

  root.append(promptEl(item.prompt, ctx), grid);
  if (confirm) root.append(confirm);

  function tap(o, btn) {
    if (locked || btn.disabled) return;
    if (item.listen) {
      ctx.say(o.say || o.text || '');
      order.forEach(x => x.btn.classList.toggle('selected', x === o));
      selected = o;
      confirm.disabled = false;
      return;
    }
    selected = o;
    submit();
  }

  function submit() {
    if (!selected || locked) return;
    const o = selected;
    if (o.i === item.answer) {
      locked = true;
      o.btn.classList.add('right');
      ctx.right(item.after);
    } else {
      o.btn.classList.add('wrong');
      o.btn.disabled = true;
      shake(o.btn);
      selected = null;
      if (confirm) confirm.disabled = true;
      ctx.wrong(o.text || o.py || o.pic, item.hint);
    }
  }
}
