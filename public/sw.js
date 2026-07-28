// CatDex Service Worker — simple cache-first for shell, network-first for pages
const CACHE_NAME = "catdex-v2";

const STATIC_ASSETS = [
  "/",
  "/capture",
  "/cat",
  "/map",
  "/stats",
  "/settings",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Only handle GET requests
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      // Try network, fall back to cache
      return fetch(event.request)
        .then((response) => {
          // Cache successful responses
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) =>
              cache.put(event.request, clone)
            );
          }
          return response;
        })
        .catch(() => cached || new Response("Offline", { status: 503 }))
    })
  );
});
