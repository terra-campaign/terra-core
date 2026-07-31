// ======================================================
// TERRA Campaign
// PWA ENGINE — RELEASE v1.0.1
// ======================================================

const CACHE_NAME = "terra-campaign-v1.0.1";

const APP_SHELL = [
  "./",
  "./index.html",
  "./login.html",
  "./admin.html",

  "./styles.css",

  "./project-config.js",
  "./firebase-config.js",
  "./app.js",
  "./login.js",
  "./admin.js",
  "./js/maps.js",

  "./manifest.json"
];

// ======================================================
// INSTALL
// ======================================================

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
  );

  self.skipWaiting();
});

// ======================================================
// ACTIVATE
// ======================================================

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ======================================================
// FETCH
// ======================================================

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  // No intervenir en extensiones ni protocolos incompatibles
  if (
    url.protocol !== "http:" &&
    url.protocol !== "https:"
  ) {
    return;
  }

  // No guardar recursos externos
  if (url.origin !== self.location.origin) {
    return;
  }

  const isHtml =
    request.mode === "navigate";

  const isJavaScript =
    url.pathname.endsWith(".js");

  const isCss =
    url.pathname.endsWith(".css");

  const isManifest =
    url.pathname.endsWith(".json");

  // ====================================================
  // NETWORK FIRST
  // HTML + JavaScript + CSS + JSON
  // ====================================================

  if (
    isHtml ||
    isJavaScript ||
    isCss ||
    isManifest
  ) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (!response || !response.ok) {
            return response;
          }

          const copy = response.clone();

          caches
            .open(CACHE_NAME)
            .then((cache) =>
              cache.put(request, copy)
            );

          return response;
        })
        .catch(async () => {
          const cachedResponse =
            await caches.match(request);

          if (cachedResponse) {
            return cachedResponse;
          }

          if (isHtml) {
            return caches.match("./index.html");
          }

          throw new Error(
            "Recurso no disponible."
          );
        })
    );

    return;
  }

  // ====================================================
  // CACHE FIRST
  // Imágenes e iconos
  // ====================================================

  event.respondWith(
    caches
      .match(request)
      .then(async (cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        const networkResponse =
          await fetch(request);

        if (
          networkResponse &&
          networkResponse.ok
        ) {
          const copy =
            networkResponse.clone();

          const cache =
            await caches.open(CACHE_NAME);

          await cache.put(request, copy);
        }

        return networkResponse;
      })
  );
});