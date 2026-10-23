// Progress, inventory and build world, persisted in localStorage on this device.
const KEY = 'momo.v1';

const fresh = () => ({
  progress: {},   // levelId -> stageId -> { done, stars, firstTry, total, mistakes: [] }
  inventory: {},  // blockType -> count
  world: null,    // build area cells
  totalBlocks: 0,
});

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...fresh(), ...JSON.parse(raw) };
  } catch (e) { /* private mode or blocked storage */ }
  return fresh();
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
}

export const store = {
  get state() { return state; },

  stage(levelId, stageId) {
    return state.progress[levelId]?.[stageId] || null;
  },

  finishStage(levelId, stageId, result) {
    const lv = (state.progress[levelId] ||= {});
    const prev = lv[stageId];
    lv[stageId] = {
      done: true,
      stars: Math.max(prev?.stars || 0, result.stars),
      firstTry: result.firstTry,
      total: result.total,
      mistakes: result.mistakes,
      plays: (prev?.plays || 0) + 1,
      at: new Date().toISOString(),
    };
    save();
  },

  resetLevel(levelId) {
    delete state.progress[levelId];
    save();
  },

  addBlock(type, n = 1) {
    state.inventory[type] = (state.inventory[type] || 0) + n;
    if (n > 0) state.totalBlocks += n;
    save();
  },

  // a block dug back out of the build area (not a new reward)
  returnBlock(type) {
    state.inventory[type] = (state.inventory[type] || 0) + 1;
    save();
  },

  takeBlock(type) {
    if (!state.inventory[type]) return false;
    state.inventory[type]--;
    save();
    return true;
  },

  setWorld(world) {
    state.world = world;
    save();
  },

  resetAll() {
    state = fresh();
    save();
  },
};
