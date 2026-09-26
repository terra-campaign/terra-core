// ======================================================
// TERRA CAMPAIGN
// BUILD-117B-2 — PERFIL OPERATIVO DE PERSONA
// ======================================================

import {
  auth,
  db
} from "./firebase-config.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
  getFunctions,
  httpsCallable
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js";


const functions =
  getFunctions(
    auth.app,
    "us-central1"
  );

const getPersonActivitySummary =
  httpsCallable(
    functions,
    "getPersonActivitySummary"
  );

const getPersonPerformanceSummary =
  httpsCallable(
    functions,
    "getPersonPerformanceSummary"
  );


// ======================================================
// ELEMENTOS
// ======================================================

const loadingSection =
  document.getElementById("loadingSection");

const errorSection =
  document.getElementById("errorSection");

const errorMessage =
  document.getElementById("errorMessage");

const profileSection =
  document.getElementById("profileSection");

const backButton =
  document.getElementById("backButton");

const logoutButton =
  document.getElementById("logoutButton");


// ======================================================
// CAMPOS DEL PERFIL
// ======================================================

const personName =
  document.getElementById("personName");

const personEmail =
  document.getElementById("personEmail");

const personPhone =
  document.getElementById("personPhone");

const personWhatsApp =
  document.getElementById("personWhatsApp");

const personLocality =
  document.getElementById("personLocality");

const personStreet =
  document.getElementById("personStreet");

const personHouseNumber =
  document.getElementById("personHouseNumber");

const personStatus =
  document.getElementById("personStatus");

const personRole =
  document.getElementById("personRole");

const personMunicipality =
  document.getElementById("personMunicipality");

const personStructure =
  document.getElementById("personStructure");

const personStructureChief =
  document.getElementById("personStructureChief");

const personParent =
  document.getElementById("personParent");

const personUid =
  document.getElementById("personUid");

const personCampaign =
  document.getElementById("personCampaign");


// ======================================================
// INDICADORES
// ======================================================

const missionsAssigned =
  document.getElementById("missionsAssigned");

const missionsCompleted =
  document.getElementById("missionsCompleted");

const evidenceCount =
  document.getElementById("evidenceCount");

const eventsCount =
  document.getElementById("eventsCount");

const activityStatus =
  document.getElementById("activityStatus");

// ======================================================
// DESEMPEÑO OPERATIVO
// BUILD-124 B4-B2B16
// ======================================================

const performanceContributionCount =
  document.getElementById(
    "performanceContributionCount"
  );

const performancePoints =
  document.getElementById("performancePoints");

const performanceTerritorial =
  document.getElementById("performanceTerritorial");

const performanceAttendance =
  document.getElementById("performanceAttendance");

const performanceOrganization =
  document.getElementById("performanceOrganization");

const performanceLogistics =
  document.getElementById("performanceLogistics");

const performanceDigital =
  document.getElementById("performanceDigital");

const performanceStatus =
  document.getElementById("performanceStatus");


// ======================================================
// UTILIDADES
// ======================================================

function cleanText(value) {
  return String(value || "").trim();
}


function showError(message) {

  loadingSection.hidden = true;
  profileSection.hidden = true;

  errorMessage.textContent =
    message || "Ocurrió un error.";

  errorSection.hidden = false;
}


function roleLabel(role) {

  const labels = {

    admin:
      "Administrador",

    lider_principal:
      "Líder principal",

    coordinador:
      "Coordinador",

    coordinador_municipal:
      "Responsable de organización",

    jefe_estructura:
      "Responsable de estructura",

    integrante:
      "Integrante",

    participante:
      "Participante",

    brigadista:
      "Brigadista"
  };

  return labels[role] || role || "Sin definir";
}


// ======================================================
// RESPONSABLE DIRECTO
// ======================================================

async function getParentName(
  parentUserId,
  fallbackName = ""
) {

  if (fallbackName) {
    return fallbackName;
  }

  if (!parentUserId) {
    return "—";
  }

  try {

    const parentSnapshot =
      await getDoc(
        doc(
          db,
          "usuarios",
          parentUserId
        )
      );

    if (!parentSnapshot.exists()) {
      return "—";
    }

    const parent =
      parentSnapshot.data();

    if (
  parent.role === "admin"
) {
  return "ADMINISTRADOR GRAL";
}

return (
  cleanText(parent.name) ||
  cleanText(parent.email) ||
  "—"
);

  } catch (error) {

    console.error(
      "Error al consultar responsable directo:",
      error
    );

    return "—";
  }
}


// ======================================================
// ACTIVIDAD OPERATIVA
// BUILD-117B-2
// ======================================================

