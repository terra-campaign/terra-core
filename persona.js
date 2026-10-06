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

async function loadActorProfile(user) { if (!user || !cleanText(user.uid)) { actorProfile = null; return null; } const actorSnapshot = await getDoc(doc(db, "usuarios", user.uid)); if (!actorSnapshot.exists()) { actorProfile = null; return null; } actorProfile = { uid: user.uid, ...actorSnapshot.data() }; return actorProfile; }

const getPersonActivitySummary =
  httpsCallable(
    functions,
    "getPersonActivitySummary"
  );

const getPersonProfileContext =
  httpsCallable(
    functions,
    "getPersonProfileContext"
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


const errorTitle =
  document.getElementById("errorTitle");

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

const performanceHeading =
  document.getElementById(
    "performanceHeading"
  );

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

const performanceContributionsActions =
  document.getElementById(
    "performanceContributionsActions"
  );

const performanceContributionsButton =
  document.getElementById(
    "performanceContributionsButton"
  );

const performanceContributionsPanel =
  document.getElementById(
    "performanceContributionsPanel"
  );

const performanceContributionsTitle =
  document.getElementById(
    "performanceContributionsTitle"
  );

const performanceContributionsSummary =
  document.getElementById(
    "performanceContributionsSummary"
  );

const performanceContributionsList =
  document.getElementById(
    "performanceContributionsList"
  );

let performanceContributionDetails = [];


// ======================================================
// UTILIDADES
// ======================================================

function cleanText(value) {
  return String(value || "").trim();
}


function showError(
  message,
  title = "No fue posible cargar el perfil"
) {

  loadingSection.hidden = true;
  profileSection.hidden = true;

  errorTitle.textContent =
    title;

  errorMessage.textContent =
    message || "Ocurri\u00f3 un error.";

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


    eventsCount.textContent =
      Number.isInteger(data.eventsAttended)
        ? String(data.eventsAttended)
        : "—";


    activityStatus.textContent =
      "Misiones, evidencias y eventos calculados con datos operativos reales validados.";

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

  resetPerformanceContributionDetails();
}


function performanceNumber(value) {

  return Number.isFinite(value)
    ? String(value)
    : "0";
}


function performanceDimensionLabel(value) {

  const labels = {
    TERRITORIAL_ACTIVITY:
      "Actividad territorial",

    ATTENDANCE:
      "Asistencia",

    ORGANIZATION:
      "Organizacion",

    LOGISTICS:
      "Logistica",

    DIGITAL_ACTIVITY:
      "Actividad digital"
  };

  return labels[value] ||
    cleanText(value) ||
    "Sin dimension";
}


function performanceActivityLabel(value) {

  const labels = {
    DIGITAL_ACTIVITY:
      "Actividad digital",

    TERRITORIAL_BRIGADE:
      "Brigada territorial"
  };

  const token =
    cleanText(value);

  if (!token) {
    return "Actividad operativa";
  }

  const normalized =
    token
      .trim()
      .replace(/[s-]+/g, "_")
      .toUpperCase();

  return labels[normalized] ||
    token
      .replace(/[_-]+/g, " ")
      .toLowerCase();
}


function performanceContributionDate(value) {

  const token =
    cleanText(value);

  if (!token) {
    return "Fecha no disponible";
  }

  const date =
    new Date(token);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Fecha no disponible";
  }

  return new Intl.DateTimeFormat(
    "es-MX",
    {
      dateStyle: "medium",
      timeStyle: "short"
    }
  ).format(date);
}


function createContributionField(
  label,
  value
) {

  const field =
    document.createElement("div");

  field.className =
    "performance-contribution-field";

  const title =
    document.createElement("span");

  title.className =
    "muted";

  title.textContent =
    label;

  const content =
    document.createElement("strong");

  content.textContent =
    value;

  field.append(
    title,
    content
  );

  return field;
}


