// Every collectible block: name, rarity, and procedural 16x16 pixel textures (original art, Minecraft-like feel).
// A block may have a different top (and bottom) texture, e.g. grass, logs, pumpkins.

export const RARITY = [
  { key: 'common', name: '普通', color: '#d8d8d8' },
  { key: 'uncommon', name: '优秀', color: '#6fdc4f' },
  { key: 'rare', name: '稀有', color: '#4fb8ff' },
  { key: 'epic', name: '史诗', color: '#c870ff' },
  { key: 'legendary', name: '传说', color: '#ffb020' },
];

// keys are stored in saved inventories/worlds, so never rename one.
// `set`: blocks that only drop in adventures with that blockSet (each new adventure brings its own).
export const BLOCKS = {
  grass:   { name: '草方块', rarity: 0 },
  dirt:    { name: '泥土', rarity: 0 },
  stone:   { name: '石头', rarity: 0 },
  cobble:  { name: '圆石', rarity: 0 },
  sand:    { name: '沙子', rarity: 0 },
  gravel:  { name: '沙砾', rarity: 0 },
  log:     { name: '原木', rarity: 0 },
  planks:  { name: '木板', rarity: 0 },
  leaves:  { name: '树叶', rarity: 0 },
  glass:   { name: '玻璃', rarity: 0, clear: true },
  snow:    { name: '雪块', rarity: 0 },
  clay:    { name: '黏土', rarity: 0 },

  brick:         { name: '红砖', rarity: 1 },
  sandstone:     { name: '砂岩', rarity: 1 },
  birch_planks:  { name: '白桦木板', rarity: 1 },
  spruce_planks: { name: '云杉木板', rarity: 1 },
  wool_white:    { name: '白羊毛', rarity: 1 },
  wool_red:      { name: '红羊毛', rarity: 1 },
  wool_blue:     { name: '蓝羊毛', rarity: 1 },
  wool_yellow:   { name: '黄羊毛', rarity: 1 },
  wool_pink:     { name: '粉羊毛', rarity: 1 },
  hay:           { name: '干草块', rarity: 1 },
  pumpkin:       { name: '南瓜', rarity: 1 },
  melon:         { name: '西瓜', rarity: 1 },
  bookshelf:     { name: '书架', rarity: 1 },
  ice:           { name: '冰', rarity: 1, clear: true },
  terracotta:    { name: '陶瓦', rarity: 1 },

  toy_red:       { name: '红积木', rarity: 2 },
  toy_blue:      { name: '蓝积木', rarity: 2 },
  toy_yellow:    { name: '黄积木', rarity: 2 },
  toy_green:     { name: '绿积木', rarity: 2 },
  lamp:          { name: '萤石灯', rarity: 2, glow: true },
  iron_block:    { name: '铁块', rarity: 2 },
  copper_block:  { name: '铜块', rarity: 2 },
  mossy_cobble:  { name: '苔石', rarity: 2 },
  cherry_planks: { name: '樱花木板', rarity: 2 },
  lapis_block:   { name: '青金石块', rarity: 2 },
  quartz:        { name: '石英块', rarity: 2 },

  gold:           { name: '金块', rarity: 3 },
  emerald:        { name: '绿宝石矿', rarity: 3 },
  diamond:        { name: '钻石矿', rarity: 3 },
  amethyst:       { name: '紫水晶', rarity: 3 },
  obsidian:       { name: '黑曜石', rarity: 3 },
  slime:          { name: '史莱姆块', rarity: 3, clear: true },
  redstone_block: { name: '红石块', rarity: 3 },
  prismarine:     { name: '海晶石', rarity: 3 },

  diamond_block: { name: '钻石块', rarity: 4 },
  rainbow:       { name: '彩虹方块', rarity: 4 },
  star_block:    { name: '星空方块', rarity: 4, glow: true },
  crystal_core:  { name: '能量水晶', rarity: 4, glow: true, clear: true },

  // 第二大关 · 数学
  crafting_table: { name: '工作台', rarity: 1, set: 'math' },
  furnace:        { name: '熔炉', rarity: 1, set: 'math' },
  bee_nest:       { name: '蜂巢', rarity: 2, set: 'math' },
  honey_block:    { name: '蜂蜜块', rarity: 2, set: 'math', clear: true },
  ...Object.fromEntries([...'0123456789'].map(d => [`num_${d}`, { name: `数字${d}`, rarity: 2, set: 'math' }])),
  golden_apple_block: { name: '金苹果块', rarity: 4, set: 'math', glow: true },
};