async function loadPersonActivity(uid) {

  missionsAssigned.textContent =
    "—";

  missionsCompleted.textContent =
    "—";

  evidenceCount.textContent =
    "—";

  eventsCount.textContent =
    "—";

  activityStatus.textContent =
    "Consultando actividad operativa…";


  try {

    const response =
      await getPersonActivitySummary({
        uid
      });

    const data =
      response?.data || {};


    missionsAssigned.textContent =
      Number.isInteger(data.assigned)
        ? String(data.assigned)
        : "—";

    missionsCompleted.textContent =
      Number.isInteger(data.completed)
        ? String(data.completed)
        : "—";

    evidenceCount.textContent =
      Number.isInteger(data.evidence)
        ? String(data.evidence)
        : "—";


    // Eventos todavía no tiene una fuente
    // operativa validada en esta versión.
    eventsCount.textContent =
      "—";


    activityStatus.textContent =
      "Misiones y evidencias calculadas con datos operativos reales. Eventos aún no está conectado.";

  } catch (error) {

    console.error(
      "Error al consultar actividad operativa:",
      error
    );


    missionsAssigned.textContent =
      "—";

    missionsCompleted.textContent =
      "—";

    evidenceCount.textContent =
      "—";

    eventsCount.textContent =
      "—";


    activityStatus.textContent =
      "No fue posible consultar la actividad operativa en este momento.";
  }
}


// ======================================================
// CARGAR PERFIL
// ======================================================

// ======================================================
// DESEMPEÑO OPERATIVO
// BUILD-124 B4-B2B16
// ======================================================

function resetPerformanceValues() {

  performanceContributionCount.textContent = "—";
  performancePoints.textContent = "—";
  performanceTerritorial.textContent = "—";
  performanceAttendance.textContent = "—";
  performanceOrganization.textContent = "—";
  performanceLogistics.textContent = "—";
  performanceDigital.textContent = "—";
}


function performanceNumber(value) {

  return Number.isFinite(value)
    ? String(value)
    : "0";
}


async function loadPersonPerformance(personId) {

  const canonicalPersonId =
    cleanText(personId);

  resetPerformanceValues();

  if (!canonicalPersonId) {

    performanceStatus.textContent =
      "Desempeño no disponible: este registro todavía no tiene identidad canónica de persona.";

    return;
  }

  performanceStatus.textContent =
    "Consultando desempeño operativo…";

  try {

    const response =
      await getPersonPerformanceSummary({
        personId:
          canonicalPersonId
      });

    const data =
      response?.data;

    const summary =
      data?.summary;

    if (
      !data ||
      data.personId !== canonicalPersonId ||
      !summary ||
      summary.personId !== canonicalPersonId
    ) {

      throw new Error(
        "INVALID_PERFORMANCE_SUMMARY_RESPONSE"
      );
    }

    if (
      summary.runtimeScoringActivated !== true
    ) {

      performanceStatus.textContent =
        "El desempeño operativo todavía no está activado. No se muestra una calificación ni un índice general.";

      return;
    }

    const historical =
      summary.contribution?.historical;

    const dimensions =
      historical?.byDimension;

    if (
      !historical ||
      !dimensions ||
      typeof dimensions !== "object"
    ) {

      throw new Error(
        "INVALID_PERFORMANCE_DIMENSIONS"
      );
    }

    performanceContributionCount.textContent =
      performanceNumber(
        historical.contributionCount
      );

    performancePoints.textContent =
      performanceNumber(
        historical.points
      );

    performanceTerritorial.textContent =
      performanceNumber(
        dimensions.TERRITORIAL_ACTIVITY
      );

    performanceAttendance.textContent =
      performanceNumber(
        dimensions.ATTENDANCE
      );

    performanceOrganization.textContent =
      performanceNumber(
        dimensions.ORGANIZATION
      );

    performanceLogistics.textContent =
      performanceNumber(
        dimensions.LOGISTICS
      );

    performanceDigital.textContent =
      performanceNumber(
        dimensions.DIGITAL_ACTIVITY
      );

    performanceStatus.textContent =
      summary.generalPerformanceIndex?.calculated === true
        ? "Contribución operativa verificada."
        : "Contribución operativa verificada. El índice general todavía no se calcula.";

  } catch (error) {

    console.error(
      "Error al cargar desempeño operativo:",
      error
    );

    resetPerformanceValues();

    const code =
      cleanText(error?.code);

    performanceStatus.textContent =
      code === "functions/permission-denied"
        ? "No tienes autorización para consultar el desempeño de esta persona."
        : "No fue posible consultar el desempeño operativo en este momento.";
  }
}

