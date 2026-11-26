// 写汉字: trace the character stroke by stroke in a 田字格 (Hanzi Writer quiz mode).
// `outline: false` is 听写: nothing is shown, he writes from memory; a wrong stroke twice flashes a hint.
import { h, promptEl } from '../ui.js';

const loader = (char, done, fail) =>
  fetch(`vendor/hanzi/${encodeURIComponent(char)}.json`).then(r => r.json()).then(done).catch(fail);

export function render(root, item, ctx) {
  const size = Math.min(320, Math.round(window.innerHeight * 0.42));
  const box = h('div.tianzige', { style: { width: size + 'px', height: size + 'px' } });
  box.innerHTML = `<svg class="tzg-bg" viewBox="0 0 100 100"><rect x="1" y="1" width="98" height="98"/>
    <line x1="0" y1="50" x2="100" y2="50"/><line x1="50" y1="0" x2="50" y2="100"/>
    <line x1="0" y1="0" x2="100" y2="100"/><line x1="100" y1="0" x2="0" y2="100"/></svg>`;
  const target = h('div.tzg-writer');
  box.append(target);

  const names = item.strokes || [];
  const status = h('div.stroke-status', names.length ? `一共 ${names.length} 笔` : '');
  // before the first stroke: the whole demo. Once he has started, 提示 flashes only the next stroke, so the strokes he
  // already wrote stay (restarting the demo used to wipe them)
  const demoBtn = h('button.mc-btn.small', { onclick: () => (done > 0 ? writer.highlightStroke(done) : demo()) }, item.outline === false ? '提示' : '看示范');

  root.append(promptEl(item.prompt, ctx), h('div.stroke-area', box, h('div.stroke-side', status, demoBtn)));

  const writer = window.HanziWriter.create(target, item.char, {
    width: size, height: size, padding: 10,
    showCharacter: false, showOutline: item.outline !== false,
    strokeColor: '#222', outlineColor: '#d8d8d8', drawingColor: '#1d6fe0', highlightColor: '#5aa83a',
    drawingWidth: 28, showHintAfterMisses: 2, strokeAnimationSpeed: 1, delayBetweenStrokes: 400,
    charDataLoader: loader,
  });

  let misses = 0, done = 0;
  function quiz() {
    writer.quiz({
      // challenge mode: every third wrong stroke is one mistake (costs a heart)
      onMistake: () => { misses++; if (ctx.challenge && misses % 3 === 0) ctx.wrong(`写错 ${misses} 笔`, item.hint); },
      onCorrectStroke: ({ strokeNum, strokesRemaining }) => {
        done = strokeNum + 1;
        const name = names[strokeNum];
        status.textContent = name ? `第${strokeNum + 1}笔：${name}` : `还剩 ${strokesRemaining} 笔`;
        if (name) ctx.say(name);
      },
      onComplete: () => {
        if (misses >= 3 && !ctx.challenge) ctx.wrong(`写错 ${misses} 次`, null);
        ctx.right(item.after);
      },
    });
  }

  function demo() {
    writer.cancelQuiz();
    writer.hideCharacter();
    if (item.demoSay) ctx.say(item.demoSay);
    writer.animateCharacter({ onComplete: () => { writer.hideCharacter(); done = 0; quiz(); } });
  }

  ctx.reveal = () => { writer.cancelQuiz(); writer.showCharacter(); demoBtn.disabled = true; };
  quiz();
}
