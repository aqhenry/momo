// Visual week-nine tasks: correspondence, constructive counting, classification and position.
import { h } from '../ui.js';
import { artEl } from '../pics.js';
import { spriteEl } from '../sprites.js';
import { sfx } from '../audio.js';
import { writePad } from '../writepad.js';
import { S } from '../phrases.js';

export function mathArt(name) {
  const drawings = {
    basket: '<path d="M12 28 Q32 -3 52 28" fill="none" stroke="#76512b" stroke-width="5"/><path d="M7 27 H57 L50 55 H14Z" fill="#c99b57" stroke="#76512b" stroke-width="3"/><path d="M20 30V52M32 30V54M44 30V52M12 40H53" stroke="#76512b" stroke-width="2"/>',
    butterfly: '<path d="M30 30C-2 -5 -5 49 27 39C3 65 38 66 32 39C64 66 65 29 38 33C75 -7 30 -3 34 30" fill="#b798e1" stroke="#593c81" stroke-width="3"/><path d="M32 21V48M32 23L24 12M32 23L40 12" stroke="#463543" stroke-width="4"/>',
    panda: '<circle cx="17" cy="15" r="10" fill="#25272d"/><circle cx="47" cy="15" r="10" fill="#25272d"/><ellipse cx="32" cy="34" rx="26" ry="25" fill="white" stroke="#25272d" stroke-width="2"/><ellipse cx="21" cy="30" rx="8" ry="10" fill="#25272d"/><ellipse cx="43" cy="30" rx="8" ry="10" fill="#25272d"/><circle cx="23" cy="28" r="2" fill="white"/><circle cx="41" cy="28" r="2" fill="white"/><path d="M27 42H37L32 48Z" fill="#25272d"/>',
  };
  if (!drawings[name]) return artEl(name, 'm-art');
  const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 64 64'); svg.classList.add('m-art');svg.innerHTML=drawings[name]; return svg;
}

