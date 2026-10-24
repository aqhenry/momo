// 3D build mode: a 32x32 grass island. One finger turns the camera, two fingers zoom/move.
// Tap a block face (or the grass) to put the selected block there; in dig mode a tap digs it back out.
import * as THREE from '../vendor/three/three.module.min.js';
import { OrbitControls } from '../vendor/three/OrbitControls.js';
import { BLOCKS, faceCanvas, iconEl } from './blocks.js';
import { store } from './store.js';
import { h } from './ui.js';
import { spriteEl } from './sprites.js';
import { sfx, speak } from './audio.js';
import { S } from './phrases.js';
import { burst } from './fx.js';

const HALF = 16;          // build area is x, z in [-16, 15]
const MAX_Y = 24;
const key = (x, y, z) => `${x},${y},${z}`;
const inside = (x, y, z) => x >= -HALF && x < HALF && z >= -HALF && z < HALF && y >= 1 && y <= MAX_Y;

function tex(type, face, repeat) {
  const t = new THREE.CanvasTexture(faceCanvas(type, face));
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}

const matCache = {};
function materials(type) {
  if (matCache[type]) return matCache[type];
  const b = BLOCKS[type] || {};
  const mk = face => {
    const map = tex(type, face);
    return new THREE.MeshLambertMaterial({
      map,
      transparent: !!b.clear, alphaTest: b.clear ? 0.04 : 0,
      emissive: b.glow ? 0xffffff : 0x000000, emissiveMap: b.glow ? map : null, emissiveIntensity: b.glow ? 0.55 : 0,
    });
  };
  const side = mk('side');
  return (matCache[type] = [side, side, mk('top'), mk('bottom'), side, side]);
}

// Old 2D build (20x12 grid, bottom two rows ground) becomes a wall in the middle of the island.
// A new island starts with one oak tree in a corner (its blocks can be dug out like any others).
function starterTree(out) {
  for (let y = 1; y <= 4; y++) out[key(-12, y, -12)] = 'log';
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let y = 4; y <= 6; y++) {
    const r = Math.abs(dx) + Math.abs(dz);
    if ((y < 6 && r <= 3 && !(dx === 0 && dz === 0 && y < 5)) || (y === 6 && r <= 1)) out[key(-12 + dx, y, -12 + dz)] ||= 'leaves';
  }
  return out;
}

function migrate2d(world2d) {
  const out = starterTree({});
  if (!Array.isArray(world2d)) return out;
  const COLS = 20, ROWS = 12;
  for (let r = 0; r < ROWS - 2; r++) for (let c = 0; c < COLS; c++) {
    const t = world2d[r * COLS + c];
    if (t) out[key(c - 10, ROWS - 2 - r, 0)] = t;
  }
  return out;
}

