// ======================================================
// TERRA CAMPAIGN — PARTICIPANTES
// ======================================================

import { auth, db } from "./firebase-config.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where
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
let stopParticipantListener = null;
let savingParticipant = false;
let sessionVersion = 0;

const urlParams = new URLSearchParams(window.location.search);
const requestedMemberUid = String(urlParams.get("id") || "").trim();

const functions = getFunctions(undefined, "us-central1");
const createParticipantFunction =
  httpsCallable(functions, "createParticipant");

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

function stopListening() {
  if (stopParticipantListener) {
    stopParticipantListener();
    stopParticipantListener = null;
  }
}

function canCreateParticipant() {
  return Boolean(
    currentUser &&
    auth.currentUser?.uid === currentUser.uid &&
    currentUserProfile?.active === true &&
    currentUserProfile.role === "integrante" &&
    currentMember?.active === true &&
    currentMember.role === "integrante" &&
    currentMember.uid === currentUser.uid &&
    currentUserProfile.campaignId &&
    currentMember.campaignId === currentUserProfile.campaignId
  );
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

  if (!profile.campaignId) {
    throw new Error("El usuario no tiene campaña asignada.");
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

async function loadMember(profile, user) {
  const targetUid =
    requestedMemberUid ||
    (profile.role === "integrante" ? user.uid : "");

  if (!targetUid) {
    throw new Error("No se especificó un integrante.");
  }

  if (profile.role === "integrante" && targetUid !== user.uid) {
    throw new Error("Sólo puedes consultar tus propios participantes.");
  }

  const snapshot = await getDoc(doc(db, "usuarios", targetUid));

  if (!snapshot.exists()) {
    throw new Error("El integrante no existe.");
  }

  const member = {
    ...snapshot.data(),
    uid: snapshot.id
  };

  if (member.role !== "integrante") {
    throw new Error("El usuario seleccionado no es un integrante.");
  }

  if (member.campaignId !== profile.campaignId) {
    throw new Error("El integrante pertenece a otra campaña.");
  }

  if (
    profile.role === "jefe_estructura" &&
    member.structureId !== profile.structureId
  ) {
    throw new Error("El integrante no pertenece a tu estructura.");
  }

  return member;
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
        href="./persona.html?id=${encodeURIComponent(participant.uid)}"
      >
        Ver perfil
      </a>
    </article>
  `).join("");
}

// ======================================================
// CONSULTAR PARTICIPANTES
// ======================================================

function listenParticipants(version) {
  stopListening();

  const filters = [
    where("campaignId", "==", currentUserProfile.campaignId),
    where("parentUserId", "==", currentMember.uid),
    where("role", "==", "participante")
  ];

  // La consulta del Responsable de estructura debe incluir
  // el mismo alcance que autorizan las reglas de Firestore.
  if (currentUserProfile.role === "jefe_estructura") {
    filters.push(
      where("structureId", "==", currentUserProfile.structureId)
    );
  }

  showStatus(participantStatus, "Cargando participantes...");

  stopParticipantListener = onSnapshot(
    query(collection(db, "usuarios"), ...filters),

    (snapshot) => {
      if (version !== sessionVersion) return;

      const participants = snapshot.docs.map((item) => ({
        ...item.data(),
        uid: item.id
      }));

      renderParticipants(participants);
      showStatus(participantStatus, "");
    },

    (error) => {
      if (version !== sessionVersion) return;

      console.error("Error al consultar participantes:", error);

      if (participantList) {
        participantList.innerHTML = "";
      }

      showStatus(
        participantStatus,
        getErrorMessage(error),
        "error"
      );
    }
  );
}

// ======================================================
// WHATSAPP · BIENVENIDA PARTICIPANTE
// BUILD-116E-2
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
        "WhatsApp: No. Entregue el usuario y la contraseña temporal por otro medio.";
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


  const message = [
    "TERRA CAMPAIGN · Bienvenida",
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
    "Tu acceso a TERRA CAMPAIGN ya está habilitado.",
    "",
    "Usuario:",
    email,
    "",
    "Ingresa aquí:",
    "https://terra-campaign.github.io/terra-core/login.html",
    "",
    "Por seguridad, tu contraseña temporal no se comparte en este mensaje.",
    "Recíbela por separado de la persona que realizó tu registro.",
    "",
    "Bienvenido al equipo territorial."
  ]
    .filter(
      (line, index, array) =>
        line !== "" ||
        index === 0 ||
        array[index - 1] !== ""
    )
    .join("\n");


  if (participantWelcomeMessage) {
    participantWelcomeMessage.value =
      message;
  }


  const updateLinks = () => {

    const preparedMessage =
      participantWelcomeMessage?.value ||
      message;

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
      "Sólo el integrante puede registrar sus propios participantes.",
      "error"
    );
    return;
  }

  if (savingParticipant) return;

  const name = String(participantNameInput?.value || "")
    .trim()
    .replace(/\s+/g, " ");

  const email = String(participantEmailInput?.value || "")
    .trim()
    .toLowerCase();

  const phone = String(participantPhoneInput?.value || "").trim();

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

  if (!email) {
    showStatus(participantFormStatus, "Ingrese un correo electrónico.", "error");
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

  if (password.length < 6) {
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
    // El backend debe validar el rol y que parentUserId
    // corresponda al usuario autenticado.
    const result = await createParticipantFunction({
      name,
      email,
      phone,
      hasWhatsApp,
      locality,
      street,
      houseNumber,
      password,
      parentUserId: currentUser.uid
    });

    if (version !== sessionVersion) return;

    const participant =
      result?.data?.user;

    const createdParticipant =
      participant || {
        name,
        email,
        phone,
        hasWhatsApp,
        locality,
        street,
        houseNumber,
        parentUserId:
          currentUser.uid,
        parentUserName:
          currentMember?.name || "",
        structureName:
          currentMember?.structureName || "",
        municipalityName:
          currentMember?.municipalityName || "",
        mustChangePassword:
          true
      };


    participantForm?.reset();


    showStatus(
      participantFormStatus,
      createdParticipant?.name
        ? `${createdParticipant.name} registrado correctamente.`
        : "Participante registrado correctamente.",
      "success"
    );


    showParticipantWelcome(
      createdParticipant
    );


    showStatus(
      memberInfoStatus,
      createdParticipant?.name
        ? `${createdParticipant.name} registrado correctamente.`
        : "Participante registrado correctamente.",
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
  stopListening();

  currentUser = null;
  currentUserProfile = null;
  currentMember = null;

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

  stopListening();

  currentUser = null;
  currentUserProfile = null;
  currentMember = null;
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

    const member = await loadMember(profile, user);

    if (version !== sessionVersion) return;

    currentUser = user;
    currentUserProfile = profile;
    currentMember = member;

    renderMember(member);
    updateCreateControls();
    listenParticipants(version);
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
