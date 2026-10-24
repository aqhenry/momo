import { h, wait } from './ui.js';
import { store } from './store.js';
import { speak, stopSpeaking, unlockAudio, preload, warmCache, sfx, praise, retry } from './audio.js';
import { S, PRAISE, stageDone } from './phrases.js';
import { BLOCKS, blockEl, blockURL, rollAnswerBlock, rollChest } from './blocks.js';
import { spriteEl, spriteURL } from './sprites.js';
import { picEl } from './pics.js';
import { burst, orbs, flyTo } from './fx.js';
import { initScene } from './scene.js';
import { measureFont } from './pinyin.js';
import * as choice from './items/choice.js';
import * as blend from './items/blend.js';
import * as spell from './items/spell.js';
import * as stroke from './items/stroke.js';
import * as order from './items/order.js';
import { renderRead, renderTap } from './items/text.js';

const ITEM_TYPES = {
  choice: choice.render,
  blend: blend.render,
  spell: spell.render,
  stroke: stroke.render,
  order: order.render,
  read: renderRead,
  tapText: renderTap,
};

const app = document.getElementById('app');
document.addEventListener('pointerdown', unlockAudio, { capture: true });
// keep iOS from zooming / showing callouts on long-press
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('contextmenu', e => e.preventDefault());

// ---------- data ----------
let levelIndex = null;
const levelCache = {};
async function loadIndex() {
  if (!levelIndex) levelIndex = await fetch('levels/index.json').then(r => r.json());
  return levelIndex;
}
async function loadLevel(id) {
  if (!levelCache[id]) {
    const meta = (await loadIndex()).find(l => l.id === id);
    levelCache[id] = await fetch(meta.path).then(r => r.json());
  }
  return levelCache[id];
}

const starsText = n => '★'.repeat(n) + '☆'.repeat(3 - n);   // parent page
function levelStats(level) {
  const done = level.stages.filter(s => store.stage(level.id, s.id)?.done).length;
  const stars = level.stages.reduce((a, s) => a + (store.stage(level.id, s.id)?.stars || 0), 0);
  return { done, total: level.stages.length, stars };
}

// ---------- router ----------
function go(hash) { location.hash = hash; }
async function route() {
  stopSpeaking();
  const [, name, a, b] = location.hash.split('/');
  app.innerHTML = '';
  app.className = '';
  try {
    if (name === 'level') await screenLevel(a);
    else if (name === 'play') await screenPlay(a, b);
    else if (name === 'build') screenBuild();
    else if (name === 'parent') await screenParent();
    else await screenHome();
  } catch (e) {
    console.error(e);
    app.append(h('div.screen.center', h('div.mc-panel', '出错了：' + e.message, h('div.row-btns', h('button.mc-btn', { onclick: () => go('#/') }, '回首页')))));
  }
}
window.addEventListener('hashchange', route);

function topBar(left, title, right) {
  return h('div.topbar', h('div.tb-left', left), h('div.tb-title', title), h('div.tb-right', right));
}
const iconBtn = (sprite, onclick) => h('button.mc-btn.icon', { onclick: () => { sfx.tap(); onclick(); } }, spriteEl(sprite));
const backBtn = (hash, sprite = 'back') => iconBtn(sprite, () => go(hash));
const starRow = (n, cls = '') => h(`div${cls}`, [0, 1, 2].map(k => spriteEl(k < n ? 'star' : 'star_off')));

function invCount() {
  return Object.values(store.state.inventory).reduce((a, b) => a + b, 0);
}

// ---------- home ----------
const SPLASHES = ['拼音小矿工！', '答对就有方块！', '钻石在等你！', '今天也要加油！', '方块越多越好玩！', '声调要读准！'];

