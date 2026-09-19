// ======================================================
// TERRA CAMPAIGN
// Panel operativo + Firestore + Google Maps
// BUILD-002
// ======================================================

import {
  auth,
  db,
  storage
} from "./firebase-config.js";



import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";


import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


import {
  ref,
  uploadBytes
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-storage.js";


import {
  getFunctions,
  httpsCallable
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js";

const terraFunctions =
  getFunctions(auth.app, "us-central1");

const getMyTerritorialAccessCall =
  httpsCallable(
    terraFunctions,
    "getMyTerritorialAccess"
  );




import {
  initializeTerritoryMap,
  renderVisitMarkers,
  showCurrentLocation,
  centerTerritoryMap
} from "./js/maps.js";

import {
  loadTerritorialEvidenceImage,
  releaseTerritorialEvidence
} from "./js/territorial-evidence.js";

// ======================================================
// ELEMENTOS DE PANTALLA
// ======================================================

const logoutButton =
  document.querySelector("#logoutButton");

const brigadistasAdminButton =
  document.querySelector("#brigadistasAdminButton");

const brigadasAdminButton =
  document.querySelector("#brigadasAdminButton");

const municipalitiesButton =
  document.querySelector("#municipalitiesButton");

const missionsButton =
  document.querySelector("#missionsButton");

const eventsButton =
  document.querySelector("#eventsButton");

const organizationButton =
  document.querySelector("#organizationButton");

const visitForm =
  document.querySelector("#visitForm");

const streetInput =
  document.querySelector("#street");

const houseNumberInput =
  document.querySelector("#houseNumber");

const neighborhoodInput =
  document.querySelector("#neighborhood");

const localityInput =
  document.querySelector("#locality");

const adultsInput =
  document.querySelector("#adults");

const citizenNameInput =
  document.querySelector("#citizenName");

const citizenPhoneInput =
  document.querySelector("#citizenPhone");

const observationsInput =
  document.querySelector("#observations");

const duplicateAddressWarning =
  document.querySelector("#duplicateAddressWarning");

const visitResultInput =
  document.querySelector("#visitResult");

const votingIntentionInput =
  document.querySelector("#votingIntention");

const locationButton =
  document.querySelector("#locationButton");

const centerMapButton =
  document.querySelector("#centerMapButton");

const locationStatus =
  document.querySelector("#locationStatus");

const mapMessage =
  document.querySelector("#mapMessage");

const latitudeInput =
  document.querySelector("#latitude");

const longitudeInput =
  document.querySelector("#longitude");

const saveVisitButton =
  document.querySelector("#saveVisitButton");

const visitMessage =
  document.querySelector("#visitMessage");

const photoButton =
  document.querySelector("#photoButton");

const photoInput =
  document.querySelector("#photo");

const photoPreview =
  document.querySelector("#photoPreview");

const photoStatus =
  document.querySelector("#photoStatus");

const totalVisitsElement =
  document.querySelector("#totalVisits");

const totalFlyersElement =
  document.querySelector("#totalFlyers");

const totalAnswersElement =
  document.querySelector("#totalAnswers");

const totalSupportElement =
  document.querySelector("#totalSupport");

const totalUndecidedElement =
  document.querySelector("#totalUndecided");

const totalOtherOptionElement =
  document.querySelector("#totalOtherOption");

const totalFollowUpsElement =
  document.querySelector("#totalFollowUps");

const visitsList =
  document.querySelector("#visitsList");

const territoryFilters =
  document.querySelectorAll(".territory-filter");

// Resultado de visita → Intención de voto
// =====================================================

function applyVisitResultRules() {

    const visitResult =
        visitResultInput.value;

    // Sin resultado seleccionado
    if (!visitResult) {

        votingIntentionInput.value = "";
        votingIntentionInput.disabled = true;
        votingIntentionInput.required = false;

        return;
    }

    // Hubo contacto con la persona
    // La intención debe seleccionarse manualmente
    if (visitResult === "flyer_entregado") {

        votingIntentionInput.disabled = false;
        votingIntentionInput.required = true;
        votingIntentionInput.value = "";

        return;
    }

    // La persona se negó a responder
    if (visitResult === "se_nego") {

        votingIntentionInput.value =
            "no_respondio";

        votingIntentionInput.disabled = true;
        votingIntentionInput.required = false;

        return;
    }

    // No se realizó la pregunta
    if (
        visitResult === "no_estaba" ||
        visitResult === "no_estaba_flyer" ||
        visitResult === "volver" ||
        visitResult === "deshabitado"
    ) {

        votingIntentionInput.value =
            "no_aplica";

        votingIntentionInput.disabled = true;
        votingIntentionInput.required = false;

        return;
    }
}

visitResultInput.addEventListener(
    "change",
    applyVisitResultRules
);

applyVisitResultRules();


// ======================================================
// MODAL DOMICILIO DUPLICADO
// ======================================================

const duplicateVisitModal =
  document.querySelector("#duplicateVisitModal");

const duplicateVisitDetails =
  document.querySelector("#duplicateVisitDetails");

const duplicateVisitPhoto =
  document.querySelector("#duplicateVisitPhoto");

const confirmDuplicateVisitButton =
  document.querySelector("#confirmDuplicateVisitButton");

const cancelDuplicateVisitButton =
  document.querySelector("#cancelDuplicateVisitButton");



// ======================================================
// ESTADO
// ======================================================

let currentUser = null;
let currentUserProfile = null;
let latestVisits = [];
let filteredVisits = [];

let activeFilter = "all";
let mapReady = false;

let currentTerritorialAccess = null;
let territorialAccessTimer = null;
let visitsUnsubscribe = null;




let selectedPhoto = null;
let previewPhotoUrl = "";

// ======================================================
// BUILD-104A — CARGAR PERFIL Y ROL DEL USUARIO
// ======================================================

async function loadCurrentUserProfile(user) {

  const userRef =
    doc(db, "usuarios", user.uid);

  const userSnapshot =
    await getDoc(userRef);

  if (!userSnapshot.exists()) {
    throw new Error(
      "El usuario no tiene perfil autorizado."
    );
  }

  const profile = {
    uid: userSnapshot.id,
    ...userSnapshot.data()
  };

  if (profile.active !== true) {
    throw new Error(
      "El usuario está desactivado."
    );
  }

  const allowedRoles = [
  "admin",
  "coordinador",
  "coordinador_municipal",
  "jefe_estructura",
  "integrante",
  "participante",
  "colaborador_base",
  "brigadista",
  "consulta",
  "lider_principal"
];

  if (!allowedRoles.includes(profile.role)) {
    throw new Error(
      "El usuario no tiene un rol válido."
    );
  }

  return profile;
}


// ======================================================
// INTERFAZ SEGÚN ROL
// ======================================================

function applyRoleInterface() {
  if (!currentUserProfile) {
    return;
  }

  const role = currentUserProfile.role;
  const isAdmin = role === "admin";

  const canManageBrigadistas =
    isAdmin || role === "coordinador";

  const canAccessOrganization = [
    "coordinador_municipal",
    "jefe_estructura",
    "integrante",
    "participante"
  ].includes(role);

  const canAccessMissions = [
    "admin",
    "coordinador_municipal",
    "jefe_estructura",
    "integrante",
    "participante",
    "colaborador_base"
  ].includes(role);

  const canAccessEvents = [
    "admin",
    "coordinador_municipal",
    "jefe_estructura",
    "integrante",
    "participante",
    "colaborador_base"
  ].includes(role);

  if (brigadistasAdminButton) {
    brigadistasAdminButton.hidden = !canManageBrigadistas;
  }

  if (brigadasAdminButton) {
    brigadasAdminButton.hidden = !isAdmin;
  }

  if (municipalitiesButton) {
    municipalitiesButton.hidden = !isAdmin;
  }

  if (organizationButton) {
    organizationButton.hidden = !canAccessOrganization;
    organizationButton.textContent = "Mi organización";
    organizationButton.removeAttribute("href");

    if (
      role === "coordinador_municipal" &&
      currentUserProfile.municipalityId
    ) {
      organizationButton.href =
        `./municipio.html?id=${encodeURIComponent(
          currentUserProfile.municipalityId
        )}`;
    }

    if (role === "integrante" && currentUser?.uid) {
      organizationButton.href =
        `./participantes.html?id=${encodeURIComponent(
          currentUser.uid
        )}`;
    }

    if (role === "participante" && currentUser?.uid) {
      organizationButton.href =
        `./colaboradores.html?id=${encodeURIComponent(
          currentUser.uid
        )}`;
    }

    // El Responsable de estructura obtiene el documento
    // de su estructura al pulsar el botón.
  }

  if (missionsButton) {
    missionsButton.hidden = !canAccessMissions;
  }

  if (eventsButton) {
    eventsButton.hidden = !canAccessEvents;
  }

  // BUILD-119A3:
  // La jerarquía controla navegación y organización.
  // El acceso territorial se decide exclusivamente
  // mediante territorialAccessGrant.
}

// ======================================================
// MI ORGANIZACIÓN
// ======================================================

let openingOrganization = false;

organizationButton?.addEventListener("click", async (event) => {
  event.preventDefault();

  if (openingOrganization) {
    return;
  }

  const user = currentUser;
  const profile = currentUserProfile;

  if (
    !user ||
    auth.currentUser?.uid !== user.uid ||
    profile?.active !== true ||
    !profile.campaignId
  ) {
    alert("No fue posible validar tu sesión. Inicia sesión nuevamente.");
    return;
  }

  openingOrganization = true;
  organizationButton.textContent = "Abriendo...";
  organizationButton.setAttribute("aria-busy", "true");

  try {
    let destination = "";

    switch (profile.role) {
      case "coordinador_municipal": {
        if (!profile.municipalityId) {
          throw new Error("No tienes un municipio asignado.");
        }

        destination =
          `./municipio.html?id=${encodeURIComponent(
            profile.municipalityId
          )}`;

        break;
      }

      case "jefe_estructura": {
        if (
          typeof profile.structureId !== "string" ||
          !profile.structureId.trim()
        ) {
          throw new Error("No tienes una estructura asignada.");
        }

        // structureId contiene el identificador operativo,
        // por ejemplo EST-002. La página necesita el ID
        // del documento de Firestore.
        const structureQuery = query(
          collection(db, "estructuras"),
          where("campaignId", "==", profile.campaignId),
          where("id", "==", profile.structureId),
          limit(2)
        );

        const snapshot = await getDocs(structureQuery);

        if (snapshot.empty) {
          throw new Error("No se encontró tu estructura asignada.");
        }

        if (snapshot.size !== 1) {
          throw new Error(
            "Hay más de una estructura con ese identificador. " +
            "Solicita al administrador revisar la asignación."
          );
        }

        destination =
          `./estructura.html?id=${encodeURIComponent(
            snapshot.docs[0].id
          )}`;

        break;
      }

      case "integrante": {
        destination =
          `./participantes.html?id=${encodeURIComponent(user.uid)}`;

        break;
      }

      case "participante": {
        destination =
          `./colaboradores.html?id=${encodeURIComponent(user.uid)}`;

        break;
      }

      default:
        throw new Error("Tu rol no tiene acceso a esta sección.");
    }

    // Evitar navegar si la sesión cambió durante la consulta.
    if (
      auth.currentUser?.uid !== user.uid ||
      currentUserProfile !== profile
    ) {
      return;
    }

    window.location.href = destination;
  } catch (error) {
    console.error("Error al abrir Mi organización:", error);

    if (auth.currentUser?.uid === user.uid) {
      alert(
        error.code === "permission-denied"
          ? "No tienes permisos para consultar la organización asignada."
          : error.message || "No fue posible abrir tu organización."
      );
    }
  } finally {
    openingOrganization = false;
    organizationButton.textContent = "Mi organización";
    organizationButton.removeAttribute("aria-busy");
  }
});




// ======================================================
// BUILD-119A3 — GATE TERRITORIAL SEGURO
// ======================================================

function territorialMainWorkspace() {
  return document.querySelector("main");
}

function ensureTerritorialAccessPanel() {
  let panel =
    document.querySelector("#territorialAccessPanel");

  if (panel) {
    return panel;
  }

  panel = document.createElement("section");
  panel.id = "territorialAccessPanel";
  panel.className = "card shell";
  panel.hidden = true;
  panel.setAttribute("role", "status");
  panel.setAttribute("aria-live", "polite");

  const main =
    territorialMainWorkspace();

  if (main) {
    main.before(panel);
  }

  return panel;
}

function stopTerritorialVisitListener() {
  if (typeof visitsUnsubscribe === "function") {
    visitsUnsubscribe();
  }

  visitsUnsubscribe = null;
}

function clearTerritorialAccessTimer() {
  if (territorialAccessTimer) {
    clearTimeout(territorialAccessTimer);
    territorialAccessTimer = null;
  }
}

function formatTerritorialExpiration(value) {
  if (!Number.isFinite(value)) {
    return "";
  }

  return new Date(value).toLocaleString(
    "es-MX"
  );
}

function blockTerritorialWorkspace(message) {

  releaseTerritorialEvidence();
  currentTerritorialAccess = null;

  clearTerritorialAccessTimer();
  stopTerritorialVisitListener();

  latestVisits = [];

  const main =
    territorialMainWorkspace();

  if (main) {
    main.hidden = true;
  }

  if (visitForm) {
    visitForm.hidden = true;
  }

  if (saveVisitButton) {
    saveVisitButton.disabled = true;
  }

  const panel =
    ensureTerritorialAccessPanel();

  panel.hidden = false;
  panel.innerHTML = "";

  const title =
    document.createElement("h2");

  title.textContent =
    "Acceso territorial no autorizado";

  const detail =
    document.createElement("p");

  detail.textContent =
    message ||
    "No tienes una autorización territorial vigente.";

  panel.append(
    title,
    detail
  );
}

function applyTerritorialWorkspaceAccess(access) {
  currentTerritorialAccess = access;

  const main =
    territorialMainWorkspace();

  if (main) {
    main.hidden = false;
  }

  const panel =
    ensureTerritorialAccessPanel();

  const grant =
    access?.grant || {};

  const canWrite =
    access?.write === true;

  if (visitForm) {
    visitForm.hidden = !canWrite;
  }

  if (saveVisitButton) {
    saveVisitButton.disabled = !canWrite;
  }

  if (
    grant.mode === "demo"
  ) {
    panel.hidden = false;
    panel.innerHTML = "";

    const title =
      document.createElement("h2");

    title.textContent =
      "MODO DEMOSTRACIÓN";

    const detail =
      document.createElement("p");

    detail.textContent =
      `Acceso territorial temporal. ${
        canWrite
          ? "Consulta y registro habilitados."
          : "Solo consulta."
      } Vence: ${
        formatTerritorialExpiration(
          grant.expiresAt
        )
      }.`;

    panel.append(
      title,
      detail
    );

  } else if (!canWrite) {
    panel.hidden = false;
    panel.innerHTML = "";

    const title =
      document.createElement("h2");

    title.textContent =
      "Acceso territorial de consulta";

    const detail =
      document.createElement("p");

    detail.textContent =
      "Puedes consultar el territorio autorizado, pero no registrar visitas.";

    panel.append(
      title,
      detail
    );

  } else {
    panel.hidden = true;
    panel.innerHTML = "";
  }
}

function scheduleTerritorialAccessValidation(access) {
  clearTerritorialAccessTimer();

  const expiresAt =
    Number(access?.grant?.expiresAt || 0);

  const untilExpiration =
    expiresAt > Date.now()
      ? expiresAt - Date.now() + 250
      : 500;

  const delay =
    Math.max(
      500,
      Math.min(
        30000,
        untilExpiration
      )
    );

  territorialAccessTimer =
    setTimeout(
      async () => {
        const wasAuthorized =
          currentTerritorialAccess?.read === true;

        const accessNow =
          await validateTerritorialAccess();

        if (
          accessNow &&
          wasAuthorized &&
          mapReady
        ) {
          stopTerritorialVisitListener();
          listenVisits();
        }
      },
      delay
    );
}

async function validateTerritorialAccess() {
  try {
    const response =
      await getMyTerritorialAccessCall({});

    const access =
      response?.data || null;

    if (
      !access ||
      access.authorized !== true ||
      access.read !== true
    ) {
      blockTerritorialWorkspace(
        "No existe una autorización territorial vigente con permiso de consulta."
      );

      return null;
    }

    applyTerritorialWorkspaceAccess(
      access
    );

    scheduleTerritorialAccessValidation(
      access
    );

    return access;

  } catch (error) {
    console.error(
      "Error al validar acceso territorial:",
      error
    );

    blockTerritorialWorkspace(
      "No fue posible validar una autorización territorial vigente."
    );

    return null;
  }
}


// ======================================================
// INICIO DE SESIÓN Y MAPA
// ======================================================

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "./login.html";
    return;
  }

  currentUser = user;

  try {
    currentUserProfile =
      await loadCurrentUserProfile(user);


      if (currentUserProfile.role === "lider_principal") {
        window.location.replace("./direccion.html");
        return;
      }
      if (currentUserProfile.role === "admin") {
        const link = document.createElement("a");
        link.href = "./direccion.html";
        link.textContent = "Panel de dirección";
        link.className = "button button--secondary";
        document.querySelector("main").prepend(link);
      }
      applyRoleInterface();


    console.log(
      "Perfil autorizado:",
      currentUserProfile
    );

    const territorialAccess =
      await validateTerritorialAccess();

    if (!territorialAccess) {
      return;
    }

    mapReady =
      await initializeTerritoryMap();

    listenVisits();

  } catch (error) {
    console.error(
      "Acceso rechazado:",
      error
    );

    mapMessage.textContent =
      error.message ||
      "No fue posible validar el acceso.";

    visitMessage.textContent =
      "Acceso no autorizado.";

    visitForm.hidden = true;

    setTimeout(async () => {
      await signOut(auth);
      window.location.href =
        "./login.html";
    }, 2500);
  }
});

