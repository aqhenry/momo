// Workbench (#/craft): long-term goals beside the adventures. Four tabs:
//   合成  Minecraft-style recipes. Pickaxes unlock recipe tiers (木镐 → 石镐 → 铁镐 → 钻石镐), so there is
//         always a next tool to work towards. Materials (木棍, 铁锭) sit between blocks and tools.
//   熔炉  load one job; it is fuelled by XP earned answering questions, then he takes the result out.
//   宠物  fishing (a cast line is also fuelled by XP) and pets tamed with food: seeds and carrots are crafted,
//         fish and bones are caught. Each pet card shows its English word (the animals unit).
//   奖杯  milestone trophies (bronze/silver/gold) with progress bars; claiming one gives a block.
// Blocks with obtain: 'craft' only come from here. No speech here, like build mode; sound effects only.
import { h } from './ui.js';
import { store } from './store.js';
import { sfx } from './audio.js';
import { BLOCKS, RARITY, iconEl, blocksOfRarity } from './blocks.js';
import { burst, banner } from './fx.js';
import { spriteEl } from './sprites.js';
import { levelOf } from './rewards.js';
import { picEl } from './pics.js';

export const MATERIALS = {
  stick: { name: '木棍', sprite: 'stick' },
  iron_ingot: { name: '铁锭', sprite: 'ingot' },
  seeds: { name: '小麦种子', sprite: 'seeds' },
  carrot: { name: '胡萝卜', sprite: 'carrot' },
  raw_fish: { name: '鱼', sprite: 'fish_item' },
  bone: { name: '骨头', sprite: 'bone' },
};
export const TOOLS = {
  wood_pickaxe: { name: '木镐', tier: 1, sprite: 'pick_wood' },
  stone_pickaxe: { name: '石镐', tier: 2, sprite: 'pick_stone' },
  iron_pickaxe: { name: '铁镐', tier: 3, sprite: 'pick_iron' },
  diamond_pickaxe: { name: '钻石镐', tier: 4, sprite: 'pick_diamond' },
  fishing_rod: { name: '钓鱼竿', tier: 0, sprite: 'rod' },
};
const TIER_TOOL = ['', 'wood_pickaxe', 'stone_pickaxe', 'iron_pickaxe', 'diamond_pickaxe'];

// tier: the pickaxe level needed to make it (0 = bare hands). out: block, material or tool; n: how many.
export const RECIPES = [
  { tier: 0, out: 'stick', n: 4, in: { planks: 2 } },
  { tier: 0, out: 'crafting_table', in: { planks: 4 } },
  { tier: 0, out: 'bookshelf', in: { planks: 6 } },
  { tier: 0, out: 'sandstone', in: { sand: 4 } },
  { tier: 0, out: 'wood_pickaxe', in: { planks: 3, stick: 2 } },
  { tier: 0, out: 'fishing_rod', in: { stick: 3, wool_white: 1 } },
  { tier: 0, out: 'seeds', n: 3, in: { hay: 1 } },
  { tier: 0, out: 'carrot', n: 2, in: { grass: 1, dirt: 1 } },
  { tier: 1, out: 'stone_pickaxe', in: { cobble: 3, stick: 2 } },
  { tier: 1, out: 'furnace', in: { cobble: 8 } },
  { tier: 1, out: 'mossy_cobble', in: { cobble: 1, moss_block: 1 } },
  { tier: 1, out: 'note_block', in: { planks: 8, redstone_ore: 1 } },
  { tier: 1, out: 'packed_ice', in: { ice: 4 } },
  { tier: 1, out: 'mud_bricks', n: 2, in: { dirt: 2, clay: 1 } },
  { tier: 2, out: 'honeycomb_block', in: { hay: 2, wool_yellow: 1 } },
  { tier: 2, out: 'iron_pickaxe', in: { iron_ingot: 3, stick: 2 } },
  { tier: 2, out: 'iron_block', in: { iron_ingot: 4 } },
  { tier: 2, out: 'chiseled_bookshelf', in: { bookshelf: 3, planks: 3 } },
  { tier: 2, out: 'sea_lantern', in: { dark_prismarine: 4, lamp: 1 } },
  { tier: 2, out: 'blue_ice', in: { packed_ice: 4 } },
  { tier: 3, out: 'diamond_pickaxe', in: { diamond: 3, stick: 2 } },
  { tier: 3, out: 'gold_block_craft', in: { gold: 2, brick: 2 } },
  { tier: 3, out: 'enchanting_table', in: { bookshelf: 1, diamond: 2, obsidian: 4 } },
  { tier: 4, out: 'netherite_block', in: { obsidian: 4, gold: 2, iron_ingot: 4 } },
];