async function screenHome() {
  const levels = await loadIndex();
  const latest = levels[0];

  const gear = h('button.gear', spriteEl('gear'));
  let timer;
  gear.addEventListener('pointerdown', () => { timer = setTimeout(() => go('#/parent'), 1500); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => gear.addEventListener(ev, () => clearTimeout(timer)));

  const rows = await Promise.all(levels.map(async meta => {
    const lv = await loadLevel(meta.id);
    const st = levelStats(lv);
    return h('button.world-row', { onclick: () => { sfx.tap(); go(`#/level/${meta.id}`); } },
      blockEl(meta.block || 'grass'),
      h('div.wr-text',
        h('div.wr-tag', meta.subject),
        h('div.wr-title', meta.title),
        h('div.wr-sub', meta.subtitle || '')),
      h('div.wr-progress', h('div', spriteEl('star'), ` ${st.stars}`), h('div', `${st.done}/${st.total}关`)));
  }));

  // the four kinds of block he owns most, for the build button preview
  const owned = Object.entries(store.state.inventory).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).map(([t]) => t);
  const preview = [...owned, 'grass', 'toy_red', 'diamond', 'planks'].slice(0, 4);

  app.append(
    h('div.screen.home',
      gear,
      h('div.logo-wrap',
        h('h1.logo', '墨然的方块世界'),
        h('div.splash', SPLASHES[Math.floor(Math.random() * SPLASHES.length)])),
      h('div.home-main',
        h('div.mc-panel.worlds', h('div.panel-title', '冒险任务'), h('div.world-list', rows)),
        h('div.home-side',
          latest ? h('button.mc-btn.big.go', { onclick: () => { sfx.tap(); go(`#/level/${latest.id}`); } }, '开始冒险') : null,
          h('div.mc-panel',
            h('div.build-preview', preview.map(t => blockEl(t))),
            h('div.inv-count', `背包 ${invCount()} 个方块`),
            h('div.row-btns', h('button.mc-btn', { onclick: () => { sfx.tap(); go('#/build'); } }, '我的建造')))))));
}

// ---------- level map ----------
async function screenLevel(id) {
  const level = await loadLevel(id);
  const st = levelStats(level);
  const nextIdx = level.stages.findIndex(s => !store.stage(id, s.id)?.done);

  const board = h('div.map-board');
  const nodes = level.stages.map((s, i) => {
    const p = store.stage(id, s.id);
    const tex = p?.done ? 'gold' : i === nextIdx ? 'grass' : 'stone';
    const block = h('div.node-block', { style: { backgroundImage: `url(${blockURL(tex)})` } },
      picEl(s.icon || 'sprite:pickaxe'), h('span.node-num', String(i + 1)));
    return h(`button.node${p?.done ? '.done' : ''}${i === nextIdx ? '.next' : ''}`,
      { onclick: () => { sfx.tap(); go(`#/play/${id}/${s.id}`); } },
      block, h('div.node-sign', s.title), p?.done ? starRow(p.stars, '.node-stars') : h('div.node-stars'));
  });
  board.append(...nodes);

  app.append(h('div.screen',
    topBar(backBtn('#/'), h('div.plate', spriteEl('map'), level.title), h('div.plate', spriteEl('star'), `${st.stars}/${st.total * 3}`)),
    level.note ? h('div.map-note.plate', level.note) : null,
    board));

  // snake path: rows left→right, then right→left
  const layout = () => {
    const w = board.clientWidth;
    const cols = Math.max(3, Math.min(5, Math.floor(w / 210)));
    const rowH = 200;
    const pts = nodes.map((n, i) => {
      const r = Math.floor(i / cols), c = i % cols;
      const col = r % 2 ? cols - 1 - c : c;
      const x = (col + 0.5) * w / cols, y = 80 + r * rowH;
      n.style.left = `${x}px`;
      n.style.top = `${y}px`;
      return [x, y];
    });
    board.style.height = `${80 + Math.ceil(nodes.length / cols) * rowH}px`;
    const d = 'M' + pts.map(([x, y]) => `${x} ${y}`).join(' L');
    board.querySelector('svg')?.remove();
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('map-path');
    svg.innerHTML = `<path d="${d}" stroke="#3b2a14" stroke-width="34"/><path d="${d}" stroke="#9b6b43" stroke-width="26"/><path d="${d}" stroke="#b98b5c" stroke-width="8" stroke-dasharray="10 18"/>`;
    board.prepend(svg);
  };
  layout();
  const onResize = () => { if (board.isConnected) layout(); else removeEventListener('resize', onResize); };
  addEventListener('resize', onResize);
  nodes[nextIdx]?.scrollIntoView({ block: 'center' });
  if (nextIdx === 0 && level.intro) setTimeout(() => speak(level.intro), 300);
}

