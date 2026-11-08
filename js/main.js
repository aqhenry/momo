import { h, wait, stageItems } from './ui.js';
import { store } from './store.js';
import { speak, stopSpeaking, preload, warmCache, sfx, praise, retry } from './audio.js';
import { S, PRAISE, stageDone } from './phrases.js';
import { BLOCKS, RARITY, blockURL, iconEl } from './blocks.js';
import { answerXP, COMBO_XP, isCombo, levelOf, levelUpDrop, openChest, CHESTS } from './rewards.js';
import { spriteEl, spriteURL } from './sprites.js';
import { picEl } from './pics.js';
import { burst, orbs, banner } from './fx.js';
import { initScene } from './scene.js';
import { measureFont } from './pinyin.js';
import * as choice from './items/choice.js';
import * as blend from './items/blend.js';
import * as spell from './items/spell.js';
import * as stroke from './items/stroke.js';
import * as order from './items/order.js';
import { renderRead, renderTap, renderRecite } from './items/text.js';
import { renderPointRead } from './items/english.js';
import { renderCalc, renderCraft, renderPattern } from './items/math.js';
import { render as renderMathExplore } from './items/math-explore.js';
import { renderHunt, renderLab, renderDictation, mountPaper } from './items/pinyin-challenge.js';

const ITEM_TYPES = {
  mathExplore: renderMathExplore,
  choice: choice.render,
  blend: blend.render,
  spell: spell.render,
  stroke: stroke.render,
  order: order.render,
  read: renderRead,
  tapText: renderTap,
  calc: renderCalc,
  craft: renderCraft,
  pattern: renderPattern,
  letterHunt: renderHunt,
  pinyinLab: renderLab,
  dictation: renderDictation,
  recite: renderRecite,
  pointRead: renderPointRead,
};

const app = document.getElementById('app');
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
    else if (name === 'build') await screenBuild();
    else if (name === 'book') screenBook();
    else if (name === 'craft') await screenCraft();
    else if (name === 'parent') await screenParent();
    else if (name === 'paper') await screenPaper(a);
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

// Player level from all XP ever earned (Minecraft-style level number over a green bar).
function playerXP() {
  const { level, into, need } = levelOf(store.state.xp || 0);
  return h('div.home-xp', h('div.xp', h('div.xp-fill', { style: { width: `${(into / need) * 100}%` } }), h('div.xp-ticks'), h('div.xp-level', String(level))));
}

// ---------- home ----------
const SPLASHES = ['拼音小矿工！', '攒经验，开宝箱！', '钻石在等你！', '今天也要加油！', '方块越多越好玩！', '声调要读准！'];

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
      iconEl(meta.block || 'grass'),
      h('div.wr-text',
        h('div.wr-tag', meta.chapter ? `第${'一二三四五六七八九十'[meta.chapter - 1]}大关 · ${meta.subject}` : meta.subject),
        h('div.wr-title', meta.title),
        h('div.wr-sub', meta.subtitle || '')),
      h('div.wr-progress', h('div', spriteEl('star'), ` ${st.stars}`), h('div', `${st.done}/${st.total}关`)));
  }));

  // the four kinds of block he owns most, for the build button preview
  const owned = Object.entries(store.state.inventory).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).map(([t]) => t);
  const preview = [...new Set([...owned.sort((a, b) => BLOCKS[b].rarity - BLOCKS[a].rarity), 'grass', 'toy_red', 'diamond', 'planks'])].slice(0, 4);

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
            h('div.build-preview', preview.map(t => iconEl(t))),
            h('div.inv-count', `背包 ${invCount()} 个方块`),
            playerXP(),
            h('div.row-btns',
              h('button.mc-btn', { onclick: () => { sfx.tap(); go('#/build'); } }, '我的建造'),
              h('button.mc-btn', { onclick: () => { sfx.tap(); go('#/craft'); } }, '工作台'),
              h('button.mc-btn', { onclick: () => { sfx.tap(); go('#/book'); } }, '图鉴')))))));
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
    level.paperStage ? h('div.map-practice', h('button.mc-btn.small', { onclick: () => go(`#/paper/${id}`) }, spriteEl('speaker'), '纸上听写')) : null,
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
  if (nextIdx === 0 && level.intro) setTimeout(() => { if (board.isConnected) speak(level.intro, { profile: level.audioProfile }); }, 300);
}

