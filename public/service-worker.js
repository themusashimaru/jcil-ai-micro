// public/service-worker.js

// keep the worker alive
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// IMPORTANT: do NOT intercept API calls
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // let all /api/* requests go straight to the server
  if (url.pathname.startsWith("/api/")) {
    return; // no respondWith -> browser uses network
  }

  // you can add other caching here later if you want
});
