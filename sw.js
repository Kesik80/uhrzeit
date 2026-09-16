/* sw.js — Uhrzeit.
   Нужен Chrome для установки и даёт работу без сети.
   Страницы и скрипты: «сначала сеть» — после деплоя всегда свежие файлы.
   Озвучка voice/…mp3: «сразу из кэша, в фоне обновить» — звук без задержки. */
const CACHE = 'uhrzeit-v3';
const VOICE_CACHE = 'uhrzeit-voice-v1';
const PRECACHE = ['/', '/index.html', '/timewords.js', '/install.js', '/icons/manifest.json', '/icons/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  const keep = [CACHE, VOICE_CACHE];
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !keep.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;                       // HEAD-проверки, сохранение, вход — только сеть
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;             // чужие домены не трогаем
  if (url.pathname.startsWith('/api/') && url.pathname !== '/api/load-settings') return;
  if (url.searchParams.has('fresh') || url.searchParams.has('t')) return;  // явный запрос свежего файла

  // ── озвучка ──
  // <audio> в Chrome просит файл кусками (Range). Из кэша отдаём файл целиком (200) —
  // плеер это принимает. В кэш кладём только полный ответ, скачанный без Range.
  if (url.pathname.startsWith('/voice/') && url.pathname.endsWith('.mp3')) {
    const key = url.origin + url.pathname;
    e.respondWith(
      caches.open(VOICE_CACHE).then((c) =>
        c.match(key).then((hit) => {
          const refresh = fetch(key).then((res) => {
            const ct = res.headers.get('content-type') || '';
            if (res.status === 200 && ct.includes('audio')) return c.put(key, res.clone()).then(() => res);
            return res;
          });
          if (hit) {
            e.waitUntil(refresh.catch(() => {}));   // обновим в фоне
            return hit;
          }
          if (req.headers.has('range')) {
            e.waitUntil(refresh.catch(() => {}));   // целиком — в кэш на следующий раз
            return fetch(req);
          }
          return refresh;
        })
      )
    );
    return;
  }

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
