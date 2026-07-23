const CACHE_NAME = "ai-usage-monitor-shell-v1";
const SHELL_FILES = [
  "./",
  "index.html",
  "app.js",
  "manifest.webmanifest",
  "privacy.html",
  "icons/icon192.png",
  "icons/icon512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
  );
  self.clients.claim();
});

// network-first - cache is just a fallback for when you lose the LAN/tailnet
self.addEventListener("fetch", (event) => {
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
