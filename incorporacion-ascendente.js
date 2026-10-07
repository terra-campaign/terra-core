// ======================================================
// TERRA CAMPAIGN
// INCORPORACIÓN ASCENDENTE DESDE APOYO TERRITORIAL
// BUILD-UPWARD-001
// ======================================================

import { auth } from "./firebase-config.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  getFunctions,
  httpsCallable
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js";


// ======================================================
// DOM
// ======================================================

const $ = selector =>
  document.querySelector(selector);

const ownerName =
  $("#ownerName");

const ownerRole =
  $("#ownerRole");

const ownerStructure =
  $("#ownerStructure");

const ownerMunicipality =
  $("#ownerMunicipality");

const pageStatus =
  $("#pageStatus");

const incorporationForm =
  $("#incorporationForm");

const targetRoleInput =
  $("#targetRole");

const parentPersonIdInput =
  $("#parentPersonId");

const parentHelp =
  $("#parentHelp");

const personNameInput =
  $("#personName");

const personPhoneInput =
  $("#personPhone");

const personWhatsAppYesInput =
  $("#personWhatsAppYes");

const personLocalityInput =
  $("#personLocality");

const personStreetInput =
  $("#personStreet");

const personHouseNumberInput =
  $("#personHouseNumber");

const personEmailInput =
  $("#personEmail");

const personPasswordInput =
  $("#personPassword");

const formStatus =
  $("#formStatus");

const saveButton =
  $("#saveButton");

const backButton =
  $("#backButton");

const logoutButton =
  $("#logoutButton");


// ======================================================
// ESTADO
// ======================================================

let currentUser = null;
let currentContext = null;
let saving = false;
let sessionVersion = 0;

const functions =
  getFunctions(
    undefined,
    "us-central1"
  );

const getUpwardIncorporationContext =
  httpsCallable(
    functions,
    "getUpwardIncorporationContext"
  );

const createUpwardIncorporation =
  httpsCallable(
    functions,
    "createUpwardIncorporation"
  );


// ======================================================
// UTILIDADES
// ======================================================

function setText(
  element,
  value
) {
  if (element) {
    element.textContent =
      value || "";
  }
}


function showStatus(
  element,
  message,
  type = ""
) {

  if (!element) {
    return;
  }

  element.textContent =
    message || "";

  element.hidden =
    !message;

  element.className =
    type
      ? `status status--${type}`
      : "status";
}


function getErrorMessage(
  error
) {

  return (
    error?.message ||
    error?.details ||
    "No fue posible completar la operación."
  );
}


function roleLabel(
  role
) {

  const labels = {
    participante:
      "Participante",

    apoyo_territorial:
      "Apoyo territorial",

    integrante:
      "Integrante",

    colaborador_base:
      "Colaborador de base"
  };

  return (
    labels[role] ||
    role ||
    ""
  );
}


// ======================================================
// RENDER CONTEXTO
// ======================================================

function renderOwner() {

  const introducer =
    currentContext?.introducer ||
    {};

  setText(
    ownerName,
    introducer.name ||
      "Apoyo territorial"
  );

  setText(
    ownerRole,
    roleLabel(
      introducer.role
    )
  );

  setText(
    ownerStructure,
    introducer.structureName
      ? `Estructura: ${introducer.structureName}`
      : introducer.structureId
        ? `Estructura: ${introducer.structureId}`
        : ""
  );

  setText(
    ownerMunicipality,
    introducer.municipalityName
      ? `Municipio: ${introducer.municipalityName}`
      : introducer.municipalityId
        ? `Municipio: ${introducer.municipalityId}`
        : ""
  );
}


function renderTargetRoles() {

  targetRoleInput.innerHTML = "";

  const initialOption =
    document.createElement(
      "option"
    );

  initialOption.value = "";
  initialOption.textContent =
    "Selecciona el nivel";

  targetRoleInput.appendChild(
    initialOption
  );


  const parentCandidates =
    Array.isArray(
      currentContext?.parentCandidates
    )
      ? currentContext.parentCandidates
      : [];


  for (
    const group of
    parentCandidates
  ) {

    if (
      group.targetRole !==
        "participante" &&
      group.targetRole !==
        "apoyo_territorial"
    ) {
      continue;
    }

    const option =
      document.createElement(
        "option"
      );

    option.value =
      group.targetRole;

    option.textContent =
      group.targetRoleLabel ||
      roleLabel(
        group.targetRole
      );

    targetRoleInput.appendChild(
      option
    );
  }
}


function selectedCandidateGroup() {

  const parentCandidates =
    Array.isArray(
      currentContext?.parentCandidates
    )
      ? currentContext.parentCandidates
      : [];

  return (
    parentCandidates.find(
      group =>
        group.targetRole ===
          targetRoleInput.value
    ) ||
    null
  );
}


function renderParentCandidates() {

  parentPersonIdInput.innerHTML = "";

  const targetRole =
    targetRoleInput.value;

  if (!targetRole) {

    const option =
      document.createElement(
        "option"
      );

    option.value = "";
    option.textContent =
      "Primero selecciona el nivel";

    parentPersonIdInput.appendChild(
      option
    );

    parentPersonIdInput.disabled =
      true;

    setText(
      parentHelp,
      ""
    );

    return;
  }


  const group =
    selectedCandidateGroup();

  const members =
    Array.isArray(
      group?.members
    )
      ? group.members
      : [];


  const initialOption =
    document.createElement(
      "option"
    );

  initialOption.value = "";

  initialOption.textContent =
    members.length
      ? "Selecciona responsable"
      : "No hay responsables disponibles";

  parentPersonIdInput.appendChild(
    initialOption
  );


  for (
    const member of
    members
  ) {

    if (!member.personId) {
      continue;
    }

    const option =
      document.createElement(
        "option"
      );

    option.value =
      member.personId;

    option.textContent =
      member.name ||
      member.personId;

    parentPersonIdInput.appendChild(
      option
    );
  }


  parentPersonIdInput.disabled =
    members.length === 0;


  if (group?.requiredParentRoleLabel) {

    setText(
      parentHelp,
      `La nueva persona quedará bajo responsabilidad de un ${group.requiredParentRoleLabel}.`
    );

  } else {

    setText(
      parentHelp,
      ""
    );
  }
}


