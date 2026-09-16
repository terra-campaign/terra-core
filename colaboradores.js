// ======================================================
// TERRA CAMPAIGN — COLABORADORES DE BASE
// BUILD-118C-3B3E-3E-B1
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
// UTILIDADES DOM
// ======================================================

const $ = selector =>
  document.querySelector(selector);

const participantTitle =
  $("#participantTitle");

const participantName =
  $("#participantName");

const participantEmail =
  $("#participantEmail");

const participantPhone =
  $("#participantPhone");

const participantStructure =
  $("#participantStructure");

const participantMunicipality =
  $("#participantMunicipality");

const participantInfoStatus =
  $("#participantInfoStatus");

const backButton =
  $("#backButton");

const logoutButton =
  $("#logoutButton");

const newCollaboratorButton =
  $("#newCollaboratorButton");

const collaboratorStatus =
  $("#collaboratorStatus");

const collaboratorList =
  $("#collaboratorList");

const collaboratorModal =
  $("#collaboratorModal");

const closeCollaboratorModalButton =
  $("#closeCollaboratorModalButton");

const collaboratorForm =
  $("#collaboratorForm");

const collaboratorNameInput =
  $("#collaboratorName");

const collaboratorEmailInput =
  $("#collaboratorEmail");

const collaboratorPhoneInput =
  $("#collaboratorPhone");

const collaboratorWhatsAppYesInput =
  $("#collaboratorWhatsAppYes");

const collaboratorWhatsAppNoInput =
  $("#collaboratorWhatsAppNo");

const collaboratorLocalityInput =
  $("#collaboratorLocality");

const collaboratorStreetInput =
  $("#collaboratorStreet");

const collaboratorHouseNumberInput =
  $("#collaboratorHouseNumber");

const collaboratorPasswordInput =
  $("#collaboratorPassword");

const saveCollaboratorButton =
  $("#saveCollaboratorButton");

const collaboratorFormStatus =
  $("#collaboratorFormStatus");

const collaboratorWelcome =
  $("#collaboratorWelcome");

const collaboratorWelcomeRecipient =
  $("#collaboratorWelcomeRecipient");

const collaboratorWelcomePhone =
  $("#collaboratorWelcomePhone");

const collaboratorWelcomeChannelStatus =
  $("#collaboratorWelcomeChannelStatus");

const collaboratorWelcomeWhatsApp =
  $("#collaboratorWelcomeWhatsApp");

const collaboratorWelcomeMessage =
  $("#collaboratorWelcomeMessage");

const collaboratorWelcomeDirect =
  $("#collaboratorWelcomeDirect");

const collaboratorWelcomeManual =
  $("#collaboratorWelcomeManual");


// ======================================================
// ESTADO
// ======================================================

let currentUser = null;
let currentProfile = null;
let currentParticipant = null;
let stopCollaboratorListener = null;
let savingCollaborator = false;
let sessionVersion = 0;

const params =
  new URLSearchParams(
    window.location.search
  );

const requestedParticipantUid =
  String(
    params.get("id") || ""
  ).trim();

const functions =
  getFunctions(
    undefined,
    "us-central1"
  );

const createBaseCollaborator =
  httpsCallable(
    functions,
    "createBaseCollaborator"
  );


// ======================================================
// HELPERS
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


function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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
    return "No tienes autorización para registrar colaboradores.";
  }

  if (
    code ===
    "unauthenticated"
  ) {
    return "La sesión no es válida. Inicia sesión nuevamente.";
  }

  if (
    code ===
    "already-exists"
  ) {
    return "Ya existe un usuario con ese correo.";
  }

  return (
    error?.message ||
    "No fue posible completar la operación."
  );
}


// ======================================================
// AUTORIZACION
// ======================================================

function canCreateCollaborator() {
  return Boolean(
    currentUser &&
    auth.currentUser?.uid ===
      currentUser.uid &&
    currentProfile?.active ===
      true &&
    currentProfile.role ===
      "participante" &&
    currentParticipant?.active ===
      true &&
    currentParticipant.role ===
      "participante" &&
    currentParticipant.uid ===
      currentUser.uid &&
    currentProfile.campaignId &&
    currentParticipant.campaignId ===
      currentProfile.campaignId
  );
}


