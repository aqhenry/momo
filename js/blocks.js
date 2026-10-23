// Procedural 16x16 pixel textures for reward/build blocks (original art, Minecraft-like feel).
export const BLOCKS = {
  grass:   { name: '草方块', tier: 0 },
  dirt:    { name: '泥土',   tier: 0 },
  stone:   { name: '石头',   tier: 0 },
  cobble:  { name: '圆石',   tier: 0 },
  sand:    { name: '沙子',   tier: 0 },
  log:     { name: '原木',   tier: 0 },
  planks:  { name: '木板',   tier: 0 },
  leaves:  { name: '树叶',   tier: 0 },
  glass:   { name: '玻璃',   tier: 0 },
  brick:   { name: '红砖',   tier: 0 },
  toy_red:    { name: '红积木', tier: 1 },
  toy_blue:   { name: '蓝积木', tier: 1 },
  toy_yellow: { name: '黄积木', tier: 1 },
  toy_green:  { name: '绿积木', tier: 1 },
  wool_pink:  { name: '粉羊毛', tier: 1 },
  lamp:       { name: '萤石灯', tier: 1 },
  gold:    { name: '金块',   tier: 2 },
  emerald: { name: '绿宝石', tier: 2 },
  diamond: { name: '钻石',   tier: 2 },
};

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const hash = str => [...str].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

function shade([r, g, b], k) {
  const f = v => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

function noise(px, rand, base, spread = 0.18) {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    px(x, y, shade(base, 1 - spread + rand() * spread * 2));
  }
}

function ore(px, rand, color) {
  noise(px, rand, [125, 125, 125]);
  for (let i = 0; i < 6; i++) {
    const cx = 2 + Math.floor(rand() * 12), cy = 2 + Math.floor(rand() * 12);
    px(cx, cy, shade(color, 1.15)); px(cx + 1, cy, shade(color, 0.9));
    px(cx, cy + 1, shade(color, 0.8)); px(cx + 1, cy + 1, shade(color, 1));
  }
}

function toy(px, color) {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const edge = x === 0 || y === 0 ? 1.2 : (x === 15 || y === 15 ? 0.7 : 1);
    px(x, y, shade(color, edge));
  }
  // four round studs
  for (const [sx, sy] of [[4, 4], [11, 4], [4, 11], [11, 11]]) {
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      if (dx * dx + dy * dy <= 5) px(sx + dx, sy + dy, shade(color, dy < 0 || dx < 0 ? 1.25 : 0.85));
    }
  }
}

const PAINT = {
  dirt: (px, r) => noise(px, r, [134, 96, 67], 0.22),
  grass: (px, r) => {
    noise(px, r, [134, 96, 67], 0.22);
    for (let x = 0; x < 16; x++) {
      const h = 3 + Math.floor(r() * 3);
      for (let y = 0; y < h; y++) px(x, y, shade([95, 159, 53], 0.85 + r() * 0.3));
    }
  },
  stone: (px, r) => noise(px, r, [125, 125, 125], 0.12),
  cobble: (px, r) => {
    noise(px, r, [120, 120, 120], 0.25);
    for (let i = 0; i < 16; i++) px(Math.floor(r() * 16), Math.floor(r() * 16), 'rgb(70,70,70)');
  },
  sand: (px, r) => noise(px, r, [219, 207, 163], 0.06),
  log: (px, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      px(x, y, shade([102, 81, 50], (x % 4 === 0 ? 0.75 : 1) * (0.9 + r() * 0.2)));
    }
  },
  planks: (px, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const seam = y % 4 === 3 || (x === ((y >> 2) % 2 ? 4 : 11));
      px(x, y, shade([162, 130, 78], seam ? 0.7 : 0.92 + r() * 0.14));
    }
  },
  leaves: (px, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      px(x, y, r() < 0.15 ? 'rgb(40,80,25)' : shade([72, 140, 45], 0.75 + r() * 0.45));
    }
  },
  glass: (px) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const border = x === 0 || y === 0 || x === 15 || y === 15;
      const glint = (x + y === 6 || x + y === 7) && x < 8;
      px(x, y, border ? 'rgb(200,230,240)' : glint ? 'rgba(255,255,255,0.9)' : 'rgba(190,225,240,0.35)');
    }
  },
  brick: (px, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const row = y >> 2, mortar = y % 4 === 3 || (x + (row % 2 ? 4 : 0)) % 8 === 7;
      px(x, y, mortar ? 'rgb(180,170,160)' : shade([150, 74, 58], 0.9 + r() * 0.2));
    }
  },
  toy_red: (px) => toy(px, [214, 40, 40]),
  toy_blue: (px) => toy(px, [30, 110, 220]),
  toy_yellow: (px) => toy(px, [245, 200, 30]),
  toy_green: (px) => toy(px, [40, 170, 70]),
  wool_pink: (px, r) => noise(px, r, [237, 141, 172], 0.1),
  lamp: (px, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      px(x, y, r() < 0.3 ? 'rgb(255,240,170)' : shade([200, 150, 70], 0.8 + r() * 0.5));
    }
  },
  gold: (px, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const edge = x === 0 || y === 0 ? 1.3 : (x === 15 || y === 15 ? 0.7 : 1);
      px(x, y, shade([245, 205, 60], edge * (0.92 + r() * 0.12)));
    }
  },
  emerald: (px, r) => ore(px, r, [40, 200, 90]),
  diamond: (px, r) => ore(px, r, [90, 225, 225]),
};

const cache = {};
export function blockURL(type) {
  if (cache[type]) return cache[type];
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d');
  const px = (x, y, col) => { if (x >= 0 && y >= 0 && x < 16 && y < 16) { g.fillStyle = col; g.fillRect(x, y, 1, 1); } };
  (PAINT[type] || PAINT.stone)(px, rng(hash(type)));
  return (cache[type] = c.toDataURL());
}

export function blockEl(type, cls = '') {
  const el = document.createElement('div');
  el.className = `block ${cls}`;
  el.style.backgroundImage = `url(${blockURL(type)})`;
  el.title = BLOCKS[type]?.name || type;
  return el;
}

const byTier = t => Object.keys(BLOCKS).filter(k => BLOCKS[k].tier === t);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

// Reward for one correct answer: mostly common, sometimes a toy brick.
export function rollAnswerBlock(firstTry) {
  if (!firstTry) return pick(byTier(0));
  return Math.random() < 0.3 ? pick(byTier(1)) : pick(byTier(0));
}

// Chest for finishing a stage.
export function rollChest(stars) {
  const out = [pick(byTier(2)), pick(byTier(1)), pick(byTier(1)), pick(byTier(0))];
  if (stars >= 3) out.unshift('diamond');
  return out;
}