async function loadPersonProfile(uid) {

  try {

    const personReference =
      doc(
        db,
        "usuarios",
        uid
      );

    const personSnapshot =
      await getDoc(
        personReference
      );

    if (!personSnapshot.exists()) {

      showError(
        "La persona solicitada no existe."
      );

      return;
    }

    const person =
      personSnapshot.data();


    // ==================================================
    // RESPONSABLE DIRECTO
    // ==================================================

    const parentName =
      await getParentName(
        person.parentUserId,
        person.parentUserName
      );


    // ==================================================
    // DATOS GENERALES
    // ==================================================

    personName.textContent =
      cleanText(person.name) || "Sin nombre";

    personEmail.textContent =
      cleanText(person.email) || "—";

    personPhone.textContent =
      cleanText(person.phone) || "—";

    personWhatsApp.textContent =
      person.hasWhatsApp === true
        ? "Sí"
        : person.hasWhatsApp === false
          ? "No"
          : "No registrado";

    personLocality.textContent =
      cleanText(person.locality) || "—";

    personStreet.textContent =
      cleanText(person.street) || "—";

    personHouseNumber.textContent =
      cleanText(person.houseNumber) || "—";

    personStatus.textContent =
      person.active === true
        ? "Activo"
        : person.active === false
          ? "Inactivo"
          : "Sin definir";


    // ==================================================
    // ORGANIZACIÓN
    // ==================================================

    personRole.textContent =
      roleLabel(person.role);

    personMunicipality.textContent =
      cleanText(
        person.municipalityName
      ) ||
      cleanText(
        person.municipalityId
      ) ||
      "—";

    personStructure.textContent =
      cleanText(
        person.structureName
      ) ||
      cleanText(
        person.structureId
      ) ||
      "—";

    if (
      person.role === "admin" ||
      person.role === "lider_principal" ||
      person.role === "coordinador_municipal"
    ) {

      personStructure.textContent =
        "No aplica";

      personStructureChief.textContent =
        "No aplica";

    } else if (
      person.role === "jefe_estructura"
    ) {

      personStructureChief.textContent =
        cleanText(person.name) ||
        "—";

    } else {

      personStructureChief.textContent =
        cleanText(
          person.structureChiefName
        ) ||
        cleanText(
          person.chiefName
        ) ||
        "—";
    }

    personParent.textContent =
      parentName;


    // ==================================================
    // TRAZABILIDAD
    // ==================================================

    personUid.textContent =
      person.uid || uid;

    personCampaign.textContent =
      cleanText(
        person.campaignId
      ) || "—";


    // ==================================================
    // MOSTRAR PERFIL
    // ==================================================

    loadingSection.hidden = true;
    errorSection.hidden = true;
    profileSection.hidden = false;


    // ==================================================
    // ACTIVIDAD
    // BUILD-117B-2
    //
    // Se consulta después de mostrar el perfil.
    // Una demora o falla de métricas no bloquea
    // los datos generales de la persona.
    // ==================================================

    void loadPersonActivity(
      uid
    );

    // ==================================================
    // DESEMPEÑO OPERATIVO
    // BUILD-124 B4-B2B16
    //
    // person.personId es la identidad canónica.
    // Nunca se sustituye con UID.
    // ==================================================

    void loadPersonPerformance(
      person.personId
    );

  } catch (error) {

    console.error(
      "Error al cargar perfil operativo:",
      error
    );

    showError(
      "No fue posible consultar el perfil operativo."
    );
  }
}


// ======================================================
// OBTENER UID DESDE URL
// ======================================================

const parameters =
  new URLSearchParams(
    window.location.search
  );

const targetUid =
  cleanText(
    parameters.get("id")
  );


// ======================================================
// AUTENTICACIÓN
// ======================================================

onAuthStateChanged(
  auth,

  async (user) => {

    if (!user) {

      window.location.href =
        "./login.html";

      return;
    }

    if (!targetUid) {

      showError(
        "No se recibió el identificador de la persona."
      );

      return;
    }

    await loadPersonProfile(
      targetUid
    );
  }
);


// ======================================================
// VOLVER
// ======================================================

backButton.addEventListener(
  "click",
  () => {

    if (
      window.history.length > 1
    ) {

      window.history.back();

      return;
    }

    window.location.href =
      "./admin.html";
  }
);


// ======================================================
// SALIR
// ======================================================

logoutButton.addEventListener(
  "click",
  async () => {

    try {

      await signOut(auth);

      window.location.href =
        "./login.html";

    } catch (error) {

      console.error(
        "Error al cerrar sesión:",
        error
      );
    }
  }
);
