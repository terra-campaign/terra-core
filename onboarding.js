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

const getMyOnboardingStatus =
  httpsCallable(
    functions,
    "getMyOnboardingStatus"
  );

const completeOnboarding =
  httpsCallable(
    functions,
    "completeOnboarding"
  );

const updateMyActivityPreferences =
  httpsCallable(
    functions,
    "updateMyActivityPreferences"
  );


const getMyActivityPreferences =
  httpsCallable(
    functions,
    "getMyActivityPreferences"
  );

const stepLabel =
  document.getElementById("onboardingStep");

const title =
  document.getElementById("onboardingTitle");

const description =
  document.getElementById("onboardingDescription");

const content =
  document.getElementById("onboardingContent");

const message =
  document.getElementById("onboardingMessage");

const previousButton =
  document.getElementById("previousButton");

const nextButton =
  document.getElementById("nextButton");

const logoutButton =
  document.getElementById("logoutButton");


let currentStep = 0;
let profile = null;
let responsibleName = "";
let onboardingStatus = null;
let finishing = false;
let initialized = false;
let savingActivityPreferences = false;

const activityPreferences = {
  territorial_brigade: false,
  material_distribution: false,
  structure_growth: false,
  event_logistics: false,
  digital_activity: false,
  wall_painting: false,
  operational_accompaniment: false,
  other_configurable: false
};

const acknowledgedCriteria =
  new Set();


const params =
  new URLSearchParams(
    window.location.search
  );

const missionId =
  params.get("mission");

const eventInvitationId =
  params.get("eventInvitation");


const validInternalId =
  value =>
    typeof value === "string" &&
    /^[A-Za-z0-9_-]{1,128}$/.test(value);


const destination =
  validInternalId(missionId)
    ? `./mision.html?id=${encodeURIComponent(missionId)}`
    : validInternalId(eventInvitationId)
      ? `./eventos.html?invitation=${encodeURIComponent(eventInvitationId)}`
      : "./admin.html";


function cleanText(value) {

  return typeof value === "string"
    ? value.trim()
    : "";
}


function displayValue(...values) {

  for (const value of values) {

    const cleaned =
      cleanText(value);

    if (cleaned) {
      return cleaned;
    }
  }

  return "No especificado";
}


function roleLabel(role) {

  const labels = {
    lider_principal:
      "Líder principal",

    coordinador_municipal:
      "Coordinador municipal",

    jefe_estructura:
      "Responsable de estructura",

    integrante:
      "Integrante",

    participante:
      "Participante",

    colaborador_base:
      "Colaborador de base",

    apoyo_territorial:
      "Apoyo territorial"
  };

  return labels[role] ||
    displayValue(role);
}


async function resolveResponsibleName(person) {
  if (person?.role === "lider_principal") {
    return "No aplica";
  }

  return displayValue(
    person?.parentUserName,
    person?.parentName,
    person?.structureChiefName,
    person?.chiefName
  );
}