// ---------- play ----------
async function screenPlay(levelId, stageId) {
  const level = await loadLevel(levelId);
  const stageIdx = level.stages.findIndex(s => s.id === stageId);
  const stage = level.stages[stageIdx];

  const total = stage.items.length;
  const slots = stage.items.map(() => h('div.hb-slot'));
  const xpFill = h('div.xp-fill');
  const xpLevel = h('div.xp-level', '0');
  const xp = h('div.xp', xpFill, h('div.xp-ticks'), xpLevel);
  const body = h('div.item-body');
  app.append(h('div.screen',
    topBar(backBtn(`#/level/${levelId}`, 'cross'), h('div.plate', picEl(stage.icon || 'sprite:pickaxe'), stage.title), iconBtn('speaker', () => speak(current?.say || ''))),
    h('div.play-wrap',
      h('div.mc-panel.play-panel', body),
      h('div.hud', xp, h('div.hotbar', slots)))));

  let current = null;
  let firstTry = 0;
  const mistakes = [];
  const earned = [];

  async function show(i) {
    current = stage.items[i];
    body.innerHTML = '';
    body.classList.remove('enter'); void body.offsetWidth; body.classList.add('enter');
    slots.forEach((s, k) => s.classList.toggle('now', k === i));
    let attempts = 0, solved = false;
    const ctx = {
      say: (t, fallback) => speak(t, { fallback }),
      wrong(got, hint) {
        attempts++;
        mistakes.push({ q: current.q || current.say, got: String(got ?? '') });
        if (hint !== null) { sfx.wrong(); speak(hint || retry()); }
      },
      async right(after) {
        if (solved) return;
        solved = true;
        const first = attempts === 0;
        if (first) firstTry++;
        const block = rollAnswerBlock(first);
        store.addBlock(block);
        earned.push(block);
        sfx.right();
        burst(block);
        orbs(xp);
        flyTo(block, slots[i]).then(() => {
          slots[i].innerHTML = '';
          slots[i].append(blockEl(block));
          xpFill.style.width = `${(earned.length / total) * 100}%`;
          xpLevel.textContent = String(earned.length);
          sfx.place();
        });
        await speak([praise(), after]);
        await wait(350);
        if (location.hash !== `#/play/${levelId}/${stageId}`) return;
        if (i + 1 < total) show(i + 1);
        else finish();
      },
    };
    preload(itemTexts(current));
    ITEM_TYPES[current.type](body, current, ctx);
    setTimeout(() => speak(current.say), 350);
  }

  function finish() {
    const rate = firstTry / total;
    const stars = rate >= 0.9 ? 3 : rate >= 0.7 ? 2 : 1;
    store.finishStage(levelId, stageId, { stars, firstTry, total, mistakes });
    const chest = rollChest(stars);
    chest.forEach(b => store.addBlock(b));
    showReward(level, stageIdx, stars, chest, earned);
  }

  show(0);
}

// Everything an item might say, so its clips are fetched before they're needed.
function itemTexts(it) {
  const opts = (it.options || []).map(o => (typeof o === 'string' ? o : o.say || o.text));
  return [it.say, it.after, it.hint, it.prompt?.picSay, it.read, ...(it.strokes || []), ...(it.pieces || []), ...opts, ...PRAISE];
}

function showReward(level, stageIdx, stars, chest, earned) {
  const next = level.stages[stageIdx + 1];
  app.innerHTML = '';
  const chestIcon = spriteEl('chest', 'chest');
  const stars3 = starRow(stars, '.reward-stars');
  const blocks = h('div.reward-blocks');
  const btns = h('div.row-btns',
    h('button.mc-btn', { onclick: () => go(`#/level/${level.id}`) }, spriteEl('map'), '回地图'),
    h('button.mc-btn', { onclick: () => go('#/build') }, spriteEl('bricks'), '去建造'),
    next ? h('button.mc-btn.go', { onclick: () => go(`#/play/${level.id}/${next.id}`) }, '下一关') : null);
  btns.style.visibility = 'hidden';
  [...stars3.children].forEach((s, k) => { s.style.animationDelay = `${0.2 + k * 0.25}s`; });

  app.append(h('div.dim'), h('div.screen.center',
    h('div.mc-panel.reward',
      h('div.reward-title', '过关啦！'),
      stars3,
      chestIcon,
      blocks,
      h('div.reward-sub', `这一关一共得到 ${earned.length + chest.length} 个方块`),
      btns)));
  speak(stageDone(stars));
  for (let k = 0; k < stars; k++) setTimeout(() => sfx.tap(), 200 + k * 250);

  // chest shakes, pops open, blocks drop into slots
  setTimeout(() => {
    chestIcon.style.backgroundImage = `url(${spriteURL('chest_open')})`;
    chestIcon.classList.add('open');
    sfx.chest();
    const r = chestIcon.getBoundingClientRect();
    burst(chest[0], { x: r.left + r.width / 2, y: r.top + r.height / 3 }, 18);
    chest.forEach((b, i) => blocks.append(h('div.rb', { style: { animationDelay: `${i * 0.12}s` } },
      h('div.inv-slot', blockEl(b)), h('div.rb-name', BLOCKS[b].name))));
    btns.style.visibility = '';
  }, 1300);
}

