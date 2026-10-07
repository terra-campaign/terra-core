// ======================================================
// TERRA CAMPAIGN - APOYOS TERRITORIALES
// BUILD-APOYOS-001
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

const supportStatus =
  $("#supportStatus");

const supportList =
  $("#supportList");

const newSupportButton =
  $("#newSupportButton");

const supportModal =
  $("#supportModal");

const supportModalBackdrop =
  $("#supportModalBackdrop");

const closeSupportModalButton =
  $("#closeSupportModalButton");

const supportForm =
  $("#supportForm");

const supportNameInput =
  $("#supportName");

const supportPhoneInput =
  $("#supportPhone");

const supportWhatsAppYesInput =
  $("#supportWhatsAppYes");

const supportWhatsAppNoInput =
  $("#supportWhatsAppNo");

const supportLocalityInput =
  $("#supportLocality");

const supportStreetInput =
  $("#supportStreet");

const supportHouseNumberInput =
  $("#supportHouseNumber");

const supportDigitalAccountYesInput =
  $("#supportDigitalAccountYes");

const supportDigitalAccountNoInput =
  $("#supportDigitalAccountNo");

const supportDigitalEmailGroup =
  $("#supportDigitalEmailGroup");

const supportDigitalPasswordGroup =
  $("#supportDigitalPasswordGroup");

const supportEmailInput =
  $("#supportEmail");

const supportPasswordInput =
  $("#supportPassword");

const saveSupportButton =
  $("#saveSupportButton");

const supportFormStatus =
  $("#supportFormStatus");

const backButton =
  $("#backButton");

const logoutButton =
  $("#logoutButton");


// ======================================================
// ESTADO
// ======================================================

let currentUser = null;
let currentContext = null;
let savingSupport = false;
let supportCreated = false;
let sessionVersion = 0;

const functions =
  getFunctions(
    undefined,
    "us-central1"
  );

const getQuickAffiliationContext =
  httpsCallable(
    functions,
    "getQuickAffiliationContext"
  );

const getMyQuickAffiliations =
  httpsCallable(
    functions,
    "getMyQuickAffiliations"
  );

const createQuickAffiliation =
  httpsCallable(
    functions,
    "createQuickAffiliation"
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
  if (!element) return;

  element.textContent =
    message || "";

  element.hidden =
    !message;

  element.className =
    "status";

  if (type) {
    element.classList.add(
      `status--${type}`
    );
  }
}


function getErrorMessage(
  error
) {
  const code =
    String(
      error?.code || ""
    ).replace(
      /^functions\//,
      ""
    );

  if (
    code ===
    "permission-denied"
  ) {
    return "No tienes autorizaci\u00f3n para administrar apoyos territoriales.";
  }

  if (
    code ===
    "unauthenticated"
  ) {
    return "La sesi\u00f3n no es v\u00e1lida. Inicia sesi\u00f3n nuevamente.";
  }

  if (
    code ===
    "already-exists"
  ) {
    return "La persona ya se encuentra registrada en la organizaci\u00f3n.";
  }

  if (
    code ===
    "invalid-argument"
  ) {
    return error?.message ||
      "Revisa los datos capturados.";
  }

  return (
    error?.message ||
    "No fue posible completar la operaci\u00f3n."
  );
}


function normalizeWhatsAppNumber(
  phone
) {
  let digits =
    String(phone || "")
      .replace(/\D/g, "");

  if (
    digits.length === 10
  ) {
    digits =
      "52" + digits;
  }

  if (
    digits.length === 12 &&
    digits.startsWith("52")
  ) {
    return digits;
  }

  return "";
}


// ======================================================
// AUTORIZACION DE INTERFAZ
// ======================================================

function canManageSupports() {
  return Boolean(
    currentUser &&
    auth.currentUser?.uid ===
      currentUser.uid &&
    currentContext?.caller?.role ===
      "colaborador_base" &&
    currentContext?.targetRole ===
      "apoyo_territorial"
  );
}


