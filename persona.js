// ======================================================
// TERRA CAMPAIGN
// BUILD-117B-2 â€” PERFIL OPERATIVO DE PERSONA
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

async function loadActorProfile(user) { if (!user || !cleanText(user.uid)) { actorProfile = null; return null; } const actorSnapshot = await getDoc(doc(db, "usuarios", user.uid)); if (!actorSnapshot.exists()) { actorProfile = null; return null; } actorProfile = { uid: user.uid, ...actorSnapshot.data() }; return actorProfile; }

const getPersonActivitySummary =
  httpsCallable(
    functions,
    "getPersonActivitySummary"
  );

let actorProfile = null;

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
// DESEMPEÃ‘O OPERATIVO
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
    message || "OcurriÃ³ un error.";

  errorSection.hidden = false;
}


function roleLabel(role) {

  const labels = {

    admin:
      "Administrador",

    lider_principal:
      "LÃ­der principal",

    coordinador:
      "Coordinador",

    coordinador_municipal:
      "Responsable de organizaciÃ³n",

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

function getParentName(
  ...candidateNames
) {

  for (const candidate of candidateNames) {

    const name =
      cleanText(candidate);

    if (name) {
      return name;
    }
  }

  return "\u2014";
}


// ======================================================
// ACTIVIDAD OPERATIVA
// BUILD-117B-2
// ======================================================

async function loadPersonActivity(uid) {

  missionsAssigned.textContent =
    "â€”";

  missionsCompleted.textContent =
    "â€”";

  evidenceCount.textContent =
    "â€”";

  eventsCount.textContent =
    "â€”";

  activityStatus.textContent =
    "Consultando actividad operativaâ€¦";


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
        : "â€”";

    missionsCompleted.textContent =
      Number.isInteger(data.completed)
        ? String(data.completed)
        : "â€”";

    evidenceCount.textContent =
      Number.isInteger(data.evidence)
        ? String(data.evidence)
        : "â€”";


    // Eventos todavÃ­a no tiene una fuente
    // operativa validada en esta versiÃ³n.
    eventsCount.textContent =
      "â€”";


    activityStatus.textContent =
      "Misiones y evidencias calculadas con datos operativos reales. Eventos aÃºn no estÃ¡ conectado.";

  } catch (error) {

    console.error(
      "Error al consultar actividad operativa:",
      error
    );


    missionsAssigned.textContent =
      "â€”";

    missionsCompleted.textContent =
      "â€”";

    evidenceCount.textContent =
      "â€”";

    eventsCount.textContent =
      "â€”";


    activityStatus.textContent =
      "No fue posible consultar la actividad operativa en este momento.";
  }
}


// ======================================================
// CARGAR PERFIL
// ======================================================

// ======================================================
// DESEMPEÃ‘O OPERATIVO
// BUILD-124 B4-B2B16
// ======================================================

function resetPerformanceValues() {

  performanceContributionCount.textContent = "â€”";
  performancePoints.textContent = "â€”";
  performanceTerritorial.textContent = "â€”";
  performanceAttendance.textContent = "â€”";
  performanceOrganization.textContent = "â€”";
  performanceLogistics.textContent = "â€”";
  performanceDigital.textContent = "â€”";
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
      "DesempeÃ±o no disponible: este registro todavÃ­a no tiene identidad canÃ³nica de persona.";

    return;
  }

  performanceStatus.textContent =
    "Consultando desempeÃ±o operativoâ€¦";

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
        "El desempeÃ±o operativo todavÃ­a no estÃ¡ activado. No se muestra una calificaciÃ³n ni un Ã­ndice general.";

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
        ? "ContribuciÃ³n operativa verificada."
        : "ContribuciÃ³n operativa verificada. El Ã­ndice general todavÃ­a no se calcula.";

  } catch (error) {

    console.error(
      "Error al cargar desempeÃ±o operativo:",
      error
    );

    resetPerformanceValues();

    const code =
      cleanText(error?.code);

    performanceStatus.textContent =
      code === "functions/permission-denied"
        ? "No tienes autorizaciÃ³n para consultar el desempeÃ±o de esta persona."
        : "No fue posible consultar el desempeÃ±o operativo en este momento.";
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
      getParentName(
        person.parentUserName,
        person.parentName,
        person.structureChiefName,
        person.chiefName
      );


    // ==================================================
    // DATOS GENERALES
    // ==================================================

    personName.textContent =
      cleanText(person.name) || "Sin nombre";

    personEmail.textContent =
      cleanText(person.email) || "â€”";

    personPhone.textContent =
      cleanText(person.phone) || "â€”";

    personWhatsApp.textContent =
      person.hasWhatsApp === true
        ? "SÃ­"
        : person.hasWhatsApp === false
          ? "No"
          : "No registrado";

    personLocality.textContent =
      cleanText(person.locality) || "â€”";

    personStreet.textContent =
      cleanText(person.street) || "â€”";

    personHouseNumber.textContent =
      cleanText(person.houseNumber) || "â€”";

    personStatus.textContent =
      person.active === true
        ? "Activo"
        : person.active === false
          ? "Inactivo"
          : "Sin definir";


    // ==================================================
    // ORGANIZACIÃ“N
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
      "â€”";

    personStructure.textContent =
      cleanText(
        person.structureName
      ) ||
      cleanText(
        person.structureId
      ) ||
      "â€”";

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
        "â€”";

    } else {

      personStructureChief.textContent =
        cleanText(
          person.structureChiefName
        ) ||
        cleanText(
          person.chiefName
        ) ||
        "â€”";
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
      ) || "â€”";


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
    // Se consulta despuÃ©s de mostrar el perfil.
    // Una demora o falla de mÃ©tricas no bloquea
    // los datos generales de la persona.
    // ==================================================

    void loadPersonActivity(
      uid
    );

    // ==================================================
    // DESEMPEÃ‘O OPERATIVO
    // BUILD-124 B4-B2B16
    //
    // person.personId es la identidad canÃ³nica.
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
// AUTENTICACIÃ“N
// ======================================================

onAuthStateChanged(
  auth,

  async (user) => {

    if (!user) {

      window.location.href =
        "./login.html";

      return;
    }

    await loadActorProfile(user);

    if (!targetUid) {

      showError(
        "No se recibiÃ³ el identificador de la persona."
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
        "Error al cerrar sesiÃ³n:",
        error
      );
    }
  }
);
