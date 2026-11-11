/*
 * Internyra service worker.
 *
 * SECURITY MODEL: only public, immutable static assets and one generic offline page are cached.
 * - No HTML page is ever stored (so no authenticated shell survives logout or is readable offline).
 * - /api/*, non-GET requests, cross-origin requests (Firebase Auth/Firestore/Google) are never touched.
 * - The page makes no claim about stale data: navigation failures show /offline.html.
 * - On logout the page sends CLEAR_CACHES and every cache is deleted.
 * - New versions wait until the user chooses to update (SKIP_WAITING message), so open forms are not discarded.
 */
const VERSION = "internyra-static-v3";
const PRECACHE = ["/offline.html", "/brand/icon-192.png", "/brand/logo-icon.svg", "/brand/favicon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(PRECACHE)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
  if (event.data === "CLEAR_CACHES") {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))));
  }
});

function isStaticAsset(url) {
  return url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/brand/") || url.pathname.startsWith("/images/");
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok && res.type === "basic") {
              const copy = res.clone();
              caches.open(VERSION).then((c) => c.put(request, copy));
            }
            return res;
          })
      )
    );
    return;
  }

  // Pages: always the network. Only when it is unreachable show the generic offline page.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/offline.html").then((r) => r || new Response("Offline", { status: 503 })))
    );
  }
});