function updateControls() {
  const allowed =
    canCreateCollaborator();

  if (
    newCollaboratorButton
  ) {
    newCollaboratorButton.hidden =
      !allowed;

    newCollaboratorButton.disabled =
      !allowed ||
      savingCollaborator;
  }

  if (
    saveCollaboratorButton
  ) {
    saveCollaboratorButton.disabled =
      !allowed ||
      savingCollaborator;

    saveCollaboratorButton.textContent =
      savingCollaborator
        ? "Guardando..."
        : "Guardar colaborador";
  }
}


// ======================================================
// PERFIL
// ======================================================

async function loadProfile(
  user
) {
  const snapshot =
    await getDoc(
      doc(
        db,
        "usuarios",
        user.uid
      )
    );

  if (
    !snapshot.exists()
  ) {
    throw new Error(
      "El usuario no tiene perfil autorizado."
    );
  }

  const profile = {
    ...snapshot.data(),
    uid:
      snapshot.id
  };

  if (
    profile.active !== true
  ) {
    throw new Error(
      "El usuario está desactivado."
    );
  }

  if (
    profile.role !==
    "participante"
  ) {
    throw new Error(
      "Esta sección corresponde al Participante."
    );
  }

  if (
    !profile.campaignId
  ) {
    throw new Error(
      "El Participante no tiene campaña asignada."
    );
  }

  return profile;
}


async function loadParticipant(
  profile,
  user
) {
  const targetUid =
    requestedParticipantUid ||
    user.uid;

  if (
    targetUid !==
    user.uid
  ) {
    throw new Error(
      "Sólo puedes consultar tu propia organización."
    );
  }

  const snapshot =
    await getDoc(
      doc(
        db,
        "usuarios",
        targetUid
      )
    );

  if (
    !snapshot.exists()
  ) {
    throw new Error(
      "El Participante no existe."
    );
  }

  const participant = {
    ...snapshot.data(),
    uid:
      snapshot.id
  };

  if (
    participant.role !==
    "participante"
  ) {
    throw new Error(
      "El usuario seleccionado no es Participante."
    );
  }

  if (
    participant.campaignId !==
    profile.campaignId
  ) {
    throw new Error(
      "El Participante pertenece a otra campaña."
    );
  }

  return participant;
}


// ======================================================
// RENDER PARTICIPANTE
// ======================================================

function renderParticipant(
  participant
) {
  setText(
    participantTitle,
    participant.name ||
    "Colaboradores de base"
  );

  setText(
    participantName,
    participant.name ||
    "Participante"
  );

  setText(
    participantEmail,
    participant.email
      ? `Correo: ${participant.email}`
      : ""
  );

  setText(
    participantPhone,
    participant.phone
      ? `Tel: ${participant.phone}`
      : ""
  );

  const structure =
    participant.structureName ||
    participant.structureId ||
    "";

  setText(
    participantStructure,
    structure
      ? `Estructura: ${structure}`
      : ""
  );

  setText(
    participantMunicipality,
    participant.municipalityName
      ? `Municipio: ${participant.municipalityName}`
      : ""
  );
}


// ======================================================
// RENDER COLABORADORES
// ======================================================

function renderCollaborators(
  collaborators
) {
  if (!collaboratorList) {
    return;
  }

  if (
    collaborators.length === 0
  ) {
    collaboratorList.innerHTML = `
      <div class="card">
        <p class="muted">
          Todavía no hay colaboradores registrados.
        </p>
      </div>
    `;

    return;
  }

  collaboratorList.innerHTML =
    collaborators
      .map(
        collaborator => `
          <article class="card">

            <p class="eyebrow">
              COLABORADOR DE BASE
            </p>

            <h3>
              ${escapeHtml(
                collaborator.name
              )}
            </h3>

            <p class="muted">
              ${escapeHtml(
                collaborator.email
              )}
            </p>

            ${
              collaborator.phone
                ? `
                  <p class="muted">
                    Tel:
                    ${escapeHtml(
                      collaborator.phone
                    )}
                  </p>
                `
                : ""
            }

            ${
              collaborator.locality
                ? `
                  <p class="muted">
                    Localidad:
                    ${escapeHtml(
                      collaborator.locality
                    )}
                  </p>
                `
                : ""
            }

            <p class="muted">
              Estado:
              ${
                collaborator.active ===
                true
                  ? "Activo"
                  : "Inactivo"
              }
            </p>

          </article>
        `
      )
      .join("");
}


// ======================================================
// LISTENER COLABORADORES
// ======================================================

