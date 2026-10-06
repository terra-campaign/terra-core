// ======================================================
// TERRA CAMPAIGN
// Pantalla inicial — BUILD-001
// ======================================================

import { app, auth, db } from "./firebase-config.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { PROJECT_CONFIG } from "./project-config.js";

const connectionStatus =
  document.querySelector("#connectionStatus");

const firebaseState =
  document.querySelector("#firebaseState");

const mapsState =
  document.querySelector("#mapsState");

const pwaState =
  document.querySelector("#pwaState");

const myPerformanceButton =
  document.querySelector("#myPerformanceButton");


// ------------------------------------------------------
// Acceso personal a Mi Desempeno
// ------------------------------------------------------

onAuthStateChanged(
  auth,
  async (user) => {

    if (!myPerformanceButton) {
      return;
    }

    myPerformanceButton.hidden = true;
    myPerformanceButton.href =
      "./persona.html";

    if (!user) {
      return;
    }

    try {

      const snapshot =
        await getDoc(
          doc(
            db,
            "usuarios",
            user.uid
          )
        );

      if (!snapshot.exists()) {
        return;
      }

      const profile =
        snapshot.data() || {};

      const personId =
        String(
          profile.personId || ""
        ).trim();

      if (!personId) {
        return;
      }

      myPerformanceButton.href =
        "./persona.html?id=" +
        encodeURIComponent(personId);

      myPerformanceButton.hidden = false;

    } catch (error) {

      console.error(
        "No fue posible resolver el personId para Mi desempe\u00f1o:",
        error
      );
    }
  }
);



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

firebaseState.textContent = app
  ? "Conectado"
  : "Error de configuración";


// ------------------------------------------------------
// Estado de Google Maps
// ------------------------------------------------------

const googleMapsConfigured =
  Boolean(PROJECT_CONFIG.googleMapsApiKey) &&
  !PROJECT_CONFIG.googleMapsApiKey.includes(
    "REEMPLAZAR"
  );

mapsState.textContent = googleMapsConfigured
  ? "Configurado"
  : "Pendiente de configurar";


// ------------------------------------------------------
// Registro único del Service Worker
// ------------------------------------------------------

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    pwaState.textContent = "No compatible";
    return;
  }

  try {
    const registration =
      await navigator.serviceWorker.register(
        "./service-worker.js",
        {
          scope: "./"
        }
      );

    pwaState.textContent =
      "Service worker activo";

    console.log(
      "Service Worker registrado:",
      registration.scope
    );
  } catch (error) {
    console.error(
      "Error al registrar el Service Worker:",
      error
    );

    pwaState.textContent =
      "Error en PWA";
  }
}


// ------------------------------------------------------
// Inicio
// ------------------------------------------------------

updateConnectionStatus();

window.addEventListener(
  "online",
  updateConnectionStatus
);

window.addEventListener(
  "offline",
  updateConnectionStatus
);

window.addEventListener(
  "load",
  registerServiceWorker
);