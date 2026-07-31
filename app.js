// ======================================================
// TERRA CAMPAIGN
// Pantalla inicial — BUILD-001
// ======================================================

import { app } from "./firebase-config.js";
import { PROJECT_CONFIG } from "./project-config.js";

const connectionStatus = document.querySelector("#connectionStatus");
const firebaseState = document.querySelector("#firebaseState");
const mapsState = document.querySelector("#mapsState");
const pwaState = document.querySelector("#pwaState");

// ------------------------------------------------------
// Estado de conexión a internet
// ------------------------------------------------------

function updateConnectionStatus() {
  const online = navigator.onLine;

  connectionStatus.textContent = online
    ? "En línea"
    : "Sin conexión";

  connectionStatus.className = online
    ? "status status--online"
    : "status status--offline";
}

// ------------------------------------------------------
// Estado de Firebase
// ------------------------------------------------------

if (app) {
  firebaseState.textContent = "Conectado";
} else {
  firebaseState.textContent = "Error de configuración";
}

// ------------------------------------------------------
// Estado de Google Maps
// ------------------------------------------------------

const googleMapsConfigured =
  PROJECT_CONFIG.googleMapsApiKey &&
  !PROJECT_CONFIG.googleMapsApiKey.includes("REEMPLAZAR");

mapsState.textContent = googleMapsConfigured
  ? "Configurado"
  : "Pendiente de configurar";

// ------------------------------------------------------
// Registro de la PWA
// ------------------------------------------------------

if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("./service-worker.js")
    .then(() => {
      pwaState.textContent = "Service worker activo";
    })
    .catch((error) => {
      console.error("Error al registrar el service worker:", error);
      pwaState.textContent = "Error en PWA";
    });
} else {
  pwaState.textContent = "No compatible";
}

// ------------------------------------------------------
// Eventos de conexión
// ------------------------------------------------------

updateConnectionStatus();

window.addEventListener("online", updateConnectionStatus);
window.addEventListener("offline", updateConnectionStatus);


// ======================================================
// REGISTRO DEL SERVICE WORKER
// ======================================================

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const registration =
        await navigator.serviceWorker.register(
          "./service-worker.js"
        );

      console.log(
        "Service Worker registrado:",
        registration.scope
      );
    } catch (error) {
      console.error(
        "No fue posible registrar el Service Worker:",
        error
      );
    }
  });
}