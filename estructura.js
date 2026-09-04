// ======================================================
// TERRA CAMPAIGN
// ADMINISTRACIÓN DE ESTRUCTURA
// RESPONSABLE DE ESTRUCTURA + INTEGRANTES
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

const structureTitle =
  document.querySelector("#structureTitle");

const structureNameElement =
  document.querySelector("#structureName");

const structureIdElement =
  document.querySelector("#structureId");

const structureCoordinatorElement =
  document.querySelector("#structureCoordinator");

const structureMunicipalityElement =
  document.querySelector("#structureMunicipality");

const structureStatus =
  document.querySelector("#structureStatus");

const backButton =
  document.querySelector("#backButton");

const logoutButton =
  document.querySelector("#logoutButton");


// ======================================================
// RESPONSABLE DE ESTRUCTURA
// ======================================================

const newStructureChiefButton =
  document.querySelector("#newStructureChiefButton");

const structureChiefStatus =
  document.querySelector("#structureChiefStatus");

const structureChiefContainer =
  document.querySelector("#structureChiefContainer");

const structureChiefModal =
  document.querySelector("#structureChiefModal");

const closeStructureChiefModalButton =
  document.querySelector("#closeStructureChiefModalButton");

const structureChiefForm =
  document.querySelector("#structureChiefForm");

const structureChiefNameInput =
  document.querySelector("#structureChiefName");

const structureChiefEmailInput =
  document.querySelector("#structureChiefEmail");

const structureChiefPhoneInput =
  document.querySelector("#structureChiefPhone");

const structureChiefPasswordInput =
  document.querySelector("#structureChiefPassword");

const saveStructureChiefButton =
  document.querySelector("#saveStructureChiefButton");

const structureChiefFormStatus =
  document.querySelector("#structureChiefFormStatus");


// ======================================================
// INTEGRANTES
// ======================================================

const newMemberButton =
  document.querySelector("#newMemberButton");

const memberStatus =
  document.querySelector("#memberStatus");

const memberList =
  document.querySelector("#memberList");

const memberModal =
  document.querySelector("#memberModal");

const closeMemberModalButton =
  document.querySelector("#closeMemberModalButton");

const memberForm =
  document.querySelector("#memberForm");

const memberNameInput =
  document.querySelector("#memberName");

const memberEmailInput =
  document.querySelector("#memberEmail");

const memberPhoneInput =
  document.querySelector("#memberPhone");

const memberPasswordInput =
  document.querySelector("#memberPassword");

const saveMemberButton =
  document.querySelector("#saveMemberButton");

const memberFormStatus =
  document.querySelector("#memberFormStatus");


// ======================================================
// ESTADO
// ======================================================

let currentUser = null;
let currentUserProfile = null;
let currentStructure = null;

let currentStructureChief = null;
let currentMembers = [];

let stopStructureUsersListener = null;


// ======================================================
// URL
// ======================================================

const urlParams =
  new URLSearchParams(
    window.location.search
  );

const structureDocumentId =
  String(
    urlParams.get("id") || ""
  ).trim();


// ======================================================
// CLOUD FUNCTIONS
// ======================================================

const functions =
  getFunctions(
    undefined,
    "us-central1"
  );

const createStructureChiefFunction =
  httpsCallable(
    functions,
    "createStructureChief"
  );

