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
  xp: 0,          // all XP ever earned (player level comes from this, see rewards.js levelOf)
  achievements: {},  // achievement id -> date
  items: {},      // workbench materials (stick, iron_ingot) -> count
  tools: {},      // pickaxes owned -> date (they unlock recipe tiers)
  furnace: null,  // { job: index into SMELT, start: xp when loaded }
  trophies: {},   // trophy id -> tiers claimed (0..3)
  stats: { crafted: 0, smelted: 0 },
});

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = { ...fresh(), ...JSON.parse(raw) };
      s.stats = { crafted: 0, smelted: 0, ...s.stats };
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

  addXP(n) {
    state.xp = (state.xp || 0) + n;
    save();
  },

  // one-time rewards; returns false if already earned
  achieve(id) {
    if (state.achievements[id]) return false;
    state.achievements[id] = new Date().toISOString();
    save();
    return true;
  },

  // workbench: inputs/outputs are block types or material keys (anything not a block lives in `items`)
  count(t, isBlock) {
    return (isBlock ? state.inventory[t] : state.items[t]) || 0;
  },
  // take every input; false (and nothing taken) if something is missing
  spend(inputs, isBlock) {
    if (Object.entries(inputs).some(([t, n]) => this.count(t, isBlock(t)) < n)) return false;
    for (const [t, n] of Object.entries(inputs)) {
      if (isBlock(t)) state.inventory[t] -= n; else state.items[t] -= n;
    }
    save();
    return true;
  },
  gainItem(t, n = 1) {
    state.items[t] = (state.items[t] || 0) + n;
    save();
  },
  setTool(id) { state.tools[id] = new Date().toISOString(); save(); },
  setFurnace(f) { state.furnace = f; save(); },
  bump(stat, n = 1) { state.stats[stat] = (state.stats[stat] || 0) + n; save(); },
  claimTrophy(id) { state.trophies[id] = (state.trophies[id] || 0) + 1; save(); },

  setWorld3d(world) {
    state.world3d = world;
    save();
  },

  resetAll() {
    state = fresh();
    save();
  },
};
