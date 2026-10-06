// ======================================================
// TERRA CAMPAIGN — PARTICIPANTES
// ======================================================

import { auth, db } from "./firebase-config.js";

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

// ======================================================
// ELEMENTOS
// ======================================================

const memberTitle = document.querySelector("#memberTitle");
const memberName = document.querySelector("#memberName");
const memberEmail = document.querySelector("#memberEmail");
const memberPhone = document.querySelector("#memberPhone");
const memberStructure = document.querySelector("#memberStructure");
const memberMunicipality = document.querySelector("#memberMunicipality");
const memberInfoStatus = document.querySelector("#memberInfoStatus");

const backButton = document.querySelector("#backButton");
const logoutButton = document.querySelector("#logoutButton");

const newParticipantButton = document.querySelector("#newParticipantButton");
const participantStatus = document.querySelector("#participantStatus");
const participantList = document.querySelector("#participantList");
const participantModal = document.querySelector("#participantModal");
const closeParticipantModalButton =
  document.querySelector("#closeParticipantModalButton");
const participantForm = document.querySelector("#participantForm");

const participantNameInput = document.querySelector("#participantName");
const participantEmailInput = document.querySelector("#participantEmail");

const participantDigitalAccountYesInput =
  document.querySelector("#participantDigitalAccountYes");

const participantDigitalAccountNoInput =
  document.querySelector("#participantDigitalAccountNo");

const participantDigitalEmailGroup =
  document.querySelector("#participantDigitalEmailGroup");

const participantDigitalPasswordGroup =
  document.querySelector("#participantDigitalPasswordGroup");

const participantPhoneInput = document.querySelector("#participantPhone");
const participantWhatsAppYesInput =
  document.querySelector("#participantWhatsAppYes");
const participantWhatsAppNoInput =
  document.querySelector("#participantWhatsAppNo");
const participantLocalityInput = document.querySelector("#participantLocality");
const participantStreetInput = document.querySelector("#participantStreet");
const participantHouseNumberInput =
  document.querySelector("#participantHouseNumber");
const participantPasswordInput = document.querySelector("#participantPassword");

const saveParticipantButton = document.querySelector("#saveParticipantButton");
const participantFormStatus = document.querySelector("#participantFormStatus");

const participantWelcome =
  document.querySelector("#participantWelcome");

const participantWelcomeRecipient =
  document.querySelector("#participantWelcomeRecipient");

const participantWelcomePhone =
  document.querySelector("#participantWelcomePhone");

const participantWelcomeChannelStatus =
  document.querySelector("#participantWelcomeChannelStatus");

const participantWelcomeWhatsApp =
  document.querySelector("#participantWelcomeWhatsApp");

const participantWelcomeMessage =
  document.querySelector("#participantWelcomeMessage");

const participantWelcomeDirect =
  document.querySelector("#participantWelcomeDirect");

const participantWelcomeManual =
  document.querySelector("#participantWelcomeManual");

// ======================================================
// ESTADO Y URL
// ======================================================

let currentUser = null;
let currentUserProfile = null;
let currentMember = null;
let currentParticipants = [];
let currentManagementMode = "";
let savingParticipant = false;
let sessionVersion = 0;

const urlParams = new URLSearchParams(window.location.search);
const requestedMemberPersonId =
  String(urlParams.get("id") || "").trim();

const functions = getFunctions(undefined, "us-central1");
const createParticipantFunction =
  httpsCallable(functions, "createParticipant");

const getParticipantManagementContextFunction =
  httpsCallable(
    functions,
    "getParticipantManagementContext"
  );

// ======================================================
// UTILIDADES
// ======================================================

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function setText(element, text) {
  if (element) {
    element.textContent = text;
  }
}

function showStatus(element, message, type = "") {
  if (!element) return;

  element.textContent = message;
  element.hidden = !message;
  element.className = "status";

  if (type) {
    element.classList.add(`status--${type}`);
  }
}

