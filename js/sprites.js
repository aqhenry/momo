// 16x16 pixel-art icons drawn from simple shapes, then auto-outlined and bevel-shaded,
// so they read like Minecraft item sprites (original art).
const N = 16;

function canvas16() {
  const grid = Array.from({ length: N }, () => Array(N).fill(null));
  const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < N && y < N) grid[y][x] = c; };
  const api = {
    grid,
    px: set,
    rect(x, y, w, h, c) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(i, j, c); },
    line(x0, y0, x1, y1, c, t = 1) {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
      for (let k = 0; k <= n; k++) {
        const x = Math.round(x0 + (x1 - x0) * k / n), y = Math.round(y0 + (y1 - y0) * k / n);
        for (let a = 0; a < t; a++) for (let b = 0; b < t; b++) set(x + a, y + b, c);
      }
    },
    disc(cx, cy, r, c) { for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if ((x + .5 - cx) ** 2 + (y + .5 - cy) ** 2 <= r * r) set(x, y, c); },
    ring(cx, cy, r0, r1, c, keep = () => true) {
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const d = Math.hypot(x + .5 - cx, y + .5 - cy);
        if (d >= r0 && d <= r1 && keep(x, y)) set(x, y, c);
      }
    },
    poly(pts, c) {
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        let inside = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [xi, yi] = pts[i], [xj, yj] = pts[j];
          if ((yi > y + .5) !== (yj > y + .5) && x + .5 < (xj - xi) * (y + .5 - yi) / (yj - yi) + xi) inside = !inside;
        }
        if (inside) set(x, y, c);
      }
    },
  };
  return api;
}

const hex = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const rgb = ([r, g, b], k) => `rgb(${Math.min(255, r * k) | 0},${Math.min(255, g * k) | 0},${Math.min(255, b * k) | 0})`;

const CHEST_COLORS = {
  wood: { body: '#a0662a', band: '#5a3410', hi: '#c07c34', lid: '#b8783a', latch: '#c9c9c9' },
  iron: { body: '#9a9ea6', band: '#55595f', hi: '#c4c8ce', lid: '#aeb2b8', latch: '#ffd23a' },
  gold: { body: '#e0a820', band: '#8a6010', hi: '#ffd860', lid: '#f0bc30', latch: '#5ee0d8' },
};

function drawChest(g, open, c) {
  if (!open) {
    g.rect(1, 4, 14, 10, c.body);
    g.rect(1, 7, 14, 1, c.band);
    g.rect(1, 4, 14, 1, c.hi);
    g.rect(7, 6, 2, 3, c.latch);
    g.px(7, 8, '#555'); g.px(8, 8, '#555');
    return;
  }
  g.rect(1, 8, 14, 7, c.body);
  g.rect(1, 8, 14, 1, c.hi);
  g.poly([[1, 6], [3, 0], [15, 0], [15, 6]], c.lid);
  g.rect(2, 6, 12, 2, '#2a1a08');
  // treasure heaped above the rim
  const pile = ['#ffd23a', '#5ee0d8', '#ffd23a', '#4fd06a', '#ffe680', '#5ee0d8', '#ffd23a', '#e2403a', '#ffd23a', '#5ee0d8', '#ffe680', '#4fd06a'];
  pile.forEach((col, k) => g.rect(2 + k, k % 3 === 1 ? 5 : 6, 1, k % 3 === 1 ? 3 : 2, col));
  g.rect(5, 4, 2, 1, '#ffd23a'); g.rect(9, 4, 2, 1, '#5ee0d8');
  g.rect(7, 9, 2, 2, c.latch);
}