function shapeEl(shape, color = 'blue') {
  const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 64 64'); svg.classList.add('math-shape');
  const el = document.createElementNS(ns, { square: 'rect', circle: 'circle', triangle: 'polygon' }[shape]);
  const props = shape === 'square' ? { x: 9, y: 9, width: 46, height: 46 } : shape === 'circle' ? { cx: 32, cy: 32, r: 24 } : { points: '32,6 59,56 5,56' };
  for (const [k, v] of Object.entries(props)) el.setAttribute(k, v);
  el.setAttribute('fill', color === 'blue' ? '#3277bf' : '#cc4840'); el.setAttribute('stroke', '#253542'); el.setAttribute('stroke-width', '3'); svg.append(el); return svg;
}
const shakeEl = el => { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); };
export function render(root, item, ctx) {
  root.classList.add('math-explore');
  let locked = false;
  const right = () => { if (!locked) { locked = true; root.querySelectorAll('button').forEach(b => b.disabled = true); ctx.right(item.after); } };
  const wrong = got => ctx.wrong(got, item.hint);
  if (item.mode === 'compare') {
    const pairs = h('div.explore-pairs');
    for (let row = 0; row < 2; row++) pairs.append(h('div.explore-pair-row', Array.from({length: Math.max(...item.counts)}, (_, i) => h('div.explore-cell', i < item.counts[row] ? artEl(item.art[row]) : null))));
    const choices = h('div.explore-answers');
    // Each option is a visual relationship, so reading a text label isn't required.
    for (const [i, sign] of ['>','<','='].entries()) choices.append(h('button.mc-btn.relation', { 'aria-label': item.options[i], onclick: () => {
      if (locked) return; if (i === item.answer) right(); else wrong(item.options[i]);
    } }, h('span.relation-row', artEl(item.art[0]), sign, artEl(item.art[1]))));
    root.append(pairs, choices);
  } else if (item.mode === 'extreme') {
    const groups=h('div.extreme-groups');
    item.counts.forEach((n,i)=>groups.append(h('button.extreme-group',{'aria-label':`第${i+1}组`,onclick:()=>{if(locked)return;if(i===item.answer)right();else wrong(i+1);}},Array.from({length:n},()=>mathArt(item.art[i])))));
    root.append(groups);
  } else if (item.mode === 'draw') {
    const selected = new Set();
    const top = h('div.explore-draw-row', Array.from({length:item.n}, () => shapeEl('circle')));
    const cells = h('div.explore-draw-row');
    const submit = h('button.mc-btn.go.explore-submit', { 'aria-label':'检查', onclick: () => {
      if (locked) return; if (selected.size === item.n - item.difference) right(); else wrong(selected.size);
    } }, spriteEl('confirm'));
    for (let i=0;i<item.n;i++) {
      const cell = h('button.draw-cell', {'aria-label':`第${i+1}格`,'aria-pressed':'false',onclick:()=>{
        if (locked) return;
        if (selected.has(i)) selected.delete(i); else selected.add(i);
        cell.replaceChildren(selected.has(i) ? shapeEl('triangle') : h('span', '+'));
        cell.setAttribute('aria-pressed',String(selected.has(i))); sfx.place();
      }}, '+'); cells.append(cell);
    }
    root.append(top,cells,submit);
  } else if (item.mode === 'sort') {
    const found = new Set(), total = item.shapes.filter(s=>s[item.by]===item.target).length;
    const grid = h('div.shape-sort');
    item.shapes.forEach((s,i)=>{
      const b = h('button.shape-cell', {'aria-label':`${s.color === 'blue'?'蓝色':'红色'}${{square:'正方形',circle:'圆形',triangle:'三角形'}[s.shape]}`,onclick:()=>{
        if(locked || found.has(i)) return;
        if(s[item.by]!==item.target){wrong(b.getAttribute('aria-label'));return;}
        found.add(i); b.disabled=true; b.classList.add('right'); b.append(spriteEl('check'));sfx.place();if(found.size===total)right();
      }},shapeEl(s.shape,s.color));grid.append(b);
    });root.append(grid);
  } else if (item.mode === 'track') {
    // number track: tap the number(s) asked for; `mark` numbers are lit up as clues
    const want = new Set(item.answer), found = new Set();
    const track = h('div.num-track');
    if (ctx.write) {
      // the asked-for tiles are "?" boxes, filled left to right by writing
      const holes = [];
      for (let n = item.from ?? 0; n <= (item.to ?? 10); n++) {
        const marked = (item.mark || []).includes(n), hole = want.has(n);
        const t = h(`div.num-tile${marked ? '.marked' : ''}${hole ? '.hole' : ''}`, hole ? '?' : String(n));
        if (hole) holes.push({ n, t });
        track.append(t);
      }
      holes[0].t.classList.add('now');
      let k = 0;
      const pad = writePad(v => {
        if (locked || v === 'back') return;
        const hole = holes[k];
        if (Number(v) !== hole.n) {
          hole.t.textContent = v; hole.t.classList.add('wrong'); shakeEl(hole.t); wrong(v);
          setTimeout(() => { hole.t.textContent = '?'; hole.t.classList.remove('wrong'); }, 900);
          return;
        }
        hole.t.textContent = v; hole.t.classList.remove('now'); hole.t.classList.add('right'); sfx.place();
        if (++k === holes.length) right(); else holes[k].t.classList.add('now');
      }, { expect: () => [String(holes[k]?.n)], say: () => ctx.say(S.writeConfirm) });
      root.classList.add('write-body');
      root.append(h('div.m-write', h('div.m-write-left', track, h('div.seat-direction', '小 → 大')), pad));
      return;
    }
    for (let n = item.from ?? 0; n <= (item.to ?? 10); n++) {
      const marked = (item.mark || []).includes(n);
      const b = h(`button.num-tile${marked ? '.marked' : ''}`, { 'aria-label': String(n), onclick: () => {
        if (locked || marked || found.has(n)) return;
        if (!want.has(n)) { wrong(n); return; }
        found.add(n); b.classList.add('right'); sfx.place();
        if (found.size === want.size) right();
      } }, String(n));
      track.append(b);
    }
    root.append(track, h('div.seat-direction', '小 → 大'));
  } else if (item.mode === 'grid') {
    // animal flats: which way is A (yellow) from B (blue)?
    const grid = h('div.pos-grid');
    item.grid.forEach((row, r) => row.forEach((art, c) => {
      const tag = r === item.a[0] && c === item.a[1] ? '.pos-a' : r === item.b[0] && c === item.b[1] ? '.pos-b' : '';
      grid.append(h(`div.pos-cell${tag}`, mathArt(art)));
    }));
    const names = ['上面', '下面', '左边', '右边'], arrows = ['↑', '↓', '←', '→'];
    const choices = h('div.explore-answers', names.map((name, i) => h('button.mc-btn.pos-btn', { onclick: () => {
      if (locked) return; if (name === item.answer) right(); else wrong(name);
    } }, h('span.pos-arrow', arrows[i]), name)));
    root.append(h('div.pos-question', h('span.pos-a-tag', item.names[0]), ' 在 ', h('span.pos-b-tag', item.names[1]), ' 的？'), h('div.pos-house', h('div.pos-roof'), grid), choices);
  } else if(item.mode === 'seats') {
    root.append(h('div.seat-front',spriteEl('compass'),'前面'));
    const grid=h('div.seat-grid');
    for(let row=0;row<3;row++){
      grid.append(h('span.seat-row-number',String(row+1)));
      for(let col=0;col<4;col++){
        const animal=item.clues && row===1&&col===2?'rabbit':item.clues&&row===2&&col===1?'panda':null;
        const b=h('button.seat-cell',{'aria-label':`第${row+1}排左数第${col+1}个`,onclick:()=>{
          if(locked)return;if(row===item.row&&col===item.col){b.append(spriteEl('check'));right();}else wrong(b.getAttribute('aria-label'));
        }}, animal ? mathArt(animal) : spriteEl('bricks'));grid.append(b);
      }
    }root.append(grid,h('div.seat-direction','左 → 右'));
  }
}