// ---------- play ----------
async function screenPlay(levelId, stageId) {
  const level = await loadLevel(levelId);
  const stageIdx = level.stages.findIndex(s => s.id === stageId);
  const stage = level.stages[stageIdx];
  const practice = level.rewardPolicy === 'practice';

  const items = stageItems(stage);
  const say = (text, options = {}) => speak(text, { ...options, profile: level.audioProfile });
  const total = items.length;
  const slots = stage.items.map(() => h('div.hb-slot'));
  const xpFill = h('div.xp-fill');
  const xpLevel = h('div.xp-level', '0');
  const paintXP = () => {
    const { level: lv, into, need } = levelOf(store.state.xp || 0);
    xpFill.style.width = `${(into / need) * 100}%`;
    xpLevel.textContent = String(lv);
  };
  paintXP();
  const xp = h('div.xp', xpFill, h('div.xp-ticks'), xpLevel);
  const body = h('div.item-body');
  if (practice) app.classList.add('child-practice');
  // Ignore carry-over taps during a transition and accidental rapid double taps.
  let tapAfter = 0;
  body.addEventListener('click', event => {
    if (!practice || !event.target.closest('button')) return;
    const now = performance.now();
    if (now < tapAfter) { event.preventDefault(); event.stopImmediatePropagation(); return; }
    tapAfter = now + 240;
  }, true);
  app.append(h('div.screen',
    topBar(practice ? iconBtn('back', pause) : backBtn(`#/level/${levelId}`, 'cross'), h('div.plate', picEl(stage.icon || 'sprite:pickaxe'), stage.title),
      h('button.mc-btn.icon', { 'aria-label': '再听一次', onclick: () => say(current?.say || '') }, spriteEl('speaker'))),
    h('div.play-wrap',
      h('div.mc-panel.play-panel', body),
      h('div.hud', xp, h('div.hotbar', slots)))));

  let current = null;
  let firstTry = 0;
  let streak = 0;   // first-try answers in a row
  const mistakes = [];
  const earned = [];
  let paused = false, pendingNext = null;

  function pause() {
    if (paused) return;
    paused = true;
    const overlay = h('div.practice-pause', h('div.mc-panel',
      h('div.challenge-title', '休息一下？'),
      h('div.pause-actions',
        h('button.mc-btn.go', { onclick: () => {
          paused = false; overlay.remove(); tapAfter = performance.now() + 450;
          if (pendingNext) { const resume = pendingNext; pendingNext = null; resume(); }
          else say(current?.say);
        } }, spriteEl('forward'), '继续玩'),
        h('button.mc-btn', { onclick: () => go(`#/level/${levelId}`) }, spriteEl('map'), '回地图'))));
    app.append(overlay);
    say(level.speech?.pause);
  }

  async function show(i) {
    current = items[i];
    tapAfter = performance.now() + 450;
    body.innerHTML = '';
    body.classList.remove('dictation-body', 'lab-body', 'dictation-tones', 'math-explore');
    body.classList.remove('enter'); void body.offsetWidth; body.classList.add('enter');
    if (!practice && current.source) body.append(h('div.item-source', current.source));
    if (!practice && stage.note) body.append(h('div.challenge-note', stage.note));
    slots.forEach((s, k) => s.classList.toggle('now', k === i));
    let attempts = 0, solved = false;
    const ctx = {
      practice,
      speech: level.speech || {},
      say: (t, fallback) => say(t, { fallback }),
      wrong(got, hint) {
        attempts++;
        mistakes.push({ q: current.q || current.say, got: String(got ?? '') });
        if (hint !== null) { (practice ? sfx.tap : sfx.wrong)(); say(hint || retry()); }
      },
      async right(after) {
        if (solved || !body.isConnected) return;
        solved = true;
        const first = attempts === 0;
        if (first) firstTry++;
        if (practice || first) streak++; else streak = 0;
        // XP instead of a block per answer; a full XP bar (level-up) gives one block.
        let gain = answerXP(current, practice || first);
        const combo = (practice || first) && isCombo(streak);
        if (combo) gain += COMBO_XP;
        const before = levelOf(store.state.xp || 0).level;
        store.addXP(gain);
        const nowLevel = levelOf(store.state.xp).level;
        const ups = [];
        for (let k = before; k < nowLevel; k++) {
          const block = levelUpDrop(level.blockSet);
          ups.push({ block, isNew: store.addBlock(block) });
          earned.push(block);
        }
        sfx.right();
        orbs(xp, undefined, 4 + gain * 2);
        slots[i].innerHTML = '';
        slots[i].className = 'hb-slot xp-done';
        slots[i].append(spriteEl('orb'), h('span.xp-gain', `+${gain}`));
        setTimeout(() => { paintXP(); sfx.place(); }, 750);
        ups.forEach(({ block, isNew }, k) => setTimeout(() => {
          if (!body.isConnected) return;
          sfx.chest();
          burst(block, undefined, 18);
          banner(block, `升级啦！${BLOCKS[block].name}${isNew ? '（新）' : ''}`);
        }, 900 + k * 1400));
        const lines = [praise(level.blockSet), after];
        if (combo) lines.push(practice ? level.speech.combo : S.combo);
        if (ups.length) lines.push(S.levelUp);
        await say(lines);
        await wait(350);
        if (!body.isConnected || location.hash !== `#/play/${levelId}/${stageId}`) return;
        const next = () => { if (i + 1 < total) show(i + 1); else finish(); };
        if (paused) pendingNext = next;
        else next();
      },
    };
    preload(itemTexts(current), { profile: level.audioProfile });
    ITEM_TYPES[current.type](body, current, ctx);
    setTimeout(() => {
      if (!body.isConnected || current !== items[i] || paused) return;
      const guide = practice && (i === 0 || items[i - 1].type !== current.type)
        ? current.type === 'dictation' ? level.speech.letters : current.type === 'pinyinLab' ? level.speech.labGuide : null
        : null;
      say([current.say, guide]);
    }, 350);
  }

  function finish() {
    const rate = firstTry / total;
    const stars = practice ? 3 : rate >= 0.9 ? 3 : rate >= 0.7 ? 2 : 1;
    const replay = !!store.stage(levelId, stageId)?.done;
    store.finishStage(levelId, stageId, { stars, firstTry, total, mistakes });
    const chest = openChest(stars, practice ? false : replay, level.blockSet);
    const fresh = chest.blocks.map(b => store.addBlock(b));
    // one-time achievement blocks: every listed stage of this adventure finished
    const achieved = (level.achievements || [])
      .filter(a => a.stages.every(id => store.stage(levelId, id)?.done) && store.achieve(a.id))
      .map(a => ({ ...a, isNew: store.addBlock(a.block) }));
    showReward(level, stageIdx, stars, chest, fresh, earned, practice ? false : replay, achieved);
  }

  show(0);
}