// blocks of a rarity that can drop in an adventure using `set` (base blocks always can)
export const blocksOfRarity = (r, set) => Object.keys(BLOCKS).filter(k => BLOCKS[k].rarity === r && (!BLOCKS[k].set || BLOCKS[k].set === set));

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const hash = str => [...str].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

function shade([r, g, b], k) {
  const f = v => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

const each = fn => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) fn(x, y); };
const edgeK = (x, y) => (x === 0 || y === 0 ? 1.18 : x === 15 || y === 15 ? 0.75 : 1);

function noise(px, rand, base, spread = 0.18) {
  each((x, y) => px(x, y, shade(base, 1 - spread + rand() * spread * 2)));
}
function ore(px, rand, color, host = [125, 125, 125]) {
  noise(px, rand, host, 0.12);
  for (let i = 0; i < 6; i++) {
    const cx = 2 + Math.floor(rand() * 12), cy = 2 + Math.floor(rand() * 12);
    px(cx, cy, shade(color, 1.2)); px(cx + 1, cy, shade(color, 0.95));
    px(cx, cy + 1, shade(color, 0.8)); px(cx + 1, cy + 1, shade(color, 1));
  }
}
function metal(px, rand, color, lines = false) {
  each((x, y) => {
    const line = lines && (y === 5 || y === 10);
    px(x, y, shade(color, edgeK(x, y) * (line ? 0.85 : 0.94 + rand() * 0.1)));
  });
}
function planksOf(px, rand, color) {
  each((x, y) => {
    const seam = y % 4 === 3 || x === ((y >> 2) % 2 ? 4 : 11);
    px(x, y, shade(color, seam ? 0.7 : 0.92 + rand() * 0.14));
  });
}
function wool(px, rand, color) {
  each((x, y) => px(x, y, shade(color, ((x + y * 3) % 5 === 0 ? 0.88 : 1) * (0.94 + rand() * 0.1))));
}
function toy(px, color) {
  each((x, y) => px(x, y, shade(color, edgeK(x, y))));
  for (const [sx, sy] of [[4, 4], [11, 4], [4, 11], [11, 11]]) {
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      if (dx * dx + dy * dy <= 5) px(sx + dx, sy + dy, shade(color, dy < 0 || dx < 0 ? 1.25 : 0.85));
    }
  }
}
function clearPane(px, edge, fill, glint = 'rgba(255,255,255,0.9)') {
  each((x, y) => {
    const border = x === 0 || y === 0 || x === 15 || y === 15;
    const shine = (x + y === 6 || x + y === 7) && x < 8;
    px(x, y, border ? edge : shine ? glint : fill);
  });
}
function rings(px, rand, bark, wood) {
  each((x, y) => {
    const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
    px(x, y, d > 6.5 ? shade(bark, 0.9 + rand() * 0.2) : shade(wood, Math.floor(d) % 2 ? 0.88 : 1));
  });
}