// ======================================================
// CERRAR SESIÓN
// ======================================================

logoutButton.addEventListener("click", async () => {
  logoutButton.disabled = true;
  logoutButton.textContent = "Saliendo...";

  try {
    await signOut(auth);
    window.location.href = "./login.html";
  } catch (error) {
    console.error("Error al cerrar sesión:", error);

    logoutButton.disabled = false;
    logoutButton.textContent = "Salir";

    alert("No fue posible cerrar la sesión.");
  }
});

// ======================================================
// OBTENER UBICACIÓN GPS
// ======================================================

locationButton.addEventListener("click", () => {
  captureCurrentLocation();
});

// ======================================================
// BOTÓN MI UBICACIÓN
// ======================================================

centerMapButton.addEventListener("click", () => {
  const latitude = Number(latitudeInput.value);
  const longitude = Number(longitudeInput.value);

  if (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude)
  ) {
    centerTerritoryMap(latitude, longitude, 19);
    return;
  }

  captureCurrentLocation();
});

// ======================================================
// CAPTURAR GPS
// ======================================================

function captureCurrentLocation() {
  if (!navigator.geolocation) {
    locationStatus.textContent =
      "Este dispositivo no permite obtener ubicación GPS.";

    return;
  }

  locationButton.disabled = true;
  centerMapButton.disabled = true;

  locationButton.textContent = "Obteniendo ubicación...";
  locationStatus.textContent =
    "Esperando la ubicación del dispositivo...";

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;
      const accuracy = position.coords.accuracy;

      latitudeInput.value = String(latitude);
      longitudeInput.value = String(longitude);

      locationStatus.textContent =
        `Ubicación capturada. Precisión aproximada: ${Math.round(accuracy)} metros.`;

      locationButton.textContent = "Actualizar ubicación GPS";
      locationButton.disabled = false;
      centerMapButton.disabled = false;

      if (mapReady) {
        await showCurrentLocation(latitude, longitude);
      }
    },

    (error) => {
      console.error("Error de geolocalización:", error);

      switch (error.code) {
        case error.PERMISSION_DENIED:
          locationStatus.textContent =
            "El permiso de ubicación fue rechazado.";
          break;

        case error.POSITION_UNAVAILABLE:
          locationStatus.textContent =
            "No fue posible obtener la ubicación.";
          break;

        case error.TIMEOUT:
          locationStatus.textContent =
            "El dispositivo tardó demasiado en obtener el GPS.";
          break;

        default:
          locationStatus.textContent =
            "Ocurrió un error al obtener la ubicación.";
      }

      locationButton.textContent = "Obtener ubicación GPS";
      locationButton.disabled = false;
      centerMapButton.disabled = false;
    },

    {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0
    }
  );
}