// Everything an item might say, so its clips are fetched before they're needed.
function itemTexts(it) {
  const opts = (it.options || []).map(o => (typeof o === 'string' ? o : o.say || o.text));
  return [it.say, it.after, it.hint, it.prompt?.picSay, it.read, ...(it.strokes || []), ...(it.pieces || []), ...opts, ...PRAISE];
}

function showReward(level, stageIdx, stars, chest, fresh, earned, replay, achieved = []) {
  const next = level.stages[stageIdx + 1];
  const practice = level.rewardPolicy === 'practice';
  app.innerHTML = '';
  const kind = chest.kind === 'wood' ? 'chest' : `chest_${chest.kind}`;
  const chestIcon = spriteEl(kind, `chest ${chest.kind}`);
  const stars3 = starRow(stars, '.reward-stars');
  const blocks = h('div.reward-blocks');
  const best = Math.max(...chest.blocks.map(b => BLOCKS[b].rarity));
  const btns = practice ? h('div.row-btns.reward-actions',
    h('button.mc-btn.icon', { 'aria-label': '回地图', onclick: () => go(`#/level/${level.id}`) }, spriteEl('map')),
    h('button.mc-btn.go', { 'aria-label': next ? '下一关' : '去建造', onclick: () => go(next ? `#/play/${level.id}/${next.id}` : '#/build') }, spriteEl(next ? 'forward' : 'bricks')),
    next ? h('button.mc-btn.icon', { 'aria-label': '去建造', onclick: () => go('#/build') }, spriteEl('bricks')) : null)
    : h('div.row-btns',
    h('button.mc-btn', { onclick: () => go(`#/level/${level.id}`) }, spriteEl('map'), '回地图'),
    h('button.mc-btn', { onclick: () => go('#/build') }, spriteEl('bricks'), '去建造'),
    next ? h('button.mc-btn.go', { onclick: () => go(`#/play/${level.id}/${next.id}`) }, '下一关') : null);
  btns.style.visibility = 'hidden';
  [...stars3.children].forEach((s, k) => { s.style.animationDelay = `${0.2 + k * 0.25}s`; });

  app.append(h('div.dim'), h('div.screen.center',
    h(`div.mc-panel.reward.best${best}`,
      h('div.reward-title', '过关啦！'),
      stars3,
      h('div.chest-wrap', h('div.rays'), chestIcon),
      h('div.chest-name', CHESTS[chest.kind].name + (replay ? '（重玩）' : '')),
      blocks,
      achieved.length ? h('div.reward-ach', achieved.map(a => h('div.ach-card.got',
        h(`div.inv-slot.r${BLOCKS[a.block].rarity}`, iconEl(a.block)),
        h('div.ach-text', h('div.craft-name', { style: { color: RARITY[BLOCKS[a.block].rarity].color } }, BLOCKS[a.block].name), h('div.ach-title', `成就：${a.title}`))))) : null,
      h('div.reward-sub', `这一关一共得到 ${earned.length + chest.blocks.length + achieved.length} 个方块`),
      btns)));
  const lines = [stageDone(stars)];
  if (replay) lines.push(S.replayChest);
  speak(lines, { profile: level.audioProfile });
  for (let k = 0; k < stars; k++) setTimeout(() => sfx.tap(), 200 + k * 250);

  // chest shakes, pops open, blocks drop into slots (rarest last)
  setTimeout(() => {
    chestIcon.style.backgroundImage = `url(${spriteURL(kind + '_open')})`;
    chestIcon.classList.add('open');
    if (best >= 3) chestIcon.parentElement.classList.add('glow');
    sfx.chest();
    const r = chestIcon.getBoundingClientRect();
    const order = chest.blocks.map((b, i) => i).sort((a, b) => BLOCKS[chest.blocks[a]].rarity - BLOCKS[chest.blocks[b]].rarity);
    burst(chest.blocks[order.at(-1)], { x: r.left + r.width / 2, y: r.top + r.height / 3 }, 18);
    order.forEach((i, k) => {
      const b = chest.blocks[i], rar = BLOCKS[b].rarity;
      blocks.append(h(`div.rb.r${rar}`, { style: { animationDelay: `${k * 0.18}s` } },
        h(`div.inv-slot.r${rar}`, iconEl(b), fresh[i] ? h('span.new-tag', '新') : null),
        h('div.rb-name', { style: { color: RARITY[rar].color } }, BLOCKS[b].name)));
    });
    btns.style.visibility = '';
    if (achieved.length) {
      setTimeout(() => {
        if (!blocks.isConnected) return;
        achieved.forEach((a, k) => setTimeout(() => { banner(a.block, `成就达成：${BLOCKS[a.block].name}`); sfx.chest(); }, k * 1500));
        speak(S.achieve, { profile: level.audioProfile });
      }, 600);
    } else if (best >= 3) setTimeout(() => { if (blocks.isConnected) speak(best === 4 ? S.legendFind : S.epicFind, { profile: level.audioProfile }); }, 500);
  }, 1300);
}

