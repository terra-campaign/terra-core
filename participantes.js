// ======================================================
// TERRA CAMPAIGN
// ADMINISTRACIÓN DE PARTICIPANTES
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

const memberTitle =
  document.querySelector("#memberTitle");

const memberName =
  document.querySelector("#memberName");

const memberEmail =
  document.querySelector("#memberEmail");

const memberPhone =
  document.querySelector("#memberPhone");

const memberStructure =
  document.querySelector("#memberStructure");

const memberMunicipality =
  document.querySelector("#memberMunicipality");

const memberInfoStatus =
  document.querySelector("#memberInfoStatus");

const backButton =
  document.querySelector("#backButton");

const logoutButton =
  document.querySelector("#logoutButton");


// ======================================================
// PARTICIPANTES
// ======================================================

const newParticipantButton =
  document.querySelector("#newParticipantButton");

const participantStatus =
  document.querySelector("#participantStatus");

const participantList =
  document.querySelector("#participantList");

const participantModal =
  document.querySelector("#participantModal");

const closeParticipantModalButton =
  document.querySelector("#closeParticipantModalButton");

const participantForm =
  document.querySelector("#participantForm");

const participantNameInput =
  document.querySelector("#participantName");

const participantEmailInput =
  document.querySelector("#participantEmail");

const participantPhoneInput =
  document.querySelector("#participantPhone");

const participantPasswordInput =
  document.querySelector("#participantPassword");

const saveParticipantButton =
  document.querySelector("#saveParticipantButton");

const participantFormStatus =
  document.querySelector("#participantFormStatus");


// ======================================================
// ESTADO
// ======================================================

let currentUser = null;
let currentUserProfile = null;
let currentMember = null;

let stopParticipantListener = null;


// ======================================================
// URL
// ======================================================

const urlParams =
  new URLSearchParams(
    window.location.search
  );

const memberUid =
  String(
    urlParams.get("id") || ""
  ).trim();


// ======================================================
// CLOUD FUNCTION
// ======================================================

const functions =
  getFunctions(
    undefined,
    "us-central1"
  );

const createParticipantFunction =
  httpsCallable(
    functions,
    "createParticipant"
  );


// ======================================================
// UTILIDADES
// ======================================================