const DRAW = {
  pickaxe(g) {
    g.line(3, 13, 10, 6, '#8a5a2b', 2);
    g.ring(9.5, 9.5, 6.2, 8, '#5ee0d8', (x, y) => x + y < 16 && y < 10 && x < 13);
  },
  book(g) {
    g.rect(2, 2, 12, 12, '#7b3f1d');
    g.rect(4, 3, 9, 10, '#f3ead2');
    g.rect(3, 2, 1, 12, '#5a2c12');
    g.rect(6, 6, 5, 1, '#9b8a6a'); g.rect(6, 8, 5, 1, '#9b8a6a'); g.rect(6, 10, 3, 1, '#9b8a6a');
  },
  compass(g) {
    g.disc(8, 8, 6.5, '#9a9a9a');
    g.disc(8, 8, 5, '#d8d8d8');
    g.poly([[12, 4], [9, 7.2], [8.8, 9]], '#d23a3a'); g.poly([[12, 4], [7, 8.8], [8.8, 9]], '#e85050');
    g.poly([[4, 12], [7, 8.8], [7.2, 7]], '#4a4a4a'); g.poly([[4, 12], [9, 7.2], [7.2, 7]], '#666666');
  },
  disc(g) {
    g.disc(8, 8, 7, '#2b2b2b');
    g.ring(8, 8, 4.6, 5.4, '#444');
    g.disc(8, 8, 3, '#36b14a');
    g.disc(8, 8, 1, '#111');
  },
  map(g) {
    g.rect(2, 2, 12, 12, '#e9dcb0');
    g.rect(4, 4, 4, 3, '#6aa84f'); g.rect(9, 6, 3, 4, '#4f8fd6'); g.rect(5, 9, 3, 3, '#6aa84f');
    g.px(11, 4, '#d23a3a'); g.px(10, 11, '#8a5a2b');
  },
  quill(g) {
    g.poly([[13, 1], [15, 3], [7, 11], [5, 9]], '#f4f4f4');
    g.line(5, 10, 9, 6, '#c9c9c9', 1);
    g.line(2, 14, 6, 10, '#3a3a3a', 1);
    g.rect(1, 13, 3, 2, '#2a2a6a');
  },
  chest: g => drawChest(g, false, CHEST_COLORS.wood),
  chest_open: g => drawChest(g, true, CHEST_COLORS.wood),
  chest_iron: g => drawChest(g, false, CHEST_COLORS.iron),
  chest_iron_open: g => drawChest(g, true, CHEST_COLORS.iron),
  chest_gold: g => drawChest(g, false, CHEST_COLORS.gold),
  chest_gold_open: g => drawChest(g, true, CHEST_COLORS.gold),
  gear(g) {
    g.disc(8, 8, 5.5, '#9a9a9a');
    for (const [x, y] of [[7, 0], [7, 13], [0, 7], [13, 7], [2, 2], [12, 2], [2, 12], [12, 12]]) g.rect(x, y, 3, 3, '#9a9a9a');
    g.disc(8, 8, 2.2, '#4a4a4a');
  },
  star(g) {
    const pts = [];
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 3.2 : 7.4;
      pts.push([8 + r * Math.cos(a), 8.6 + r * Math.sin(a)]);
    }
    g.poly(pts, '#ffd23a');
  },
  star_off(g) {
    DRAW.star(g);
    for (const row of g.grid) row.forEach((c, i) => { if (c) row[i] = '#6a6a6a'; });
  },
  bell(g) {
    g.poly([[5, 4], [11, 4], [13, 12], [3, 12]], '#f2c53d');
    g.disc(8, 4.5, 3, '#f2c53d');
    g.rect(2, 12, 12, 2, '#d9a520');
    g.rect(7, 14, 2, 1, '#8a6a10');
    g.px(8, 1, '#8a6a10');
  },
  target(g) {
    g.disc(8, 8, 7, '#e8e8e8');
    g.disc(8, 8, 5.5, '#d23a3a');
    g.disc(8, 8, 3.8, '#e8e8e8');
    g.disc(8, 8, 2, '#d23a3a');
  },
  magnifier(g) {
    g.line(9, 9, 13, 13, '#8a5a2b', 2);
    g.ring(6.5, 6.5, 3.4, 5.2, '#9a9a9a');
    g.disc(6.5, 6.5, 3.4, '#bfe6ff');
    g.px(5, 5, '#ffffff'); g.px(4, 6, '#ffffff');
  },
  painting(g) {
    g.rect(1, 2, 14, 12, '#8a5a2b');
    g.rect(2, 3, 12, 10, '#9fd4ff');
    g.poly([[2, 13], [6, 6], [10, 13]], '#5f8f4f');
    g.poly([[7, 13], [11, 7], [14, 13]], '#6faa5a');
    g.rect(11, 4, 2, 2, '#ffe066');
  },
  sign(g) {
    g.rect(1, 2, 14, 8, '#c49a5c');
    g.rect(2, 4, 12, 1, '#8a6a3a'); g.rect(2, 6, 9, 1, '#8a6a3a');
    g.rect(7, 10, 2, 5, '#7a5530');
  },
  bricks(g) {
    g.rect(1, 1, 14, 14, '#d63a3a');
    for (const [x, y] of [[4, 4], [11, 4], [4, 11], [11, 11]]) g.disc(x + .5, y + .5, 1.8, '#f26060');
  },
  eye(g) {
    g.poly([[1, 8], [5, 4], [11, 4], [15, 8], [11, 12], [5, 12]], '#f4f4f4');
    g.disc(8, 8, 3.2, '#4f8fd6');
    g.disc(8, 8, 1.5, '#111');
  },
  speaker(g) {
    g.rect(2, 6, 3, 4, '#d8d8d8');
    g.poly([[5, 6], [9, 2], [9, 14], [5, 10]], '#d8d8d8');
    g.ring(8, 8, 3.8, 4.8, '#ffffff', x => x > 10);
    g.ring(8, 8, 5.8, 6.8, '#ffffff', x => x > 11);
  },
  cross(g) { g.line(4, 4, 11, 11, '#f4f4f4', 2); g.line(11, 4, 4, 11, '#f4f4f4', 2); },
  back(g) { g.poly([[2, 8], [8, 2], [8, 6], [14, 6], [14, 10], [8, 10], [8, 14]], '#f4f4f4'); },
  check(g) { g.line(2, 8, 6, 12, '#5fe05f', 2); g.line(6, 12, 13, 3, '#5fe05f', 2); },
  heart(g) { g.disc(5, 5.5, 3.7, '#e23b3b'); g.disc(11, 5.5, 3.7, '#e23b3b'); g.poly([[1.4, 6.5], [14.6, 6.5], [8, 14.2]], '#e23b3b'); g.px(4, 4, '#ff9a9a'); },
  apple(g) { g.disc(8, 9.5, 5.5, '#d63030'); g.rect(8, 2, 1, 3, '#6a4020'); g.rect(9, 3, 3, 2, '#4caf50'); },
};