// side textures (also used for flat icons, backgrounds, the 2D map)
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
  gravel: (px, r) => each((x, y) => px(x, y, shade([[130, 124, 120], [110, 102, 98], [150, 140, 132]][Math.floor(r() * 3)], 0.9 + r() * 0.2))),
  log: (px, r) => each((x, y) => px(x, y, shade([102, 81, 50], (x % 4 === 0 ? 0.75 : 1) * (0.9 + r() * 0.2)))),
  planks: (px, r) => planksOf(px, r, [162, 130, 78]),
  leaves: (px, r) => each((x, y) => px(x, y, r() < 0.15 ? 'rgb(40,80,25)' : shade([72, 140, 45], 0.75 + r() * 0.45))),
  glass: px => clearPane(px, 'rgb(200,230,240)', 'rgba(190,225,240,0.3)'),
  snow: (px, r) => noise(px, r, [242, 248, 252], 0.04),
  clay: (px, r) => noise(px, r, [160, 166, 179], 0.05),

  brick: (px, r) => each((x, y) => {
    const row = y >> 2, mortar = y % 4 === 3 || (x + (row % 2 ? 4 : 0)) % 8 === 7;
    px(x, y, mortar ? 'rgb(180,170,160)' : shade([150, 74, 58], 0.9 + r() * 0.2));
  }),
  sandstone: (px, r) => each((x, y) => px(x, y, shade([216, 200, 150], (y < 3 ? 1.06 : y > 12 ? 0.86 : y % 4 === 1 ? 0.93 : 1) * (0.97 + r() * 0.06)))),
  birch_planks: (px, r) => planksOf(px, r, [196, 178, 123]),
  spruce_planks: (px, r) => planksOf(px, r, [115, 85, 50]),
  wool_white: (px, r) => wool(px, r, [234, 236, 236]),
  wool_red: (px, r) => wool(px, r, [176, 46, 38]),
  wool_blue: (px, r) => wool(px, r, [53, 57, 157]),
  wool_yellow: (px, r) => wool(px, r, [248, 198, 39]),
  wool_pink: (px, r) => wool(px, r, [237, 141, 172]),
  hay: (px, r) => each((x, y) => px(x, y, (y === 3 || y === 12) ? 'rgb(120,40,30)' : shade([196, 160, 40], (x % 3 === 0 ? 0.85 : 1) * (0.92 + r() * 0.16)))),
  pumpkin: (px, r) => each((x, y) => px(x, y, shade([214, 120, 24], (x % 5 === 0 ? 0.8 : 1) * (0.93 + r() * 0.1)))),
  melon: (px, r) => each((x, y) => px(x, y, shade((x + (y >> 2)) % 4 < 2 ? [100, 160, 40] : [70, 125, 30], 0.93 + r() * 0.12))),
  bookshelf: (px, r) => {
    planksOf(px, r, [162, 130, 78]);
    const colors = [[160, 40, 40], [40, 80, 160], [50, 130, 60], [190, 150, 50], [120, 60, 140]];
    for (const y0 of [1, 9]) {
      for (let x = 1; x < 15; x++) {
        const c = colors[Math.floor(r() * colors.length)];
        const h = 5 + (r() < 0.3 ? 0 : 1);
        for (let y = y0 + (6 - h); y < y0 + 6; y++) px(x, y, shade(c, x % 2 ? 1 : 0.85));
      }
    }
  },
  ice: px => clearPane(px, 'rgb(160,200,255)', 'rgba(150,190,255,0.55)'),
  terracotta: (px, r) => noise(px, r, [161, 83, 37], 0.05),

  toy_red: px => toy(px, [214, 40, 40]),
  toy_blue: px => toy(px, [30, 110, 220]),
  toy_yellow: px => toy(px, [245, 200, 30]),
  toy_green: px => toy(px, [40, 170, 70]),
  lamp: (px, r) => each((x, y) => px(x, y, r() < 0.3 ? 'rgb(255,240,170)' : shade([200, 150, 70], 0.8 + r() * 0.5))),
  iron_block: (px, r) => metal(px, r, [220, 220, 220], true),
  copper_block: (px, r) => {
    metal(px, r, [196, 110, 80]);
    for (let i = 0; i < 10; i++) px(Math.floor(r() * 16), Math.floor(r() * 16), 'rgb(90,170,140)');
  },
  mossy_cobble: (px, r) => {
    PAINT.cobble(px, r);
    for (let i = 0; i < 40; i++) px(Math.floor(r() * 16), Math.floor(r() * 16), shade([80, 120, 50], 0.8 + r() * 0.4));
  },
  cherry_planks: (px, r) => planksOf(px, r, [226, 168, 160]),
  lapis_block: (px, r) => {
    metal(px, r, [38, 72, 160]);
    for (let i = 0; i < 8; i++) px(1 + Math.floor(r() * 14), 1 + Math.floor(r() * 14), 'rgb(230,190,60)');
  },
  quartz: (px, r) => each((x, y) => px(x, y, shade([236, 230, 222], edgeK(x, y) * (0.98 + r() * 0.04)))),

  gold: (px, r) => metal(px, r, [245, 205, 60]),
  emerald: (px, r) => ore(px, r, [40, 200, 90]),
  diamond: (px, r) => ore(px, r, [90, 225, 225]),
  amethyst: (px, r) => each((x, y) => {
    const facet = ((x * 3 + y * 5) % 7) / 7;
    px(x, y, shade([150, 90, 210], 0.75 + facet * 0.5 + r() * 0.08));
  }),
  obsidian: (px, r) => each((x, y) => px(x, y, r() < 0.08 ? 'rgb(90,50,130)' : shade([24, 16, 38], 0.8 + r() * 0.5))),
  slime: px => each((x, y) => {
    const inner = x > 3 && x < 12 && y > 3 && y < 12;
    const border = x === 0 || y === 0 || x === 15 || y === 15;
    px(x, y, border ? 'rgb(90,170,70)' : inner ? 'rgba(100,190,80,0.85)' : 'rgba(130,210,110,0.5)');
  }),
  redstone_block: (px, r) => {
    metal(px, r, [175, 25, 15]);
    for (let i = 0; i < 12; i++) px(Math.floor(r() * 16), Math.floor(r() * 16), 'rgb(110,10,5)');
  },
  prismarine: (px, r) => each((x, y) => px(x, y, shade(r() < 0.5 ? [90, 170, 150] : [70, 140, 150], 0.85 + r() * 0.3))),

  diamond_block: (px, r) => each((x, y) => {
    const glint = (x + y) % 6 === 0 && x < 12;
    px(x, y, glint ? 'rgb(230,255,255)' : shade([100, 230, 225], edgeK(x, y) * (0.93 + r() * 0.1)));
  }),
  rainbow: px => {
    const bands = [[230, 60, 60], [240, 150, 40], [245, 215, 50], [70, 190, 80], [60, 140, 230], [140, 80, 210]];
    each((x, y) => px(x, y, shade(bands[Math.floor(((y + x * 0.25) % 16) / 16 * 6)], edgeK(x, y))));
    for (const [x, y] of [[3, 3], [12, 5], [6, 11]]) { px(x, y, '#fff'); px(x + 1, y, 'rgba(255,255,255,.6)'); px(x, y + 1, 'rgba(255,255,255,.6)'); }
  },
  star_block: (px, r) => {
    each((x, y) => px(x, y, shade([20, 24, 70], edgeK(x, y) * (0.85 + r() * 0.3))));
    for (let i = 0; i < 7; i++) {
      const x = 1 + Math.floor(r() * 14), y = 1 + Math.floor(r() * 14);
      px(x, y, '#fff7b0'); if (i < 3) { px(x - 1, y, '#e8d060'); px(x + 1, y, '#e8d060'); px(x, y - 1, '#e8d060'); px(x, y + 1, '#e8d060'); }
    }
  },
  crystal_core: px => {
    clearPane(px, 'rgb(170,230,240)', 'rgba(170,230,240,0.3)');
    each((x, y) => {
      const d = Math.abs(x - 7.5) + Math.abs(y - 7.5);
      if (d < 5) px(x, y, d < 2.5 ? '#e8ffff' : '#4fe0f0');
    });
  },
};