// ======================================================
// CARGA DE CONTEXTO
// ======================================================

async function loadContext(
  version
) {

  const result =
    await getUpwardIncorporationContext();

  if (
    version !==
    sessionVersion
  ) {
    return;
  }


  const data =
    result?.data ||
    {};

  if (
    data.success !== true
  ) {
    throw new Error(
      "No fue posible cargar tu organización."
    );
  }


  if (
    data.introducer?.role !==
      "apoyo_territorial"
  ) {
    throw new Error(
      "Esta pantalla está disponible únicamente para Apoyo Territorial."
    );
  }


  currentContext =
    data;

  renderOwner();
  renderTargetRoles();
  renderParentCandidates();
}


// ======================================================
// CREAR INCORPORACIÓN
// ======================================================

async function handleSubmit(
  event
) {

  event.preventDefault();

  if (
    saving ||
    !currentContext
  ) {
    return;
  }


  const targetRole =
    targetRoleInput.value;

  const parentPersonId =
    parentPersonIdInput.value;

  const name =
    personNameInput.value.trim();

  const phone =
    personPhoneInput.value.trim();

  const locality =
    personLocalityInput.value.trim();

  const street =
    personStreetInput.value.trim();

  const houseNumber =
    personHouseNumberInput.value.trim();

  const email =
    personEmailInput.value
      .trim()
      .toLowerCase();

  const password =
    personPasswordInput.value;

  const hasWhatsApp =
    Boolean(
      phone &&
      personWhatsAppYesInput.checked
    );


  if (!targetRole) {
    showStatus(
      formStatus,
      "Selecciona el nivel de la persona.",
      "error"
    );
    return;
  }


  if (!parentPersonId) {
    showStatus(
      formStatus,
      "Selecciona al responsable jerárquico.",
      "error"
    );
    return;
  }


  if (name.length < 2) {
    showStatus(
      formStatus,
      "Ingresa el nombre completo.",
      "error"
    );
    return;
  }


  if (locality.length < 2) {
    showStatus(
      formStatus,
      "Ingresa la población.",
      "error"
    );
    return;
  }


  if (!email) {
    showStatus(
      formStatus,
      "Ingresa el correo electrónico.",
      "error"
    );
    return;
  }


  if (password.length < 6) {
    showStatus(
      formStatus,
      "La contraseña temporal debe tener al menos 6 caracteres.",
      "error"
    );
    return;
  }


  saving = true;

  saveButton.disabled =
    true;

  saveButton.textContent =
    "Incorporando...";

  showStatus(
    formStatus,
    ""
  );


  try {

    const result =
      await createUpwardIncorporation({
        targetRole,
        parentPersonId,

        name,
        phone,
        hasWhatsApp,
        locality,
        street,
        houseNumber,

        createDigitalAccount:
          true,

        email,
        password
      });


    const data =
      result?.data ||
      {};


    if (
      data.success !== true
    ) {
      throw new Error(
        "La incorporación no pudo completarse."
      );
    }


    incorporationForm.reset();

    personWhatsAppYesInput.checked =
      false;

    const noWhatsApp =
      $("#personWhatsAppNo");

    if (noWhatsApp) {
      noWhatsApp.checked =
        true;
    }

    targetRoleInput.value =
      "";

    renderParentCandidates();


    showStatus(
      formStatus,
      "Persona incorporada correctamente. La relación jerárquica y la autoría de incorporación quedaron registradas.",
      "success"
    );

  } catch (error) {

    console.error(
      "Error al incorporar persona:",
      error
    );

    showStatus(
      formStatus,
      getErrorMessage(error),
      "error"
    );

  } finally {

    saving = false;

    saveButton.disabled =
      false;

    saveButton.textContent =
      "Incorporar persona";
  }
}


// ======================================================
// EVENTOS
// ======================================================

targetRoleInput?.addEventListener(
  "change",
  renderParentCandidates
);


incorporationForm?.addEventListener(
  "submit",
  handleSubmit
);


backButton?.addEventListener(
  "click",
  () => {
    window.location.href =
      "./admin.html";
  }
);


logoutButton?.addEventListener(
  "click",
  async () => {

    await signOut(auth);

    window.location.href =
      "./login.html";
  }
);


// ======================================================
// SESIÓN
// ======================================================

onAuthStateChanged(
  auth,
  async user => {

    sessionVersion += 1;

    const version =
      sessionVersion;

    currentUser =
      user || null;


    if (!user) {

      currentContext =
        null;

      window.location.href =
        "./login.html";

      return;
    }


    try {

      showStatus(
        pageStatus,
        ""
      );

      await loadContext(
        version
      );

    } catch (error) {

      console.error(
        "Acceso rechazado:",
        error
      );

      currentContext =
        null;

      incorporationForm.hidden =
        true;

      showStatus(
        pageStatus,
        getErrorMessage(error),
        "error"
      );
    }
  }
);