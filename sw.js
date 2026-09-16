/* sw.js — Uhrzeit.
   Нужен Chrome для установки и даёт работу без сети.
   Стратегия «сначала сеть»: после деплоя всегда свежие файлы,
   кэш используется только когда сети нет. */
const CACHE = 'uhrzeit-v1';
const PRECACHE = ['/', '/index.html', '/install.js', '/icons/manifest.json', '/icons/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;                       // сохранение/вход — только сеть
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;             // чужие домены не трогаем
  if (url.pathname.startsWith('/api/') && url.pathname !== '/api/load-settings') return;
  if (url.searchParams.has('fresh')) return;              // редактор хочет свежие данные

  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((hit) =>
          hit || (req.mode === 'navigate' ? caches.match('/') : Response.error())
        )
      )
  );
});