// 3x5 digit glyphs for the number blocks
const DIGITS = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001',
  '111100111001111', '111100111101111', '111001010010010', '111101111101111', '111101111001111'];
const DIGIT_COLORS = [[90, 90, 100], [214, 60, 50], [235, 140, 40], [235, 200, 40], [70, 170, 70],
  [50, 160, 200], [60, 100, 210], [130, 80, 200], [210, 90, 160], [120, 80, 50]];
function numberBlock(px, d) {
  const c = DIGIT_COLORS[d];
  each((x, y) => px(x, y, shade(c, edgeK(x, y))));
  const glyph = DIGITS[d];
  for (let gy = 0; gy < 5; gy++) for (let gx = 0; gx < 3; gx++) {
    if (glyph[gy * 3 + gx] !== '1') continue;
    for (let k = 0; k < 4; k++) {
      const x = 5 + gx * 2 + (k & 1), y = 3 + gy * 2 + (k >> 1);
      px(x + 1, y + 1, shade(c, 0.55));
      px(x, y, '#ffffff');
    }
  }
}
for (let d = 0; d < 10; d++) PAINT[`num_${d}`] = px => numberBlock(px, d);

Object.assign(PAINT, {
  crafting_table: (px, r) => {
    planksOf(px, r, [162, 120, 70]);
    for (let y = 5; y < 13; y++) px(4, y, 'rgb(80,55,30)');                       // saw handle
    for (let x = 3; x < 7; x++) px(x, 5, 'rgb(170,170,170)');
    for (let y = 4; y < 12; y++) px(11, y, 'rgb(90,60,30)');                       // hammer
    for (let x = 9; x < 14; x++) { px(x, 4, 'rgb(150,150,150)'); px(x, 5, 'rgb(120,120,120)'); }
  },
  furnace: (px, r) => {
    PAINT.cobble(px, r);
    for (let y = 8; y < 14; y++) for (let x = 4; x < 12; x++) px(x, y, y > 11 ? (r() < 0.5 ? 'rgb(255,150,40)' : 'rgb(255,210,80)') : 'rgb(30,30,30)');
  },
  bee_nest: (px, r) => each((x, y) => {
    const hole = (y % 4 === 2) && ((x + (y >> 2) * 2) % 4 === 1);
    px(x, y, hole ? 'rgb(90,60,20)' : shade([205, 160, 70], edgeK(x, y) * (0.92 + r() * 0.1)));
  }),
  honey_block: px => each((x, y) => {
    const border = x === 0 || y === 0 || x === 15 || y === 15;
    const inner = x > 3 && x < 12 && y > 3 && y < 12;
    px(x, y, border ? 'rgb(220,140,20)' : inner ? 'rgba(250,190,50,0.95)' : 'rgba(245,170,40,0.75)');
  }),
  golden_apple_block: (px, r) => {
    metal(px, r, [245, 205, 60]);
    const apple = ['..0110..', '.111111.', '11111111', '11111111', '11111111', '.111111.', '..1111..'];
    apple.forEach((row, y) => [...row].forEach((c, x) => {
      if (c === '1') px(4 + x, 5 + y, x < 3 && y < 3 ? 'rgb(255,250,200)' : 'rgb(255,225,90)');
      if (c === '0') px(4 + x, 5 + y, 'rgb(90,140,40)');
    }));
  },
});