function listenCollaborators() {
  if (
    stopCollaboratorListener
  ) {
    stopCollaboratorListener();
    stopCollaboratorListener =
      null;
  }

  if (
    !currentUser ||
    !currentProfile
  ) {
    return;
  }

  const version =
    sessionVersion;

  const q =
    query(
      collection(
        db,
        "usuarios"
      ),
      where(
        "campaignId",
        "==",
        currentProfile.campaignId
      ),
      where(
        "parentUserId",
        "==",
        currentUser.uid
      )
    );

  stopCollaboratorListener =
    onSnapshot(
      q,

      snapshot => {
        if (
          version !==
          sessionVersion
        ) {
          return;
        }

        const collaborators =
          snapshot.docs
            .map(
              item => ({
                uid:
                  item.id,
                ...item.data()
              })
            )
            .filter(
              item =>
                item.role ===
                "colaborador_base"
            )
            .sort(
              (a, b) =>
                String(
                  a.name || ""
                ).localeCompare(
                  String(
                    b.name || ""
                  ),
                  "es"
                )
            );

        renderCollaborators(
          collaborators
        );

        showStatus(
          collaboratorStatus,
          ""
        );
      },

      error => {
        console.error(
          "Error al consultar colaboradores:",
          error
        );

        showStatus(
          collaboratorStatus,
          error.code ===
            "permission-denied"
            ? "No tienes permisos para consultar estos colaboradores."
            : "No fue posible cargar los colaboradores.",
          "error"
        );
      }
    );
}


// ======================================================
// WHATSAPP
// ======================================================

function resetWelcome() {
  if (
    collaboratorWelcome
  ) {
    collaboratorWelcome.hidden =
      true;
  }

  if (
    collaboratorWelcomeWhatsApp
  ) {
    collaboratorWelcomeWhatsApp.hidden =
      true;
  }

  if (
    collaboratorWelcomeDirect
  ) {
    collaboratorWelcomeDirect.hidden =
      true;

    collaboratorWelcomeDirect.removeAttribute(
      "href"
    );
  }

  if (
    collaboratorWelcomeMessage
  ) {
    collaboratorWelcomeMessage.value =
      "";

    collaboratorWelcomeMessage.oninput =
      null;
  }
}


function showWelcome(
  collaborator
) {
  resetWelcome();

  const name =
    String(
      collaborator?.name || ""
    ).trim();

  const email =
    String(
      collaborator?.email || ""
    ).trim();

  const phone =
    String(
      collaborator?.phone || ""
    ).trim();

  const hasWhatsApp =
    collaborator?.hasWhatsApp ===
    true;

  const whatsappNumber =
    hasWhatsApp
      ? normalizeWhatsAppNumber(
          phone
        )
      : "";

  collaboratorWelcome.hidden =
    false;

  setText(
    collaboratorWelcomeRecipient,
    `Destinatario: ${name}`
  );

  setText(
    collaboratorWelcomePhone,
    phone
      ? `Teléfono: ${phone}`
      : "Teléfono no registrado."
  );

  setText(
    collaboratorWelcomeChannelStatus,
    hasWhatsApp
      ? (
          whatsappNumber
            ? `Se preparó WhatsApp para: +${whatsappNumber}`
            : "El teléfono está marcado con WhatsApp, pero no se pudo preparar un destinatario directo."
        )
      : "Este teléfono no está marcado con WhatsApp."
  );

  const message = [
    `Hola ${name}.`,
    "",
    "Has sido registrado como colaborador de base en TERRA Campaign.",
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
  ].join("\n");

  collaboratorWelcomeMessage.value =
    message;

  const updateLinks = () => {
    const preparedMessage =
      collaboratorWelcomeMessage.value ||
      message;

    collaboratorWelcomeManual.href =
      "https://wa.me/?text=" +
      encodeURIComponent(
        preparedMessage
      );

    if (
      whatsappNumber
    ) {
      collaboratorWelcomeDirect.hidden =
        false;

      collaboratorWelcomeDirect.textContent =
        `Abrir WhatsApp con ${name}`;

      collaboratorWelcomeDirect.href =
        "https://wa.me/" +
        whatsappNumber +
        "?text=" +
        encodeURIComponent(
          preparedMessage
        );
    } else {
      collaboratorWelcomeDirect.hidden =
        true;
    }
  };

  collaboratorWelcomeMessage.oninput =
    updateLinks;

  updateLinks();

  collaboratorWelcomeWhatsApp.hidden =
    false;
}


// ======================================================
// MODAL
// ======================================================

