const CACHE_VERSION = "pickagame-runtime-v1";
const NAVIGATION_CACHE = "pickagame-navigation-v1";
const DATA_CACHE = "pickagame-data-v1";
const META_CACHE = "pickagame-meta-v1";
const SKIP_WAITING_MESSAGE = "SKIP_WAITING";
const UPDATE_NOTIFICATION_PREFS_MESSAGE = "UPDATE_NOTIFICATION_PREFS";
const TOP_GAMES_UPDATED_MESSAGE = "TOP_GAMES_UPDATED";
const NOTIFICATION_PREFS_KEY = `${self.location.origin}/__meta/notification-prefs`;
const DEFAULT_NOTIFICATION_PREFS = {
  enabled: false,
  newTrends: false,
};

self.addEventListener("install", () => {
  // Wait for explicit user confirmation before activating a new service worker.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => ![CACHE_VERSION, NAVIGATION_CACHE, DATA_CACHE, META_CACHE].includes(name))
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

const readNotificationPrefs = async () => {
  const cache = await caches.open(META_CACHE);
  const cached = await cache.match(NOTIFICATION_PREFS_KEY);
  if (!cached) return DEFAULT_NOTIFICATION_PREFS;
  try {
    const parsed = await cached.json();
    return {
      enabled: Boolean(parsed?.enabled),
      newTrends: Boolean(parsed?.newTrends),
    };
  } catch {
    return DEFAULT_NOTIFICATION_PREFS;
  }
};

const writeNotificationPrefs = async (prefs) => {
  const cache = await caches.open(META_CACHE);
  const safePrefs = {
    enabled: Boolean(prefs?.enabled),
    newTrends: Boolean(prefs?.newTrends),
  };
  await cache.put(
    NOTIFICATION_PREFS_KEY,
    new Response(JSON.stringify(safePrefs), {
      headers: {
        "content-type": "application/json",
      },
    }),
  );
};

const notifyTopGamesUpdate = async () => {
  const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  clients.forEach((client) => {
    client.postMessage({ type: TOP_GAMES_UPDATED_MESSAGE });
  });

  const prefs = await readNotificationPrefs();
  if (!prefs.enabled || !prefs.newTrends) return;
  if (!self.registration?.showNotification) return;
  if (!("Notification" in self) || self.Notification.permission !== "granted") return;

  await self.registration.showNotification("New game trends available", {
    body: "Top game rankings were refreshed. Spin again to use fresh data.",
    tag: "pickagame-top-games-updated",
    renotify: true,
  });
};

const networkFirstTopGames = async (request) => {
  const cache = await caches.open(DATA_CACHE);
  const cached = await cache.match(request);
  let previousBody = "";
  if (cached) {
    try {
      previousBody = await cached.clone().text();
    } catch {
      previousBody = "";
    }
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
      let nextBody = "";
      try {
        nextBody = await response.clone().text();
      } catch {
        nextBody = "";
      }
      if (cached && nextBody && nextBody !== previousBody) {
        await notifyTopGamesUpdate();
      }
    }
    return response;
  } catch {
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
    event.respondWith(networkFirstTopGames(request));
    return;
  }

  if (["script", "style", "image", "font", "manifest"].includes(request.destination)) {
    event.respondWith(cacheFirst(request, CACHE_VERSION));
  }
});

self.addEventListener("message", (event) => {
  if (event.data?.type === SKIP_WAITING_MESSAGE) {
    self.skipWaiting();
    return;
  }

  if (event.data?.type === UPDATE_NOTIFICATION_PREFS_MESSAGE) {
    event.waitUntil(writeNotificationPrefs(event.data.payload));
  }
});
