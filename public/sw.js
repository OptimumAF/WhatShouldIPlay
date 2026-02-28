const CACHE_VERSION = "pickagame-runtime-v1";
const NAVIGATION_CACHE = "pickagame-navigation-v1";
const DATA_CACHE = "pickagame-data-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => ![CACHE_VERSION, NAVIGATION_CACHE, DATA_CACHE].includes(name))
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

const cacheFirst = async (request, cacheName) => {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    cache.put(request, response.clone());
  }
  return response;
};

const networkFirst = async (request, cacheName) => {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw new Error("Network and cache both unavailable.");
  }
};

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, NAVIGATION_CACHE));
    return;
  }

  if (url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.includes("/data/top-games.json")) {
    event.respondWith(networkFirst(request, DATA_CACHE));
    return;
  }

  if (["script", "style", "image", "font", "manifest"].includes(request.destination)) {
    event.respondWith(cacheFirst(request, CACHE_VERSION));
  }
});