function openModal() {
  if (
    !canCreateCollaborator() ||
    savingCollaborator
  ) {
    return;
  }

  collaboratorForm?.reset();

  resetWelcome();

  showStatus(
    collaboratorFormStatus,
    ""
  );

  collaboratorModal.hidden =
    false;

  collaboratorNameInput?.focus();
}


function closeModal() {
  collaboratorModal.hidden =
    true;

  collaboratorForm?.reset();

  resetWelcome();

  showStatus(
    collaboratorFormStatus,
    ""
  );
}


// ======================================================
// CREAR COLABORADOR
// ======================================================

async function handleSubmit(
  event
) {
  event.preventDefault();

  if (
    !canCreateCollaborator() ||
    savingCollaborator
  ) {
    return;
  }

  const name =
    String(
      collaboratorNameInput.value || ""
    )
      .trim()
      .replace(/\s+/g, " ");

  const email =
    String(
      collaboratorEmailInput.value || ""
    )
      .trim()
      .toLowerCase();

  const phone =
    String(
      collaboratorPhoneInput.value || ""
    ).trim();

  const hasWhatsApp =
    collaboratorWhatsAppYesInput.checked
      ? true
      : collaboratorWhatsAppNoInput.checked
        ? false
        : null;

  const locality =
    String(
      collaboratorLocalityInput.value || ""
    )
      .trim()
      .replace(/\s+/g, " ");

  const street =
    String(
      collaboratorStreetInput.value || ""
    )
      .trim()
      .replace(/\s+/g, " ");

  const houseNumber =
    String(
      collaboratorHouseNumberInput.value || ""
    )
      .trim()
      .replace(/\s+/g, " ");

  const password =
    String(
      collaboratorPasswordInput.value || ""
    );

  if (
    name.length < 2 ||
    !email ||
    hasWhatsApp === null ||
    locality.length < 2 ||
    street.length < 2 ||
    !houseNumber ||
    password.length < 6
  ) {
    showStatus(
      collaboratorFormStatus,
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
      collaboratorFormStatus,
      "Ingrese el teléfono que tiene WhatsApp.",
      "error"
    );

    return;
  }

  const version =
    sessionVersion;

  savingCollaborator =
    true;

  updateControls();

  showStatus(
    collaboratorFormStatus,
    "Registrando colaborador..."
  );

  try {
    const result =
      await createBaseCollaborator({
        name,
        email,
        phone,
        hasWhatsApp,
        locality,
        street,
        houseNumber,
        password
      });

    if (
      version !==
      sessionVersion
    ) {
      return;
    }

    const collaborator =
      result?.data?.user;

    collaboratorForm.reset();

    showStatus(
      collaboratorFormStatus,
      collaborator?.name
        ? `${collaborator.name} registrado correctamente.`
        : "Colaborador registrado correctamente.",
      "success"
    );

    if (
      collaborator
    ) {
      showWelcome(
        collaborator
      );
    }

  } catch (error) {
    console.error(
      "Error al crear colaborador:",
      error
    );

    showStatus(
      collaboratorFormStatus,
      getErrorMessage(
        error
      ),
      "error"
    );

  } finally {
    savingCollaborator =
      false;

    updateControls();
  }
}


// ======================================================
// EVENTOS
// ======================================================

newCollaboratorButton?.addEventListener(
  "click",
  openModal
);

closeCollaboratorModalButton?.addEventListener(
  "click",
  closeModal
);

collaboratorModal
  ?.querySelector(
    ".modal__backdrop"
  )
  ?.addEventListener(
    "click",
    closeModal
  );

collaboratorForm?.addEventListener(
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

    currentUser =
      user;

    currentProfile =
      null;

    currentParticipant =
      null;

    if (
      stopCollaboratorListener
    ) {
      stopCollaboratorListener();

      stopCollaboratorListener =
        null;
    }

    if (!user) {
      window.location.href =
        "./login.html";

      return;
    }

    try {
      currentProfile =
        await loadProfile(
          user
        );

      currentParticipant =
        await loadParticipant(
          currentProfile,
          user
        );

      renderParticipant(
        currentParticipant
      );

      updateControls();

      listenCollaborators();

    } catch (error) {
      console.error(
        "Acceso rechazado:",
        error
      );

      showStatus(
        participantInfoStatus,
        error.message ||
        "No fue posible validar el acceso.",
        "error"
      );

      newCollaboratorButton.hidden =
        true;
    }
  }
);
