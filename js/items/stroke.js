// 写汉字: trace the character stroke by stroke in a 田字格 (Hanzi Writer quiz mode).
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
  const demoBtn = h('button.btn.small', { onclick: demo }, '👀 看示范');

  root.append(promptEl(item.prompt, ctx), h('div.stroke-area', box, h('div.stroke-side', status, demoBtn)));

  const writer = window.HanziWriter.create(target, item.char, {
    width: size, height: size, padding: 10,
    showCharacter: false, showOutline: true,
    strokeColor: '#222', outlineColor: '#d8d8d8', drawingColor: '#1d6fe0', highlightColor: '#5aa83a',
    drawingWidth: 28, showHintAfterMisses: 2, strokeAnimationSpeed: 1, delayBetweenStrokes: 400,
    charDataLoader: loader,
  });

  let misses = 0;
  function quiz() {
    writer.quiz({
      onMistake: () => { misses++; },
      onCorrectStroke: ({ strokeNum, strokesRemaining }) => {
        const name = names[strokeNum];
        status.textContent = name ? `第${strokeNum + 1}笔：${name}` : `还剩 ${strokesRemaining} 笔`;
        if (name) ctx.say(name);
      },
      onComplete: () => {
        if (misses >= 3) ctx.wrong(`写错 ${misses} 次`, null);
        ctx.right(item.after);
      },
    });
  }

  function demo() {
    writer.cancelQuiz();
    writer.hideCharacter();
    if (item.demoSay) ctx.say(item.demoSay);
    writer.animateCharacter({ onComplete: () => { writer.hideCharacter(); quiz(); } });
  }

  quiz();
}