function renderPerformanceContributions() {

  performanceContributionsList
    .replaceChildren();

  const details =
    [...performanceContributionDetails]
      .sort(
        (left, right) => {

          const leftTime =
            Date.parse(
              left?.occurredAt || ""
            );

          const rightTime =
            Date.parse(
              right?.occurredAt || ""
            );

          const safeLeft =
            Number.isFinite(leftTime)
              ? leftTime
              : 0;

          const safeRight =
            Number.isFinite(rightTime)
              ? rightTime
              : 0;

          return safeRight - safeLeft;
        }
      );

  performanceContributionsSummary.textContent =
    details.length === 1
      ? "1 contribucion verificada."
      : details.length +
        " contribuciones verificadas.";

  if (!details.length) {

    const empty =
      document.createElement("p");

    empty.className =
      "muted performance-contributions-empty";

    empty.textContent =
      "Todavia no hay contribuciones verificadas para mostrar.";

    performanceContributionsList
      .appendChild(empty);

    return;
  }

  for (
    const detail of
    details
  ) {

    const card =
      document.createElement("article");

    card.className =
      "performance-contribution-card";

    const top =
      document.createElement("div");

    top.className =
      "performance-contribution-card__top";

    const activity =
      document.createElement("strong");

    activity.className =
      "performance-contribution-activity";

    activity.textContent =
      performanceActivityLabel(
        detail?.activityCode
      );

    const points =
      document.createElement("span");

    points.className =
      "performance-contribution-points";

    const pointsValue =
      Number.isFinite(
        detail?.points
      )
        ? detail.points
        : 0;

    points.textContent =
      "+" +
      pointsValue +
      (
        pointsValue === 1
          ? " punto"
          : " puntos"
      );

    top.append(
      activity,
      points
    );

    const fields =
      document.createElement("div");

    fields.className =
      "performance-contribution-fields";

    fields.append(
      createContributionField(
        "Dimensión",
        performanceDimensionLabel(
          detail?.scoreDimension
        )
      ),

      createContributionField(
        "Fecha",
        performanceContributionDate(
          detail?.occurredAt
        )
      ),

      createContributionField(
        "Evidencia",
        detail?.evidenceAvailable === true
          ? "Evidencia asociada"
          : "Sin evidencia asociada"
      )
    );

    card.append(
      top,
      fields
    );

    performanceContributionsList
      .appendChild(card);
  }
}


function isOwnPerformanceProfile() {

  return Boolean(
    cleanText(actorProfile?.personId) &&
    cleanText(targetPersonId) &&
    cleanText(actorProfile.personId) ===
      cleanText(targetPersonId)
  );
}


function applyPerformanceContextLabels() {

  const ownProfile =
    isOwnPerformanceProfile();

  performanceHeading.textContent =
    ownProfile
      ? "Mi desempeño operativo"
      : "Desempeño operativo";

  performanceContributionsTitle.textContent =
    ownProfile
      ? "Mis contribuciones verificadas"
      : "Contribuciones verificadas";

  const expanded =
    performanceContributionsPanel.hidden === false;

  performanceContributionsButton.textContent =
    expanded
      ? (
          ownProfile
            ? "Ocultar mis contribuciones"
            : "Ocultar contribuciones"
        )
      : (
          ownProfile
            ? "Ver mis contribuciones"
            : "Ver contribuciones verificadas"
        );
}


function closePerformanceContributions() {

  performanceContributionsPanel.hidden =
    true;

  performanceContributionsButton
    .setAttribute(
      "aria-expanded",
      "false"
    );

  applyPerformanceContextLabels();
}