const TOP = {
  grass: (px, r) => noise(px, r, [95, 159, 53], 0.18),
  log: (px, r) => rings(px, r, [102, 81, 50], [176, 140, 86]),
  hay: (px, r) => each((x, y) => px(x, y, shade([206, 170, 50], ((x + y) % 3 === 0 ? 0.85 : 1) * (0.92 + r() * 0.16)))),
  pumpkin: (px, r) => {
    each((x, y) => px(x, y, shade([214, 120, 24], 0.93 + r() * 0.1)));
    for (const [x, y] of [[7, 6], [8, 6], [7, 7], [8, 7], [7, 8], [8, 8]]) px(x, y, 'rgb(90,70,30)');
  },
  melon: (px, r) => each((x, y) => px(x, y, shade([110, 160, 40], (Math.abs(x - 7.5) + Math.abs(y - 7.5)) % 4 < 2 ? 1 : 0.8))),
  bookshelf: (px, r) => planksOf(px, r, [162, 130, 78]),
  sandstone: (px, r) => noise(px, r, [222, 208, 160], 0.04),
  crafting_table: (px, r) => {
    planksOf(px, r, [176, 132, 80]);
    for (let i = 0; i < 16; i++) { px(5, i, 'rgb(110,75,40)'); px(10, i, 'rgb(110,75,40)'); px(i, 5, 'rgb(110,75,40)'); px(i, 10, 'rgb(110,75,40)'); }
  },
  furnace: (px, r) => noise(px, r, [125, 125, 125], 0.12),
  bee_nest: (px, r) => planksOf(px, r, [196, 150, 80]),
};
const BOTTOM = { grass: PAINT.dirt, bookshelf: TOP.bookshelf, log: TOP.log, hay: TOP.hay };