function escapeHtml(value) {

  return String(
    value ?? ""
  )
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function infoList(items) {

  return `
    <div class="grid">
      ${items.map(item => `
        <article class="card">
          <p class="eyebrow">
            ${escapeHtml(item.label)}
          </p>
          <strong>
            ${escapeHtml(item.value)}
          </strong>
        </article>
      `).join("")}
    </div>
  `;
}


const steps = [

  {
    key:
      "welcome",

    label:
      "PASO 1 DE 9",

    title:
      "Bienvenido a TERRA Campaign",

    description:
      "Antes de comenzar, conocerás cómo estás integrado a la organización y cómo funciona tu participación.",

    render:
      () => `
        <p>
          Este recorrido inicial te ayudará a identificar tu función,
          tu estructura y la forma en que TERRA registra tu actividad.
        </p>

        <p>
          Solo tendrás que realizarlo una vez.
        </p>
      `
  },


  {
    key:
      "identity",

    criterion:
      "localityKnown",

    label:
      "PASO 2 DE 9",

    title:
      "Quién soy y dónde participo",

    description:
      "Estos son los datos principales de tu registro territorial.",

    render:
      () =>
        infoList([
          {
            label:
              "NOMBRE",
            value:
              displayValue(profile?.name)
          },
          {
            label:
              "FUNCIÓN",
            value:
              roleLabel(profile?.role)
          },
          {
            label:
              "LOCALIDAD",
            value:
              displayValue(
                profile?.locality
              )
          },
          {
            label:
              "MUNICIPIO",
            value:
              displayValue(
                profile?.municipalityName,
                profile?.municipalityId
              )
          }
        ])
  },


  {
    key:
      "structure",

    criterion:
      "structureKnown",

    label:
      "PASO 3 DE 9",

    title:
      "Mi estructura",

    description:
      "Tu estructura determina dónde participas dentro de la organización.",

    render:
      () =>
        infoList([
          {
            label:
              "ESTRUCTURA",
            value:
              displayValue(
                profile?.structureName,
                profile?.structureId,
                profile?.role === "lider_principal" ||
                profile?.role === "coordinador_municipal"
                  ? "No aplica"
                  : ""
              )
          },
          {
            label:
              "CAMPAÑA",
            value:
              displayValue(
                profile?.campaignName,
                profile?.campaignId
              )
          }
        ])
  },


  {
    key:
      "responsible",

    criterion:
      "responsibleKnown",

    label:
      "PASO 4 DE 9",

    title:
      "Mi responsable",

    description:
      "Esta es la referencia organizacional inmediata registrada para tu participación.",

    render:
      () =>
        infoList([
          {
            label:
              "RESPONSABLE",
            value:
              displayValue(responsibleName)
          }
        ])
  },


  {
    key:
      "responsibilities",

    criterion:
      "responsibilitiesUnderstood",

    label:
      "PASO 5 DE 9",

    title:
      "Mis responsabilidades",

    description:
      "Tu participación se basa en actividades y compromisos operativos verificables.",

    render:
      () => `
        <p>
          Cuando aceptes una misión, evento u otra actividad concreta,
          TERRA podrá registrar su cumplimiento, asistencia, evidencia
          y validación cuando corresponda.
        </p>

        <p>
          Tu función dentro de la estructura no significa que todas las
          actividades sean obligatorias. Cada compromiso específico debe
          quedar claramente identificado.
        </p>
      `
  },


  {
    key:
      "activities",

    criterion:
      "optionalActivitiesExplained",

    label:
      "PASO 6 DE 9",

    title:
      "Actividades en las que puedo apoyar",

    description:
      "Selecciona las actividades en las que estás dispuesto(a) a apoyar. Puedes elegir una, varias o ninguna, según tus intereses y disponibilidad.",

    render:
      () => `
        <div class="grid">
          <article class="card"><label><input type="checkbox" data-activity-preference="territorial_brigade"> <strong>Brigadeo y actividad territorial</strong></label></article>
          <article class="card"><label><input type="checkbox" data-activity-preference="material_distribution"> <strong>Volanteo y distribución de materiales</strong></label></article>
          <article class="card"><label><input type="checkbox" data-activity-preference="structure_growth"> <strong>Organización y crecimiento de estructura</strong></label></article>
          <article class="card"><label><input type="checkbox" data-activity-preference="event_logistics"> <strong>Logística de apoyo en eventos</strong></label></article>
          <article class="card"><label><input type="checkbox" data-activity-preference="digital_activity"> <strong>Actividad digital y redes sociales</strong></label></article>
          <article class="card"><label><input type="checkbox" data-activity-preference="wall_painting"> <strong>Pinta de bardas</strong></label></article>
          <article class="card"><label><input type="checkbox" data-activity-preference="operational_accompaniment"> <strong>Acompañamiento operativo en misiones</strong></label></article>
          <article class="card"><label><input type="checkbox" data-activity-preference="other_configurable"> <strong>Otras actividades configurables</strong></label></article>
        </div>

        <p>
          Seleccionar una actividad no significa que ya estás aceptando una tarea.
          Cuando exista una actividad concreta, podrás conocerla y asumir el
          compromiso correspondiente.
        </p>

        <p>
          <strong>Marcar más opciones no aumenta tu calificación.</strong>
          Tu desempeño se construye con tu participación real: las actividades
          que realices y sean validadas podrán contribuir a tu historial,
          reconocimiento y puntuación dentro de TERRA.
        </p>
      `
  },


  {
    key:
      "availability",

    criterion:
      "preferenceCommitmentDistinctionUnderstood",

    label:
      "PASO 7 DE 9",

    title:
      "Disponibilidad y compromisos",

    description:
      "Una preferencia de apoyo y un compromiso aceptado son cosas diferentes.",

    render:
      () => `
        <p>
          Tus preferencias sirven para saber en qué actividades puedes
          colaborar y facilitar futuras invitaciones.
        </p>

        <p>
          El compromiso operativo comienza cuando aceptas una actividad,
          misión o participación específica.
        </p>

        <p>
          Modificar posteriormente tus preferencias no cambia los
          compromisos ni el historial ya registrado.
        </p>
      `
  },


  {
    key:
      "performance",

    criterion:
      "performanceEvaluationExplained",

    label:
      "PASO 8 DE 9",

    title:
      "Mi participación y desempeño",

    description:
      "TERRA registra desempeño con base en actividad operativa verificable.",

    render:
      () => `
        <p>
          Misiones cumplidas, asistencia, evidencia, validaciones y otras
          acciones operativas pueden formar parte de tu historial.
        </p>

        <p>
          La información de desempeño pertenece a tu perfil operativo y
          permite dar seguimiento a tu participación dentro de la estructura.
        </p>
      `
  },


  {
    key:
      "communication",

    criterion:
      "helpAvailable",

    label:
      "PASO 9 DE 9",

    title:
      "Comunicación y ayuda",

    description:
      "TERRA complementa la operación con comunicación y orientación contextual.",

    render:
      () => `
        <p>
          Podrás recibir información relacionada con actividades,
          misiones, eventos y otras novedades operativas por los medios
          habilitados para tu perfil.
        </p>

        <p>
          Si tienes dudas sobre una asignación o actividad, tu responsable
          dentro de la estructura es tu referencia operativa inmediata.
        </p>

        <p>
          Al finalizar este recorrido quedará registrado que recibiste
          y comprendiste esta orientación inicial.
        </p>
      `
  }

];


function bindActivityPreferenceControls() {

  const controls =
    content.querySelectorAll(
      "[data-activity-preference]"
    );

  for (const control of controls) {

    const key =
      control.dataset.activityPreference;

    if (
      !Object.prototype.hasOwnProperty.call(
        activityPreferences,
        key
      )
    ) {
      continue;
    }

    control.checked =
      activityPreferences[key] === true;

    control.addEventListener(
      "change",
      () => {
        activityPreferences[key] =
          control.checked === true;
      }
    );
  }
}


function renderStep() {

  const step =
    steps[currentStep];

  stepLabel.textContent =
    step.label;

  title.textContent =
    step.title;

  description.textContent =
    step.description;

  content.innerHTML =
    step.render();

  if (step.key === "activities") {
    bindActivityPreferenceControls();
  }

  if (step.criterion) {
    acknowledgedCriteria.add(
      step.criterion
    );
  }

  message.textContent =
    "";

  previousButton.hidden =
    currentStep === 0;

  nextButton.disabled =
    false;

  nextButton.textContent =
    currentStep === steps.length - 1
      ? "Finalizar"
      : "Continuar";

  window.scrollTo({
    top:
      0,
    behavior:
      "smooth"
  });
}


function buildCriteria() {

  const requiredCriteria = [
    "responsibleKnown",
    "structureKnown",
    "localityKnown",
    "responsibilitiesUnderstood",
    "optionalActivitiesExplained",
    "preferenceCommitmentDistinctionUnderstood",
    "performanceEvaluationExplained",
    "helpAvailable"
  ];

  const criteria = {};

  for (const criterion of requiredCriteria) {
    criteria[criterion] =
      acknowledgedCriteria.has(
        criterion
      );
  }

  return criteria;
}


async function finishOnboarding() {

  if (
    finishing ||
    !onboardingStatus?.personId
  ) {
    return;
  }

  finishing = true;

  previousButton.disabled =
    true;

  nextButton.disabled =
    true;

  nextButton.textContent =
    "Finalizando...";

  message.textContent =
    "Registrando tu orientación inicial...";

  try {

    const criteria =
      buildCriteria();

    const allCriteriaCompleted =
      Object
        .values(criteria)
        .every(
          value =>
            value === true
        );

    if (!allCriteriaCompleted) {
      throw new Error(
        "Debes recorrer toda la orientación inicial antes de finalizar."
      );
    }

    await completeOnboarding({
      deliveryMode:
        "SELF_SERVICE",

      personId:
        onboardingStatus.personId,

      criteria
    });

    const verification =
      await getMyOnboardingStatus();

    if (
      !verification?.data?.completed
    ) {
      throw new Error(
        "El onboarding no quedó confirmado por el servidor."
      );
    }

    message.textContent =
      "Primer acceso completado correctamente.";

    window.location.replace(
      destination
    );

  } catch (error) {

    console.error(
      "No fue posible completar onboarding:",
      error
    );

    message.textContent =
      error?.message ||
      "No fue posible completar el primer acceso.";

    previousButton.disabled =
      false;

    nextButton.disabled =
      false;

    nextButton.textContent =
      "Finalizar";

    finishing = false;
  }
}


previousButton.addEventListener(
  "click",
  () => {

    if (
      finishing ||
      currentStep === 0
    ) {
      return;
    }

    currentStep -= 1;
    renderStep();
  }
);


async function saveActivityPreferences() {
  if (savingActivityPreferences) return false;

  savingActivityPreferences = true;
  previousButton.disabled = true;
  nextButton.disabled = true;
  nextButton.textContent = "Guardando...";
  message.textContent = "Guardando tus preferencias de apoyo...";

  try {
    const result = await updateMyActivityPreferences({
      activityPreferences: { ...activityPreferences }
    });

    if (result?.data?.ok !== true) {
      throw new Error("El servidor no confirmó tus preferencias.");
    }

    message.textContent = "";
    return true;
  } catch (error) {
    console.error("Error al guardar preferencias:", error);
    message.textContent =
      error?.message ||
      "No fue posible guardar tus preferencias. Intenta nuevamente.";
    return false;
  } finally {
    savingActivityPreferences = false;
    previousButton.disabled = false;
    nextButton.disabled = false;
    nextButton.textContent = "Continuar";
  }
}

nextButton.addEventListener(
  "click",
  async () => {

    if (finishing) {
      return;
    }

    if (
      currentStep <
      steps.length - 1
    ) {
      if (steps[currentStep].key === "activities") {
        const preferencesSaved = await saveActivityPreferences();

        if (!preferencesSaved) {
          return;
        }
      }

      currentStep += 1;
      renderStep();
      return;
    }

    await finishOnboarding();
  }
);


logoutButton.addEventListener(
  "click",
  async () => {

    if (finishing) {
      return;
    }

    await signOut(auth);

    window.location.replace(
      "./login.html"
    );
  }
);


async function initialize(user) {

  if (initialized) {
    return;
  }

  initialized = true;

  try {

    nextButton.disabled =
      true;

    message.textContent =
      "Cargando tu información...";

    const statusResult =
      await getMyOnboardingStatus();

    onboardingStatus =
      statusResult?.data || null;

    if (
      !onboardingStatus ||
      onboardingStatus.ok !== true
    ) {
      throw new Error(
        "No fue posible determinar el estado del primer acceso."
      );
    }

    if (
      onboardingStatus.applicable === false ||
      onboardingStatus.completed === true
    ) {
      window.location.replace(
        destination
      );

      return;
    }

    const profileSnapshot =
      await getDoc(
        doc(
          db,
          "usuarios",
          user.uid
        )
      );

    if (!profileSnapshot.exists()) {
      throw new Error(
        "Tu perfil territorial no está disponible."
      );
    }

    profile =
      profileSnapshot.data();

    responsibleName =
      await resolveResponsibleName(profile);

    const preferencesResult =
      await getMyActivityPreferences();

    const savedPreferences =
      preferencesResult?.data?.activityPreferences;

    if (
      !savedPreferences ||
      preferencesResult?.data?.ok !== true
    ) {
      throw new Error(
        "No fue posible cargar tus preferencias de apoyo."
      );
    }

    Object.keys(activityPreferences)
      .forEach(key => {
        activityPreferences[key] =
          savedPreferences[key] === true;
      });

    currentStep =
      0;

    renderStep();

  } catch (error) {

    console.error(
      "No fue posible iniciar onboarding:",
      error
    );

    initialized =
      false;

    stepLabel.textContent =
      "PRIMER ACCESO";

    title.textContent =
      "No fue posible cargar tu orientación";

    description.textContent =
      "Tu sesión está activa, pero TERRA no pudo preparar la información necesaria.";

    content.innerHTML =
      "";

    message.textContent =
      error?.message ||
      "Intenta nuevamente.";

    previousButton.hidden =
      true;

    nextButton.disabled =
      true;
  }
}


onAuthStateChanged(
  auth,
  user => {

    if (!user) {

      const query =
        window.location.search || "";

      window.location.replace(
        `./login.html${query}`
      );

      return;
    }

    initialize(user);
  }
);
