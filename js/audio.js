// Speech: pre-recorded clips (audio/manifest.json, made by tools/tts_build.py) played through Web Audio,
// falling back to the iPad's built-in voice for any line that has no clip. Plus small synthesized sound effects.
import { PRAISE, RETRY } from './phrases.js';

let voice = null;
let unlocked = false;

function pickVoice() {
  const voices = speechSynthesis.getVoices().filter(v => /zh[-_]CN/i.test(v.lang));
  voice = voices.find(v => /Tingting|婷婷/.test(v.name))
    || voices.find(v => v.localService)
    || voices[0] || null;
}
if ('speechSynthesis' in window) {
  pickVoice();
  speechSynthesis.addEventListener?.('voiceschanged', pickVoice);
}

let manifest = {};
export const audioReady = fetch('audio/manifest.json')
  .then(r => (r.ok ? r.json() : {}))
  .then(m => { manifest = m; })
  .catch(() => {});

const buffers = new Map();   // clip id -> Promise<AudioBuffer|null>
function clip(text) {
  const id = manifest[text];
  if (!id) return null;
  if (!buffers.has(id)) {
    buffers.set(id, fetch(`audio/${id}.m4a`)
      .then(r => (r.ok ? r.arrayBuffer() : Promise.reject()))
      .then(data => new Promise((ok, fail) => ac().decodeAudioData(data, ok, fail)))
      .catch(() => null));
  }
  return buffers.get(id);
}

// Quietly download every clip once so the service worker has them for offline play.
export async function warmCache() {
  await audioReady;
  for (const id of new Set(Object.values(manifest))) {
    try { await fetch(`audio/${id}.m4a`); } catch (e) { return; }
  }
}

// Start fetching/decoding clips ahead of time (e.g. everything an item may say).
export function preload(texts) {
  for (const t of texts) if (t) clip(t);
}

let current = null;   // { stop() } for whatever is speaking now
let token = 0;

function playBuffer(buf) {
  return new Promise(resolve => {
    const src = ac().createBufferSource();
    src.buffer = buf;
    src.connect(ac().destination);
    src.onended = () => resolve();
    current = { stop: () => { try { src.stop(); } catch (e) {} resolve(); } };
    src.start();
  });
}

function sayBuiltIn(text, rate = 0.85) {
  if (!('speechSynthesis' in window)) return Promise.resolve();
  return new Promise(resolve => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN';
    if (voice) u.voice = voice;
    u.rate = rate;
    u.pitch = 1.1;
    // iOS sometimes drops the end event
    const timer = setTimeout(resolve, 600 + text.length * 380);
    u.onend = u.onerror = () => { clearTimeout(timer); resolve(); };
    current = { stop: () => { speechSynthesis.cancel(); resolve(); } };
    speechSynthesis.speak(u);
  });
}

// speak('一句话') or speak(['太棒了！', '讲解…']). Resolves when finished or interrupted.
// `fallback` is what the built-in voice says if there is no clip (e.g. a character instead of its pinyin).
export async function speak(text, { fallback } = {}) {
  stopSpeaking();
  const mine = ++token;
  await audioReady;
  const parts = (Array.isArray(text) ? text : [text]).filter(Boolean);
  parts.forEach(clip);
  for (const part of parts) {
    if (mine !== token) return;
    const buf = await clip(part);
    if (mine !== token) return;
    if (buf) await playBuffer(buf);
    else await sayBuiltIn(parts.length === 1 && fallback ? fallback : part);
  }
}

export function stopSpeaking() {
  token++;
  current?.stop();
  current = null;
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

let ctx = null;
function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// iOS needs audio and speech to start inside a user gesture once.
export function unlockAudio() {
  if (unlocked) return;
  unlocked = true;
  // play through the silent switch, like a game would
  if (navigator.audioSession) navigator.audioSession.type = 'playback';
  ac();
  if ('speechSynthesis' in window) {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    speechSynthesis.speak(u);
  }
}

function tone(freq, start, dur, type = 'square', gain = 0.08) {
  const c = ac();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  const t = c.currentTime + start;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export const sfx = {
  right() { tone(660, 0, 0.12); tone(880, 0.1, 0.12); tone(1320, 0.2, 0.25); },
  wrong() { tone(220, 0, 0.18, 'sawtooth', 0.05); tone(180, 0.15, 0.25, 'sawtooth', 0.05); },
  tap() { tone(520, 0, 0.05, 'square', 0.04); },
  place() { tone(140, 0, 0.08, 'triangle', 0.15); tone(90, 0.03, 0.1, 'triangle', 0.12); },
  dig() { tone(110, 0, 0.06, 'sawtooth', 0.06); tone(80, 0.05, 0.08, 'sawtooth', 0.05); },
  chest() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.09, 0.2, 'square', 0.06)); },
};

export const praise = () => PRAISE[Math.floor(Math.random() * PRAISE.length)];
export const retry = () => RETRY[Math.floor(Math.random() * RETRY.length)];
