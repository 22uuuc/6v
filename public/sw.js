/* 墨影书城 · Service Worker（PWA 壳）
   策略：网络优先 → 失败回退缓存；导航请求离线回退到缓存的 index.html。
   注意：业务数据（localStorage / IndexedDB）不在 SW 缓存范围，不会被污染。 */
const CACHE = 'moying-shell-v1';
const SHELL = ['./', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => null)
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // 只接管同源请求；GitHub raw 云端内容库走网络直连，不缓存
  if (url.origin !== self.location.origin) return;

  // 导航请求：网络优先，离线回退缓存的 index.html
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./', copy)).catch(() => null);
          return res;
        })
        .catch(() => caches.match('./').then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  // 静态资源：网络优先回退缓存
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => null);
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