const cache = {};
// Returns a data URL of the sprite (16x16; scale it up with image-rendering: pixelated).
export function spriteURL(name) {
  if (cache[name]) return cache[name];
  const g = canvas16();
  (DRAW[name] || DRAW.apple)(g);
  const src = g.grid.map(r => [...r]);
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const ctx = c.getContext('2d');
  const filled = (x, y) => x >= 0 && y >= 0 && x < N && y < N && src[y][x];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const col = src[y][x];
    if (col) {
      const base = hex(col);
      // bevel: light where the pixel above/left is empty, dark where below/right is empty
      const k = (!filled(x, y - 1) || !filled(x - 1, y)) ? 1.18 : (!filled(x, y + 1) || !filled(x + 1, y)) ? 0.78 : 1;
      ctx.fillStyle = rgb(base, k);
      ctx.fillRect(x, y, 1, 1);
    } else {
      // outline: empty pixel touching a filled one
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => filled(x + dx, y + dy)).find(Boolean);
      if (nb) { ctx.fillStyle = rgb(hex(nb), 0.32); ctx.fillRect(x, y, 1, 1); }
    }
  }
  return (cache[name] = c.toDataURL());
}

export function spriteEl(name, cls = '') {
  const el = document.createElement('i');
  el.className = `sprite ${cls}`;
  el.style.backgroundImage = `url(${spriteURL(name)})`;
  return el;
}
