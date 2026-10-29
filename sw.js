// BrainVault Progressive Web App (PWA) Service Worker
// Enables sub-50ms offline loading and caching of all shell code, styles, and libraries.

const CACHE_NAME = "brainvault-v3.0-offline";

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/app.css",
  "./js/app.js",
  "./js/store.js",
  "./js/canvas.js",
  "./js/ui.js",
  "./js/audio.js",
  "./js/sfx.js",
  "./js/terminal.js",
  "./js/palette.js",
  "./js/report.js",
  "./js/landing.js",
  "./js/tree3d.js",
  "./js/admin.js",
  "./js/content.js",
  "./js/feeds.js",
  "./js/icons.js",
  "./js/persistence.js",
  "./js/three.min.js",
  "./js/anime.min.js"
];

// Install: pre-cache static application shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CORE_ASSETS).catch((err) => {
        console.warn("PWA pre-cache notice:", err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean up older cache versions
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Stale-While-Revalidate for local files, Network-First for external API queries
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Ignore non-GET requests or backend SQLite API writes
  if (req.method !== "GET" || url.pathname.startsWith("/api/")) {
    return;
  }

  // Same-origin shell assets: Cache-First with background revalidation
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetchPromise = fetch(req).then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return networkRes;
        }).catch(() => cached);

        return cached || fetchPromise;
      })
    );
    return;
  }

  // External font / CDN assets: Stale-while-revalidate
  if (url.hostname.includes("fonts.") || url.hostname.includes("gstatic.")) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          return res;
        }).catch(() => cached);
      })
    );
  }
});
