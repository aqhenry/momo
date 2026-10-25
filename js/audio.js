// Speech: pre-recorded clips (audio/manifest.json, made by tools/tts_build.py) played through Web Audio,
// falling back to the iPad's built-in voice for any line that has no clip. Plus small synthesized sound effects.
import { PRAISE, RETRY } from './phrases.js';

let voice = null;

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
      .catch(() => { buffers.delete(id); return null; }));   // retry next time
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

async function playBuffer(buf) {
  const c = ac();
  if (!c) return;
  // after an interruption the context only comes back on a tap; until then skip the clip
  // instead of waiting for an 'ended' event that would never fire
  if (c.state !== 'running') {
    c.resume().catch(() => {});
    await new Promise(r => setTimeout(r, 300));
    if (c.state !== 'running') return;
  }
  return new Promise(resolve => {
    const src = c.createBufferSource();
    src.buffer = buf;
    src.connect(c.destination);
    // safety net: the clock freezes if the audio gets interrupted mid-clip
    const timer = setTimeout(resolve, buf.duration * 1000 + 1500);
    const done = () => { clearTimeout(timer); resolve(); };
    src.onended = done;
    current = { stop: () => { try { src.stop(); } catch (e) {} done(); } };
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
let ranBefore = false;   // the context has played at least once, so a non-running state means an interruption
function ac() {
  if (!ctx || ctx.state === 'closed') {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    const c = (ctx = new AC());
    // if audio stops mid-sentence (a call, Siri, another app), end the sentence so the game doesn't wait on it
    c.onstatechange = () => {
      if (c.state === 'running') ranBefore = true;
      else if (c === ctx) current?.stop();
    };
  }
  // 'suspended' or iOS's 'interrupted' (after a phone call / other app's audio)
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
  return ctx;
}

// iOS only lets audio start, or restart after an interruption, inside a tap. So every tap checks:
// resume the context, and if iOS refuses to bring it back, replace it with a fresh one
// (decoded clips are plain AudioBuffers and work in the new context too).
let primedSpeech = false;
export function unlockAudio() {
  // play through the silent switch, like a game would
  if (navigator.audioSession && navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback';
  const c = ac();
  if (c && c.state !== 'running' && ranBefore) {
    const stale = c;
    setTimeout(() => {
      if (stale === ctx && stale.state !== 'running') {
        stale.close().catch(() => {});
        ctx = null;
        ac();
      }
    }, 400);
  }
  if ('speechSynthesis' in window) {
    speechSynthesis.resume();
    if (!primedSpeech) {
      primedSpeech = true;
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      speechSynthesis.speak(u);
    }
  }
}
// touchend / click count as a user gesture on iOS (pointerdown from a finger does not)
for (const ev of ['pointerdown', 'pointerup', 'touchend', 'click']) {
  document.addEventListener(ev, unlockAudio, { capture: true, passive: true });
}
// coming back from a call or another app: try straight away (works on some iOS versions; otherwise the next tap does it)
document.addEventListener('visibilitychange', () => { if (!document.hidden && ctx) ac(); });
addEventListener('pageshow', () => { if (ctx) ac(); });

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
