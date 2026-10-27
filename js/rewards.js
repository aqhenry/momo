// What drops when: harder questions, first-try answers, streaks and 3-star stages roll rarer blocks.
import { blocksOfRarity } from './blocks.js';
import { store } from './store.js';

// weights for rarity 0..4 (普通 优秀 稀有 史诗 传说)
const TABLES = {
  easy:   [70, 25, 5, 0, 0],
  medium: [50, 35, 13, 2, 0],
  hard:   [35, 38, 20, 6, 1],
  retry:  [80, 20, 0, 0, 0],
  combo:  [0, 45, 40, 13, 2],
  wood:   [55, 35, 10, 0, 0],
  iron:   [20, 42, 30, 8, 0],
  gold:   [0, 22, 43, 27, 8],
};

export const CHESTS = {
  wood: { name: '木箱', count: 3 },
  iron: { name: '铁箱', count: 4 },
  gold: { name: '金箱', count: 5 },
};

const pick = arr => arr[Math.floor(Math.random() * arr.length)];

function rollRarity(weights, min = 0) {
  const w = weights.map((v, i) => (i < min ? 0 : v));
  let t = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < w.length; i++) if ((t -= w[i]) < 0) return i;
  return w.findLastIndex(v => v > 0);
}

// fall back to a lower rarity if this adventure's set has nothing at that rarity
const blockOf = (rarity, set) => {
  for (let r = rarity; r >= 0; r--) { const list = blocksOfRarity(r, set); if (list.length) return pick(list); }
};

// 1 easy, 2 medium, 3 hard; a level item can set `difficulty` itself.
export function difficulty(item) {
  if (item.difficulty) return item.difficulty;
  if (item.type === 'spell') return item.word.trim().split(/\s+/).length > 1 ? 3 : 2;
  if (item.type === 'stroke' || item.type === 'tapText') return 3;
  if (item.type === 'blend' || item.type === 'order' || item.type === 'craft' || item.type === 'pattern') return 2;
  if (item.type === 'calc') {
    const blanks = (item.eq.match(/□|○/g) || []).length;
    if (blanks >= 3 || item.eq.includes('○') && item.scene) return 3;          // writing a whole equation
    if (blanks === 2 || !/=□$/.test(item.eq.replace(/\s/g, ''))) return 2;   // a missing number in the middle
  }
  return 1;
}

export function answerDrop(item, firstTry, set) {
  if (!firstTry) return blockOf(rollRarity(TABLES.retry), set);
  return blockOf(rollRarity(TABLES[['easy', 'medium', 'hard'][difficulty(item) - 1]]), set);
}

// every third first-try answer in a row
export const isCombo = streak => streak > 0 && streak % 3 === 0;
export const comboDrop = set => blockOf(rollRarity(TABLES.combo), set);

// Stage chest: stars pick the chest; replaying an already-finished stage gives one chest lower and one block fewer,
// so new homework stays the best source of rare blocks. Gold chests always hold something rare or better,
// and a legendary is guaranteed after 6 gold chests without one.
export function openChest(stars, replay, set) {
  let kind = stars >= 3 ? 'gold' : stars === 2 ? 'iron' : 'wood';
  if (replay) kind = kind === 'gold' ? 'iron' : 'wood';
  const n = CHESTS[kind].count - (replay ? 1 : 0);
  const out = [];
  for (let i = 0; i < n; i++) out.push(blockOf(rollRarity(TABLES[kind], kind === 'gold' && i === 0 ? 2 : 0), set));
  if (kind === 'gold') {
    const s = store.state;
    if (out.some(b => blocksOfRarity(4, set).includes(b))) s.pity = 0;
    else if ((s.pity = (s.pity || 0) + 1) >= 6) { out[0] = blockOf(4, set); s.pity = 0; }
  }
  return { kind, blocks: out };
}
