const CACHE_NAME = "needle-v4";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
      ),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  // Page loads stay with the browser. Following the sign-in redirect from
  // here stores the session cookie after the next page has already rendered.
  if (event.request.mode === "navigate") return;

  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request)),
  );
});
