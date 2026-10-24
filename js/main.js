import { h, wait } from './ui.js';
import { store } from './store.js';
import { speak, stopSpeaking, unlockAudio, preload, warmCache, sfx, praise, retry } from './audio.js';
import { S, PRAISE, stageDone } from './phrases.js';
import { BLOCKS, blockEl, rollAnswerBlock, rollChest } from './blocks.js';
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

const starsText = n => '★'.repeat(n) + '☆'.repeat(3 - n);
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
    app.append(h('div.screen.center', h('div.panel', '出错了：' + e.message, h('button.btn', { onclick: () => go('#/') }, '回首页'))));
  }
}
window.addEventListener('hashchange', route);

function topBar(left, title, right) {
  return h('div.topbar', h('div.tb-left', left), h('div.tb-title', title), h('div.tb-right', right));
}
const backBtn = (hash, label = '⬅') => h('button.btn.icon', { onclick: () => { sfx.tap(); go(hash); } }, label);

function invCount() {
  return Object.values(store.state.inventory).reduce((a, b) => a + b, 0);
}

// ---------- home ----------
async function screenHome() {
  app.className = 'sky';
  const levels = await loadIndex();
  const latest = levels[0];

  const gear = h('button.gear', '⚙︎');
  let timer;
  gear.addEventListener('pointerdown', () => { timer = setTimeout(() => go('#/parent'), 1500); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => gear.addEventListener(ev, () => clearTimeout(timer)));

  const levelCards = await Promise.all(levels.map(async meta => {
    const lv = await loadLevel(meta.id);
    const st = levelStats(lv);
    return h('button.level-card', { onclick: () => { sfx.tap(); go(`#/level/${meta.id}`); } },
      h('div.lc-subject', meta.subject),
      h('div.lc-title', meta.title),
      h('div.lc-sub', meta.subtitle || ''),
      h('div.lc-progress', `${st.done}/${st.total} 关`, h('span.stars', ` ★ ${st.stars}`)));
  }));

  app.append(
    h('div.screen.home',
      gear,
      h('h1.title', '墨然的方块世界'),
      h('div.home-sub', '答对题目，收集方块，搭出你的世界！'),
      h('div.home-main',
        h('div.home-col',
          h('div.section-title', latest ? '⛏️ 冒险任务' : ''),
          h('div.level-list', levelCards)),
        h('button.build-card', { onclick: () => { sfx.tap(); go('#/build'); } },
          h('div.bc-blocks', ['grass', 'toy_red', 'diamond', 'planks'].map(t => blockEl(t))),
          h('div.bc-title', '🧱 我的建造'),
          h('div.bc-sub', `背包里有 ${invCount()} 个方块`))),
      h('div.ground')));
}

// ---------- level map ----------
async function screenLevel(id) {
  app.className = 'sky';
  const level = await loadLevel(id);
  const st = levelStats(level);
  const nextIdx = level.stages.findIndex(s => !store.stage(id, s.id)?.done);

  const tiles = level.stages.map((s, i) => {
    const p = store.stage(id, s.id);
    return h(`button.stage-tile${p?.done ? '.done' : ''}${i === nextIdx ? '.next' : ''}`,
      { onclick: () => { sfx.tap(); go(`#/play/${id}/${s.id}`); } },
      h('div.st-num', String(i + 1)),
      h('div.st-icon', s.icon || '⛏️'),
      h('div.st-title', s.title),
      h('div.st-stars', p?.done ? starsText(p.stars) : '　'));
  });

  app.append(h('div.screen',
    topBar(backBtn('#/'), level.title, h('div.tb-stat', `★ ${st.stars}/${st.total * 3}`)),
    h('div.level-note', level.note || ''),
    h('div.stage-grid', tiles),
    h('div.ground')));
  if (nextIdx === 0 && level.intro) setTimeout(() => speak(level.intro), 300);
}

// ---------- play ----------
async function screenPlay(levelId, stageId) {
  const level = await loadLevel(levelId);
  const stageIdx = level.stages.findIndex(s => s.id === stageId);
  const stage = level.stages[stageIdx];
  app.className = 'play';

  const pips = h('div.pips', stage.items.map(() => h('div.pip')));
  const replay = h('button.btn.icon', { onclick: () => speak(current?.say || '') }, '🔊');
  const body = h('div.item-body');
  app.append(h('div.screen',
    topBar(backBtn(`#/level/${levelId}`, '✕'), h('span', stage.icon || '', ' ', stage.title), replay),
    pips, body));

  let idx = 0, current = null;
  let firstTry = 0;
  const mistakes = [];
  const earned = [];

  async function show(i) {
    current = stage.items[i];
    body.innerHTML = '';
    body.classList.remove('enter'); void body.offsetWidth; body.classList.add('enter');
    pips.children[i]?.classList.add('now');
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
        const pip = pips.children[i];
        pip.classList.remove('now');
        pip.classList.add('filled');
        pip.style.backgroundImage = blockEl(block).style.backgroundImage;
        sfx.right();
        flyBlock(block);
        await speak([praise(), after]);
        await wait(350);
        if (location.hash !== `#/play/${levelId}/${stageId}`) return;
        if (i + 1 < stage.items.length) show(i + 1);
        else finish();
      },
    };
    preload(itemTexts(current));
    ITEM_TYPES[current.type](body, current, ctx);
    setTimeout(() => speak(current.say), 350);
  }

  function finish() {
    const total = stage.items.length;
    const rate = firstTry / total;
    const stars = rate >= 0.9 ? 3 : rate >= 0.7 ? 2 : 1;
    store.finishStage(levelId, stageId, { stars, firstTry, total, mistakes });
    const chest = rollChest(stars);
    chest.forEach(b => store.addBlock(b));
    showReward(level, stageIdx, stars, chest, earned);
  }

  show(idx);
}