// ---------- workbench ----------
async function screenCraft() {
  const { mountCraft } = await import('./craft.js');
  mountCraft(app, { onBack: () => history.length > 1 ? history.back() : go('#/') });
}

// ---------- build ----------
async function screenBuild() {
  const { mountBuild } = await import('./build3d.js');
  mountBuild(app, { onBack: () => go('#/'), onBook: () => go('#/book') });
}

// Paper practice has no automatic grading or block rewards: the child and parent check the writing.
async function screenPaper(levelId) {
  const level = await loadLevel(levelId);
  const stage = level.stages.find(s => s.id === level.paperStage);
  if (!stage) throw new Error('这个冒险还没有纸上听写。');
  const body = h('div.mc-panel.paper-practice');
  app.append(h('div.screen',
    topBar(backBtn(`#/level/${levelId}`), h('div.plate', spriteEl('book'), '纸上听写'), ''), body));
  mountPaper(body, stage.items, { profile: level.audioProfile });
}

// ---------- collection book ----------
function screenBook() {
  const found = store.state.found;
  const all = Object.keys(BLOCKS);
  const sections = RARITY.map((r, ri) => {
    const list = all.filter(t => BLOCKS[t].rarity === ri);
    const got = list.filter(t => found[t]).length;
    return h('div.book-sec',
      h('div.book-head', { style: { color: r.color } }, `${r.name}  ${got}/${list.length}`),
      h('div.book-grid', list.map(t => found[t]
        ? h(`div.book-cell.r${ri}`, h(`div.inv-slot.r${ri}`, iconEl(t), h('span.inv-n', String(store.state.inventory[t] || 0))), h('div.book-name', BLOCKS[t].name))
        : h('div.book-cell.unknown', h(`div.inv-slot.r${ri}`, iconEl(t), h('span.qmark-s', '?')), h('div.book-name', '？？？')))));
  });
  const got = all.filter(t => found[t]).length;
  app.append(h('div.screen.book',
    topBar(backBtn('#/build'), h('div.plate', spriteEl('book'), `方块图鉴  ${got}/${all.length}`), ''),
    h('div.mc-panel.book-panel', sections)));
  speak(S.bookIntro);
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
      lv.rewardPolicy === 'practice' ? h('div.p-note', '练习完成并订正即可获得三星；首次答对情况仅供复习参考，重练不减少奖励。') : null,
      rows,
      h('button.mc-btn.small', { onclick: () => { if (confirm('清空这个任务的进度？')) { store.resetLevel(lv.id); route(); } } }, '重置这个任务')));
  }
  box.append(h('div.mc-panel',
    h('h2', '方块'),
    h('div', `背包 ${invCount()} 个，累计获得 ${store.state.totalBlocks} 个；经验等级 ${levelOf(store.state.xp || 0).level}（共 ${store.state.xp || 0} 点经验）`),
    h('div.p-note', '每题只得经验，经验条满一次得到 1 个方块；每关结束开宝箱（木 1 / 铁 2 / 金 3 个）。合成和背诵成就可得到专属方块。'),
    h('div.row-btns',
      h('button.mc-btn.small', { onclick: () => { ['diamond', 'gold', 'toy_red', 'toy_blue', 'toy_yellow'].forEach(b => store.addBlock(b, 2)); route(); } }, '奖励 10 个方块'),
      h('button.mc-btn.small', { onclick: () => { Object.keys(BLOCKS).forEach(b => store.addBlock(b, 5)); route(); } }, '试玩：每种方块送 5 个'),
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