// ======================================================
// SELECCIONAR FOTOGRAFÍA
// ======================================================

photoInput.addEventListener("change", () => {
  const file = photoInput.files?.[0];

  if (!file) {
    selectedPhoto = null;

    photoPreview.removeAttribute("src");
    photoPreview.style.display = "none";

    photoStatus.textContent =
      "Fotografía todavía no capturada.";

    return;
  }

  if (!file.type.startsWith("image/")) {
    selectedPhoto = null;
    photoInput.value = "";

    photoPreview.removeAttribute("src");
    photoPreview.style.display = "none";

    photoStatus.textContent =
      "El archivo seleccionado no es una imagen.";

    return;
  }

  selectedPhoto = file;

  if (previewPhotoUrl) {
    URL.revokeObjectURL(previewPhotoUrl);
  }

  previewPhotoUrl = URL.createObjectURL(file);

  photoPreview.src = previewPhotoUrl;
  photoPreview.style.display = "block";

  photoStatus.textContent =
    "Fotografía lista para guardar.";
});


// ======================================================
// COMPRIMIR FOTOGRAFÍA
// ======================================================

async function compressPhoto(file) {
  const imageBitmap = await createImageBitmap(file);

  const maximumWidth = 1200;
  const maximumHeight = 1200;

  let targetWidth = imageBitmap.width;
  let targetHeight = imageBitmap.height;

  const reductionRatio = Math.min(
    maximumWidth / targetWidth,
    maximumHeight / targetHeight,
    1
  );

  targetWidth = Math.round(
    targetWidth * reductionRatio
  );

  targetHeight = Math.round(
    targetHeight * reductionRatio
  );

  const canvas =
    document.createElement("canvas");

  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context =
    canvas.getContext("2d");

  if (!context) {
    imageBitmap.close();

    throw new Error(
      "No fue posible preparar la fotografía."
    );
  }

  context.drawImage(
    imageBitmap,
    0,
    0,
    targetWidth,
    targetHeight
  );

  imageBitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(
            new Error(
              "No fue posible comprimir la fotografía."
            )
          );

          return;
        }

        resolve(blob);
      },
      "image/jpeg",
      0.72
    );
  });
}



