// Progress, inventory and build world, persisted in localStorage on this device.
const KEY = 'momo.v1';

const fresh = () => ({
  progress: {},   // levelId -> stageId -> { done, stars, firstTry, total, mistakes: [] }
  inventory: {},  // blockType -> count
  found: {},      // blockType -> date first obtained (collection book)
  world: null,    // old 2D build area cells (migrated into world3d)
  world3d: null,  // "x,y,z" -> blockType
  pity: 0,        // gold chests since the last legendary
  totalBlocks: 0,
});

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = { ...fresh(), ...JSON.parse(raw) };
      // anything already owned counts as found
      for (const t of Object.keys(s.inventory)) s.found[t] ||= new Date().toISOString();
      return s;
    }
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

  // returns true the first time this kind of block is ever obtained
  addBlock(type, n = 1) {
    state.inventory[type] = (state.inventory[type] || 0) + n;
    state.totalBlocks += n;
    const isNew = !state.found[type];
    if (isNew) state.found[type] = new Date().toISOString();
    save();
    return isNew;
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

  setWorld3d(world) {
    state.world3d = world;
    save();
  },

  resetAll() {
    state = fresh();
    save();
  },
};
