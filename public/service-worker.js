// public/service-worker.js
// 🧩 Neutral SW — does nothing, ensures clean bypass for APIs

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  // ✅ Always let /api requests hit the server directly
  if (url.pathname.startsWith("/api/")) return;
  // no caching, no intercepting anything
});