function updateControls() {
  const allowed =
    canManageSupports();

  if (
    newSupportButton
  ) {
    newSupportButton.hidden =
      !allowed;

    newSupportButton.disabled =
      !allowed ||
      savingSupport;
  }

  if (
    saveSupportButton
  ) {
    saveSupportButton.disabled =
      !allowed ||
      savingSupport ||
      supportCreated;

    saveSupportButton.textContent =
      savingSupport
        ? "Guardando..."
        : "Guardar apoyo territorial";
  }
}


// ======================================================
// CONTEXTO
// ======================================================

function renderContext(
  context
) {
  const caller =
    context?.caller || {};

  setText(
    ownerName,
    caller.name ||
      "Colaborador de base"
  );

  setText(
    ownerRole,
    caller.roleLabel
      ? `Rol: ${caller.roleLabel}`
      : ""
  );

  setText(
    ownerStructure,
    caller.structureName
      ? `Estructura: ${caller.structureName}`
      : ""
  );

  setText(
    ownerMunicipality,
    caller.municipalityName
      ? `Municipio: ${caller.municipalityName}`
      : ""
  );
}


async function loadContext(
  version
) {
  const result =
    await getQuickAffiliationContext();

  if (
    version !==
    sessionVersion
  ) {
    return null;
  }

  const context =
    result?.data;

  if (
    context?.caller?.role !==
      "colaborador_base" ||
    context?.targetRole !==
      "apoyo_territorial"
  ) {
    throw new Error(
      "Esta secci\u00f3n corresponde al Colaborador de base."
    );
  }

  currentContext =
    context;

  renderContext(
    context
  );

  updateControls();

  return context;
}


// ======================================================
// RENDER APOYOS
// ======================================================

function createMutedLine(
  text
) {
  const p =
    document.createElement("p");

  p.className =
    "muted";

  p.textContent =
    text;

  return p;
}


function renderSupports(
  members
) {
  if (!supportList) {
    return;
  }

  supportList.replaceChildren();

  if (
    !Array.isArray(members) ||
    members.length === 0
  ) {
    const card =
      document.createElement(
        "div"
      );

    card.className =
      "card";

    card.appendChild(
      createMutedLine(
        "Todav\u00eda no tienes apoyos territoriales registrados."
      )
    );

    supportList.appendChild(
      card
    );

    return;
  }

  for (
    const member of members
  ) {
    const article =
      document.createElement(
        "article"
      );

    article.className =
      "card";

    const eyebrow =
      document.createElement(
        "p"
      );

    eyebrow.className =
      "eyebrow";

    eyebrow.textContent =
      "APOYO TERRITORIAL";

    article.appendChild(
      eyebrow
    );

    const title =
      document.createElement(
        "h3"
      );

    title.textContent =
      member?.name ||
      "Persona sin nombre";

    article.appendChild(
      title
    );

    if (
      member?.locality
    ) {
      article.appendChild(
        createMutedLine(
          `Localidad: ${member.locality}`
        )
      );
    }

    if (
      member?.phone
    ) {
      article.appendChild(
        createMutedLine(
          `Tel: ${member.phone}`
        )
      );
    }

    article.appendChild(
      createMutedLine(
        member?.hasDigitalAccount
          ? "Cuenta digital: vinculada"
          : "Cuenta digital: no requerida"
      )
    );

    article.appendChild(
      createMutedLine(
        member?.active === false
          ? "Estado: Inactivo"
          : "Estado: Activo"
      )
    );

    if (
      member?.personId
    ) {
      const profileLink =
        document.createElement(
          "a"
        );

      profileLink.className =
        "button";

      profileLink.textContent =
        "Ver perfil";

      profileLink.href =
        "./persona.html?id=" +
        encodeURIComponent(
          member.personId
        );

      article.appendChild(
        profileLink
      );
    }

    supportList.appendChild(
      article
    );
  }
}