// Furnace jobs: `xp` is how much XP (from answering questions) the fire needs. Needs a 熔炉 block owned.
export const SMELT = [
  { in: { sand: 2 }, out: 'glass', n: 2, xp: 6 },
  { in: { cobble: 2 }, out: 'stone', n: 2, xp: 6 },
  { in: { clay: 2 }, out: 'terracotta', n: 2, xp: 6 },
  { in: { iron_ore: 1 }, out: 'iron_ingot', n: 1, xp: 10 },
  { in: { snow: 2 }, out: 'ice', n: 1, xp: 8 },
];

// Fishing: cast the line, earn FISH_XP answering questions, then reel in one catch (weights out of 100).
export const FISH_XP = 8;
const CATCH = [{ w: 55, item: 'raw_fish', n: 2 }, { w: 25, item: 'raw_fish', n: 1 }, { w: 15, item: 'bone', n: 2 }, { w: 5, block: true }];

// Pets: feed one its food once and it joins for good. `art` is the picture, `en` the word on its card.
export const PETS = [
  { id: 'dog', en: 'dog', name: '小狗', art: 'dog', food: { bone: 3 } },
  { id: 'cat', en: 'cat', name: '小猫', art: 'cat', food: { raw_fish: 3 } },
  { id: 'rabbit', en: 'rabbit', name: '兔子', art: 'rabbit', food: { carrot: 3 } },
  { id: 'bird', en: 'bird', name: '小鸟', art: 'bird', food: { seeds: 4 } },
  { id: 'hamster', en: 'hamster', name: '仓鼠', art: 'hamster', food: { seeds: 2, carrot: 1 } },
  { id: 'tortoise', en: 'tortoise', name: '乌龟', art: 'turtle', food: { carrot: 2, raw_fish: 1 } },
  { id: 'bee', en: 'bee', name: '蜜蜂', art: 'bee', food: { leaves: 3, seeds: 1 } },
];

// Achievement blocks, listed so he can see what he's working towards.
export const ACHIEVEMENTS = [
  { id: 'chile', block: 'sky_terracotta', title: '会背《敕勒歌》' },
  { id: 'yongliu', block: 'jade_terracotta', title: '会背《咏柳》' },
  { id: 'readygo', block: 'jukebox', title: '英语 Ready Go 三单元指读' },
  { id: 'temple', block: 'conduit', title: '闯过海底神殿全部关卡' },
  { id: 'u12-pinyin', block: 'lodestone', title: '拼音听写过关' },
  { id: 'u12-hanzi', block: 'respawn_anchor', title: '十八个字全会写' },
  { id: 'w11-all', block: 'froglight', title: '闯过丛林算术营' },
  { id: 'feng', block: 'wind_block', title: '会背《风》' },
  { id: 'changge', block: 'sunflower_block', title: '会背《长歌行》' },
  { id: 'zoo-all', block: 'crown_block', title: '闯过国王的动物园' },
];

const stagesDone = s => Object.values(s.progress).reduce((a, lv) => a + Object.values(lv).filter(x => x.done).length, 0);
export const TROPHIES = [
  { id: 'craft', name: '合成大师', sprite: 'hammer', tiers: [5, 20, 50], value: s => s.stats.crafted },
  { id: 'smelt', name: '熔炉工匠', sprite: 'flame', tiers: [3, 10, 30], value: s => s.stats.smelted },
  { id: 'tools', name: '工具达人', sprite: 'pick_iron', tiers: [1, 3, 4], value: s => Object.keys(s.tools).length },
  { id: 'level', name: '经验之星', sprite: 'orb', tiers: [3, 10, 20], value: s => levelOf(s.xp || 0).level },
  { id: 'collect', name: '方块收藏家', sprite: 'book', tiers: [20, 45, 75], value: s => Object.keys(s.found).length },
  { id: 'stages', name: '闯关勇士', sprite: 'map', tiers: [10, 30, 60], value: stagesDone },
  { id: 'pets', name: '动物朋友', sprite: 'paw', tiers: [1, 4, 7], value: s => Object.keys(s.pets || {}).length },
  { id: 'fish', name: '钓鱼高手', sprite: 'fish_item', tiers: [3, 10, 25], value: s => s.stats.fished || 0 },
  { id: 'achieve', name: '成就猎人', sprite: 'star', tiers: [1, 3, 6], value: s => Object.keys(s.achievements).length },
];
const TIER_NAMES = ['铜', '银', '金'];

