// Workbench: turn spare blocks into better ones (Minecraft-style recipes, simplified for counting).
// Some blocks (obtain: 'craft' in blocks.js) can only be made here, so collecting has a goal.
// No speech here, like build mode; sound effects only.
import { h } from './ui.js';
import { store } from './store.js';
import { sfx } from './audio.js';
import { BLOCKS, RARITY, iconEl } from './blocks.js';
import { burst, banner } from './fx.js';
import { spriteEl } from './sprites.js';

export const RECIPES = [
  { out: 'crafting_table', in: { planks: 4 } },
  { out: 'sandstone', in: { sand: 4 } },
  { out: 'bookshelf', in: { planks: 6 } },
  { out: 'furnace', in: { cobble: 8 } },
  { out: 'mossy_cobble', in: { cobble: 1, moss_block: 1 } },
  { out: 'iron_block', in: { iron_ore: 9 } },
  { out: 'note_block', in: { planks: 8, redstone_ore: 1 } },
  { out: 'chiseled_bookshelf', in: { bookshelf: 3, planks: 3 } },
  { out: 'enchanting_table', in: { bookshelf: 1, diamond: 2, obsidian: 4 } },
  { out: 'sea_lantern', in: { dark_prismarine: 4, lamp: 1 } },
];

// Achievement blocks, shown on the workbench page so he can see what he's working towards.
export const ACHIEVEMENTS = [
  { id: 'chile', block: 'sky_terracotta', title: '会背《敕勒歌》' },
  { id: 'yongliu', block: 'jade_terracotta', title: '会背《咏柳》' },
  { id: 'readygo', block: 'jukebox', title: '英语 Ready Go 三单元指读' },
  { id: 'temple', block: 'conduit', title: '闯过海底神殿全部关卡' },
];

const have = t => store.state.inventory[t] || 0;

export function mountCraft(app, { onBack }) {
  const list = h('div.craft-list');
  const ach = h('div.craft-ach');
  app.append(h('div.screen.craft',
    h('div.topbar',
      h('div.tb-left', h('button.mc-btn.icon', { onclick: () => { sfx.tap(); onBack(); } }, spriteEl('back'))),
      h('div.tb-title', h('div.plate', iconEl('crafting_table'), '工作台')),
      h('div.tb-right')),
    h('div.mc-panel.craft-panel', h('div.panel-title', '合成'), list),
    h('div.mc-panel.craft-panel', h('div.panel-title', '成就方块'), ach)));

  function paint() {
    list.replaceChildren(...RECIPES.map(r => {
      const ok = Object.entries(r.in).every(([t, n]) => have(t) >= n);
      const rar = BLOCKS[r.out].rarity;
      const btn = h(`button.mc-btn.go.craft-go`, { disabled: !ok, onclick: () => make(r, card) }, spriteEl('hammer'));
      const card = h(`div.craft-card${ok ? '.ready' : ''}`,
        h('div.craft-in', Object.entries(r.in).map(([t, n]) =>
          h('div.craft-need', h(`div.inv-slot.r${BLOCKS[t].rarity}`, iconEl(t)),
            h(`div.craft-count${have(t) >= n ? '.enough' : ''}`, `${Math.min(have(t), n)}/${n}`)))),
        h('div.craft-arrow', '➜'),
        h('div.craft-out', h(`div.inv-slot.r${rar}`, iconEl(r.out), have(r.out) ? h('span.inv-n', String(have(r.out))) : null),
          h('div.craft-name', { style: { color: RARITY[rar].color } }, BLOCKS[r.out].name)),
        btn);
      return card;
    }));
    ach.replaceChildren(...ACHIEVEMENTS.map(a => {
      const got = !!store.state.achievements[a.id];
      const rar = BLOCKS[a.block].rarity;
      return h(`div.ach-card${got ? '.got' : ''}`,
        h(`div.inv-slot.r${rar}`, iconEl(a.block), got ? null : h('span.qmark-s', '?')),
        h('div.ach-text', h('div.craft-name', { style: { color: got ? RARITY[rar].color : '#aaa' } }, got ? BLOCKS[a.block].name : '？？？'), h('div.ach-title', a.title)));
    }));
  }

  function make(r, card) {
    const fresh = store.craft(r.in, r.out);
    if (fresh === null) return;
    sfx.place();
    sfx.chest();
    const rect = card.querySelector('.craft-out').getBoundingClientRect();
    burst(r.out, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }, 16);
    banner(r.out, `${fresh ? '新发现：' : '合成了'}${BLOCKS[r.out].name}`);
    paint();
  }

  paint();
}
