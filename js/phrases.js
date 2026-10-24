// Every sentence the game code speaks (level-specific lines live in levels/*.json).
// tools/tts_build.py pre-records each quoted string here; templates may use only ${n}, recorded for every
// number word in CN (TTS reads digits awkwardly, e.g. 2个 as 二个).
export const PRAISE = ['太棒了！', '答对啦！', '真厉害！', '就是它！', '你是拼音小矿工！', '漂亮！', '完全正确！'];
export const RETRY = ['再想想哦。', '差一点点，再试一次。', '没关系，换一个试试。'];

export const S = {
  pickBlock: '先在下面选一个方块。',
  blendTone: '听听声调，再找一找。',
  blendInitial: '看看拼出来的音节，它开头是哪个声母？',
  blendRule: '声母和韵母拼在一起，声调跟着韵母走哦。',
  spellIniFirst: '先放声母哦。',
  spellFinNow: '这里该放韵母啦。',
  spellBadIni: '声母不对，再听听开头的声音。',
  spellBadTone: '韵母对了，声调再听一听。',
  spellBadOther: '红色的格子不对，再试一次。',
  tapWrong: '红色的不对哦，再看看它的拼音。',
  orderWrong: '不是这一句，想想下一句是什么？',
  orderAgain: '再想想。',
};

export const CN = ['零', '一', '两', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];
const cn = k => CN[k] ?? String(k);
export const tapMissing = k => (n => `还少了${n}个，再找找。`)(cn(k));
export const tapTotal = k => (n => `一共有${n}个！`)(cn(k));
export const stageDone = k => (n => `过关啦！你得到了${n}颗星，还有一个宝箱！`)(cn(k));