function getErrorMessage(error) {
  const code = String(error?.code || "").replace(/^functions\//, "");

  if (code === "permission-denied") {
    return "No tienes autorización para consultar o modificar estos participantes.";
  }

  if (code === "unauthenticated") {
    return "La sesión no es válida. Inicia sesión nuevamente.";
  }

  if (code === "already-exists") {
    return "Ya existe un usuario con esos datos.";
  }

  return error?.message || "No fue posible completar la operación.";
}

function canCreateParticipant() {
  return Boolean(
    currentUser &&
    auth.currentUser?.uid === currentUser.uid &&
    currentUserProfile?.active === true &&
    currentMember?.active === true &&
    currentMember.role === "integrante" &&
    currentMember.personId &&
    (
      currentManagementMode === "self" ||
      currentManagementMode === "assisted"
    )
  );
}

function participantCreatesDigitalAccount() {

  return !participantDigitalAccountNoInput?.checked;
}


function updateDigitalAccountFields() {

  const createDigitalAccount =
    participantCreatesDigitalAccount();

  if (participantDigitalEmailGroup) {
    participantDigitalEmailGroup.hidden =
      !createDigitalAccount;
  }

  if (participantDigitalPasswordGroup) {
    participantDigitalPasswordGroup.hidden =
      !createDigitalAccount;
  }

  if (participantEmailInput) {

    participantEmailInput.required =
      createDigitalAccount;

    if (!createDigitalAccount) {
      participantEmailInput.value = "";
    }
  }

  if (participantPasswordInput) {

    participantPasswordInput.required =
      createDigitalAccount;

    if (!createDigitalAccount) {
      participantPasswordInput.value = "";
    }
  }
}


function updateCreateControls() {
  const allowed = canCreateParticipant();

  if (newParticipantButton) {
    newParticipantButton.hidden = !allowed;
    newParticipantButton.disabled = !allowed || savingParticipant;
  }

  if (saveParticipantButton) {
    saveParticipantButton.disabled = !allowed || savingParticipant;
    saveParticipantButton.textContent =
      savingParticipant ? "Guardando..." : "Guardar participante";
  }
}

function clearMemberDisplay() {
  setText(memberTitle, "Participantes");
  setText(memberName, "");
  setText(memberEmail, "");
  setText(memberPhone, "");
  setText(memberStructure, "");
  setText(memberMunicipality, "");

  if (participantList) {
    participantList.innerHTML = "";
  }
}

// ======================================================
// PERFIL ACTUAL
// ======================================================

async function loadCurrentUserProfile(user) {
  const snapshot = await getDoc(doc(db, "usuarios", user.uid));

  if (!snapshot.exists()) {
    throw new Error("El usuario no tiene perfil autorizado.");
  }

  const profile = {
    ...snapshot.data(),
    uid: snapshot.id
  };

  if (profile.active !== true) {
    throw new Error("El usuario está desactivado.");
  }

  if (!["admin", "jefe_estructura", "integrante"].includes(profile.role)) {
    throw new Error("No tienes autorización para consultar participantes.");
  }

  if (
    profile.role !== "admin" &&
    !profile.campaignId
  ) {
    throw new Error(
      "El usuario no tiene campaña asignada."
    );
  }

  if (
    profile.role === "jefe_estructura" &&
    (
      typeof profile.structureId !== "string" ||
      !profile.structureId.trim()
    )
  ) {
    throw new Error("El Responsable de estructura no tiene estructura asignada.");
  }

  return profile;
}

// ======================================================
// CARGAR INTEGRANTE
// ======================================================

async function loadParticipantManagementContext(
  profile
) {

  let parentPersonId =
    requestedMemberPersonId;

  if (
    !parentPersonId &&
    profile.role === "integrante"
  ) {
    parentPersonId =
      String(
        profile.personId || ""
      ).trim();
  }

  if (!parentPersonId) {
    throw new Error(
      "No se especificó un integrante."
    );
  }

  const result =
    await getParticipantManagementContextFunction({
      parentPersonId
    });

  const data =
    result?.data || {};

  if (
    !data.member ||
    data.member.role !== "integrante"
  ) {
    throw new Error(
      "No fue posible cargar al integrante."
    );
  }

  return data;
}

function renderMember(member) {
  setText(memberTitle, member.name || "Participantes");
  setText(memberName, member.name || "Integrante");
  setText(memberEmail, member.email ? `Correo: ${member.email}` : "");
  setText(memberPhone, member.phone ? `Tel: ${member.phone}` : "");

  const structureLabel = member.structureName || member.structureId || "";

  setText(
    memberStructure,
    structureLabel ? `Estructura: ${structureLabel}` : ""
  );

  setText(
    memberMunicipality,
    member.municipalityName ? `Municipio: ${member.municipalityName}` : ""
  );

  showStatus(
    memberInfoStatus,
    canCreateParticipant()
      ? ""
      : "Consulta de participantes. Las altas corresponden al integrante."
  );
}

// ======================================================
// RENDER PARTICIPANTES
// ======================================================

function renderParticipants(participants) {
  if (!participantList) return;

  if (participants.length === 0) {
    participantList.innerHTML = `
      <div class="card">
        <p class="muted">Todavía no hay participantes registrados.</p>
      </div>
    `;
    return;
  }

  participantList.innerHTML = participants.map((participant) => `
    <article class="card">
      <p class="eyebrow">PARTICIPANTE</p>

      <h3>${escapeHtml(participant.name)}</h3>
      <p class="muted">${escapeHtml(participant.email)}</p>

      ${
        participant.phone
          ? `<p class="muted">Tel: ${escapeHtml(participant.phone)}</p>`
          : ""
      }

      ${
        participant.locality
          ? `<p class="muted">Localidad: ${escapeHtml(participant.locality)}</p>`
          : ""
      }

      <p class="muted">
        Estado: ${participant.active === true ? "Activo" : "Inactivo"}
      </p>

      <a
        class="button button--secondary button--small"
        href="./persona.html?id=${encodeURIComponent(participant.personId)}"
      >
        Ver perfil
      </a>
    </article>
  `).join("");
}

// ======================================================
// CONSULTAR PARTICIPANTES
// ======================================================

function loadParticipantsFromContext(
  participants
) {

  currentParticipants =
    Array.isArray(participants)
      ? participants
      : [];

  renderParticipants(
    currentParticipants
  );

  showStatus(
    participantStatus,
    currentParticipants.length
      ? String(currentParticipants.length) +
        " participante(s) registrado(s)."
      : ""
  );
}


// ======================================================

function normalizeParticipantWhatsAppPhone(value) {

  const digits =
    String(value || "")
      .replace(/\D/g, "");

  if (/^52\d{10}$/.test(digits)) {
    return digits;
  }

  if (/^\d{10}$/.test(digits)) {
    return `52${digits}`;
  }

  return "";
}


function resetParticipantWelcome() {

  if (participantWelcome) {
    participantWelcome.hidden = true;
  }

  if (participantWelcomeWhatsApp) {
    participantWelcomeWhatsApp.hidden = true;
  }

  if (participantWelcomeMessage) {
    participantWelcomeMessage.value = "";
    participantWelcomeMessage.oninput = null;
  }

  if (participantWelcomeDirect) {
    participantWelcomeDirect.hidden = true;
    participantWelcomeDirect.removeAttribute("href");
  }

  if (participantWelcomeManual) {
    participantWelcomeManual.removeAttribute("href");
  }
}


function showParticipantWelcome(user) {

  const name =
    String(
      user?.name ||
      "Participante"
    ).trim();

  const email =
    String(
      user?.email || ""
    ).trim();

  const phone =
    String(
      user?.phone || ""
    ).trim();

  const hasWhatsApp =
    user?.hasWhatsApp === true;

  const hasDigitalAccount =
    user?.hasDigitalAccount === true ||
    user?.createDigitalAccount === true;

  const parentUserName =
    String(
      user?.parentUserName ||
      currentMember?.name ||
      ""
    ).trim();

  const structureName =
    String(
      user?.structureName ||
      currentMember?.structureName ||
      ""
    ).trim();

  const municipalityName =
    String(
      user?.municipalityName ||
      currentMember?.municipalityName ||
      ""
    ).trim();

  const whatsappNumber =
    normalizeParticipantWhatsAppPhone(
      phone
    );


  if (participantWelcomeRecipient) {
    participantWelcomeRecipient.textContent =
      `Destinatario: ${name}`;
  }

  if (participantWelcomePhone) {
    participantWelcomePhone.textContent =
      phone
        ? `Teléfono: ${phone}`
        : "Teléfono: no registrado";
  }

  if (participantWelcome) {
    participantWelcome.hidden =
      false;
  }


  // --------------------------------------------------
  // SIN WHATSAPP
  // --------------------------------------------------

  if (!hasWhatsApp) {

    if (participantWelcomeChannelStatus) {

      participantWelcomeChannelStatus.textContent =
        hasDigitalAccount
          ? "WhatsApp: No. Entregue el usuario y la contraseña temporal por otro medio."
          : "Registrado sin cuenta digital y sin WhatsApp. El integrante responsable dará seguimiento operativo.";
    }

    if (participantWelcomeWhatsApp) {
      participantWelcomeWhatsApp.hidden =
        true;
    }

    return;
  }


  // --------------------------------------------------
  // CON WHATSAPP
  // --------------------------------------------------

  if (participantWelcomeChannelStatus) {
    participantWelcomeChannelStatus.textContent =
      "WhatsApp: Sí.";
  }


  const message =
    hasDigitalAccount
      ? [
          "TERRA CAMPAIGN \u00b7 Bienvenida",
          "",
          `Hola, ${name}.`,
          "",
          "Has sido registrado como Participante de TERRA CAMPAIGN.",
          parentUserName
            ? `Integrante responsable: ${parentUserName}.`
            : "",
          structureName
            ? `Estructura: ${structureName}.`
            : "",
          municipalityName
            ? `Municipio: ${municipalityName}.`
            : "",
          "",
          "Tu acceso a TERRA CAMPAIGN ya est\u00e1 habilitado.",
          "",
          "Usuario:",
          email,
          "",
          "Ingresa aqu\u00ed:",
          "https://terra-campaign.github.io/terra-core/login.html",
          "",
          "Por seguridad, tu contrase\u00f1a temporal no se comparte en este mensaje.",
          "Rec\u00edbela por separado de la persona que realiz\u00f3 tu registro.",
          "",
          "Bienvenido al equipo territorial."
        ]
      : [
          "TERRA CAMPAIGN \u00b7 Registro territorial",
          "",
          `Hola, ${name}.`,
          "",
          "Has sido registrado como Participante de TERRA CAMPAIGN.",
          parentUserName
            ? `Integrante responsable: ${parentUserName}.`
            : "",
          structureName
            ? `Estructura: ${structureName}.`
            : "",
          municipalityName
            ? `Municipio: ${municipalityName}.`
            : "",
          "",
          "Tu registro no requiere cuenta digital propia.",
          "Tu actividad, evidencia, desempe\u00f1o, puntos y reconocimiento seguir\u00e1n formando parte de TERRA.",
          "Tu integrante responsable dar\u00e1 seguimiento a las operaciones que correspondan.",
          "",
          "Bienvenido al equipo territorial."
        ];

  const preparedWelcomeMessage =
    message
      .filter(
        (line, index, array) =>
          line !== "" ||
          index === 0 ||
          array[index - 1] !== ""
      )
      .join("\n");


  if (participantWelcomeMessage) {
    participantWelcomeMessage.value =
      preparedWelcomeMessage;
  }


  const updateLinks = () => {

    const preparedMessage =
      participantWelcomeMessage?.value ||
      preparedWelcomeMessage;

    if (participantWelcomeManual) {
      participantWelcomeManual.href =
        "https://wa.me/?text=" +
        encodeURIComponent(
          preparedMessage
        );
    }

    if (participantWelcomeDirect) {

      if (whatsappNumber) {

        participantWelcomeDirect.hidden =
          false;

        participantWelcomeDirect.textContent =
          `Abrir WhatsApp con ${name}`;

        participantWelcomeDirect.href =
          "https://wa.me/" +
          whatsappNumber +
          "?text=" +
          encodeURIComponent(
            preparedMessage
          );

      } else {

        participantWelcomeDirect.hidden =
          true;

        participantWelcomeDirect
          .removeAttribute("href");
      }
    }
  };


  if (participantWelcomeMessage) {
    participantWelcomeMessage.oninput =
      updateLinks;
  }

  updateLinks();

  if (participantWelcomeWhatsApp) {
    participantWelcomeWhatsApp.hidden =
      false;
  }
}


// ======================================================
// MODAL
// ======================================================

function openParticipantModal() {
  if (!canCreateParticipant() || savingParticipant) return;

  participantForm?.reset();
  updateDigitalAccountFields();
  resetParticipantWelcome();
  showStatus(participantFormStatus, "");

  if (participantModal) {
    participantModal.hidden = false;
  }

  participantNameInput?.focus();
}

function closeParticipantModal() {
  if (participantModal) {
    participantModal.hidden = true;
  }

  participantForm?.reset();
  updateDigitalAccountFields();
  resetParticipantWelcome();
  showStatus(participantFormStatus, "");
}

// ======================================================
// CREAR PARTICIPANTE
// ======================================================

async function handleCreateParticipant(event) {
  event.preventDefault();

  if (!canCreateParticipant()) {
    showStatus(
      participantFormStatus,
      "No tienes autorización para registrar participantes para este integrante.",
      "error"
    );
    return;
  }

  if (savingParticipant) return;

  const name = String(participantNameInput?.value || "")
    .trim()
    .replace(/\s+/g, " ");

  const createDigitalAccount =
    participantCreatesDigitalAccount();

  const email =
    createDigitalAccount
      ? String(participantEmailInput?.value || "")
          .trim()
          .toLowerCase()
      : "";

  const phone =
    String(participantPhoneInput?.value || "").trim();

  const hasWhatsApp =
    participantWhatsAppYesInput?.checked
      ? true
      : participantWhatsAppNoInput?.checked
        ? false
        : null;

  const locality = String(participantLocalityInput?.value || "")
    .trim()
    .replace(/\s+/g, " ");

  const street = String(participantStreetInput?.value || "")
    .trim()
    .replace(/\s+/g, " ");

  const houseNumber = String(participantHouseNumberInput?.value || "")
    .trim()
    .replace(/\s+/g, " ");

  const password = String(participantPasswordInput?.value || "");

  if (name.length < 2) {
    showStatus(participantFormStatus, "Ingrese el nombre completo.", "error");
    participantNameInput?.focus();
    return;
  }

  if (
    createDigitalAccount &&
    !email
  ) {
    showStatus(
      participantFormStatus,
      "Ingrese un correo electrónico para crear la cuenta digital.",
      "error"
    );

    participantEmailInput?.focus();
    return;
  }

  if (hasWhatsApp === null) {
    showStatus(
      participantFormStatus,
      "Indique si el teléfono tiene WhatsApp.",
      "error"
    );
    return;
  }

  if (
    hasWhatsApp === true &&
    !phone
  ) {
    showStatus(
      participantFormStatus,
      "Ingrese el teléfono que tiene WhatsApp.",
      "error"
    );
    participantPhoneInput?.focus();
    return;
  }

  if (locality.length < 2) {
    showStatus(
      participantFormStatus,
      "Ingrese la población del participante.",
      "error"
    );
    participantLocalityInput?.focus();
    return;
  }

  if (street.length < 2) {
    showStatus(
      participantFormStatus,
      "Ingrese la calle del participante.",
      "error"
    );
    participantStreetInput?.focus();
    return;
  }

  if (!houseNumber) {
    showStatus(
      participantFormStatus,
      "Ingrese el número o S/N.",
      "error"
    );
    participantHouseNumberInput?.focus();
    return;
  }

  if (
    createDigitalAccount &&
    password.length < 6
  ) {
    showStatus(
      participantFormStatus,
      "La contraseña temporal debe tener al menos 6 caracteres.",
      "error"
    );

    participantPasswordInput?.focus();
    return;
  }

  const version = sessionVersion;

  savingParticipant = true;
  updateCreateControls();
  showStatus(participantFormStatus, "Registrando participante...");

  try {
    // La jerarquía se resuelve por identidad canónica.
    // La cuenta que registra puede ser distinta del
    // Integrante responsable.
    const result = await createParticipantFunction({
      name,
      email,
      phone,
      hasWhatsApp,
      locality,
      street,
      houseNumber,
      password:
        createDigitalAccount
          ? password
          : "",
      createDigitalAccount,
      parentPersonId:
        currentMember.personId
    });

    if (version !== sessionVersion) return;

    const participant =
      result?.data?.user;

    const createdParticipant = {
      name,
      email,
      phone,
      hasWhatsApp,
      locality,
      street,
      houseNumber,
      parentPersonId:
        currentMember?.personId || "",
      parentUserName:
        currentMember?.name || "",
      structureName:
        currentMember?.structureName || "",
      municipalityName:
        currentMember?.municipalityName || "",
      createDigitalAccount,
      hasDigitalAccount:
        createDigitalAccount,
      mustChangePassword:
        createDigitalAccount,
      ...(participant || {})
    };

    createdParticipant.createDigitalAccount =
      createDigitalAccount;

    createdParticipant.hasDigitalAccount =
      createDigitalAccount;


    participantForm?.reset();
    updateDigitalAccountFields();


    showStatus(
      participantFormStatus,
      createdParticipant?.name
        ? `✓ ${createdParticipant.name} registrado correctamente.`
        : "✓ Participante registrado correctamente.",
      "success"
    );


    showParticipantWelcome(
      createdParticipant
    );


    const refreshedContext =
      await loadParticipantManagementContext(
        currentUserProfile
      );

    if (version !== sessionVersion) return;

    currentMember =
      refreshedContext.member;

    currentManagementMode =
      String(
        refreshedContext.recordingMode || ""
      );

    renderMember(
      currentMember
    );

    loadParticipantsFromContext(
      refreshedContext.participants
    );


    showStatus(
      memberInfoStatus,
      createdParticipant?.name
        ? `✓ ${createdParticipant.name} registrado correctamente.`
        : "✓ Participante registrado correctamente.",
      "success"
    );
  } catch (error) {
    if (version !== sessionVersion) return;

    console.error("Error al crear participante:", error);

    showStatus(
      participantFormStatus,
      getErrorMessage(error),
      "error"
    );
  } finally {
    if (version === sessionVersion) {
      savingParticipant = false;
      updateCreateControls();
    }
  }
}

// ======================================================
// EVENTOS
// ======================================================

newParticipantButton?.addEventListener("click", openParticipantModal);

closeParticipantModalButton?.addEventListener(
  "click",
  closeParticipantModal
);

participantForm?.addEventListener("submit", handleCreateParticipant);

participantDigitalAccountYesInput?.addEventListener(
  "change",
  updateDigitalAccountFields
);

participantDigitalAccountNoInput?.addEventListener(
  "change",
  updateDigitalAccountFields
);

participantWelcomeDirect?.addEventListener("click", () => {
  window.setTimeout(() => {
    closeParticipantModal();
  }, 150);
});

participantModal
  ?.querySelector(".modal__backdrop")
  ?.addEventListener("click", closeParticipantModal);

// ======================================================
// VOLVER
// ======================================================

backButton?.addEventListener("click", () => {
  const role = currentUserProfile?.role;

  if (
    (role === "admin" || role === "jefe_estructura") &&
    currentMember?.structureDocumentId
  ) {
    window.location.href =
      `./estructura.html?id=${encodeURIComponent(
        currentMember.structureDocumentId
      )}`;
    return;
  }

  // El integrante no se envía al administrador de municipios.
  window.location.href = "./admin.html";
});

// ======================================================
// LOGOUT
// ======================================================

logoutButton?.addEventListener("click", async () => {
  sessionVersion++;

  currentUser = null;
  currentUserProfile = null;
  currentMember = null;
  currentParticipants = [];
  currentManagementMode = "";

  clearMemberDisplay();
  closeParticipantModal();
  updateCreateControls();

  try {
    await signOut(auth);
  } finally {
    window.location.href = "./login.html";
  }
});

// ======================================================
// AUTENTICACIÓN
// ======================================================

// Ocultar controles y contenido mientras se valida la sesión.
clearMemberDisplay();
closeParticipantModal();
updateCreateControls();

onAuthStateChanged(auth, async (user) => {
  const version = ++sessionVersion;

  currentUser = null;
  currentUserProfile = null;
  currentMember = null;
  currentParticipants = [];
  currentManagementMode = "";
  savingParticipant = false;

  clearMemberDisplay();
  closeParticipantModal();
  updateCreateControls();
  showStatus(participantStatus, "");

  if (!user) {
    window.location.href = "./login.html";
    return;
  }

  showStatus(memberInfoStatus, "Validando acceso...");

  try {
    const profile = await loadCurrentUserProfile(user);

    if (version !== sessionVersion) return;

    const context =
      await loadParticipantManagementContext(
        profile
      );

    if (version !== sessionVersion) return;

    currentUser = user;
    currentUserProfile = profile;
    currentMember =
      context.member;

    currentParticipants =
      Array.isArray(
        context.participants
      )
        ? context.participants
        : [];

    currentManagementMode =
      String(
        context.recordingMode || ""
      );

    renderMember(
      currentMember
    );

    updateCreateControls();

    loadParticipantsFromContext(
      currentParticipants
    );
  } catch (error) {
    if (version !== sessionVersion) return;

    console.error("Error al iniciar módulo de participantes:", error);

    clearMemberDisplay();
    updateCreateControls();

    showStatus(
      memberInfoStatus,
      getErrorMessage(error),
      "error"
    );
  }
});