const isBlock = t => !!BLOCKS[t];
const kind = t => (BLOCKS[t] ? 'block' : TOOLS[t] ? 'tool' : 'item');
const nameOf = t => BLOCKS[t]?.name || TOOLS[t]?.name || MATERIALS[t]?.name || t;
const have = t => (TOOLS[t] ? (store.state.tools[t] ? 1 : 0) : store.count(t, isBlock(t)));
export const toolTier = () => Math.max(0, ...Object.keys(store.state.tools).map(t => TOOLS[t]?.tier || 0));

function thing(t, cls = '') {
  if (BLOCKS[t]) return h(`div.inv-slot.r${BLOCKS[t].rarity}${cls}`, iconEl(t));
  return h(`div.inv-slot.tool-slot${cls}`, spriteEl(TOOLS[t]?.sprite || MATERIALS[t]?.sprite || 'apple'));
}
const can = r => Object.entries(r.in).every(([t, n]) => have(t) >= n);

export function furnaceStatus() {
  const f = store.state.furnace;
  if (!f) return null;
  const job = SMELT[f.job];
  const prog = Math.min(job.xp, (store.state.xp || 0) - f.start);
  return { job, prog, ready: prog >= job.xp };
}
export function fishStatus() {
  const f = store.state.fishing;
  if (!f) return null;
  const prog = Math.min(FISH_XP, (store.state.xp || 0) - f.start);
  return { prog, ready: prog >= FISH_XP };
}
export const trophyReady = tr => {
  const k = store.state.trophies[tr.id] || 0;
  return k < tr.tiers.length && tr.value(store.state) >= tr.tiers[k];
};
// something waiting on the workbench (furnace done or a trophy to claim): home shows a "!" on its button
export const workbenchAlert = () => !!furnaceStatus()?.ready || !!fishStatus()?.ready || TROPHIES.some(trophyReady);

