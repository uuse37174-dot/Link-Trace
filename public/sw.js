// Service Worker for Link Click Tracker PWA
const CACHE_NAME = "clicktracker-v1";
const ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/pwa-icon.jpg"
];

// Install Event
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Caching app shell and core assets");
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate Event
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("[Service Worker] Removing old cache", key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event (Network-first fallback to Cache for offline support)
self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);

  // Bypass service worker caching for API routes and redirect paths (/api/*, /t/*, /track/*)
  if (
    requestUrl.pathname.startsWith("/api/") ||
    requestUrl.pathname.startsWith("/t/") ||
    requestUrl.pathname.startsWith("/track/")
  ) {
    return; // Let browser process fetch directly via network
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // If valid response, update cache dynamically for next time
        if (response && response.status === 200 && response.type === "basic") {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // If network fails, serve from cache
        return caches.match(event.request);
      })
  );
});
