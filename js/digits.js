// Handwritten digit recognition for the writing pad: finger strokes -> MNIST-style 28x28 -> small CNN
// (weights in js/digits-model.json, trained by tools/digits_train.py). Plain JS, runs offline on the iPad.

let model = null;
export function loadDigits() {
  if (!model) {
    model = fetch('js/digits-model.json').then(r => r.json()).then(m => m.layers.map(l => {
      const bytes = Uint8Array.from(atob(l.w), c => c.charCodeAt(0));
      const w = new Float32Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) w[i] = ((bytes[i] << 24) >> 24) * l.scale;   // int8 -> float
      return { shape: l.shape, w, b: Float32Array.from(l.b) };
    })).catch(e => { model = null; throw e; });
  }
  return model;
}

// ---------- strokes -> 28x28 ----------
const bbox = pts => pts.reduce((b, p) => ({
  x0: Math.min(b.x0, p.x), y0: Math.min(b.y0, p.y), x1: Math.max(b.x1, p.x), y1: Math.max(b.y1, p.y),
}), { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });

// Render one digit's strokes the way MNIST digits look: longest side 20px, centre of mass in the middle.
export function toInput(strokes) {
  const b = bbox(strokes.flat());
  const w = Math.max(b.x1 - b.x0, 1), h = Math.max(b.y1 - b.y0, 1);
  const LW = 22, BOX = 200;                          // stroke width relative to the 200px render box
  const k = (BOX - LW) / Math.max(w, h, 40);         // a tiny scribble is not blown up into a huge blob
  const cw = Math.ceil(w * k + LW), ch = Math.ceil(h * k + LW);
  const big = document.createElement('canvas');
  big.width = cw; big.height = ch;
  const g = big.getContext('2d');
  g.lineCap = g.lineJoin = 'round';
  g.lineWidth = LW;
  g.strokeStyle = '#000';
  for (const s of strokes) {
    g.beginPath();
    s.forEach((p, i) => {
      const x = (p.x - b.x0) * k + LW / 2, y = (p.y - b.y0) * k + LW / 2;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    });
    if (s.length === 1) g.lineTo((s[0].x - b.x0) * k + LW / 2 + 0.1, (s[0].y - b.y0) * k + LW / 2);
    g.stroke();
  }
  // downscale in halving steps (smooth, like area averaging) to longest side 20px
  let src = big, sw = cw, sh = ch;
  const tw = Math.max(1, Math.round(cw * 20 / Math.max(cw, ch))), th = Math.max(1, Math.round(ch * 20 / Math.max(cw, ch)));
  while (sw / 2 > tw * 1.5 || sh / 2 > th * 1.5) {
    const c = document.createElement('canvas');
    c.width = Math.max(tw, Math.round(sw / 2)); c.height = Math.max(th, Math.round(sh / 2));
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    src = c; sw = c.width; sh = c.height;
  }
  const small = document.createElement('canvas');
  small.width = tw; small.height = th;
  const sg = small.getContext('2d');
  sg.drawImage(src, 0, 0, tw, th);
  const a = sg.getImageData(0, 0, tw, th).data;
  let tot = 0, mx = 0, my = 0;
  const ink = new Float32Array(tw * th);
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
    const v = a[(y * tw + x) * 4 + 3] / 255;
    ink[y * tw + x] = v; tot += v; mx += v * x; my += v * y;
  }
  const out = new Float32Array(28 * 28);
  if (!tot) return out;
  const ox = Math.max(0, Math.min(28 - tw, Math.round(14 - mx / tot))), oy = Math.max(0, Math.min(28 - th, Math.round(14 - my / tot)));
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) out[(y + oy) * 28 + x + ox] = ink[y * tw + x];
  return out;
}

// ---------- the network ----------
function conv(x, size, cin, L) {
  const [cout] = L.shape, out = new Float32Array(cout * size * size);
  for (let o = 0; o < cout; o++) for (let y = 0; y < size; y++) for (let xx = 0; xx < size; xx++) {
    let s = L.b[o];
    for (let i = 0; i < cin; i++) for (let ky = 0; ky < 3; ky++) {
      const yy = y + ky - 1;
      if (yy < 0 || yy >= size) continue;
      for (let kx = 0; kx < 3; kx++) {
        const xk = xx + kx - 1;
        if (xk < 0 || xk >= size) continue;
        s += x[(i * size + yy) * size + xk] * L.w[((o * cin + i) * 3 + ky) * 3 + kx];
      }
    }
    out[(o * size + y) * size + xx] = s > 0 ? s : 0;
  }
  return out;
}
function pool(x, c, size) {
  const h = size / 2, out = new Float32Array(c * h * h);
  for (let i = 0; i < c; i++) for (let y = 0; y < h; y++) for (let xx = 0; xx < h; xx++) {
    const at = (dy, dx) => x[(i * size + 2 * y + dy) * size + 2 * xx + dx];
    out[(i * h + y) * h + xx] = Math.max(at(0, 0), at(0, 1), at(1, 0), at(1, 1));
  }
  return out;
}
function dense(x, L, relu) {
  const [nout, nin] = L.shape, out = new Float32Array(nout);
  for (let o = 0; o < nout; o++) {
    let s = L.b[o];
    for (let i = 0; i < nin; i++) s += x[i] * L.w[o * nin + i];
    out[o] = relu && s < 0 ? 0 : s;
  }
  return out;
}
function classify(layers, input) {
  const [c1, c2, f1, f2] = layers;
  let x = pool(conv(input, 28, 1, c1), c1.shape[0], 28);
  x = pool(conv(x, 14, c1.shape[0], c2), c2.shape[0], 14);
  const logits = dense(dense(x, f1, true), f2, false);
  const m = Math.max(...logits), e = logits.map(v => Math.exp(v - m)), t = e.reduce((a, b) => a + b, 0);
  return [...e].map((v, d) => ({ d, p: v / t })).sort((a, b) => b.p - a.p);
}

// Split strokes into digits left to right (strokes that overlap horizontally belong to the same digit, e.g. 4 or 5).
export function groupStrokes(strokes, gap = 0) {
  const items = strokes.map(s => ({ s, b: bbox(s) })).sort((a, c) => a.b.x0 - c.b.x0);
  const groups = [];
  for (const it of items) {
    const g = groups.at(-1);
    if (g && it.b.x0 <= g.x1 + gap) { g.strokes.push(it.s); g.x1 = Math.max(g.x1, it.b.x1); }
    else groups.push({ strokes: [it.s], x1: it.b.x1 });
  }
  return groups.map(g => g.strokes);
}

// -> [{d, p}, ...] ranked candidates per written digit, left to right
export async function recognise(strokes, gap) {
  const layers = await loadDigits();
  return groupStrokes(strokes, gap).map(g => classify(layers, toInput(g)));
}