async function loadSupports(
  version
) {
  showStatus(
    supportStatus,
    "Cargando apoyos territoriales..."
  );

  try {
    const result =
      await getMyQuickAffiliations();

    if (
      version !==
      sessionVersion
    ) {
      return;
    }

    const data =
      result?.data || {};

    if (
      data.targetRole !==
      "apoyo_territorial"
    ) {
      throw new Error(
        "El nivel territorial esperado no est\u00e1 disponible."
      );
    }

    renderSupports(
      Array.isArray(data.members)
        ? data.members
        : []
    );

    showStatus(
      supportStatus,
      ""
    );

  } catch (error) {
    console.error(
      "Error al cargar apoyos territoriales:",
      error
    );

    showStatus(
      supportStatus,
      getErrorMessage(error),
      "error"
    );
  }
}


// ======================================================
// MODAL
// ======================================================

function updateDigitalAccountFields() {

  const createDigitalAccount =
    supportDigitalAccountYesInput?.checked ===
      true;

  if (supportDigitalEmailGroup) {
    supportDigitalEmailGroup.hidden =
      !createDigitalAccount;
  }

  if (supportDigitalPasswordGroup) {
    supportDigitalPasswordGroup.hidden =
      !createDigitalAccount;
  }

  if (supportEmailInput) {
    supportEmailInput.required =
      createDigitalAccount;

    if (!createDigitalAccount) {
      supportEmailInput.value =
        "";
    }
  }

  if (supportPasswordInput) {
    supportPasswordInput.required =
      createDigitalAccount;

    if (!createDigitalAccount) {
      supportPasswordInput.value =
        "";
    }
  }
}


function clearFormStatus() {
  if (!supportFormStatus) {
    return;
  }

  supportFormStatus.replaceChildren();
  supportFormStatus.hidden =
    true;
  supportFormStatus.className =
    "status";
}


function openModal() {
  if (
    !canManageSupports() ||
    savingSupport
  ) {
    return;
  }

  supportForm?.reset();

  updateDigitalAccountFields();

  supportCreated = false;
  updateControls();

  clearFormStatus();

  supportModal.hidden =
    false;

  supportNameInput?.focus();
}


function closeModal() {
  supportModal.hidden =
    true;

  supportForm?.reset();

  updateDigitalAccountFields();

  supportCreated = false;
  updateControls();

  clearFormStatus();
}


// ======================================================
// COMUNICACION WHATSAPP
// ======================================================

function showCreatedSupport(
  person
) {
  if (!supportFormStatus) {
    return;
  }

  supportFormStatus.replaceChildren();

  supportFormStatus.hidden =
    false;

  supportFormStatus.className =
    "status status--success";

  const message =
    document.createElement(
      "p"
    );

  message.textContent =
    person?.name
      ? `\u2713 ${person.name} fue registrado como Apoyo territorial.`
      : "\u2713 Apoyo territorial registrado correctamente.";

  supportFormStatus.appendChild(
    message
  );

  const whatsappNumber =
    person?.hasWhatsApp === true
      ? normalizeWhatsAppNumber(
          person?.phone
        )
      : "";

  if (!whatsappNumber) {
    return;
  }

  const responsibleName =
    String(
      currentContext?.caller?.name ||
      ""
    ).trim();

  const welcomeMessage = [
    "TERRA CAMPAIGN",
    "",
    `Hola, ${person.name || ""}.`,
    "",
    "Has sido incorporado(a) como Apoyo territorial.",
    responsibleName
      ? `Responsable directo: ${responsibleName}.`
      : "",
    "",
    "Gracias por formar parte de la organizaci\u00f3n territorial."
  ]
    .filter(
      (line, index, array) =>
        line !== "" ||
        index === 0 ||
        array[index - 1] !== ""
    )
    .join("\n");

  const link =
    document.createElement(
      "a"
    );

  link.className =
    "button whatsapp-link";

  link.target =
    "_blank";

  link.rel =
    "noopener noreferrer";

  link.textContent =
    "Comunicar por WhatsApp";

  link.href =
    "https://wa.me/" +
    whatsappNumber +
    "?text=" +
    encodeURIComponent(
      welcomeMessage
    );

  link.addEventListener(
    "click",
    () => {
      window.setTimeout(
        closeModal,
        150
      );
    }
  );

  supportFormStatus.appendChild(
    link
  );
}


// ======================================================
// CREAR APOYO
// ======================================================