// Everything an item might say, so its clips are fetched before they're needed.
function itemTexts(it) {
  const opts = (it.options || []).map(o => (typeof o === 'string' ? o : o.say || o.text));
  return [it.say, it.after, it.hint, it.prompt?.picSay, it.read, ...(it.strokes || []), ...(it.pieces || []), ...opts, ...PRAISE];
}

function flyBlock(type) {
  const el = blockEl(type, 'fly');
  document.getElementById('toast-layer').append(el);
  setTimeout(() => el.remove(), 1300);
}

function showReward(level, stageIdx, stars, chest, earned) {
  sfx.chest();
  const next = level.stages[stageIdx + 1];
  app.innerHTML = '';
  app.className = 'sky';
  const all = [...earned, ...chest];
  app.append(h('div.screen.center',
    h('div.panel.reward',
      h('div.reward-title', '🎉 过关啦！'),
      h('div.reward-stars', starsText(stars)),
      h('div.reward-label', '宝箱里有：'),
      h('div.reward-blocks', chest.map((b, i) => h('div.rb', { style: { animationDelay: `${i * 0.15}s` } }, blockEl(b), h('span', BLOCKS[b].name)))),
      h('div.reward-sub', `这一关一共得到 ${all.length} 个方块`),
      h('div.row-btns',
        h('button.btn', { onclick: () => go(`#/level/${level.id}`) }, '🗺️ 回地图'),
        h('button.btn', { onclick: () => go('#/build') }, '🧱 去建造'),
        next ? h('button.btn.go', { onclick: () => go(`#/play/${level.id}/${next.id}`) }, '下一关 ➜') : null)),
    h('div.ground')));
  speak(stageDone(stars));
}

// ---------- build ----------
const COLS = 20, ROWS = 12;
function screenBuild() {
  app.className = 'sky';
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
    cells[i].style.backgroundImage = t ? blockEl(t).style.backgroundImage : '';
    cells[i].classList.toggle('filled', !!t);
  }
  function paintInv() {
    inv.innerHTML = '';
    const types = Object.keys(BLOCKS).filter(k => store.state.inventory[k] > 0);
    if (!types.length) inv.append(h('div.inv-empty', '背包空了，去冒险答题赚方块吧！'));
    for (const t of types) {
      inv.append(h(`button.inv-slot${t === selected ? '.sel' : ''}`, { onclick: () => { selected = t; sfx.tap(); paintInv(); } },
        blockEl(t), h('span.inv-n', String(store.state.inventory[t]))));
    }
  }
  function tapCell(i) {
    if (world[i]) {
      if (fixed(i)) return;
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
    topBar(backBtn('#/'), '🧱 我的建造', h('div.tb-stat', '点空格放方块，点方块挖回来')),
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
    box.append(h('div.panel.p-level',
      h('h2', `${meta.subject} · ${lv.title}`),
      h('div.p-note', lv.note || ''),
      rows,
      h('button.btn.small', { onclick: () => { if (confirm('清空这个任务的进度？')) { store.resetLevel(lv.id); route(); } } }, '重置这个任务')));
  }
  box.append(h('div.panel',
    h('h2', '方块'),
    h('div', `背包 ${invCount()} 个，累计获得 ${store.state.totalBlocks} 个`),
    h('div.row-btns',
      h('button.btn.small', { onclick: () => { ['diamond', 'gold', 'toy_red', 'toy_blue', 'toy_yellow'].forEach(b => store.addBlock(b, 2)); route(); } }, '奖励 10 个方块'),
      h('button.btn.small.danger', { onclick: () => { if (confirm('清空所有进度、方块和建造？不能恢复。')) { store.resetAll(); route(); } } }, '清空全部数据'))));
  app.append(h('div.screen', topBar(backBtn('#/'), '家长页面', ''), box));
}

// ---------- boot ----------
measureFont().then(route);
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').then(() => setTimeout(warmCache, 4000)).catch(() => {});
}
