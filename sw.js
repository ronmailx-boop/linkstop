// Service Worker מינימלי - נדרש להתקנת ה-PWA (Add to Home Screen) ולתפריט השיתוף באנדרואיד.
// לא מיועד ל-offline caching מלא של תוכן (הוחלט שאינו קריטי ל-v1).
const CACHE_NAME = "linkstop-shell-v3";
const APP_SHELL = [
  "/linkstop/index.html",
  "/linkstop/share-target.html",
  "/linkstop/manifest.json",
  "/linkstop/src/css/style.css",
  "/linkstop/src/js/app.js",
  "/linkstop/src/js/share-handler.js",
  "/linkstop/src/js/storage.js",
  "/linkstop/src/js/metadata.js",
  "/linkstop/src/js/config.js",
  "/linkstop/src/icons/icon-192.png",
  "/linkstop/src/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// network-first: תמיד מנסה קודם רשת (כדי שעדכונים יגיעו מיד), ונופל למטמון רק כשאין רשת.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