export function mountCraft(app, { onBack }) {
  let tab = 'craft';
  const body = h('div.craft-body');
  const tabs = h('div.craft-tabs');
  const bag = h('div.craft-bag');
  app.append(h('div.screen.craft',
    h('div.topbar',
      h('div.tb-left', h('button.mc-btn.icon', { onclick: () => { sfx.tap(); onBack(); } }, spriteEl('back'))),
      h('div.tb-title', h('div.plate', iconEl('crafting_table'), '工作台')),
      h('div.tb-right')),
    tabs, bag, body));

  function paint() {
    const alert = { smelt: !!furnaceStatus()?.ready, pets: !!fishStatus()?.ready, trophy: TROPHIES.some(trophyReady) };
    tabs.replaceChildren(...[['craft', 'hammer', '合成'], ['smelt', 'flame', '熔炉'], ['pets', 'paw', '宠物'], ['trophy', 'trophy', '奖杯']].map(([id, sp, label]) =>
      h(`button.mc-btn.craft-tab${tab === id ? '.on' : ''}`, { onclick: () => { sfx.tap(); tab = id; paint(); } },
        spriteEl(sp), label, alert[id] ? h('span.alert-dot', '!') : null)));
    // tools and materials he owns
    bag.replaceChildren(
      ...Object.entries(TOOLS).map(([id, t]) => h(`div.bag-tool${store.state.tools[id] ? '.got' : ''}`, spriteEl(store.state.tools[id] ? t.sprite : 'lock'), h('span', t.name))),
      ...Object.entries(MATERIALS).map(([id, m]) => h('div.bag-mat', spriteEl(m.sprite), h('span', `${m.name} ${have(id)}`))));
    body.replaceChildren(tab === 'craft' ? craftTab() : tab === 'smelt' ? smeltTab() : tab === 'pets' ? petsTab() : trophyTab());
  }

  function craftTab() {
    const tier = toolTier();
    const groups = [0, 1, 2, 3, 4].map(t => {
      const locked = t > tier;
      const head = t ? h('div.tier-head', spriteEl(locked ? 'lock' : TOOLS[TIER_TOOL[t]].sprite), locked ? `需要${TOOLS[TIER_TOOL[t]].name}` : `${TOOLS[TIER_TOOL[t]].name}解锁`) : h('div.tier-head', spriteEl('hammer'), '徒手就能做');
      const cards = RECIPES.filter(r => r.tier === t).map(r => recipeCard(r, locked));
      return h(`div.mc-panel.craft-panel${locked ? '.locked' : ''}`, head, h('div.craft-list', cards));
    });
    return h('div', groups, achPanel());
  }

  function recipeCard(r, locked) {
    const owned = TOOLS[r.out] && store.state.tools[r.out];
    const ok = !locked && !owned && can(r);
    const rar = BLOCKS[r.out]?.rarity ?? 2;
    const card = h(`div.craft-card${ok ? '.ready' : ''}${owned ? '.owned' : ''}`,
      h('div.craft-in', Object.entries(r.in).map(([t, n]) =>
        h('div.craft-need', thing(t), h(`div.craft-count${have(t) >= n ? '.enough' : ''}`, `${Math.min(have(t), n)}/${n}`)))),
      h('div.craft-arrow', '➜'),
      h('div.craft-out', thing(r.out), h('div.craft-name', { style: { color: RARITY[rar].color } }, `${nameOf(r.out)}${r.n > 1 ? ` ×${r.n}` : ''}`)),
      owned ? h('div.craft-done', spriteEl('check')) :
        h('button.mc-btn.go.craft-go', { disabled: !ok, onclick: () => make(r, card) }, spriteEl(locked ? 'lock' : 'hammer')));
    return card;
  }

  function make(r, card) {
    if (!store.spend(r.in, isBlock)) return;
    let fresh = false;
    if (kind(r.out) === 'block') fresh = store.addBlock(r.out, r.n || 1);
    else if (kind(r.out) === 'tool') { store.setTool(r.out); fresh = true; }
    else store.gainItem(r.out, r.n || 1);
    store.bump('crafted');
    sfx.place(); sfx.chest();
    const rect = card.querySelector('.craft-out').getBoundingClientRect();
    if (BLOCKS[r.out]) {
      burst(r.out, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }, 16);
      banner(r.out, `${fresh ? '新发现：' : '合成了'}${nameOf(r.out)}`);
    } else toast(TOOLS[r.out] ? `做好了${nameOf(r.out)}！解锁新的合成` : `合成了${nameOf(r.out)} ×${r.n || 1}`, TOOLS[r.out]?.sprite || MATERIALS[r.out].sprite);
    paint();
  }

  function smeltTab() {
    const hasFurnace = have('furnace') > 0;
    const st = furnaceStatus();
    const panel = h('div.mc-panel.craft-panel.smelt-panel');
    if (!hasFurnace && !st) {
      panel.append(h('div.tier-head', spriteEl('lock'), '先在合成里做一个熔炉'), h('div.smelt-need', iconEl('furnace'), h('span', '8 个圆石 + 木镐')));
      return panel;
    }
    const slot = h('div.smelt-machine',
      st ? thing(Object.keys(st.job.in)[0]) : h('div.inv-slot.empty'),
      h('div.smelt-fire', spriteEl('flame'), h('div.smelt-bar', h('div.smelt-fill', { style: { width: `${st ? (st.prog / st.job.xp) * 100 : 0}%` } }))),
      st ? thing(st.job.out) : h('div.inv-slot.empty'));
    panel.append(h('div.tier-head', iconEl('furnace'), st ? (st.ready ? '烧好啦！' : `答题攒经验当柴火：${st.prog}/${st.job.xp}`) : '选一样东西放进去烧'), slot);
    if (st?.ready) {
      panel.append(h('button.mc-btn.go.smelt-take', { onclick: () => {
        const { job } = st;
        store.setFurnace(null);
        if (isBlock(job.out)) { const fresh = store.addBlock(job.out, job.n); banner(job.out, `${fresh ? '新发现：' : '烧好了'}${nameOf(job.out)} ×${job.n}`); }
        else { store.gainItem(job.out, job.n); toast(`烧好了${nameOf(job.out)} ×${job.n}`, MATERIALS[job.out].sprite); }
        store.bump('smelted');
        sfx.chest();
        paint();
      } }, spriteEl('confirm'), '取出来'));
    } else if (!st) {
      panel.append(h('div.craft-list', SMELT.map((job, i) => {
        const ok = Object.entries(job.in).every(([t, n]) => have(t) >= n);
        return h(`div.craft-card${ok ? '.ready' : ''}`,
          h('div.craft-in', Object.entries(job.in).map(([t, n]) => h('div.craft-need', thing(t), h(`div.craft-count${have(t) >= n ? '.enough' : ''}`, `${Math.min(have(t), n)}/${n}`)))),
          h('div.craft-arrow', spriteEl('flame')),
          h('div.craft-out', thing(job.out), h('div.craft-name', `${nameOf(job.out)} ×${job.n}`), h('div.smelt-xp', spriteEl('orb'), String(job.xp))),
          h('button.mc-btn.go.craft-go', { disabled: !ok, onclick: () => {
            if (!store.spend(job.in, isBlock)) return;
            store.setFurnace({ job: i, start: store.state.xp || 0 });
            sfx.place();
            paint();
          } }, spriteEl('flame')));
      })));
    } else panel.append(h('div.smelt-note', spriteEl('orb'), '去冒险答题吧，答对的经验会让火烧旺。'));
    return panel;
  }

  function petsTab() {
    const fishing = h('div.mc-panel.craft-panel.fish-panel');
    const st = fishStatus();
    if (!store.state.tools.fishing_rod) {
      fishing.append(h('div.tier-head', spriteEl('lock'), '先在合成里做一根钓鱼竿'), h('div.smelt-need', spriteEl('rod'), h('span', '3 根木棍 + 1 块白羊毛')));
    } else if (!st) {
      fishing.append(h('div.tier-head', spriteEl('rod'), '去钓鱼！鱼和骨头可以喂宠物'),
        h('button.mc-btn.go.smelt-take', { onclick: () => { store.setFishing({ start: store.state.xp || 0 }); sfx.place(); paint(); } }, spriteEl('rod'), '甩竿'));
    } else {
      fishing.append(h('div.tier-head', spriteEl('rod'), st.ready ? '鱼上钩啦！' : `答题攒经验，鱼就会上钩：${st.prog}/${FISH_XP}`),
        h('div.fish-water', h('div.smelt-bar', h('div.smelt-fill.fish-fill', { style: { width: `${(st.prog / FISH_XP) * 100}%` } }))));
      if (st.ready) fishing.append(h('button.mc-btn.go.smelt-take', { onclick: reel }, spriteEl('confirm'), '收竿'));
    }
    const pets = h('div.mc-panel.craft-panel', h('div.tier-head', spriteEl('paw'), '喂一次，它就成为你的好朋友'), h('div.pet-list', PETS.map(petCard)));
    return h('div', fishing, pets);
  }

  function reel() {
    store.setFishing(null);
    store.bump('fished');
    let roll = Math.random() * 100;
    const got = CATCH.find(c => (roll -= c.w) < 0) || CATCH[0];
    sfx.chest();
    if (got.block) {
      const pool = blocksOfRarity(2);
      const block = pool[Math.floor(Math.random() * pool.length)];
      const fresh = store.addBlock(block);
      banner(block, `钓到宝藏：${BLOCKS[block].name}${fresh ? '（新）' : ''}`);
    } else {
      store.gainItem(got.item, got.n);
      toast(`钓到了${nameOf(got.item)} ×${got.n}`, MATERIALS[got.item].sprite);
    }
    paint();
  }

  function petCard(p) {
    const tamed = !!store.state.pets?.[p.id];
    const ok = !tamed && Object.entries(p.food).every(([t, n]) => have(t) >= n);
    const card = h(`div.pet-card${tamed ? '.tamed' : ''}${ok ? '.ready' : ''}`,
      h('div.pet-pic', picEl('art:' + p.art)),
      h('div.pet-en', p.en),
      h('div.pet-name', p.name),
      tamed ? h('div.pet-heart', spriteEl('heart')) :
        h('div.pet-food', Object.entries(p.food).map(([t, n]) =>
          h('div.craft-need', thing(t), h(`div.craft-count${have(t) >= n ? '.enough' : ''}`, `${Math.min(have(t), n)}/${n}`)))),
      tamed ? null : h('button.mc-btn.go.pet-feed', { disabled: !ok, onclick: () => {
        if (!store.spend(p.food, isBlock)) return;
        store.tamePet(p.id);
        sfx.chest();
        toast(`${p.en}，${p.name}成为你的好朋友！`, 'heart');
        paint();
      } }, '喂它'));
    if (tamed) card.addEventListener('click', () => { sfx.tap(); card.querySelector('.pet-pic').animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-14px)' }, { transform: 'translateY(0)' }], { duration: 380, easing: 'ease-out' }); });
    return card;
  }

  function trophyTab() {
    const s = store.state;
    return h('div.mc-panel.craft-panel', h('div.trophy-list', TROPHIES.map(tr => {
      const k = s.trophies[tr.id] || 0, v = tr.value(s), next = tr.tiers[k];
      const ready = trophyReady(tr);
      const cups = h('div.trophy-cups', tr.tiers.map((_, i) => spriteEl(i < k ? `trophy_${['bronze', 'silver', 'gold'][i]}` : 'lock', i < k ? 'cup got' : 'cup')));
      return h(`div.trophy-card${ready ? '.ready' : ''}`,
        h('div.trophy-icon', spriteEl(tr.sprite)),
        h('div.trophy-text', h('div.trophy-name', tr.name),
          next !== undefined ? h('div.trophy-bar', h('div.trophy-fill', { style: { width: `${Math.min(1, v / next) * 100}%` } }), h('span', `${Math.min(v, next)}/${next}`)) : h('div.trophy-max', '全部金杯！')),
        cups,
        ready ? h('button.mc-btn.go.trophy-claim', { onclick: () => claim(tr, k) }, `领${TIER_NAMES[k]}杯`) : null);
    })));
  }

  function claim(tr, k) {
    store.claimTrophy(tr.id);
    const pool = blocksOfRarity(k + 1);        // bronze → 优秀, silver → 稀有, gold → 史诗
    const block = pool[Math.floor(Math.random() * pool.length)];
    const fresh = store.addBlock(block);
    sfx.chest();
    banner(block, `${tr.name}${TIER_NAMES[k]}杯！${BLOCKS[block].name}${fresh ? '（新）' : ''}`);
    paint();
  }

  function achPanel() {
    return h('div.mc-panel.craft-panel', h('div.tier-head', spriteEl('star'), '成就方块'), h('div.craft-ach', ACHIEVEMENTS.map(a => {
      const got = !!store.state.achievements[a.id];
      const rar = BLOCKS[a.block].rarity;
      return h(`div.ach-card${got ? '.got' : ''}`,
        h(`div.inv-slot.r${rar}`, iconEl(a.block), got ? null : h('span.qmark-s', '?')),
        h('div.ach-text', h('div.craft-name', { style: { color: got ? RARITY[rar].color : '#aaa' } }, got ? BLOCKS[a.block].name : '？？？'), h('div.ach-title', a.title)));
    })));
  }

  paint();
}

// a banner for things that aren't blocks (tools, materials)
function toast(text, sprite) {
  const b = h('div.banner.r2', spriteEl(sprite, 'toast-ico'), h('span', text));
  document.body.append(b);
  b.animate([{ transform: 'translate(-50%, -120%)' }, { transform: 'translate(-50%, 0)', offset: 0.12 }, { transform: 'translate(-50%, 0)', offset: 0.85 }, { transform: 'translate(-50%, -120%)' }],
    { duration: 2400, easing: 'ease-out' }).onfinish = () => b.remove();
}