async function handleSubmit(
  event
) {
  event.preventDefault();

  if (
    !canManageSupports() ||
    savingSupport ||
    supportCreated
  ) {
    return;
  }

  const name =
    String(
      supportNameInput?.value ||
      ""
    )
      .trim()
      .replace(/\s+/g, " ");

  const phone =
    String(
      supportPhoneInput?.value ||
      ""
    ).trim();

  const hasWhatsApp =
    supportWhatsAppYesInput?.checked
      ? true
      : supportWhatsAppNoInput?.checked
        ? false
        : false;

  const locality =
    String(
      supportLocalityInput?.value ||
      ""
    )
      .trim()
      .replace(/\s+/g, " ");

  const street =
    String(
      supportStreetInput?.value ||
      ""
    )
      .trim()
      .replace(/\s+/g, " ");

  const houseNumber =
    String(
      supportHouseNumberInput?.value ||
      ""
    )
      .trim()
      .replace(/\s+/g, " ");

  const createDigitalAccount =
    supportDigitalAccountYesInput?.checked ===
      true;

  const email =
    String(
      supportEmailInput?.value ||
      ""
    )
      .trim()
      .toLowerCase();

  const password =
    String(
      supportPasswordInput?.value ||
      ""
    );

  if (
    name.length < 2 ||
    locality.length < 2
  ) {
    showStatus(
      supportFormStatus,
      "Revisa los campos obligatorios.",
      "error"
    );

    return;
  }

  if (
    hasWhatsApp === true &&
    !phone
  ) {
    showStatus(
      supportFormStatus,
      "Ingresa el tel\u00e9fono que tiene WhatsApp.",
      "error"
    );

    return;
  }

  if (
    createDigitalAccount &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      email
    )
  ) {
    showStatus(
      supportFormStatus,
      "Ingresa un correo electrónico válido.",
      "error"
    );

    return;
  }

  if (
    createDigitalAccount &&
    password.length < 6
  ) {
    showStatus(
      supportFormStatus,
      "La contraseña temporal debe tener al menos 6 caracteres.",
      "error"
    );

    return;
  }

  const version =
    sessionVersion;

  savingSupport =
    true;

  updateControls();

  showStatus(
    supportFormStatus,
    "Registrando apoyo territorial..."
  );

  try {
    const result =
      await createQuickAffiliation({
        name,
        locality,
        phone,
        street,
        houseNumber,
        hasWhatsApp,
        createDigitalAccount,
        email,
        password
      });

    if (
      version !==
      sessionVersion
    ) {
      return;
    }

    const person =
      result?.data?.person;

    supportForm?.reset();

    supportCreated = true;

    showCreatedSupport(
      person
    );

    updateControls();

    await loadSupports(
      version
    );

  } catch (error) {
    console.error(
      "Error al crear apoyo territorial:",
      error
    );

    showStatus(
      supportFormStatus,
      getErrorMessage(error),
      "error"
    );

  } finally {
    savingSupport =
      false;

    updateControls();
  }
}


// ======================================================
// EVENTOS
// ======================================================

newSupportButton?.addEventListener(
  "click",
  openModal
);

closeSupportModalButton?.addEventListener(
  "click",
  closeModal
);

supportModalBackdrop?.addEventListener(
  "click",
  closeModal
);

supportDigitalAccountYesInput?.addEventListener(
  "change",
  updateDigitalAccountFields
);

supportDigitalAccountNoInput?.addEventListener(
  "change",
  updateDigitalAccountFields
);

supportForm?.addEventListener(
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
// SESION
// ======================================================

onAuthStateChanged(
  auth,
  async user => {
    sessionVersion += 1;

    const version =
      sessionVersion;

    currentUser =
      user;

    currentContext =
      null;

    if (!user) {
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

      if (
        version !==
        sessionVersion
      ) {
        return;
      }

      await loadSupports(
        version
      );

    } catch (error) {
      console.error(
        "Acceso rechazado:",
        error
      );

      currentContext =
        null;

      updateControls();

      showStatus(
        pageStatus,
        getErrorMessage(error),
        "error"
      );
    }
  }
);
