// Full-screen pixel landscape behind every screen: banded sky, blocky clouds, far hills,
// trees and a grass/dirt ground built from the same block textures as the build area.
import { blockURL } from './blocks.js';

const PX = 4;            // device-independent pixels per scene pixel
const BLOCK = 16;        // scene pixels per block

let bg, clouds;

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function loadImg(src) {
  return new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = src; });
}

async function draw() {
  const W = Math.ceil(innerWidth / PX), H = Math.ceil(innerHeight / PX);
  bg.width = W; bg.height = H;
  const g = bg.getContext('2d');
  g.imageSmoothingEnabled = false;
  const rand = rng(42);

  // sky in flat bands, like a low-res gradient
  const top = [96, 148, 240], bottom = [178, 214, 255];
  const bands = 12;
  for (let b = 0; b < bands; b++) {
    const t = b / (bands - 1);
    g.fillStyle = `rgb(${top.map((c, i) => Math.round(c + (bottom[i] - c) * t)).join(',')})`;
    g.fillRect(0, Math.floor(b * H * 0.75 / bands), W, Math.ceil(H * 0.75 / bands) + 1);
  }
  g.fillRect(0, Math.floor(H * 0.75), W, H);

  // square sun
  g.fillStyle = '#fff6b0'; g.fillRect(W - 46, 14, 18, 18);
  g.fillStyle = '#ffe680'; g.fillRect(W - 44, 16, 14, 14);

  const groundY = H - BLOCK * 2.2 | 0;

  // far hills: two stepped silhouettes
  for (const [shade, amp, base, step] of [['#8fc0a0', 34, 30, 6], ['#6fa878', 24, 12, 4]]) {
    g.fillStyle = shade;
    let h = base + rand() * amp;
    for (let x = 0; x < W; x += step) {
      h = Math.max(base * 0.4, Math.min(base + amp, h + (rand() - 0.5) * 10));
      g.fillRect(x, groundY - h, step, h);
    }
  }

  // ground: one row of grass blocks then dirt
  const [grass, dirt, log, leaves] = await Promise.all(['grass', 'dirt', 'log', 'leaves'].map(t => loadImg(blockURL(t))));
  for (let x = 0; x < W; x += BLOCK) {
    g.drawImage(grass, x, groundY);
    for (let y = groundY + BLOCK; y < H; y += BLOCK) g.drawImage(dirt, x, y);
  }

  // trees standing on the ground, kept to the sides so screens stay clear in the middle
  const treeXs = [BLOCK * 1, W - BLOCK * 2.5];
  for (const tx of treeXs) {
    const x = Math.round(tx / BLOCK) * BLOCK;
    const trunk = 3;
    for (let k = 1; k <= trunk; k++) g.drawImage(log, x, groundY - k * BLOCK);
    const ly = groundY - (trunk + 2) * BLOCK;
    for (const [dx, dy] of [[-1, 1], [0, 1], [1, 1], [-1, 0], [0, 0], [1, 0], [0, -1]]) {
      g.drawImage(leaves, x + dx * BLOCK, ly + dy * BLOCK + BLOCK);
    }
  }

  // flowers
  for (let i = 0; i < W / 40; i++) {
    const x = (rand() * W) | 0;
    g.fillStyle = '#3f7f27'; g.fillRect(x, groundY - 4, 1, 4);
    g.fillStyle = rand() < 0.5 ? '#ffd23a' : '#e2403a'; g.fillRect(x - 1, groundY - 6, 3, 2);
  }
}

function drawClouds() {
  const W = Math.ceil(innerWidth / PX) * 2, H = 60;
  clouds.width = W; clouds.height = H;
  const g = clouds.getContext('2d');
  const rand = rng(7);
  for (let i = 0; i < W / 70; i++) {
    const x = rand() * W, y = 6 + rand() * 30, w = 20 + rand() * 30, h = 5 + rand() * 4;
    g.fillStyle = 'rgba(255,255,255,0.92)';
    g.fillRect(x | 0, y | 0, w | 0, h | 0);
    g.fillRect((x + w * 0.2) | 0, (y - 3) | 0, (w * 0.5) | 0, 3);
    g.fillStyle = 'rgba(220,232,250,0.9)';
    g.fillRect(x | 0, (y + h - 2) | 0, w | 0, 2);
  }
}

export function initScene() {
  bg = document.createElement('canvas');
  bg.className = 'scene-bg';
  clouds = document.createElement('canvas');
  clouds.className = 'scene-clouds';
  document.body.prepend(clouds);
  document.body.prepend(bg);
  const redraw = () => { draw(); drawClouds(); };
  redraw();
  let t;
  addEventListener('resize', () => { clearTimeout(t); t = setTimeout(redraw, 150); });
}