export function mountBuild(root, { onBack, onBook }) {
  let world = store.state.world3d;
  if (!world) {
    world = migrate2d(store.state.world);
    store.setWorld3d(world);
  }

  // ---------- DOM ----------
  const stage = h('div.b3-stage');
  const inv = h('div.inventory.b3-inv');
  const placeBtn = h('button.mc-btn.b3-mode', { onclick: () => setMode('place') }, spriteEl('bricks'), '建造');
  const digBtn = h('button.mc-btn.b3-mode', { onclick: () => setMode('dig') }, spriteEl('pickaxe'), '挖掘');
  const undoBtn = h('button.mc-btn.small', { onclick: undo }, spriteEl('back'), '撤销');
  const homeBtn = h('button.mc-btn.small', { onclick: resetView }, spriteEl('compass'), '回到中间');
  root.append(h('div.screen.b3',
    stage,
    h('div.topbar.b3-top',
      h('div.tb-left', h('button.mc-btn.icon', { onclick: onBack }, spriteEl('back'))),
      h('div.tb-title', h('div.plate', spriteEl('bricks'), '我的世界')),
      h('div.tb-right', h('button.mc-btn.small', { onclick: onBook }, spriteEl('book'), '图鉴'))),
    h('div.b3-bottom',
      h('div.b3-tools', placeBtn, digBtn, h('div.b3-gap'), undoBtn, homeBtn),
      inv)));

  // ---------- three.js ----------
  const renderer = new THREE.WebGLRenderer({ antialias: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  stage.append(renderer.domElement);

  const scene = new THREE.Scene();
  const sky = new THREE.Color(0x8fc3ff);
  scene.background = sky;
  scene.fog = new THREE.Fog(sky, 70, 140);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x6a5a48, 1.15));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(12, 30, 18);
  scene.add(sun);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 400);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.minDistance = 6;
  controls.maxDistance = 70;
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.screenSpacePanning = false;
  function resetView() {
    camera.position.set(17, 11, 25);
    controls.target.set(0, 3, 0);
    controls.update();
  }
  resetView();

  // ground: the build island plus a darker meadow around it
  const ground = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2, 1, HALF * 2), [
    new THREE.MeshLambertMaterial({ map: tex('grass', 'side', [HALF * 2, 1]) }),
    new THREE.MeshLambertMaterial({ map: tex('grass', 'side', [HALF * 2, 1]) }),
    new THREE.MeshLambertMaterial({ map: tex('grass', 'top', [HALF * 2, HALF * 2]) }),
    new THREE.MeshLambertMaterial({ map: tex('dirt', 'side', [HALF * 2, HALF * 2]) }),
    new THREE.MeshLambertMaterial({ map: tex('grass', 'side', [HALF * 2, 1]) }),
    new THREE.MeshLambertMaterial({ map: tex('grass', 'side', [HALF * 2, 1]) }),
  ]);
  ground.position.set(0, 0.5, 0);
  scene.add(ground);
  const meadow = new THREE.Mesh(new THREE.PlaneGeometry(240, 240),
    new THREE.MeshLambertMaterial({ map: tex('grass', 'top', [240, 240]), color: 0x9ab38a }));
  meadow.rotation.x = -Math.PI / 2;
  meadow.position.y = -0.02;
  scene.add(meadow);

  // flat blocky clouds
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, fog: false });
  for (let i = 0; i < 14; i++) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(6 + Math.random() * 10, 1.2, 4 + Math.random() * 6), cloudMat);
    c.position.set((Math.random() - 0.5) * 160, 34 + Math.random() * 6, (Math.random() - 0.5) * 160);
    scene.add(c);
  }

  // outline that flashes where a block was placed / dug
  const outline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.03, 1.03, 1.03)),
    new THREE.LineBasicMaterial({ color: 0x111111 }));
  outline.visible = false;
  scene.add(outline);
  let outlineTimer;
  function flash(x, y, z) {
    outline.position.set(x + 0.5, y + 0.5, z + 0.5);
    outline.visible = true;
    clearTimeout(outlineTimer);
    outlineTimer = setTimeout(() => { outline.visible = false; }, 500);
  }

  // one InstancedMesh per block type, rebuilt after each change
  const cube = new THREE.BoxGeometry(1, 1, 1);
  let meshes = [];
  function rebuild() {
    meshes.forEach(m => { scene.remove(m); m.dispose(); });
    const byType = {};
    for (const [k, t] of Object.entries(world)) (byType[t] ||= []).push(k);
    const mtx = new THREE.Matrix4();
    meshes = Object.entries(byType).map(([type, keys]) => {
      const mesh = new THREE.InstancedMesh(cube, materials(type), keys.length);
      keys.forEach((k, i) => {
        const [x, y, z] = k.split(',').map(Number);
        mesh.setMatrixAt(i, mtx.makeTranslation(x + 0.5, y + 0.5, z + 0.5));
      });
      mesh.userData.keys = keys;
      scene.add(mesh);
      return mesh;
    });
  }
  rebuild();

  // ---------- inventory + modes ----------
  const owned = () => Object.keys(BLOCKS)
    .filter(t => store.state.inventory[t] > 0)
    .sort((a, b) => BLOCKS[b].rarity - BLOCKS[a].rarity);
  let selected = owned()[0] || null;
  let mode = 'place';

  function paintInv() {
    inv.innerHTML = '';
    const list = owned();
    if (!list.length) inv.append(h('div.inv-empty', '背包空了，去冒险赚方块吧！'));
    for (const t of list) {
      inv.append(h(`button.inv-slot.r${BLOCKS[t].rarity}${t === selected && mode === 'place' ? '.sel' : ''}`,
        { onclick: () => { selected = t; sfx.tap(); if (mode !== 'place') setMode('place'); else paintInv(); } },
        iconEl(t), h('span.inv-n', String(store.state.inventory[t]))));
    }
  }
  function setMode(m) {
    mode = m;
    placeBtn.classList.toggle('pressed', m === 'place');
    digBtn.classList.toggle('pressed', m === 'dig');
    speak(m === 'place' ? S.placeMode : S.digMode);
    paintInv();
  }
  placeBtn.classList.add('pressed');
  paintInv();

  // ---------- editing ----------
  const history = [];
  function place(x, y, z, type, record = true) {
    if (!inside(x, y, z) || world[key(x, y, z)]) return false;
    if (!store.takeBlock(type)) return false;
    world[key(x, y, z)] = type;
    if (record) history.push({ op: 'place', x, y, z, type });
    return true;
  }
  function dig(x, y, z, record = true) {
    const type = world[key(x, y, z)];
    if (!type) return null;
    delete world[key(x, y, z)];
    store.returnBlock(type);
    if (record) history.push({ op: 'dig', x, y, z, type });
    return type;
  }
  function commit() {
    store.setWorld3d(world);
    rebuild();
    if (selected && !store.state.inventory[selected]) selected = owned()[0] || null;
    paintInv();
  }
  function undo() {
    const a = history.pop();
    if (!a) return;
    if (a.op === 'place') dig(a.x, a.y, a.z, false);
    else place(a.x, a.y, a.z, a.type, false);
    sfx.tap();
    flash(a.x, a.y, a.z);
    commit();
  }

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function tapAt(clientX, clientY) {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects([...meshes, ground], false)[0];
    if (!hit) return;
    let x, y, z;
    if (hit.object === ground) {
      if (hit.face.normal.y < 0.5) return;
      x = Math.floor(hit.point.x); y = 0; z = Math.floor(hit.point.z);
    } else {
      [x, y, z] = hit.object.userData.keys[hit.instanceId].split(',').map(Number);
    }
    if (mode === 'dig') {
      if (hit.object === ground) return;
      const type = dig(x, y, z);
      if (type) { sfx.dig(); burst(type, { x: clientX, y: clientY }, 10); flash(x, y, z); commit(); }
      return;
    }
    if (!selected) { speak(S.pickBlock); return; }
    const n = hit.face.normal;
    const [px, py, pz] = [x + Math.round(n.x), y + Math.round(n.y), z + Math.round(n.z)];
    if (place(px, py, pz, selected)) { sfx.place(); flash(px, py, pz); commit(); }
  }

  // a tap is a short touch that barely moved and never became a two-finger gesture
  const pointers = new Map();
  let tapCandidate = null;
  const el = renderer.domElement;
  el.addEventListener('pointerdown', e => {
    pointers.set(e.pointerId, e);
    tapCandidate = pointers.size === 1 ? { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() } : null;
  });
  el.addEventListener('pointerup', e => {
    pointers.delete(e.pointerId);
    const c = tapCandidate;
    tapCandidate = null;
    if (c && c.id === e.pointerId && Math.hypot(e.clientX - c.x, e.clientY - c.y) < 10 && performance.now() - c.t < 500) tapAt(e.clientX, e.clientY);
  });
  el.addEventListener('pointercancel', e => { pointers.delete(e.pointerId); tapCandidate = null; });

  // ---------- loop ----------
  function resize() {
    const w = stage.clientWidth, hgt = stage.clientHeight;
    renderer.setSize(w, hgt, false);
    camera.aspect = w / hgt;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(stage);
  resize();

  function frame() {
    if (!stage.isConnected) {
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      return;
    }
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