function resetPerformanceContributionDetails() {

  performanceContributionDetails = [];

  performanceContributionsActions.hidden =
    true;

  performanceContributionsList
    .replaceChildren();

  performanceContributionsSummary.textContent =
    "";

  closePerformanceContributions();
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
      summary.personId !== canonicalPersonId ||
      !Array.isArray(
        data.contributionDetails
      )
    ) {

      throw new Error(
        "INVALID_PERFORMANCE_SUMMARY_RESPONSE"
      );
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

    performanceContributionDetails =
      data.contributionDetails;

    performanceContributionsActions.hidden =
      false;

    renderPerformanceContributions();

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

performanceContributionsButton.addEventListener(
  "click",
  () => {

    const opening =
      performanceContributionsPanel.hidden;

    if (opening) {

      renderPerformanceContributions();

      performanceContributionsPanel.hidden =
        false;

      performanceContributionsButton
        .setAttribute(
          "aria-expanded",
          "true"
        );

      applyPerformanceContextLabels();

      return;
    }

    closePerformanceContributions();
  }
);


async function loadPersonProfile(personId) {

  try {

    const canonicalPersonId =
      cleanText(personId);

    const response =
      await getPersonProfileContext({
        personId:
          canonicalPersonId
      });

    const data =
      response?.data || {};

    const person =
      data.person;

    if (
      data.success !== true ||
      !person ||
      cleanText(person.personId) !==
        canonicalPersonId
    ) {

      throw new Error(
        "INVALID_PERSON_PROFILE_CONTEXT"
      );
    }


    const parentName =
      getParentName(
        person.parentName
      );


    // ==================================================
    // DATOS GENERALES
    // ==================================================

    personName.textContent =
      cleanText(person.name) || "Sin nombre";

    personEmail.textContent =
      cleanText(person.email) || "\u2014";

    personPhone.textContent =
      cleanText(person.phone) || "\u2014";

    personWhatsApp.textContent =
      person.hasWhatsApp === true
        ? "S\u00ed"
        : person.hasWhatsApp === false
          ? "No"
          : "No registrado";

    personLocality.textContent =
      cleanText(person.locality) || "\u2014";

    personStreet.textContent =
      cleanText(person.street) || "\u2014";

    personHouseNumber.textContent =
      cleanText(person.houseNumber) || "\u2014";

    personStatus.textContent =
      person.active === true
        ? "Activo"
        : person.active === false
          ? "Inactivo"
          : "Sin definir";


    // ==================================================
    // ORGANIZACI\u00d3N
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
      "\u2014";

    personStructure.textContent =
      cleanText(
        person.structureName
      ) ||
      cleanText(
        person.structureId
      ) ||
      "\u2014";


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
        "\u2014";

    } else {

      personStructureChief.textContent =
        cleanText(
          person.structureChiefName
        ) ||
        "\u2014";
    }


    personParent.textContent =
      parentName;


    // ==================================================
    // TRAZABILIDAD CAN\u00d3NICA
    // ==================================================

    personUid.textContent =
      cleanText(
        person.accountUid
      ) ||
      "Sin cuenta digital";

    personCampaign.textContent =
      cleanText(
        person.campaignId
      ) ||
      "\u2014";


    // ==================================================
    // MOSTRAR PERFIL
    // ==================================================

    loadingSection.hidden = true;
    errorSection.hidden = true;
    profileSection.hidden = false;


    if (
      window.location.hash ===
        "#desempeno"
    ) {

      const performanceSection =
        document.getElementById(
          "desempeno"
        );

      if (performanceSection) {

        requestAnimationFrame(
          () => {

            performanceSection
              .scrollIntoView({
                behavior: "smooth",
                block: "start"
              });
          }
        );
      }
    }


    // ==================================================
    // ACTIVIDAD OPERATIVA
    //
    // El servicio hist\u00f3rico todav\u00eda trabaja por UID.
    // No se inventa UID para una persona sin cuenta.
    // ==================================================

    const accountUid =
      cleanText(
        person.accountUid
      );

    if (accountUid) {

      void loadPersonActivity(
        accountUid
      );

    } else {

      missionsAssigned.textContent =
        "\u2014";

      missionsCompleted.textContent =
        "\u2014";

      evidenceCount.textContent =
        "\u2014";

      eventsCount.textContent =
        "\u2014";

      activityStatus.textContent =
        "La actividad operativa por persona sin cuenta digital est\u00e1 pendiente de migraci\u00f3n al identificador can\u00f3nico.";
    }


    // ==================================================
    // DESEMPE\u00d1O OPERATIVO
    // personId es la identidad can\u00f3nica.
    // ==================================================

    void loadPersonPerformance(
      person.personId
    );


  } catch (error) {

    console.error(
      "Error al cargar perfil operativo:",
      error
    );

    const code =
      cleanText(error?.code);

    const permissionDenied =
      code === "permission-denied" ||
      code === "functions/permission-denied";

    const notFound =
      code === "not-found" ||
      code === "functions/not-found";

    showError(
      permissionDenied
        ? "No tienes autorizaci\u00f3n para consultar el perfil de esta persona."
        : notFound
          ? "La persona solicitada no existe."
          : "No fue posible consultar el perfil operativo.",
      permissionDenied
        ? "Acceso no autorizado"
        : notFound
          ? "Persona no encontrada"
          : "No fue posible cargar el perfil"
    );
  }
}

// ======================================================
// OBTENER personId CAN\u00d3NICO DESDE URL
// ======================================================

const parameters =
  new URLSearchParams(
    window.location.search
  );

const targetPersonId =
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

    await loadActorProfile(user);

    applyPerformanceContextLabels();

    if (!targetPersonId) {

      showError(
        "No se recibió el identificador de la persona."
      );

      return;
    }

    await loadPersonProfile(
      targetPersonId
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
