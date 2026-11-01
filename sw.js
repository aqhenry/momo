// Network first (so new levels show up as soon as they're published), cache as offline fallback.
const CACHE = 'momo-v12';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/main.js', 'js/ui.js', 'js/phrases.js', 'js/sprites.js', 'js/scene.js', 'js/fx.js', 'js/rewards.js', 'js/build3d.js',
  'vendor/three/three.module.min.js', 'vendor/three/OrbitControls.js', 'js/store.js', 'js/audio.js', 'js/blocks.js', 'js/pinyin.js', 'js/pics.js',
  'js/items/choice.js', 'js/items/blend.js', 'js/items/spell.js', 'js/items/stroke.js', 'js/items/order.js', 'js/items/text.js', 'js/items/math.js',
  'js/items/pinyin-challenge.js', 'js/items/math-explore.js', 'levels/yuwen-jqx/level.json', 'levels/math-week9/level.json',
  'vendor/hanzi-writer.min.js', 'fonts/andika-400.woff2', 'fonts/andika-700.woff2', 'fonts/pixel.woff2', 'fonts/kai.woff2',
  'levels/index.json', 'audio/manifest.json', 'audio/profiles/jqx-b.json', 'icons/icon-180.png',
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}));
});
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      })
      // Prefer this release's shell/level index; older caches can still supply audio.
      .catch(async () => {
        const current = await caches.open(CACHE);
        return (await current.match(req, { ignoreSearch: true })) || caches.match(req, { ignoreSearch: true });
      })
  );
});