const createStructureMemberFunction =
  httpsCallable(
    functions,
    "createStructureMember"
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
      "Ya existe un registro con esos datos."
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
// PERFIL DEL USUARIO
// ======================================================

async function loadCurrentUserProfile(
  user
) {

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
      "El usuario no tiene un perfil autorizado."
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
// CARGAR ESTRUCTURA
// ======================================================

async function loadStructure() {

  if (!structureDocumentId) {
    throw new Error(
      "No se especificó una estructura."
    );
  }

  const reference =
    doc(
      db,
      "estructuras",
      structureDocumentId
    );

  const snapshot =
    await getDoc(
      reference
    );

  if (!snapshot.exists()) {
    throw new Error(
      "La estructura no existe."
    );
  }

  const structure = {
    firestoreId:
      snapshot.id,

    ...snapshot.data()
  };

  if (
    structure.campaignId !==
    currentUserProfile.campaignId
  ) {
    throw new Error(
      "La estructura no pertenece a esta campaña."
    );
  }

  currentStructure =
    structure;

  if (structureTitle) {
    structureTitle.textContent =
      structure.name ||
      "Estructura";
  }

  if (structureNameElement) {
    structureNameElement.textContent =
      structure.name ||
      "Estructura";
  }

  if (structureIdElement) {
    structureIdElement.textContent =
      structure.id ||
      "";
  }

  if (structureCoordinatorElement) {
    structureCoordinatorElement.textContent =
      structure.coordinatorName
        ? `Coordinador municipal: ${structure.coordinatorName}`
        : "";
  }

  if (structureMunicipalityElement) {
    structureMunicipalityElement.textContent =
      structure.municipalityName
        ? `Municipio: ${structure.municipalityName}`
        : "";
  }

  showStatus(
    structureStatus,
    ""
  );
}


// ======================================================
// RENDER RESPONSABLE DE ESTRUCTURA
// ======================================================

function renderStructureChief(
  chief
) {

  if (!structureChiefContainer) {
    return;
  }

  currentStructureChief =
    chief || null;

  if (!chief) {

    structureChiefContainer.innerHTML = `
      <div class="card">
        <p class="muted">
          Todavía no hay RESPONSABLE DE ESTRUCTURA asignado.
        </p>
      </div>
    `;

    if (newStructureChiefButton) {
      newStructureChiefButton.disabled =
        false;

      newStructureChiefButton.textContent =
        "+ Asignar jefe";
    }

    return;
  }

  const statusText =
    chief.active === true
      ? "Activo"
      : "Inactivo";

  structureChiefContainer.innerHTML = `
    <article class="card">

      <p class="eyebrow">
        RESPONSABLE DE ESTRUCTURA
      </p>

      <h3>
        ${escapeHtml(
          chief.name
        )}
      </h3>

      <p class="muted">
        ${escapeHtml(
          chief.email
        )}
      </p>

      ${
        chief.phone
          ? `
            <p class="muted">
              Tel:
              ${escapeHtml(
                chief.phone
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

  if (newStructureChiefButton) {
    newStructureChiefButton.disabled =
      true;

    newStructureChiefButton.textContent =
      "Jefe asignado";
  }
}


// ======================================================
// RENDER INTEGRANTES
// ======================================================

function renderMembers(
  members
) {

  if (!memberList) {
    return;
  }

  currentMembers =
    members;

  if (
    members.length === 0
  ) {

    memberList.innerHTML = `
      <div class="card">
        <p class="muted">
          Todavía no hay integrantes registrados.
        </p>
      </div>
    `;

    return;
  }

  memberList.innerHTML =
    members
      .map(
        (member) => {

          const statusText =
            member.active === true
              ? "Activo"
              : "Inactivo";

          return `
            <article class="card">

              <p class="eyebrow">
                INTEGRANTE
              </p>

              <h3>
                ${escapeHtml(
                  member.name
                )}
              </h3>

              <p class="muted">
                ${escapeHtml(
                  member.email
                )}
              </p>

              ${
                member.phone
                  ? `
                    <p class="muted">
                      Tel:
                      ${escapeHtml(
                        member.phone
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
// ESCUCHAR PERSONAS DE LA ESTRUCTURA
// ======================================================

function listenStructureUsers() {

  if (
    stopStructureUsersListener
  ) {
    stopStructureUsersListener();
  }

  const structureUsersQuery =
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
        "structureId",
        "==",
        currentStructure.id
      )
    );

  stopStructureUsersListener =
    onSnapshot(

      structureUsersQuery,

      (snapshot) => {

        const users =
          [];

        snapshot.forEach(
          (documentSnapshot) => {

            users.push({
              uid:
                documentSnapshot.id,

              ...documentSnapshot.data()
            });
          }
        );

        const chief =
          users.find(
            (user) =>
              user.role ===
              "jefe_estructura"
          ) || null;

        const members =
          users.filter(
            (user) =>
              user.role ===
              "integrante"
          );

        renderStructureChief(
          chief
        );

        renderMembers(
          members
        );

        showStatus(
          structureChiefStatus,
          ""
        );

        showStatus(
          memberStatus,
          ""
        );
      },

      (error) => {

        console.error(
          "Error al consultar personas de la estructura:",
          error
        );

        showStatus(
          structureChiefStatus,
          "No fue posible consultar el responsable de la estructura.",
          "error"
        );

        showStatus(
          memberStatus,
          "No fue posible consultar los integrantes.",
          "error"
        );
      }
    );
}


// ======================================================
// MODAL RESPONSABLE DE ESTRUCTURA
// ======================================================

function openStructureChiefModal() {

  if (
    currentStructureChief
  ) {
    return;
  }

  structureChiefForm?.reset();

  showStatus(
    structureChiefFormStatus,
    ""
  );

  if (structureChiefModal) {
    structureChiefModal.hidden =
      false;
  }

  setTimeout(
    () => {
      structureChiefNameInput?.focus();
    },
    50
  );
}


function closeStructureChiefModal() {

  if (structureChiefModal) {
    structureChiefModal.hidden =
      true;
  }

  structureChiefForm?.reset();

  showStatus(
    structureChiefFormStatus,
    ""
  );
}


// ======================================================
// CREAR RESPONSABLE DE ESTRUCTURA
// ======================================================

async function handleCreateStructureChief(
  event
) {

  event.preventDefault();

  const name =
    String(
      structureChiefNameInput?.value ||
      ""
    )
      .trim()
      .replace(/\s+/g, " ");

  const email =
    String(
      structureChiefEmailInput?.value ||
      ""
    )
      .trim()
      .toLowerCase();

  const phone =
    String(
      structureChiefPhoneInput?.value ||
      ""
    )
      .trim();

  const password =
    String(
      structureChiefPasswordInput?.value ||
      ""
    );

  if (
    name.length < 2
  ) {

    showStatus(
      structureChiefFormStatus,
      "Ingrese el nombre completo.",
      "error"
    );

    structureChiefNameInput?.focus();

    return;
  }

  if (!email) {

    showStatus(
      structureChiefFormStatus,
      "Ingrese un correo electrónico.",
      "error"
    );

    structureChiefEmailInput?.focus();

    return;
  }

  if (
    password.length < 6
  ) {

    showStatus(
      structureChiefFormStatus,
      "La contraseña temporal debe tener al menos 6 caracteres.",
      "error"
    );

    structureChiefPasswordInput?.focus();

    return;
  }

  saveStructureChiefButton.disabled =
    true;

  saveStructureChiefButton.textContent =
    "Guardando...";

  showStatus(
    structureChiefFormStatus,
    "Registrando RESPONSABLE DE ESTRUCTURA..."
  );

  try {

    const result =
      await createStructureChiefFunction({
        name,
        email,
        phone,
        password,
        structureDocumentId
      });

    const chief =
      result?.data?.user;

    showStatus(
      structureChiefFormStatus,
      chief?.name
        ? `${chief.name} registrado correctamente.`
        : "RESPONSABLE DE ESTRUCTURA registrado correctamente.",
      "success"
    );

    setTimeout(
      () => {
        closeStructureChiefModal();
      },
      900
    );

  } catch (error) {

    console.error(
      "Error al crear RESPONSABLE DE ESTRUCTURA:",
      error
    );

    showStatus(
      structureChiefFormStatus,
      getErrorMessage(error),
      "error"
    );

  } finally {

    saveStructureChiefButton.disabled =
      false;

    saveStructureChiefButton.textContent =
      "Guardar RESPONSABLE DE ESTRUCTURA";
  }
}


// ======================================================
// MODAL INTEGRANTE
// ======================================================

function openMemberModal() {

  memberForm?.reset();

  showStatus(
    memberFormStatus,
    ""
  );

  if (memberModal) {
    memberModal.hidden =
      false;
  }

  setTimeout(
    () => {
      memberNameInput?.focus();
    },
    50
  );
}


function closeMemberModal() {

  if (memberModal) {
    memberModal.hidden =
      true;
  }

  memberForm?.reset();

  showStatus(
    memberFormStatus,
    ""
  );
}


// ======================================================
// CREAR INTEGRANTE
// ======================================================

async function handleCreateMember(
  event
) {

  event.preventDefault();

  const name =
    String(
      memberNameInput?.value ||
      ""
    )
      .trim()
      .replace(/\s+/g, " ");

  const email =
    String(
      memberEmailInput?.value ||
      ""
    )
      .trim()
      .toLowerCase();

  const phone =
    String(
      memberPhoneInput?.value ||
      ""
    )
      .trim();

  const password =
    String(
      memberPasswordInput?.value ||
      ""
    );

  if (
    name.length < 2
  ) {

    showStatus(
      memberFormStatus,
      "Ingrese el nombre completo.",
      "error"
    );

    memberNameInput?.focus();

    return;
  }

  if (!email) {

    showStatus(
      memberFormStatus,
      "Ingrese un correo electrónico.",
      "error"
    );

    memberEmailInput?.focus();

    return;
  }

  if (
    password.length < 6
  ) {

    showStatus(
      memberFormStatus,
      "La contraseña temporal debe tener al menos 6 caracteres.",
      "error"
    );

    memberPasswordInput?.focus();

    return;
  }

  saveMemberButton.disabled =
    true;

  saveMemberButton.textContent =
    "Guardando...";

  showStatus(
    memberFormStatus,
    "Registrando integrante..."
  );

  try {

    const result =
      await createStructureMemberFunction({
        name,
        email,
        phone,
        password,
        structureDocumentId
      });

    const member =
      result?.data?.user;

    showStatus(
      memberFormStatus,
      member?.name
        ? `${member.name} registrado correctamente.`
        : "Integrante registrado correctamente.",
      "success"
    );

    setTimeout(
      () => {
        closeMemberModal();
      },
      900
    );

  } catch (error) {

    console.error(
      "Error al crear integrante:",
      error
    );

    showStatus(
      memberFormStatus,
      getErrorMessage(error),
      "error"
    );

  } finally {

    saveMemberButton.disabled =
      false;

    saveMemberButton.textContent =
      "Guardar integrante";
  }
}


// ======================================================
// EVENTOS JEFE
// ======================================================

newStructureChiefButton?.addEventListener(
  "click",
  openStructureChiefModal
);

closeStructureChiefModalButton?.addEventListener(
  "click",
  closeStructureChiefModal
);

structureChiefForm?.addEventListener(
  "submit",
  handleCreateStructureChief
);

structureChiefModal
  ?.querySelector(
    ".modal__backdrop"
  )
  ?.addEventListener(
    "click",
    closeStructureChiefModal
  );


// ======================================================
// EVENTOS INTEGRANTE
// ======================================================

newMemberButton?.addEventListener(
  "click",
  openMemberModal
);

closeMemberModalButton?.addEventListener(
  "click",
  closeMemberModal
);

memberForm?.addEventListener(
  "submit",
  handleCreateMember
);

memberModal
  ?.querySelector(
    ".modal__backdrop"
  )
  ?.addEventListener(
    "click",
    closeMemberModal
  );


// ======================================================
// VOLVER
// ======================================================

backButton?.addEventListener(
  "click",
  () => {

    if (
      currentStructure?.municipalityId
    ) {

      window.location.href =
        `./municipio.html?id=${encodeURIComponent(
          currentStructure.municipalityId
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

      await loadStructure();

      listenStructureUsers();

    } catch (error) {

      console.error(
        "Error al iniciar módulo de estructura:",
        error
      );

      alert(
        error.message ||
        "No fue posible abrir la estructura."
      );

      window.location.href =
        "./municipios.html";
    }
  }
);
