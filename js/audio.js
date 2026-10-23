// Chinese text-to-speech (iPad built-in voice) and small synthesized sound effects.
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

// Resolves when speech ends (or after a timeout, since iOS sometimes drops the end event).
export function speak(text, { rate = 0.85 } = {}) {
  if (!text || !('speechSynthesis' in window)) return Promise.resolve();
  speechSynthesis.cancel();
  return new Promise(resolve => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN';
    if (voice) u.voice = voice;
    u.rate = rate;
    u.pitch = 1.1;
    const timer = setTimeout(resolve, 600 + text.length * 380);
    u.onend = u.onerror = () => { clearTimeout(timer); resolve(); };
    speechSynthesis.speak(u);
  });
}

export function stopSpeaking() {
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

const PRAISE = ['太棒了！', '答对啦！', '真厉害！', '就是它！', '你是拼音小矿工！', '漂亮！', '完全正确！'];
const RETRY = ['再想想哦。', '差一点点，再试一次。', '没关系，换一个试试。'];
export const praise = () => PRAISE[Math.floor(Math.random() * PRAISE.length)];
export const retry = () => RETRY[Math.floor(Math.random() * RETRY.length)];