function escapeHtml(value) {

  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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
    message;

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


function getErrorMessage(error) {

  const message =
    error?.message ||
    error?.details ||
    "";

  if (
    error?.code ===
    "functions/already-exists"
  ) {
    return (
      message ||
      "Ya existe un usuario con esos datos."
    );
  }

  if (
    error?.code ===
    "functions/permission-denied"
  ) {
    return "No tiene permisos para realizar esta operación.";
  }

  if (
    error?.code ===
    "functions/unauthenticated"
  ) {
    return "La sesión no es válida. Inicie sesión nuevamente.";
  }

  if (
    error?.code ===
    "functions/not-found"
  ) {
    return (
      message ||
      "No se encontró el registro solicitado."
    );
  }

  if (
    error?.code ===
    "functions/invalid-argument"
  ) {
    return (
      message ||
      "Revise los datos ingresados."
    );
  }

  if (
    error?.code ===
    "functions/failed-precondition"
  ) {
    return (
      message ||
      "No se cumplen las condiciones necesarias para realizar esta operación."
    );
  }

  return (
    message ||
    "No fue posible completar la operación."
  );
}


// ======================================================
// PERFIL ACTUAL
// ======================================================

async function loadCurrentUserProfile(user) {

  const reference =
    doc(
      db,
      "usuarios",
      user.uid
    );

  const snapshot =
    await getDoc(
      reference
    );

  if (!snapshot.exists()) {
    throw new Error(
      "El usuario no tiene perfil autorizado."
    );
  }

  const profile = {
    uid:
      snapshot.id,

    ...snapshot.data()
  };

  if (
    profile.active !== true
  ) {
    throw new Error(
      "El usuario está desactivado."
    );
  }

  if (
    profile.role !== "admin"
  ) {
    throw new Error(
      "Esta sección es exclusiva para administradores."
    );
  }

  if (
    !profile.campaignId
  ) {
    throw new Error(
      "El administrador no tiene campaña asignada."
    );
  }

  return profile;
}


// ======================================================
// CARGAR INTEGRANTE
// ======================================================

async function loadMember() {

  if (!memberUid) {
    throw new Error(
      "No se especificó un integrante."
    );
  }

  const reference =
    doc(
      db,
      "usuarios",
      memberUid
    );

  const snapshot =
    await getDoc(
      reference
    );

  if (!snapshot.exists()) {
    throw new Error(
      "El integrante no existe."
    );
  }

  const member = {
    uid:
      snapshot.id,

    ...snapshot.data()
  };

  if (
    member.role !== "integrante"
  ) {
    throw new Error(
      "El usuario seleccionado no es un integrante."
    );
  }

  if (
    member.campaignId !==
    currentUserProfile.campaignId
  ) {
    throw new Error(
      "El integrante pertenece a otra campaña."
    );
  }

  currentMember =
    member;

  memberTitle.textContent =
    member.name ||
    "Participantes";

  memberName.textContent =
    member.name ||
    "Integrante";

  memberEmail.textContent =
    member.email
      ? `Correo: ${member.email}`
      : "";

  memberPhone.textContent =
    member.phone
      ? `Tel: ${member.phone}`
      : "";

  memberStructure.textContent =
    member.structureName
      ? `Estructura: ${member.structureName}`
      : (
          member.structureId
            ? `Estructura: ${member.structureId}`
            : ""
        );

  memberMunicipality.textContent =
    member.municipalityName
      ? `Municipio: ${member.municipalityName}`
      : "";

  showStatus(
    memberInfoStatus,
    ""
  );
}


// ======================================================
// RENDER PARTICIPANTES
// ======================================================

function renderParticipants(
  participants
) {

  if (!participantList) {
    return;
  }

  if (
    participants.length === 0
  ) {

    participantList.innerHTML = `
      <div class="card">
        <p class="muted">
          Todavía no hay participantes registrados.
        </p>
      </div>
    `;

    return;
  }

  participantList.innerHTML =
    participants
      .map(
        (participant) => {

          const statusText =
            participant.active === true
              ? "Activo"
              : "Inactivo";

          return `
            <article class="card">

              <p class="eyebrow">
                PARTICIPANTE
              </p>

              <h3>
                ${escapeHtml(
                  participant.name
                )}
              </h3>

              <p class="muted">
                ${escapeHtml(
                  participant.email
                )}
              </p>

              ${
                participant.phone
                  ? `
                    <p class="muted">
                      Tel:
                      ${escapeHtml(
                        participant.phone
                      )}
                    </p>
                  `
                  : ""
              }

              <p class="muted">
                Estado:
                ${escapeHtml(
                  statusText
                )}
              </p>

            </article>
          `;
        }
      )
      .join("");
}


// ======================================================
// ESCUCHAR PARTICIPANTES DEL INTEGRANTE
// ======================================================

function listenParticipants() {

  if (
    stopParticipantListener
  ) {
    stopParticipantListener();
  }

  const participantQuery =
    query(

      collection(
        db,
        "usuarios"
      ),

      where(
        "campaignId",
        "==",
        currentUserProfile.campaignId
      ),

      where(
        "parentUserId",
        "==",
        currentMember.uid
      ),

      where(
        "role",
        "==",
        "participante"
      )
    );

  stopParticipantListener =
    onSnapshot(

      participantQuery,

      (snapshot) => {

        const participants =
          [];

        snapshot.forEach(
          (documentSnapshot) => {

            participants.push({
              uid:
                documentSnapshot.id,

              ...documentSnapshot.data()
            });
          }
        );

        renderParticipants(
          participants
        );

        showStatus(
          participantStatus,
          ""
        );
      },

      (error) => {

        console.error(
          "Error al consultar participantes:",
          error
        );

        showStatus(
          participantStatus,
          "No fue posible consultar los participantes.",
          "error"
        );
      }
    );
}


// ======================================================
// MODAL
// ======================================================

function openParticipantModal() {

  participantForm?.reset();

  showStatus(
    participantFormStatus,
    ""
  );

  if (participantModal) {
    participantModal.hidden =
      false;
  }

  setTimeout(
    () => {
      participantNameInput?.focus();
    },
    50
  );
}


function closeParticipantModal() {

  if (participantModal) {
    participantModal.hidden =
      true;
  }

  participantForm?.reset();

  showStatus(
    participantFormStatus,
    ""
  );
}


// ======================================================
// CREAR PARTICIPANTE
// ======================================================

async function handleCreateParticipant(
  event
) {

  event.preventDefault();

  const name =
    String(
      participantNameInput?.value ||
      ""
    )
      .trim()
      .replace(/\s+/g, " ");

  const email =
    String(
      participantEmailInput?.value ||
      ""
    )
      .trim()
      .toLowerCase();

  const phone =
    String(
      participantPhoneInput?.value ||
      ""
    )
      .trim();

  const password =
    String(
      participantPasswordInput?.value ||
      ""
    );

  if (
    name.length < 2
  ) {

    showStatus(
      participantFormStatus,
      "Ingrese el nombre completo.",
      "error"
    );

    participantNameInput?.focus();

    return;
  }

  if (!email) {

    showStatus(
      participantFormStatus,
      "Ingrese un correo electrónico.",
      "error"
    );

    participantEmailInput?.focus();

    return;
  }

  if (
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

  saveParticipantButton.disabled =
    true;

  saveParticipantButton.textContent =
    "Guardando...";

  showStatus(
    participantFormStatus,
    "Registrando participante..."
  );

  try {

    const result =
      await createParticipantFunction({
        name,
        email,
        phone,
        password,
        parentUserId:
          currentMember.uid
      });

    const participant =
      result?.data?.user;

    showStatus(
      participantFormStatus,
      participant?.name
        ? `${participant.name} registrado correctamente.`
        : "Participante registrado correctamente.",
      "success"
    );

    setTimeout(
      () => {
        closeParticipantModal();
      },
      900
    );

  } catch (error) {

    console.error(
      "Error al crear participante:",
      error
    );

    showStatus(
      participantFormStatus,
      getErrorMessage(error),
      "error"
    );

  } finally {

    saveParticipantButton.disabled =
      false;

    saveParticipantButton.textContent =
      "Guardar participante";
  }
}


// ======================================================
// EVENTOS
// ======================================================

newParticipantButton?.addEventListener(
  "click",
  openParticipantModal
);

closeParticipantModalButton?.addEventListener(
  "click",
  closeParticipantModal
);

participantForm?.addEventListener(
  "submit",
  handleCreateParticipant
);

participantModal
  ?.querySelector(
    ".modal__backdrop"
  )
  ?.addEventListener(
    "click",
    closeParticipantModal
  );


// ======================================================
// VOLVER
// ======================================================

backButton?.addEventListener(
  "click",
  () => {

    if (
      currentMember?.structureDocumentId
    ) {

      window.location.href =
        `./estructura.html?id=${encodeURIComponent(
          currentMember.structureDocumentId
        )}`;

      return;
    }

    window.location.href =
      "./municipios.html";
  }
);


// ======================================================
// LOGOUT
// ======================================================

logoutButton?.addEventListener(
  "click",
  async () => {

    try {

      await signOut(
        auth
      );

    } finally {

      window.location.href =
        "./login.html";
    }
  }
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

    try {

      currentUser =
        user;

      currentUserProfile =
        await loadCurrentUserProfile(
          user
        );

      await loadMember();

      listenParticipants();

    } catch (error) {

      console.error(
        "Error al iniciar módulo de participantes:",
        error
      );

      alert(
        error.message ||
        "No fue posible abrir los participantes."
      );

      window.location.href =
        "./municipios.html";
    }
  }
);
