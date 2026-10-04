/* LearnUp Live Arena — service worker (Modernize.md §2.1)
 *
 * Goal: the contestant shell loads instantly on congested venue Wi-Fi.
 *  - Navigations: network-first, falling back to the cached app shell.
 *  - Hashed build assets (/assets/*), icons, fonts: cache-first.
 *  - Live game traffic (Socket.IO, /api) is never cached.
 */
const VERSION = 'arena-v1';
const SHELL = ['/', '/play', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon.svg'];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') {
    const cache = await caches.open(VERSION);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(VERSION);
    cache.put('/play', response.clone());
    return response;
  } catch {
    return (await caches.match(request)) || (await caches.match('/play')) || (await caches.match('/'));
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (url.origin !== self.location.origin) return; // API + Socket.IO live on the backend origin
  if (url.pathname.startsWith('/socket.io') || url.pathname.startsWith('/api')) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(cacheFirst(request));
  }
});