const canvases = {};
// face: 'side' | 'top' | 'bottom'
export function faceCanvas(type, face = 'side') {
  const key = `${type}:${face}`;
  if (canvases[key]) return canvases[key];
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d');
  const px = (x, y, col) => { if (x >= 0 && y >= 0 && x < 16 && y < 16) { g.fillStyle = col; g.fillRect(x, y, 1, 1); } };
  const paint = (face === 'top' && TOP[type]) || (face === 'bottom' && (BOTTOM[type] || TOP[type])) || PAINT[type] || PAINT.stone;
  paint(px, rng(hash(key)));
  return (canvases[key] = c);
}

const urls = {};
export function blockURL(type, face = 'side') {
  const key = `${type}:${face}`;
  return urls[key] || (urls[key] = faceCanvas(type, face).toDataURL());
}

// Isometric cube icon, like inventory items in Minecraft.
const icons = {};
export function iconURL(type) {
  if (icons[type]) return icons[type];
  const S = 4;                         // texture pixel -> icon pixels
  const c = document.createElement('canvas');
  c.width = c.height = 32 * S;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  const w = 13 * S, hgt = 6.5 * S, side_h = 15 * S;   // half-width, half the top's height, side height
  const cx = c.width / 2, top = 2 * S;
  const face = (img, a, b, cc, d, e, f, dark) => {
    g.save();
    g.setTransform(a, b, cc, d, e, f);
    g.drawImage(img, 0, 0);
    if (dark) { g.fillStyle = `rgba(0,0,0,${dark})`; g.fillRect(0, 0, 16, 16); }
    g.restore();
  };
  const side = faceCanvas(type, 'side'), topImg = faceCanvas(type, 'top');
  // top rhombus
  face(topImg, w / 16, hgt / 16, -w / 16, hgt / 16, cx, top);
  // left face
  face(side, w / 16, hgt / 16, 0, side_h / 16, cx - w, top + hgt, 0.18);
  // right face
  face(side, w / 16, -hgt / 16, 0, side_h / 16, cx, top + 2 * hgt, 0.38);
  return (icons[type] = c.toDataURL());
}

// flat square tile (map nodes, small UI)
export function blockEl(type, cls = '') {
  const el = document.createElement('div');
  el.className = `block ${cls}`;
  el.style.backgroundImage = `url(${blockURL(type)})`;
  el.title = BLOCKS[type]?.name || type;
  return el;
}

// isometric icon (inventory, rewards, collection)
export function iconEl(type, cls = '') {
  const el = document.createElement('div');
  el.className = `icon ${cls}`;
  el.style.backgroundImage = `url(${iconURL(type)})`;
  el.title = BLOCKS[type]?.name || type;
  return el;
}
