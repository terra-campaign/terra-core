// ======================================================
// TERRA Campaign
// BUILD-001
// PWA ENGINE v2
// ======================================================

const CACHE_NAME = "terra-campaign-build-001";

const APP_SHELL = [

    "./",
    "./index.html",
    "./login.html",
    "./admin.html",

    "./styles.css",

    "./project-config.js",
    "./firebase-config.js",
    "./login.js",
    "./admin.js",

    "./manifest.json"

];


//======================================================
// INSTALL
//======================================================

self.addEventListener("install", event => {

    event.waitUntil(

        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(APP_SHELL))

    );

    self.skipWaiting();

});


//======================================================
// ACTIVATE
//======================================================

self.addEventListener("activate", event => {

    event.waitUntil(

        caches.keys().then(keys =>

            Promise.all(

                keys
                    .filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))

            )

        )

    );

    self.clients.claim();

});


//======================================================
// FETCH
//======================================================

self.addEventListener("fetch", event => {

    if (event.request.method !== "GET") {
        return;
    }

    const url = new URL(event.request.url);

    const isHtml =
        event.request.mode === "navigate";

    const isJavaScript =
        url.pathname.endsWith(".js");

    const isManifest =
        url.pathname.endsWith(".json");



    //--------------------------------------------------
    // NETWORK FIRST
    // HTML + JS + JSON
    //--------------------------------------------------

    if (isHtml || isJavaScript || isManifest) {

        event.respondWith(

            fetch(event.request)

                .then(response => {

                    const copy =
                        response.clone();

                    caches
                        .open(CACHE_NAME)
                        .then(cache =>
                            cache.put(event.request, copy)
                        );

                    return response;

                })

                .catch(() =>
                    caches.match(event.request)
                )

        );

        return;

    }



    //--------------------------------------------------
    // CACHE FIRST
    // imágenes, css, iconos...
    //--------------------------------------------------

    event.respondWith(

        caches.match(event.request)

            .then(cache => {

                if (cache)
                    return cache;

                return fetch(event.request)

                    .then(response => {

                        const copy =
                            response.clone();

                        caches
                            .open(CACHE_NAME)
                            .then(c =>
                                c.put(event.request, copy)
                            );

                        return response;

                    });

            })

    );

});