// ---------- build ----------
const COLS = 20, ROWS = 12;
function screenBuild() {
  let world = store.state.world;
  if (!world || world.length !== ROWS * COLS) {
    world = Array(ROWS * COLS).fill(null);
    for (let c = 0; c < COLS; c++) { world[(ROWS - 2) * COLS + c] = 'grass'; world[(ROWS - 1) * COLS + c] = 'dirt'; }
  }
  const fixed = i => i >= (ROWS - 1) * COLS;   // bottom row can't be dug
  let selected = Object.keys(store.state.inventory).find(k => store.state.inventory[k] > 0) || null;

  const grid = h('div.world', { style: { gridTemplateColumns: `repeat(${COLS}, 1fr)` } });
  const cells = world.map((t, i) => {
    const cell = h('div.cell', { onclick: () => tapCell(i) });
    grid.append(cell);
    return cell;
  });
  const inv = h('div.inventory');

  function paintCell(i) {
    const t = world[i];
    cells[i].style.backgroundImage = t ? `url(${blockURL(t)})` : '';
    cells[i].classList.toggle('filled', !!t);
  }
  function paintInv() {
    inv.innerHTML = '';
    const types = Object.keys(BLOCKS).filter(k => store.state.inventory[k] > 0);
    if (!types.length) inv.append(h('div.inv-empty', '背包空了，去冒险赚方块吧！'));
    for (const t of types) {
      inv.append(h(`button.inv-slot${t === selected ? '.sel' : ''}`, { onclick: () => { selected = t; sfx.tap(); paintInv(); } },
        blockEl(t), h('span.inv-n', String(store.state.inventory[t]))));
    }
  }
  function tapCell(i) {
    if (world[i]) {
      if (fixed(i)) return;
      const r = cells[i].getBoundingClientRect();
      burst(world[i], { x: r.left + r.width / 2, y: r.top + r.height / 2 }, 8);
      store.returnBlock(world[i]);
      world[i] = null;
      sfx.dig();
    } else {
      if (!selected || !store.takeBlock(selected)) { speak(S.pickBlock); return; }
      world[i] = selected;
      sfx.place();
      if (!store.state.inventory[selected]) selected = Object.keys(store.state.inventory).find(k => store.state.inventory[k] > 0) || null;
    }
    store.setWorld(world);
    paintCell(i);
    paintInv();
  }

  world.forEach((_, i) => paintCell(i));
  paintInv();
  app.append(h('div.screen.build',
    topBar(backBtn('#/'), h('div.plate', spriteEl('bricks'), '我的建造'), h('div.plate.small-tip', '点空格放，点方块挖')),
    h('div.world-wrap', grid), inv));
}

// ---------- parent ----------
async function screenParent() {
  app.className = 'parent';
  const levels = await loadIndex();
  const box = h('div.parent-body');
  for (const meta of levels) {
    const lv = await loadLevel(meta.id);
    const rows = lv.stages.map((s, i) => {
      const p = store.stage(lv.id, s.id);
      const miss = p?.mistakes || [];
      return h('div.p-stage',
        h('div.p-head', `${i + 1}. ${s.title}`,
          h('span.p-stat', p?.done ? `${starsText(p.stars)}  一次答对 ${p.firstTry}/${p.total}  玩了${p.plays}次  ${new Date(p.at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : '未完成')),
        miss.length ? h('ul.p-miss', miss.map(m => h('li', `${m.q}  →  选了：${m.got}`))) : null);
    });
    box.append(h('div.mc-panel.p-level',
      h('h2', `${meta.subject} · ${lv.title}`),
      h('div.p-note', lv.note || ''),
      rows,
      h('button.mc-btn.small', { onclick: () => { if (confirm('清空这个任务的进度？')) { store.resetLevel(lv.id); route(); } } }, '重置这个任务')));
  }
  box.append(h('div.mc-panel',
    h('h2', '方块'),
    h('div', `背包 ${invCount()} 个，累计获得 ${store.state.totalBlocks} 个`),
    h('div.row-btns',
      h('button.mc-btn.small', { onclick: () => { ['diamond', 'gold', 'toy_red', 'toy_blue', 'toy_yellow'].forEach(b => store.addBlock(b, 2)); route(); } }, '奖励 10 个方块'),
      h('button.mc-btn.small.danger', { onclick: () => { if (confirm('清空所有进度、方块和建造？不能恢复。')) { store.resetAll(); route(); } } }, '清空全部数据'))));
  app.append(h('div.screen', topBar(backBtn('#/'), h('div.plate', '家长页面'), ''), box));
}

// ---------- boot ----------
for (const t of ['stone', 'cobble', 'planks', 'dirt', 'grass']) {
  document.documentElement.style.setProperty(`--tex-${t}`, `url(${blockURL(t)})`);
}
initScene();
Promise.all([measureFont(), document.fonts.load('24px Pixel'), document.fonts.load('32px Kai')]).catch(() => {}).then(route);
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').then(() => setTimeout(warmCache, 4000)).catch(() => {});
}