// ======================================================
// NORMALIZAR DIRECCIÓN
// ======================================================

function normalizeAddress(
  street,
  houseNumber,
  neighborhood,
  locality
) {
  return `${street} ${houseNumber}, ${neighborhood}, ${locality}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,#-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ======================================================
// BUSCAR DOMICILIO YA VISITADO
// ======================================================
// ======================================================
// BUILD-101 — BUSCAR HISTORIAL DEL DOMICILIO
// ======================================================

function requireTerritorialReadAccess() {
  const access =
    currentTerritorialAccess;

  const grant =
    access?.grant;

  if (
    access?.read !== true ||
    !grant ||
    !currentUserProfile?.campaignId
  ) {
    throw new Error(
      "No existe autorización territorial vigente para consultar información."
    );
  }

  return grant;
}

async function requireTerritorialWriteAccess() {
  const access =
    await validateTerritorialAccess();

  const grant =
    access?.grant;

  const metadata =
    grant?.recordMetadata;

  if (
    access?.write !== true ||
    !grant ||
    !metadata ||
    !metadata.territorialGrantId ||
    !metadata.territorialPersonId
  ) {
    throw new Error(
      "No existe autorización territorial vigente para registrar visitas."
    );
  }

  return {
    access,
    grant,
    metadata
  };
}


function territorialVisitConstraints() {
  const grant =
    requireTerritorialReadAccess();

  const constraints = [
    where(
      "campaignId",
      "==",
      currentUserProfile.campaignId
    ),

    where(
      "recordMode",
      "==",
      grant.mode === "demo"
        ? "demo"
        : "production"
    )
  ];

  switch (grant.scopeType) {

    case "campaign":
      break;

    case "municipality":
      if (!grant.municipalityId) {
        throw new Error(
          "La autorización territorial no tiene municipio."
        );
      }

      constraints.push(
        where(
          "municipalityId",
          "==",
          grant.municipalityId
        )
      );

      break;

    case "structure":
      if (
        !grant.municipalityId ||
        !grant.structureId
      ) {
        throw new Error(
          "La autorización territorial no tiene estructura válida."
        );
      }

      constraints.push(
        where(
          "municipalityId",
          "==",
          grant.municipalityId
        ),

        where(
          "structureId",
          "==",
          grant.structureId
        )
      );

      break;

    case "brigade":
      if (!grant.brigadeId) {
        throw new Error(
          "La autorización territorial no tiene brigada."
        );
      }

      constraints.push(
        where(
          "brigadeId",
          "==",
          grant.brigadeId
        )
      );

      break;

    default:
      throw new Error(
        "Alcance territorial no autorizado."
      );
  }

  return constraints;
}


async function findVisitHistory(normalizedAddress) {

  if (!normalizedAddress) {
    return [];
  }

  const visitsQuery = query(
    collection(db, "visitas"),

    ...territorialVisitConstraints(),

    where(
      "normalizedAddress",
      "==",
      normalizedAddress
    ),

    limit(50)
  );


  const snapshot =
    await getDocs(visitsQuery);

  const visitHistory = [];

  snapshot.forEach((documentSnapshot) => {

    visitHistory.push({
      id: documentSnapshot.id,
      ...documentSnapshot.data()
    });

  });

  visitHistory.sort((a, b) => {

    const dateA =
      a.visitedAt?.seconds ||
      a.createdAt?.seconds ||
      0;

    const dateB =
      b.visitedAt?.seconds ||
      b.createdAt?.seconds ||
      0;

    return dateB - dateA;

  });

  return visitHistory;
}


// ======================================================
// BUILD-105 — DETECTOR DE DOMICILIO REPETIDO
// ======================================================

let duplicateAddressTimer = null;
let duplicateAddressRequest = 0;

function normalizeAddressPart(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildCurrentNormalizedAddress() {
  return [
    streetInput.value,
    houseNumberInput.value,
    neighborhoodInput.value,
    localityInput.value
  ]
    .map(normalizeAddressPart)
    .filter(Boolean)
    .join(" ");
}

function clearDuplicateAddressWarning() {
  duplicateAddressWarning.hidden = true;
  duplicateAddressWarning.innerHTML = "";
}

async function detectDuplicateAddress() {
  const street = streetInput.value.trim();
  const houseNumber = houseNumberInput.value.trim();
  const neighborhood = neighborhoodInput.value.trim();
  const locality = localityInput.value.trim();

  if (
    !street ||
    !houseNumber ||
    !neighborhood ||
    !locality
  ) {
    clearDuplicateAddressWarning();
    return;
  }

  const normalizedAddress =
    buildCurrentNormalizedAddress();

  if (!normalizedAddress) {
    clearDuplicateAddressWarning();
    return;
  }

  const requestId =
    ++duplicateAddressRequest;

  duplicateAddressWarning.hidden = false;

  duplicateAddressWarning.innerHTML = `
    <p style="margin:0;">
      Consultando antecedentes del domicilio...
    </p>
  `;

  try {
    const history =
      await findVisitHistory(normalizedAddress);

    // Ignora una respuesta vieja si el usuario siguió escribiendo.
    if (requestId !== duplicateAddressRequest) {
      return;
    }

    if (!history.length) {
      clearDuplicateAddressWarning();
      return;
    }

    const latestVisit = history[0];

    duplicateAddressWarning.hidden = false;

    duplicateAddressWarning.innerHTML = `
      <div>
        <strong>
          ⚠ Domicilio previamente visitado
        </strong>

        <p>
          ${escapeHtml(street)}
          ${escapeHtml(houseNumber)}
          <br>
          ${escapeHtml(neighborhood)},
          ${escapeHtml(locality)}
        </p>

        <p>
          <b>Visitas encontradas:</b>
          ${history.length}
        </p>

        <p>
          <b>Último resultado:</b>
          ${formatVisitResult(
            latestVisit.visitResult
          )}
        </p>

        <p>
          <b>Última intención:</b>
          ${formatVotingIntention(
            latestVisit.votingIntention
          )}
        </p>

        <p style="margin-bottom:0;">
          El registro se guardará como seguimiento
          cuando corresponda.
        </p>
      </div>
    `;

  } catch (error) {
    console.error(
      "Error al verificar domicilio:",
      error
    );

    clearDuplicateAddressWarning();
  }
}

function scheduleDuplicateAddressDetection() {
  clearTimeout(duplicateAddressTimer);

  duplicateAddressTimer = setTimeout(
    detectDuplicateAddress,
    650
  );
}


// ======================================================
// BUILD-101 — MODAL DE HISTORIAL Y SEGUIMIENTO
// ======================================================

async function confirmDuplicateVisit(visitHistory) {

  return new Promise((resolve) => {

    const latestVisit =
      visitHistory[0];

    duplicateVisitDetails.innerHTML = `
      <p>
        <strong>
          Este domicilio ya cuenta con
          ${visitHistory.length}
          ${visitHistory.length === 1 ? "visita registrada" : "visitas registradas"}.
        </strong>
      </p>

      <div class="visit-history">

        ${visitHistory.map((visit, index) => {

          const interviewer =
            visit.interviewerName ||
            visit.interviewerEmail ||
            "Sin identificar";

          const visitDate =
            visit.visitedAt?.toDate?.() ||
            visit.createdAt?.toDate?.();

          return `
            <article class="visit-history__item">

              <p>
                <strong>
                  ${index === 0
                    ? "Visita más reciente"
                    : `Visita anterior ${index}`}
                </strong>
              </p>

              <p>
                <b>Fecha:</b>
                ${
                  visitDate
                    ? visitDate.toLocaleString("es-MX")
                    : "Sin fecha"
                }
              </p>

              <p>
                <b>Encuestador:</b>
                ${escapeHtml(interviewer)}
              </p>

              <p>
                <b>Resultado:</b>
                ${formatVisitResult(visit.visitResult)}
              </p>

              <p>
                <b>Intención:</b>
                ${formatVotingIntention(visit.votingIntention)}
              </p>

              <p>
                <b>Tipo:</b>
                ${
                  visit.isFollowUp
                    ? "Seguimiento"
                    : "Primera visita"
                }
              </p>

            </article>
          `;

        }).join("")}

      </div>
    `;

    releaseTerritorialEvidence(
      duplicateVisitPhoto
    );

    duplicateVisitPhoto.removeAttribute(
      "src"
    );

    duplicateVisitPhoto.style.display =
      "none";

    if (latestVisit?.photoPath) {

      loadTerritorialEvidenceImage(
        duplicateVisitPhoto,
        latestVisit.photoPath
      ).then((loaded) => {

        if (
          loaded &&
          !duplicateVisitModal.hidden
        ) {
          duplicateVisitPhoto.style.display =
            "block";
        }

      });

    }

    duplicateVisitModal.hidden = false;

    confirmDuplicateVisitButton.onclick = () => {

      releaseTerritorialEvidence(
        duplicateVisitPhoto
      );

      duplicateVisitModal.hidden = true;

      resolve(true);

    };

    cancelDuplicateVisitButton.onclick = () => {

      releaseTerritorialEvidence(
        duplicateVisitPhoto
      );

      duplicateVisitModal.hidden = true;

      resolve(false);

    };

  });
}



// ======================================================
// GUARDAR VISITA
// ======================================================

visitForm.addEventListener("submit", async (event) => {
  event.preventDefault();

const adultsValue =
  Number(adultsInput.value);

if (
  !Number.isInteger(adultsValue) ||
  adultsValue < 1
) {
  visitMessage.textContent =
    "Indique cuántos mayores de 18 años habitan en el domicilio.";

  adultsInput.focus();
  return;
}




  if (!currentUser) {
    visitMessage.textContent =
      "La sesión todavía no está disponible.";

    return;
  }

  const street = streetInput.value.trim();
  const houseNumber = houseNumberInput.value.trim();
  const neighborhood = neighborhoodInput.value.trim();
  const locality = localityInput.value.trim();

const normalizedAddress = normalizeAddress(
  street,
  houseNumber,
  neighborhood,
  locality
);

  const visitResult = visitResultInput.value;
  const votingIntention = votingIntentionInput.value;

  const latitude = latitudeInput.value
    ? Number(latitudeInput.value)
    : null;

  const longitude = longitudeInput.value
    ? Number(longitudeInput.value)
    : null;

  if (
    !street ||
    !houseNumber ||
    !neighborhood ||
    !locality ||
    !visitResult ||
    !votingIntention
  ) {
    visitMessage.textContent =
      "Completa todos los campos obligatorios.";

    return;
  }

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    visitMessage.textContent =
      "Debes obtener la ubicación GPS antes de guardar.";

    return;
  }

if (!selectedPhoto) {
  visitMessage.textContent =
    "Debes tomar una fotografía antes de guardar.";

  return;
}



  saveVisitButton.disabled = true;
  saveVisitButton.textContent = "Guardando...";
  visitMessage.textContent = "";

  const flyerDelivered =
  visitResult === "flyer_entregado" ||
  visitResult === "no_estaba_flyer";

  const answeredQuestion =
    votingIntention !== "no_respondio" &&
    votingIntention !== "no_aplica";




  try {
const {
  grant: territorialGrant,
  metadata: territorialMetadata
} = await requireTerritorialWriteAccess();

const visitHistory =
  await findVisitHistory(normalizedAddress);

const previousVisit =
  visitHistory[0] || null;

if (previousVisit) {

  const continueAsFollowUp =
    await confirmDuplicateVisit(
      visitHistory
    );

  if (!continueAsFollowUp) {
    return;
  }
}





    const visitRef = doc(collection(db, "visitas"));

    const visitId = visitRef.id;

saveVisitButton.textContent =
  "Comprimiendo fotografía...";

const compressedPhoto =
  await compressPhoto(selectedPhoto);

const visitCampaignId =
  currentUserProfile.campaignId ||
  territorialGrant.campaignId;

if (!visitCampaignId) {
  throw new Error(
    "No fue posible determinar la campaña territorial."
  );
}

const photoPath =
  `visitas/${visitCampaignId}/${visitId}/evidencia.jpg`;

const photoReference =
  ref(storage, photoPath);

saveVisitButton.textContent =
  "Subiendo fotografía...";

await uploadBytes(
  photoReference,
  compressedPhoto,
  {
    contentType: "image/jpeg",
    customMetadata: {
      uploaderUid:
        String(currentUser.uid || ""),

      territorialGrantId:
        String(
          territorialMetadata.territorialGrantId ||
          ""
        ),

      territorialPersonId:
        String(
          territorialMetadata.territorialPersonId ||
          ""
        ),

      territorialGrantMode:
        String(
          territorialMetadata.territorialGrantMode ||
          ""
        ),

      territorialScopeType:
        String(
          territorialGrant.scopeType ||
          ""
        ),

      recordMode:
        String(
          territorialMetadata.recordMode ||
          ""
        ),

      productionEligible:
        territorialMetadata.productionEligible
          ? "true"
          : "false",

      municipalityId:
        String(
          territorialMetadata.municipalityId ||
          ""
        ),

      structureId:
        String(
          territorialMetadata.structureId ||
          ""
        ),

      brigadeId:
        String(
          territorialMetadata.brigadeId ||
          ""
        )
    }
  }
);

saveVisitButton.textContent =
  "Guardando visita...";


  await setDoc(visitRef, {

        id: visitId,

      campaignId:
  currentUserProfile.campaignId ||
  "CAM-001",

interviewerId:
  currentUser.uid,

interviewerEmail:
  currentUserProfile.email ||
  currentUser.email ||
  "",

interviewerName:
  currentUserProfile.name ||
  currentUser.displayName ||
  currentUser.email?.split("@")[0] ||
  "Sin identificar",

interviewerRole:
  currentUserProfile.role,

territorialGrantId:
  territorialMetadata.territorialGrantId,

territorialPersonId:
  territorialMetadata.territorialPersonId,

territorialGrantMode:
  territorialMetadata.territorialGrantMode,

recordMode:
  territorialMetadata.recordMode,

productionEligible:
  territorialMetadata.productionEligible,

municipalityId:
  territorialMetadata.municipalityId,

structureId:
  territorialMetadata.structureId,

brigadeId:
  territorialMetadata.brigadeId,

territorialScopeType:
  territorialGrant.scopeType,



     street,
houseNumber,
neighborhood,
locality,

normalizedAddress,

isFollowUp: Boolean(previousVisit),

previousVisitId:
  previousVisit?.id || null,

followUpNumber:
  visitHistory.length + 1,

rootVisitId:
  previousVisit?.rootVisitId ||
  previousVisit?.id ||
  visitId,

visitResult,


      flyerDelivered,

      votingIntention,
      answeredQuestion,

      latitude,
      longitude,
      hasLocation: true,

      photoPath,
hasPhoto: true,

adults:
  Number(adultsInput.value),

citizenName:
  citizenNameInput.value.trim(),

citizenPhone:
  citizenPhoneInput.value.trim(),

observations:
  observationsInput.value.trim(),



      visitedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),

      version: 1
    });

    visitMessage.textContent =
      `✅ Visita registrada correctamente. Gracias por contribuir al levantamiento territorial. ID: ${visitId}`;

    visitForm.reset();

// Restablecer las reglas del formulario inteligente
applyVisitResultRules();

    latitudeInput.value = "";
    longitudeInput.value = "";

    locationStatus.textContent =
      "Ubicación todavía no capturada.";

selectedPhoto = null;

if (previewPhotoUrl) {
  URL.revokeObjectURL(previewPhotoUrl);
  previewPhotoUrl = "";
}

photoPreview.removeAttribute("src");
photoPreview.style.display = "none";

photoStatus.textContent =
  "Fotografía todavía no capturada.";



    setTimeout(() => {
      visitMessage.textContent = "";
    }, 4000);
  } catch (error) {
    console.error("Error al guardar visita:", error);

    if (error.code === "permission-denied") {
      visitMessage.textContent =
        "Firestore rechazó el registro por las reglas de seguridad.";
    } else {
      visitMessage.textContent =
        "No fue posible guardar la visita.";
    }
  } finally {
    saveVisitButton.disabled = false;
    saveVisitButton.textContent = "Guardar visita";
  }
});

// ======================================================
// ESCUCHAR VISITAS EN TIEMPO REAL
// ======================================================

function listenVisits() {
  stopTerritorialVisitListener();

  const visitsQuery = query(
    collection(db, "visitas"),

    ...territorialVisitConstraints(),

    orderBy(
      "createdAt",
      "desc"
    ),

    limit(200)
  );


  visitsUnsubscribe = onSnapshot(
    visitsQuery,

    async (snapshot) => {
      latestVisits = [];

      snapshot.forEach((documentSnapshot) => {
        latestVisits.push({
          id: documentSnapshot.id,
          ...documentSnapshot.data()
        });
      });

      applyTerritoryFilter();
    },

    (error) => {
      console.error("Error al consultar visitas:", error);

      visitsList.innerHTML =
        "<p>No fue posible consultar las visitas.</p>";
    }
  );
}

// ======================================================
// BUILD-102C — TERRITORY FILTER ENGINE
// ======================================================

function applyTerritoryFilter() {

  switch (activeFilter) {

    case "all":
      filteredVisits = [...latestVisits];
      break;

    case "support":
      filteredVisits = latestVisits.filter(
        (visit) =>
          visit.votingIntention === "apoya"
      );
      break;

    case "indecisos":
      filteredVisits = latestVisits.filter(
        (visit) =>
          visit.votingIntention === "indeciso"
      );
      break;

    case "otra":
      filteredVisits = latestVisits.filter(
        (visit) =>
          visit.votingIntention === "otra_opcion"
      );
      break;

    case "flyer":
      filteredVisits = latestVisits.filter(
        (visit) =>
          visit.flyerDelivered === true
      );
      break;

    case "volver":
      filteredVisits = latestVisits.filter(
        (visit) =>
          visit.visitResult === "volver"
      );
      break;

    case "followup":
      filteredVisits = latestVisits.filter(
        (visit) =>
          visit.isFollowUp === true
      );
      break;

    default:
      filteredVisits = [...latestVisits];
  }

  updateMetrics(filteredVisits);

  renderVisits(
    filteredVisits.slice(0, 10)
  );

  if (mapReady) {
    renderVisitMarkers(filteredVisits);
  }
}



// ======================================================
// CONTADORES
// ======================================================

function updateMetrics(visits) {
  const totalVisits = visits.length;

  const totalFlyers = visits.filter(
    (visit) => visit.flyerDelivered === true
  ).length;

  const totalAnswers = visits.filter(
    (visit) => visit.answeredQuestion === true
  ).length;

  const totalSupport = visits.filter(
    (visit) =>
      visit.votingIntention === "apoya"
  ).length;

  const totalUndecided = visits.filter(
    (visit) =>
      visit.votingIntention === "indeciso"
  ).length;

  const totalOtherOption = visits.filter(
    (visit) =>
      visit.votingIntention === "otra_opcion"
  ).length;

  const totalFollowUps = visits.filter(
    (visit) =>
      visit.isFollowUp === true
  ).length;

  totalVisitsElement.textContent = totalVisits;
  totalFlyersElement.textContent = totalFlyers;
  totalAnswersElement.textContent = totalAnswers;

  totalSupportElement.textContent = totalSupport;
  totalUndecidedElement.textContent = totalUndecided;
  totalOtherOptionElement.textContent = totalOtherOption;
  totalFollowUpsElement.textContent = totalFollowUps;
}

// ======================================================
// LISTA DE VISITAS
// ======================================================

function renderVisits(visits) {

  if (!visits.length) {

    visitsList.innerHTML =
      "<p>Todavía no existen visitas registradas.</p>";

    return;

  }

  visitsList.innerHTML = visits
    .map((visit) => {

      const dateText =
        formatFirestoreDate(
          visit.createdAt
        );

      const hasCoordinates =
        Number.isFinite(visit.latitude) &&
        Number.isFinite(visit.longitude);

      return `

        <article class="visit-item">

          <div>

            <strong>

              ${escapeHtml(visit.street || "")}
              ${escapeHtml(visit.houseNumber || "")}

            </strong>

            <p>

              ${escapeHtml(visit.neighborhood || "")},
              ${escapeHtml(visit.locality || "")}

            </p>

          </div>

          <div>

            <p>

              Resultado:
              <strong>

                ${formatVisitResult(
                  visit.visitResult
                )}

              </strong>

            </p>

            <p>

              Intención:
              <strong>

                ${formatVotingIntention(
                  visit.votingIntention
                )}

              </strong>

            </p>

            <p>

              Mayores de 18:
              <strong>

                ${visit.adults ?? "-"}

              </strong>

            </p>

            <p>

              Nombre:
              <strong>

                ${escapeHtml(
                  visit.citizenName || "-"
                )}

              </strong>

            </p>

            <p>

              Teléfono:
              <strong>

                ${escapeHtml(
                  visit.citizenPhone || "-"
                )}

              </strong>

            </p>

            <p>

              Observaciones:
              <strong>

                ${escapeHtml(
                  visit.observations || "-"
                )}

              </strong>

            </p>

            <p>

              GPS:
              <strong>

                ${hasCoordinates ? "Sí" : "No"}

              </strong>

            </p>

            <p>

              ${dateText}

            </p>

          </div>

        </article>

      `;

    })
    .join("");

}

// ======================================================
// ETIQUETAS
// ======================================================

function formatVisitResult(value) {
  const labels = {
    flyer_entregado: "Flyer entregado",
    no_estaba: "No había nadie",
    no_estaba_flyer: "No había nadie — Flyer dejado",
    se_nego: "Se negó",
    volver: "Volver posteriormente",
    deshabitado: "Domicilio deshabitado"
  };

  return labels[value] || "Sin especificar";
}

function formatVotingIntention(value) {
  const labels = {
    apoya: "Apoya al candidato",
    indeciso: "Indeciso",
    otra_opcion: "Prefiere otra opción",
    no_respondio: "Prefirió no responder",
    no_aplica: "No se realizó la pregunta"
  };

  return labels[value] || "Sin especificar";
}

// ======================================================
// FECHA
// ======================================================

function formatFirestoreDate(timestamp) {
  if (!timestamp || typeof timestamp.toDate !== "function") {
    return "Sin fecha";
  }

  return timestamp.toDate().toLocaleString("es-MX", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

// ======================================================
// SEGURIDAD DE TEXTO
// ======================================================

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


// ======================================================
// EVENTOS DE INTERFAZ
// ======================================================

// BUILD-102C — FILTROS TERRITORIALES

territoryFilters.forEach((button) => {

  button.addEventListener("click", () => {

    activeFilter =
      button.dataset.filter || "all";

    territoryFilters.forEach((item) => {
      item.classList.remove("active");
    });

    button.classList.add("active");

    applyTerritoryFilter();

  });

});

// ======================================================
// BUILD-105 — EVENTOS DEL DETECTOR
// ======================================================

[
  streetInput,
  houseNumberInput,
  neighborhoodInput,
  localityInput
].forEach((input) => {

  input.addEventListener(
    "input",
    scheduleDuplicateAddressDetection
  );

  input.addEventListener(
    "change",
    scheduleDuplicateAddressDetection
  );

});





// ======================================================
// ABRIR CÁMARA / SELECTOR DE FOTOGRAFÍA
// ======================================================

photoButton.addEventListener("click", () => {
  photoInput.click();
});
