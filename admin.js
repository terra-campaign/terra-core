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

const recordCandidateSupportResponseCall =
  httpsCallable(
    terraFunctions,
    "recordCandidateSupportResponse"
  );

const getCandidateSupportStatsCall =
  httpsCallable(
    terraFunctions,
    "getCandidateSupportStats"
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

const candidateSupportSection =
  document.querySelector("#candidateSupportSection");

const candidateSupportResponseInput =
  document.querySelector("#candidateSupportResponse");

const candidateSupportOtherGroup =
  document.querySelector("#candidateSupportOtherGroup");

const candidateSupportOtherTextInput =
  document.querySelector("#candidateSupportOtherText");

const candidateSupportHint =
  document.querySelector("#candidateSupportHint");

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

const gpsAccuracyInput =
  document.querySelector("#gpsAccuracyMeters");

const gpsCapturedAtInput =
  document.querySelector("#gpsCapturedAt");

const GPS_TARGET_METERS = 10;
const GPS_VERY_GOOD_METERS = 25;
const GPS_ACCEPTABLE_METERS = 50;
const GPS_MAX_METERS = 100;
const GPS_SEARCH_DURATION_MS = 12000;

let gpsWatchId = null;
let gpsSearchTimer = null;
let bestGpsPosition = null;

const saveVisitButton =
  document.querySelector("#saveVisitButton");

const visitMessage =
  document.querySelector("#visitMessage");

function updateVisitMessagePresentation() {

  if (!visitMessage) {
    return;
  }

  const message =
    visitMessage.textContent.trim();

  visitMessage.classList.remove(
    "terra-form-alert",
    "terra-form-alert--info",
    "terra-form-alert--warning",
    "terra-form-alert--error",
    "terra-form-alert--success"
  );

  if (!message) {
    return;
  }

  visitMessage.classList.add(
    "terra-form-alert"
  );

  if (
    message.startsWith("✅") ||
    message.toLowerCase().includes("correctamente")
  ) {
    visitMessage.classList.add(
      "terra-form-alert--success"
    );

    return;
  }

  if (
    message.toLowerCase().includes("no fue posible") ||
    message.toLowerCase().includes("rechazó") ||
    message.toLowerCase().includes("desactivado") ||
    message.toLowerCase().includes("no está disponible")
  ) {
    visitMessage.classList.add(
      "terra-form-alert--error"
    );

    return;
  }

  if (
    message.toLowerCase().includes("debes") ||
    message.toLowerCase().includes("completa") ||
    message.toLowerCase().includes("falta") ||
    message.toLowerCase().includes("revise") ||
    message.toLowerCase().includes("cancelado")
  ) {
    visitMessage.classList.add(
      "terra-form-alert--warning"
    );

    return;
  }

  visitMessage.classList.add(
    "terra-form-alert--info"
  );
}

const visitMessageObserver =
  new MutationObserver(
    updateVisitMessagePresentation
  );

visitMessageObserver.observe(
  visitMessage,
  {
    childList: true,
    characterData: true,
    subtree: true
  }
);

updateVisitMessagePresentation();

const photoButton =
  document.querySelector("#photoButton");

const photoInput =
  document.querySelector("#photo");

const photoPreview =
  document.querySelector("#photoPreview");

const photoStatus =
  document.querySelector("#photoStatus");

const territorialSupervisionContext =
  document.querySelector(
    "#territorialSupervisionContext"
  );

const territorialSupervisionScope =
  document.querySelector(
    "#territorialSupervisionScope"
  );

const territorialSupervisionMode =
  document.querySelector(
    "#territorialSupervisionMode"
  );

const territorialSupervisionFilter =
  document.querySelector(
    "#territorialSupervisionFilter"
  );

const territorialSupervisionVisible =
  document.querySelector(
    "#territorialSupervisionVisible"
  );

const territorialSupervisionPeriod =
  document.querySelector(
    "#territorialSupervisionPeriod"
  );

const territorialSupervisionUpdated =
  document.querySelector(
    "#territorialSupervisionUpdated"
  );


const totalVisitsElement =
  document.querySelector("#totalVisits");

const totalFlyersElement =
  document.querySelector("#totalFlyers");

const totalContactsElement =
  document.querySelector("#totalContacts");

const totalNoHomeElement =
  document.querySelector("#totalNoHome");

const totalReturnElement =
  document.querySelector("#totalReturn");

const totalVacantElement =
  document.querySelector("#totalVacant");

const totalFollowUpsElement =
  document.querySelector("#totalFollowUps");

const candidateSupportStatsSection =
  document.querySelector(
    "#candidateSupportStatsSection"
  );

const candidateSupportStatsScope =
  document.querySelector(
    "#candidateSupportStatsScope"
  );

const candidateSupportStatsMessage =
  document.querySelector(
    "#candidateSupportStatsMessage"
  );

const candidateSupportStatsGrid =
  document.querySelector(
    "#candidateSupportStatsGrid"
  );

const candidateSupportTotal =
  document.querySelector(
    "#candidateSupportTotal"
  );

const candidateSupportYes =
  document.querySelector(
    "#candidateSupportYes"
  );

const candidateSupportNo =
  document.querySelector(
    "#candidateSupportNo"
  );

const candidateSupportOther =
  document.querySelector(
    "#candidateSupportOther"
  );

const candidateSupportYesPercent =
  document.querySelector(
    "#candidateSupportYesPercent"
  );

const candidateSupportNoPercent =
  document.querySelector(
    "#candidateSupportNoPercent"
  );

const candidateSupportOtherPercent =
  document.querySelector(
    "#candidateSupportOtherPercent"
  );

let candidateSupportStatsRequestId = 0;

const visitsList =
  document.querySelector("#visitsList");

const registeredHomesTable =
  document.querySelector("#duplicatesTable");

const registeredHomesSummary =
  document.querySelector("#registeredHomesSummary");

const refreshRegisteredHomesButton =
  document.querySelector("#refreshDuplicates");

const territoryFilters =
  document.querySelectorAll(".territory-filter");

const citizenSection =
  document.querySelector(".citizen-section");

const citizenInfoHint =
  document.querySelector("#citizenInfoHint");

const photoInstruction =
  document.querySelector("#photoInstruction");

// ======================================================
// BUILD-121B3 — RESULTADOS AGREGADOS
// ======================================================

function resetCandidateSupportStats() {
  candidateSupportTotal.textContent = "0";
  candidateSupportYes.textContent = "0";
  candidateSupportNo.textContent = "0";
  candidateSupportOther.textContent = "0";

  candidateSupportYesPercent.textContent = "0%";
  candidateSupportNoPercent.textContent = "0%";
  candidateSupportOtherPercent.textContent = "0%";
}


function candidateSupportPercent(value, total) {
  const n = Number(value || 0);
  const t = Number(total || 0);

  if (!Number.isFinite(t) || t <= 0) {
    return "0%";
  }

  return `${((n / t) * 100).toLocaleString(
    "es-MX",
    {
      maximumFractionDigits: 1
    }
  )}%`;
}


function candidateSupportScopeLabel(data) {
  const labels = {
    campaign: "Campaña",
    municipality: "Municipio",
    structure: "Estructura",
    brigade: "Brigada"
  };

  const scope =
    labels[data?.scopeType] ||
    "Alcance autorizado";

  const mode =
    data?.recordMode === "demo"
      ? "Modo demostración"
      : "Operación";

  return [
    scope,
    data?.scopeId || "",
    mode
  ]
    .filter(Boolean)
    .join(" · ");
}


function clearCandidateSupportStats() {
  candidateSupportStatsRequestId += 1;

  resetCandidateSupportStats();

  candidateSupportStatsGrid.hidden = true;
  candidateSupportStatsSection.hidden = true;

  candidateSupportStatsScope.textContent = "";

  candidateSupportStatsMessage.textContent =
    "Resultados no disponibles sin autorización territorial vigente.";
}


function renderCandidateSupportStats(data) {
  candidateSupportStatsSection.hidden = false;

  candidateSupportStatsScope.textContent =
    candidateSupportScopeLabel(data);

  if (data?.displayAllowed !== true) {
    resetCandidateSupportStats();

    candidateSupportStatsGrid.hidden = true;

    const minimum =
      Number(data?.minimumSampleSize || 5);

    candidateSupportStatsMessage.textContent =
      `Muestra insuficiente. Se requieren al menos ` +
      `${minimum} respuestas agregadas en este alcance.`;

    return;
  }

  const total =
    Number(data?.totalResponses || 0);

  const yes =
    Number(data?.yes || 0);

  const no =
    Number(data?.no || 0);

  const other =
    Number(data?.other || 0);

  candidateSupportTotal.textContent =
    String(total);

  candidateSupportYes.textContent =
    String(yes);

  candidateSupportNo.textContent =
    String(no);

  candidateSupportOther.textContent =
    String(other);

  candidateSupportYesPercent.textContent =
    candidateSupportPercent(yes, total);

  candidateSupportNoPercent.textContent =
    candidateSupportPercent(no, total);

  candidateSupportOtherPercent.textContent =
    candidateSupportPercent(other, total);

  candidateSupportStatsGrid.hidden = false;

  candidateSupportStatsMessage.textContent =
    "Resultados agregados de respuestas declaradas.";
}


async function loadCandidateSupportStats() {
  const requestId =
    ++candidateSupportStatsRequestId;

  if (
    currentTerritorialAccess?.read !== true
  ) {
    clearCandidateSupportStats();
    return;
  }

  candidateSupportStatsSection.hidden = false;
  candidateSupportStatsGrid.hidden = true;

  candidateSupportStatsMessage.textContent =
    "Cargando resultados agregados...";

  try {
    const response =
      await getCandidateSupportStatsCall({});

    if (
      requestId !==
        candidateSupportStatsRequestId ||
      currentTerritorialAccess?.read !== true
    ) {
      return;
    }

    renderCandidateSupportStats(
      response?.data || {}
    );

  } catch (error) {
    console.error(
      "Error al cargar estadísticas:",
      error
    );

    if (
      requestId !==
      candidateSupportStatsRequestId
    ) {
      return;
    }

    resetCandidateSupportStats();
    candidateSupportStatsGrid.hidden = true;

    candidateSupportStatsMessage.textContent =
      "No fue posible cargar los resultados agregados.";
  }
}


// ======================================================
// BUILD-120A4 — RESPUESTA DECLARADA DE APOYO
// ======================================================

function applyCandidateSupportExperience() {

  const visitResult =
    visitResultInput.value;

  const response =
    candidateSupportResponseInput.value;

  const contactAvailable =
    visitResult === "flyer_entregado";

  candidateSupportResponseInput.disabled =
    !contactAvailable;

  if (!contactAvailable) {

    candidateSupportResponseInput.value = "";

    candidateSupportOtherTextInput.value = "";
    candidateSupportOtherTextInput.disabled = true;
    candidateSupportOtherTextInput.required = false;

    candidateSupportOtherGroup.hidden = true;

    candidateSupportHint.textContent =
      "Se habilita cuando hubo contacto directo con la persona.";

    return;
  }

  candidateSupportHint.textContent =
    "Registra únicamente la respuesta expresada por la persona.";

  const showOther =
    response === "other";

  candidateSupportOtherGroup.hidden =
    !showOther;

  candidateSupportOtherTextInput.disabled =
    !showOther;

  candidateSupportOtherTextInput.required =
    showOther;

  if (!showOther) {
    candidateSupportOtherTextInput.value = "";
  }
}


candidateSupportResponseInput.addEventListener(
  "change",
  applyCandidateSupportExperience
);

visitResultInput.addEventListener(
  "change",
  applyCandidateSupportExperience
);

applyCandidateSupportExperience();


// ======================================================
// BUILD-120A2 — FORMULARIO TERRITORIAL ADAPTATIVO
// ======================================================

function setCitizenOperationalFieldsEnabled(enabled) {

  const fields = [
    adultsInput,
    citizenNameInput,
    citizenPhoneInput
  ];

  fields.forEach((field) => {
    if (!field) {
      return;
    }

    field.disabled = !enabled;

    if (!enabled) {
      field.value = "";
    }
  });

  // Nunca obligar a inventar este dato.
  adultsInput.required = false;
}


function applyVisitResultExperience() {

  const result =
    visitResultInput.value;

  let enableCitizenData = false;

  let citizenMessage =
    "Selecciona primero el resultado de la visita.";

  let photoMessage =
    `📸 <strong>Evidencia de la visita:</strong>
     Selecciona primero el resultado para mostrar
     la instrucción fotográfica correspondiente.`;

  switch (result) {

    case "flyer_entregado":

      enableCitizenData = true;

      citizenMessage =
        "Captura únicamente la información que realmente se obtuvo. Si no conoces cuántos adultos habitan el domicilio, deja el dato como «No se obtuvo / no aplica».";

      photoMessage =
        `📸 <strong>Evidencia de la visita:</strong>
         Toma una fotografía que permita verificar la entrega del material
         y parte de la fachada o acceso del domicilio.
         Evita captar rostros o datos personales innecesarios.`;

      break;


    case "no_estaba":

      citizenMessage =
        "No había nadie. No es necesario capturar número de adultos, nombre ni teléfono.";

      photoMessage =
        `📸 <strong>Evidencia de la visita:</strong>
         Como no había nadie, toma una fotografía donde se aprecie
         <strong>la casa completa</strong>.
         Si no es posible, captura claramente la
         <strong>fachada y el acceso principal</strong>.`;

      break;


    case "no_estaba_flyer":

      citizenMessage =
        "No había nadie. No es necesario capturar número de adultos, nombre ni teléfono.";

      photoMessage =
        `📸 <strong>Evidencia de la visita:</strong>
         Toma una fotografía donde se aprecie
         <strong>la casa completa o la fachada principal</strong>
         y, cuando sea posible, el lugar donde quedó el flyer.
         No ingreses al domicilio para obtener la evidencia.`;

      break;


    case "se_nego":

      citizenMessage =
        "La persona se negó. No es necesario capturar información personal.";

      photoMessage =
        `📸 <strong>Evidencia de la visita:</strong>
         No fotografíes a la persona que se negó.
         Toma únicamente una fotografía de la
         <strong>fachada o acceso del domicilio</strong>
         como evidencia de la visita.`;

      break;


    case "volver":

      citizenMessage =
        "La visita requiere seguimiento. No es necesario capturar datos que no fueron obtenidos.";

      photoMessage =
        `📸 <strong>Evidencia de la visita:</strong>
         Toma una fotografía de la
         <strong>casa, fachada o acceso principal</strong>
         para dejar evidencia del intento de visita.`;

      break;


    case "deshabitado":

      citizenMessage =
        "El domicilio se registró como deshabitado. Los datos del ciudadano no aplican.";

      photoMessage =
        `📸 <strong>Evidencia de la visita:</strong>
         Toma una fotografía donde se aprecie
         <strong>la casa completa o su fachada principal</strong>
         como evidencia del estado observado.`;

      break;
  }

  setCitizenOperationalFieldsEnabled(
    enableCitizenData
  );

  if (citizenInfoHint) {
    citizenInfoHint.textContent =
      citizenMessage;
  }

  if (photoInstruction) {
    photoInstruction.innerHTML =
      photoMessage;
  }

  if (citizenSection) {
    citizenSection.dataset.visitState =
      result || "pending";
  }
}


visitResultInput.addEventListener(
  "change",
  applyVisitResultExperience
);

applyVisitResultExperience();


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

  clearCandidateSupportStats();
  clearTerritorialSupervisionContext();

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
  panel.className =
    "card shell territorial-access-panel territorial-access-panel--blocked";

  const accessMessage =
    message ||
    "No tienes una autorización territorial vigente.";

  panel.innerHTML = `
    <div class="territorial-access-status">
      <div class="territorial-access-status__icon" aria-hidden="true">
        🔒
      </div>

      <div>
        <p class="territorial-access-eyebrow">
          OPERACIÓN TERRITORIAL PROTEGIDA
        </p>

        <h2>
          Sin autorización territorial vigente
        </h2>

        <p class="territorial-access-status__message">
          ${accessMessage}
        </p>

        <p class="territorial-access-status__note">
          Tu cuenta permanece activa. Por seguridad, los mapas,
          registros, indicadores y evidencias territoriales solo
          están disponibles mientras exista una autorización válida.
        </p>
      </div>
    </div>

    <div class="territorial-access-intro">
      <p class="territorial-access-eyebrow">
        CAPACIDADES DEL MÓDULO
      </p>

      <h3>
        Del trabajo de campo a información verificable y medible
      </h3>

      <p>
        TERRA Campaign concentra la operación territorial en un mismo
        entorno para documentar actividades, supervisar cobertura y
        mantener trazabilidad sobre cada registro autorizado.
      </p>
    </div>

    <div class="territorial-access-features">

      <article class="territorial-access-feature">
        <div class="territorial-access-feature__icon" aria-hidden="true">
          📍
        </div>

        <h4>Registro verificable</h4>

        <p>
          Documenta actividades de campo con responsable, ubicación,
          fecha, resultado operativo y evidencia cuando corresponda.
        </p>
      </article>

      <article class="territorial-access-feature">
        <div class="territorial-access-feature__icon" aria-hidden="true">
          🗺️
        </div>

        <h4>Mapa y cobertura</h4>

        <p>
          Organiza geográficamente el trabajo registrado para conocer
          las zonas atendidas y facilitar el seguimiento operativo.
        </p>
      </article>

      <article class="territorial-access-feature">
        <div class="territorial-access-feature__icon" aria-hidden="true">
          📊
        </div>

        <h4>Indicadores operativos</h4>

        <p>
          Convierte registros individuales en información de avance,
          cobertura, entregas, resultados de visita y seguimientos.
        </p>
      </article>

      <article class="territorial-access-feature">
        <div class="territorial-access-feature__icon" aria-hidden="true">
          🛡️
        </div>

        <h4>Seguridad y trazabilidad</h4>

        <p>
          El acceso depende de una autorización vigente, con identidad,
          alcance territorial, permisos y tiempo de operación definidos.
        </p>
      </article>

    </div>

    <div class="territorial-access-trace">
      <span>QUÉ SE HIZO</span>
      <span>QUIÉN</span>
      <span>DÓNDE</span>
      <span>CUÁNDO</span>
      <span>RESULTADO</span>
    </div>

    <div class="territorial-access-security">
      <div>
        <strong>Acceso por autorización</strong>
        <span>
          La jerarquía por sí sola no habilita información territorial.
        </span>
      </div>

      <div>
        <strong>Alcance controlado</strong>
        <span>
          Cada autorización determina qué información puede consultarse
          o registrarse.
        </span>
      </div>

      <div>
        <strong>Protección automática</strong>
        <span>
          Al vencer o revocarse el acceso, el espacio territorial vuelve
          a quedar protegido.
        </span>
      </div>
    </div>

    <footer class="territorial-access-footer">
      <strong>TERRA Campaign</strong>
      <span>
        Operación territorial organizada, protegida y verificable.
      </span>
    </footer>
  `;
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

  panel.className =
    "card shell territorial-access-panel";

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
      }`;

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

  void loadCandidateSupportStats();
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

function getGpsQuality(accuracy) {

  if (accuracy <= GPS_TARGET_METERS) {
    return {
      label: "Excelente",
      tone: "success"
    };
  }

  if (accuracy <= GPS_VERY_GOOD_METERS) {
    return {
      label: "Muy buena",
      tone: "success"
    };
  }

  if (accuracy <= GPS_ACCEPTABLE_METERS) {
    return {
      label: "Aceptable",
      tone: "success"
    };
  }

  if (accuracy <= GPS_MAX_METERS) {
    return {
      label: "Limitada",
      tone: "warning"
    };
  }

  return {
    label: "Insuficiente",
    tone: "error"
  };
}


function setGpsStatus(message, tone = "info") {

  if (locationButton) {

    const hasValidLocation =
      Boolean(
        latitudeInput.value &&
        longitudeInput.value &&
        gpsAccuracyInput.value
      );

    locationButton.classList.toggle(
      "gps-cta--pending",
      !hasValidLocation
    );

    locationButton.classList.toggle(
      "gps-cta--captured",
      hasValidLocation
    );
  }

  locationStatus.classList.remove(
    "gps-status--info",
    "gps-status--success",
    "gps-status--warning",
    "gps-status--error"
  );

  locationStatus.classList.add(
    "gps-status",
    `gps-status--${tone}`
  );

  locationStatus.textContent = message;
}


function clearGpsSearch() {

  if (
    gpsWatchId !== null &&
    navigator.geolocation
  ) {
    navigator.geolocation.clearWatch(
      gpsWatchId
    );

    gpsWatchId = null;
  }

  if (gpsSearchTimer !== null) {
    clearTimeout(gpsSearchTimer);
    gpsSearchTimer = null;
  }
}


function finishGpsSearch() {

  clearGpsSearch();

  locationButton.disabled = false;
  locationButton.textContent =
    "📍 Actualizar ubicación GPS";

  if (!bestGpsPosition) {

    centerMapButton.disabled = false;

    setGpsStatus(
      "⛔ No fue posible obtener una ubicación válida. Intenta nuevamente.",
      "error"
    );

    return;
  }

  const accuracy =
    bestGpsPosition.accuracy;

  const roundedAccuracy =
    Math.round(accuracy);

  const quality =
    getGpsQuality(accuracy);

  if (accuracy > GPS_MAX_METERS) {

    setGpsStatus(
      `⛔ Ubicación demasiado imprecisa · Precisión: ${roundedAccuracy} m. Actualiza el GPS antes de guardar.`,
      "error"
    );

    return;
  }

  if (accuracy > GPS_ACCEPTABLE_METERS) {

    setGpsStatus(
      `⚠️ Ubicación verificada · Precisión: ${roundedAccuracy} m · ${quality.label}. Conviene actualizar GPS si es posible.`,
      "warning"
    );

    return;
  }

  setGpsStatus(
    `✅ Ubicación verificada · Precisión: ${roundedAccuracy} m · ${quality.label}.`,
    "success"
  );
}


function captureCurrentLocation() {

  if (!navigator.geolocation) {

    setGpsStatus(
      "⛔ Este dispositivo no permite obtener ubicación GPS.",
      "error"
    );

    return;
  }

  clearGpsSearch();

  bestGpsPosition = null;

  latitudeInput.value = "";
  longitudeInput.value = "";
  gpsAccuracyInput.value = "";
  gpsCapturedAtInput.value = "";

  locationButton.disabled = true;
  locationButton.textContent =
    "📍 Buscando mejor ubicación...";

  centerMapButton.disabled = true;

  setGpsStatus(
    "🔵 Buscando ubicación de alta precisión… Puedes continuar llenando el formulario.",
    "info"
  );

  gpsWatchId =
    navigator.geolocation.watchPosition(

      (position) => {

        const latitude =
          position.coords.latitude;

        const longitude =
          position.coords.longitude;

        const accuracy =
          Number(position.coords.accuracy);

        if (
          !Number.isFinite(latitude) ||
          !Number.isFinite(longitude) ||
          !Number.isFinite(accuracy)
        ) {
          return;
        }

        if (
          bestGpsPosition &&
          accuracy >= bestGpsPosition.accuracy
        ) {
          return;
        }

        bestGpsPosition = {
          latitude,
          longitude,
          accuracy,
          capturedAt: Date.now()
        };

        latitudeInput.value =
          String(latitude);

        longitudeInput.value =
          String(longitude);

        gpsAccuracyInput.value =
          String(accuracy);

        gpsCapturedAtInput.value =
          String(bestGpsPosition.capturedAt);

        locationButton.classList.remove(
          "gps-cta--pending"
        );

        locationButton.classList.add(
          "gps-cta--captured"
        );

        centerMapButton.disabled = false;

        const quality =
          getGpsQuality(accuracy);

        setGpsStatus(
          `🔵 Buscando mejor ubicación… Mejor lectura actual: ${Math.round(accuracy)} m · ${quality.label}. Puedes continuar llenando el formulario.`,
          "info"
        );

        if (mapReady) {

          showCurrentLocation(
            latitude,
            longitude
          ).catch((error) => {
            console.error(
              "No fue posible actualizar la ubicación en el mapa:",
              error
            );
          });
        }

        if (
          accuracy <= GPS_TARGET_METERS
        ) {
          finishGpsSearch();
        }
      },

      (error) => {

        console.error(
          "Error de geolocalización:",
          error
        );

        if (
          error.code ===
          error.PERMISSION_DENIED
        ) {

          clearGpsSearch();

          locationButton.disabled = false;
          locationButton.textContent =
            "📍 1. Obtener ubicación GPS";

          centerMapButton.disabled = false;

          setGpsStatus(
            "⛔ El permiso de ubicación fue rechazado.",
            "error"
          );
        }
      },

      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );

  gpsSearchTimer =
    setTimeout(
      finishGpsSearch,
      GPS_SEARCH_DURATION_MS
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

  const candidateSupportResponse =
    candidateSupportResponseInput.value;

  const candidateSupportOtherText =
    candidateSupportOtherTextInput.value.trim();

  const latitude = latitudeInput.value
    ? Number(latitudeInput.value)
    : null;

  const longitude = longitudeInput.value
    ? Number(longitudeInput.value)
    : null;

  const gpsAccuracyMeters =
    gpsAccuracyInput.value
      ? Number(gpsAccuracyInput.value)
      : null;

  const gpsCapturedAtMillis =
    gpsCapturedAtInput.value
      ? Number(gpsCapturedAtInput.value)
      : null;

  if (
    !street ||
    !houseNumber ||
    !neighborhood ||
    !locality ||
    !visitResult
  ) {
    visitMessage.textContent =
      "Completa todos los campos obligatorios.";

    return;
  }

  if (
    visitResult === "flyer_entregado" &&
    !["yes", "no", "other"].includes(
      candidateSupportResponse
    )
  ) {
    visitMessage.textContent =
      "Selecciona la respuesta a «¿Apoya al candidato?» antes de guardar.";

    candidateSupportResponseInput.focus();

    return;
  }

  if (
    visitResult === "flyer_entregado" &&
    candidateSupportResponse === "other" &&
    !candidateSupportOtherText
  ) {
    visitMessage.textContent =
      "Indica a quién declaró apoyar la persona.";

    candidateSupportOtherTextInput.focus();

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

  if (
    !Number.isFinite(gpsAccuracyMeters) ||
    !Number.isFinite(gpsCapturedAtMillis)
  ) {
    visitMessage.textContent =
      "Debes verificar la precisión GPS antes de guardar.";

    return;
  }

  if (
    gpsAccuracyMeters > GPS_MAX_METERS
  ) {
    visitMessage.textContent =
      `La ubicación GPS es demasiado imprecisa (${Math.round(gpsAccuracyMeters)} m). Actualiza la ubicación antes de guardar.`;

    return;
  }

if (!selectedPhoto) {
  visitMessage.textContent =
    "Debes tomar una fotografía antes de guardar.";

  return;
}



  saveVisitButton.disabled = true;
  saveVisitButton.textContent = "Guardando...";
  visitMessage.textContent =
    "Guardando visita y evidencia...";

  const flyerDelivered =
  visitResult === "flyer_entregado" ||
  visitResult === "no_estaba_flyer";

  const candidateSupportSubmissionId =
    (
      window.crypto &&
      typeof window.crypto.randomUUID === "function"
    )
      ? window.crypto.randomUUID()
      : `CSS-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 12)}`;






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
    visitMessage.textContent =
      "Registro cancelado. Revise la información antes de volver a guardar.";

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

      latitude,
      longitude,
      hasLocation: true,

      gpsAccuracyMeters:
        Number(
          gpsAccuracyMeters.toFixed(1)
        ),

      gpsCapturedAt:
        new Date(gpsCapturedAtMillis),

      photoPath,
hasPhoto: true,

adults:
  adultsInput.value
    ? Number(adultsInput.value)
    : null,

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

    if (
      visitResult === "flyer_entregado"
    ) {

      saveVisitButton.textContent =
        "Registrando respuesta...";

      await recordCandidateSupportResponseCall({
        response:
          candidateSupportResponse,

        otherText:
          candidateSupportResponse === "other"
            ? candidateSupportOtherText
            : "",

        submissionId:
          candidateSupportSubmissionId,

        visitResult
      });

      void loadCandidateSupportStats();
    }

    const visitResultLabels = {
      flyer_entregado:
        "Flyer entregado",

      no_estaba:
        "No había nadie",

      no_estaba_flyer:
        "No había nadie — Flyer dejado",

      se_nego:
        "Se negó",

      volver:
        "Volver posteriormente",

      deshabitado:
        "Deshabitado"
    };

    const visitResultLabel =
      visitResultLabels[visitResult] ||
      "Resultado registrado";

    const visitFolio =
      `VIS-${visitId.slice(0, 8).toUpperCase()}`;

    const savedAt =
      new Date().toLocaleString(
        "es-MX",
        {
          timeZone: "America/Mazatlan",
          dateStyle: "short",
          timeStyle: "short"
        }
      );

    visitMessage.innerHTML = `
      <span class="terra-status-title">
        ✅ Visita registrada correctamente
      </span>

      <span class="terra-status-detail">
        ${
          visitResult === "flyer_entregado"
            ? "Registro territorial, evidencia y respuesta estadística guardados."
            : "Registro territorial y evidencia fotográfica guardados."
        }
      </span>

      <span class="terra-status-meta">
        <strong>Resultado:</strong>
        ${visitResultLabel}
      </span>

      <span class="terra-status-meta">
        <strong>Folio:</strong>
        ${visitFolio}
      </span>

      <span class="terra-status-time">
        ${savedAt}
      </span>
    `;

    visitForm.reset();

    applyVisitResultExperience();

    clearGpsSearch();

    bestGpsPosition = null;

    latitudeInput.value = "";
    longitudeInput.value = "";
    gpsAccuracyInput.value = "";
    gpsCapturedAtInput.value = "";

    locationButton.disabled = false;
    locationButton.textContent =
      "📍 1. Obtener ubicación GPS";

    centerMapButton.disabled = false;

    setGpsStatus(
      "Aún no se ha capturado la ubicación.",
      "info"
    );

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

      if (
        !visitMessage.textContent.includes(
          visitFolio
        )
      ) {
        return;
      }

      visitMessage.textContent =
        `✓ Última visita guardada correctamente · Folio: ${visitFolio}`;

    }, 9000);
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
// BUILD-121C1 — CONTEXTO DE SUPERVISIÓN TERRITORIAL
// ======================================================

function territorialSupervisionScopeLabel() {

  const grant =
    currentTerritorialAccess?.grant || {};

  const labels = {
    campaign: "Campaña",
    municipality: "Municipio",
    structure: "Estructura",
    brigade: "Brigada"
  };

  const label =
    labels[grant.scopeType] ||
    "Alcance autorizado";

  const scopeId =
    grant.scopeId ||
    grant.municipalityId ||
    grant.structureId ||
    grant.brigadeId ||
    "";

  return [
    label,
    scopeId
  ]
    .filter(Boolean)
    .join(" · ");
}


function territorialSupervisionFilterLabel() {

  const labels = {
    all: "Todos",
    contact: "Contactos",
    nohome: "No había nadie",
    vacant: "Deshabitados",
    flyer: "Flyers",
    volver: "Volver",
    followup: "Seguimientos"
  };

  return labels[activeFilter] || "Todos";
}


function territorialVisitDate(visit) {

  const value =
    visit?.visitedAt ||
    visit?.createdAt ||
    null;

  if (!value) {
    return null;
  }

  if (
    typeof value.toDate === "function"
  ) {
    const date = value.toDate();

    return Number.isNaN(
      date.getTime()
    )
      ? null
      : date;
  }

  if (
    Number.isFinite(value?.seconds)
  ) {
    return new Date(
      value.seconds * 1000
    );
  }

  if (value instanceof Date) {
    return Number.isNaN(
      value.getTime()
    )
      ? null
      : value;
  }

  return null;
}


function formatTerritorialPeriodDate(date) {

  return date.toLocaleDateString(
    "es-MX",
    {
      timeZone: "America/Mazatlan",
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }
  );
}


function territorialVisiblePeriodLabel(visits) {

  const dates =
    visits
      .map(territorialVisitDate)
      .filter(Boolean)
      .sort(
        (a, b) =>
          a.getTime() - b.getTime()
      );

  if (!dates.length) {
    return "Sin registros visibles";
  }

  const first =
    dates[0];

  const last =
    dates[dates.length - 1];

  const firstText =
    formatTerritorialPeriodDate(first);

  const lastText =
    formatTerritorialPeriodDate(last);

  if (firstText === lastText) {
    return firstText;
  }

  return `${firstText} – ${lastText}`;
}


function clearTerritorialSupervisionContext() {

  if (!territorialSupervisionContext) {
    return;
  }

  territorialSupervisionContext.hidden = true;

  territorialSupervisionScope.textContent = "—";
  territorialSupervisionMode.textContent = "—";
  territorialSupervisionFilter.textContent = "Todos";
  territorialSupervisionVisible.textContent = "0";
  territorialSupervisionPeriod.textContent = "—";

  territorialSupervisionUpdated.textContent =
    "Vista todavía no actualizada.";
}


function updateTerritorialSupervisionContext() {

  if (
    !territorialSupervisionContext ||
    currentTerritorialAccess?.read !== true
  ) {
    clearTerritorialSupervisionContext();
    return;
  }

  const grant =
    currentTerritorialAccess?.grant || {};

  territorialSupervisionContext.hidden = false;

  territorialSupervisionScope.textContent =
    territorialSupervisionScopeLabel();

  territorialSupervisionMode.textContent =
    grant.mode === "demo"
      ? "Demostración"
      : "Operación";

  territorialSupervisionFilter.textContent =
    territorialSupervisionFilterLabel();

  territorialSupervisionVisible.textContent =
    String(filteredVisits.length);

  territorialSupervisionPeriod.textContent =
    territorialVisiblePeriodLabel(
      filteredVisits
    );

  territorialSupervisionUpdated.textContent =
    `Vista actualizada: ${
      new Date().toLocaleString(
        "es-MX",
        {
          timeZone: "America/Mazatlan",
          dateStyle: "short",
          timeStyle: "short"
        }
      )
    }`;
}


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

      if (registeredHomesTable) {
        registeredHomesTable.innerHTML = `
          <tr>
            <td colspan="6">
              No fue posible consultar los domicilios.
            </td>
          </tr>
        `;
      }

      if (registeredHomesSummary) {
        registeredHomesSummary.textContent =
          "No fue posible actualizar la vista territorial.";
      }
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

    case "contact":
      filteredVisits = latestVisits.filter(
        (visit) =>
          visit.visitResult === "flyer_entregado" ||
          visit.visitResult === "se_nego"
      );
      break;

    case "nohome":
      filteredVisits = latestVisits.filter(
        (visit) =>
          visit.visitResult === "no_estaba" ||
          visit.visitResult === "no_estaba_flyer"
      );
      break;

    case "vacant":
      filteredVisits = latestVisits.filter(
        (visit) =>
          visit.visitResult === "deshabitado"
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

  renderRegisteredHomes(
    filteredVisits
  );

  renderVisits(
    filteredVisits.slice(0, 10)
  );

  if (mapReady) {
    renderVisitMarkers(filteredVisits);
  }

  updateTerritorialSupervisionContext();
}



// ======================================================
// BUILD-121A — DOMICILIOS REGISTRADOS CANÓNICOS
// ======================================================

function registeredHomeKey(visit) {

  const canonical =
    String(
      visit.normalizedAddress || ""
    ).trim();

  if (canonical) {
    return canonical;
  }

  return [
    visit.street,
    visit.houseNumber,
    visit.neighborhood,
    visit.locality
  ]
    .map((value) =>
      String(value || "")
        .trim()
        .toLocaleLowerCase("es-MX")
    )
    .join("|");
}


function renderRegisteredHomes(visits) {

  if (
    !registeredHomesTable ||
    !registeredHomesSummary
  ) {
    return;
  }

  const homes =
    new Map();

  visits.forEach((visit) => {

    const key =
      registeredHomeKey(visit);

    if (!key) {
      return;
    }

    if (!homes.has(key)) {

      homes.set(
        key,
        {
          street:
            visit.street || "",

          houseNumber:
            visit.houseNumber || "",

          neighborhood:
            visit.neighborhood || "",

          locality:
            visit.locality || "",

          visits: 1,

          latestVisit:
            visit
        }
      );

      return;
    }

    homes.get(key).visits += 1;
  });


  const rows =
    [...homes.values()];


  registeredHomesSummary.textContent =
    `${rows.length} domicilio${rows.length === 1 ? "" : "s"} · ` +
    `${visits.length} visita${visits.length === 1 ? "" : "s"} ` +
    `en la vista actual.`;


  if (!rows.length) {

    registeredHomesTable.innerHTML = `
      <tr>
        <td
          colspan="6"
          class="registered-homes-empty"
        >
          No existen domicilios para el filtro seleccionado.
        </td>
      </tr>
    `;

    return;
  }


  registeredHomesTable.innerHTML =
    rows
      .map((home) => {

        const latest =
          home.latestVisit;

        const status =
          formatVisitResult(
            latest.visitResult
          );

        const followUp =
          latest.isFollowUp === true
            ? ` · Seguimiento ${latest.followUpNumber || ""}`
            : "";

        return `
          <tr>
            <td>
              ${escapeHtml(home.street || "-")}
            </td>

            <td>
              ${escapeHtml(home.houseNumber || "-")}
            </td>

            <td>
              ${escapeHtml(home.neighborhood || "-")}
            </td>

            <td>
              ${escapeHtml(home.locality || "-")}
            </td>

            <td>
              <strong>
                ${home.visits}
              </strong>
            </td>

            <td>
              <span class="registered-home-status">
                ${escapeHtml(status)}
                ${escapeHtml(followUp)}
              </span>
            </td>
          </tr>
        `;
      })
      .join("");
}


// ======================================================
// CONTADORES
// ======================================================

function updateMetrics(visits) {
  const totalVisits = visits.length;

  const totalFlyers = visits.filter(
    (visit) => visit.flyerDelivered === true
  ).length;

  const totalContacts = visits.filter(
    (visit) =>
      visit.visitResult === "flyer_entregado" ||
      visit.visitResult === "se_nego"
  ).length;

  const totalNoHome = visits.filter(
    (visit) =>
      visit.visitResult === "no_estaba" ||
      visit.visitResult === "no_estaba_flyer"
  ).length;

  const totalReturn = visits.filter(
    (visit) =>
      visit.visitResult === "volver"
  ).length;

  const totalVacant = visits.filter(
    (visit) =>
      visit.visitResult === "deshabitado"
  ).length;

  const totalFollowUps = visits.filter(
    (visit) =>
      visit.isFollowUp === true
  ).length;

  totalVisitsElement.textContent = totalVisits;
  totalFlyersElement.textContent = totalFlyers;
  totalContactsElement.textContent = totalContacts;
  totalNoHomeElement.textContent = totalNoHome;
  totalReturnElement.textContent = totalReturn;
  totalVacantElement.textContent = totalVacant;
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
// BUILD-121A — ACTUALIZAR VISTA DE DOMICILIOS
// ======================================================

refreshRegisteredHomesButton?.addEventListener(
  "click",
  () => {

    renderRegisteredHomes(
      filteredVisits
    );

    const originalText =
      refreshRegisteredHomesButton.textContent;

    refreshRegisteredHomesButton.textContent =
      "Actualizado ✓";

    refreshRegisteredHomesButton.disabled =
      true;

    setTimeout(() => {

      refreshRegisteredHomesButton.textContent =
        originalText;

      refreshRegisteredHomesButton.disabled =
        false;

    }, 1200);
  }
);


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
