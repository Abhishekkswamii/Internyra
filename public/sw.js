/*
 * Internyra service worker — app-shell caching only.
 *
 * - Never caches /api/* responses or any non-GET request (inspections need the server;
 *   offline submissions fail visibly instead of producing a fake result).
 * - Page HTML is a client-rendered shell with no account or report data (that is fetched from the
 *   authenticated API at runtime), so caching it is safe and lets the shell open offline.
 * - Static build assets are cached on first use.
 */

const VERSION = "internyra-shell-v2";
const SHELL = ["/", "/app", "/app/verify", "/app/settings", "/manifest.json", "/brand/logo-icon.svg", "/brand/favicon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Immutable build assets: cache-first.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(VERSION).then((c) => c.put(request, copy));
            }
            return res;
          })
      )
    );
    return;
  }

  // Page navigations: network-first, fall back to the cached page or the dashboard shell.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok && res.type === "basic") {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() =>
          caches.match(request).then((hit) => hit || caches.match("/app")).then(
            (hit) => hit || new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } })
          )
        )
    );
  }
});
