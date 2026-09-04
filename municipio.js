// ======================================================
// TERRA CAMPAIGN
// ADMINISTRACIÓN DE MUNICIPIO
// COORDINADORES MUNICIPALES
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
  orderBy,
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

const logoutButton =
  document.querySelector("#logoutButton");

const municipalityTitle =
  document.querySelector("#municipalityTitle");

const municipalityNameElement =
  document.querySelector("#municipalityName");

const municipalityIdElement =
  document.querySelector("#municipalityId");

const municipalityStatus =
  document.querySelector("#municipalityStatus");

const newCoordinatorButton =
  document.querySelector("#newCoordinatorButton");

const coordinatorStatus =
  document.querySelector("#coordinatorStatus");

const coordinatorList =
  document.querySelector("#coordinatorList");

const coordinatorModal =
  document.querySelector("#coordinatorModal");

const closeCoordinatorModalButton =
  document.querySelector("#closeCoordinatorModalButton");

const coordinatorForm =
  document.querySelector("#coordinatorForm");

const coordinatorNameInput =
  document.querySelector("#coordinatorName");

const coordinatorEmailInput =
  document.querySelector("#coordinatorEmail");

const coordinatorPhoneInput =
  document.querySelector("#coordinatorPhone");

const coordinatorPasswordInput =
  document.querySelector("#coordinatorPassword");

const saveCoordinatorButton =
  document.querySelector("#saveCoordinatorButton");

const formStatus =
  document.querySelector("#formStatus");
const newStructureButton =
  document.querySelector("#newStructureButton");

const structureStatus =
  document.querySelector("#structureStatus");

const structureList =
  document.querySelector("#structureList");

const structureModal =
  document.querySelector("#structureModal");

const closeStructureModalButton =
  document.querySelector("#closeStructureModalButton");

const structureForm =
  document.querySelector("#structureForm");

const structureNameInput =
  document.querySelector("#structureName");

const structureCoordinatorSelect =
  document.querySelector("#structureCoordinator");

const saveStructureButton =
  document.querySelector("#saveStructureButton");

const structureFormStatus =
  document.querySelector("#structureFormStatus");

// ======================================================
// ESTADO
// ======================================================

let currentUser = null;
let currentUserProfile = null;
let currentMunicipality = null;

let currentCoordinators = [];

let stopCoordinatorsListener = null;
let stopStructuresListener = null;


// ======================================================
// URL
// ======================================================

const urlParams =
  new URLSearchParams(
    window.location.search
  );

const municipalityId =
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

const createMunicipalCoordinatorFunction =
  httpsCallable(
    functions,
    "createMunicipalCoordinator"
  );

const createStructureFunction =
  httpsCallable(
    functions,
    "createStructure"
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
    return "Ya existe un usuario registrado con ese correo.";
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
    return "El municipio seleccionado no existe.";
  }

  if (
    error?.code ===
    "functions/invalid-argument"
  ) {
    return message || "Revise los datos ingresados.";
  }

  return (
    message ||
    "No fue posible completar la operación."
  );
}


// ======================================================
// PERFIL
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
// CARGAR MUNICIPIO
// ======================================================

async function loadMunicipality() {

  if (!municipalityId) {
    throw new Error(
      "No se especificó un municipio."
    );
  }

  const reference =
    doc(
      db,
      "municipios",
      municipalityId
    );

  const snapshot =
    await getDoc(
      reference
    );

  if (!snapshot.exists()) {
    throw new Error(
      "El municipio no existe."
    );
  }

  const municipality = {
    id:
      snapshot.id,

    ...snapshot.data()
  };

  if (
    municipality.campaignId !==
    currentUserProfile.campaignId
  ) {
    throw new Error(
      "El municipio no pertenece a esta campaña."
    );
  }

  currentMunicipality =
    municipality;

  if (municipalityTitle) {
    municipalityTitle.textContent =
      municipality.name || "Municipio";
  }

  if (municipalityNameElement) {
    municipalityNameElement.textContent =
      municipality.name || "Municipio";
  }

  if (municipalityIdElement) {
    municipalityIdElement.textContent =
      municipality.id;
  }

  showStatus(
    municipalityStatus,
    ""
  );
}


// ======================================================
// MODAL
// ======================================================

function openCoordinatorModal() {

  coordinatorForm?.reset();

  showStatus(
    formStatus,
    ""
  );

  if (coordinatorModal) {
    coordinatorModal.hidden =
      false;
  }

  setTimeout(
    () => {
      coordinatorNameInput?.focus();
    },
    50
  );
}


function closeCoordinatorModal() {

  if (coordinatorModal) {
    coordinatorModal.hidden =
      true;
  }

  coordinatorForm?.reset();

  showStatus(
    formStatus,
    ""
  );
}


// ======================================================
// RENDER COORDINADORES
// ======================================================

function renderCoordinators(
  coordinators
) {

  if (!coordinatorList) {
    return;
  }

  if (
    coordinators.length === 0
  ) {

    coordinatorList.innerHTML = `
      <div class="card">
        <p class="muted">
          Todavía no hay coordinadores municipales registrados.
        </p>
      </div>
    `;

    return;
  }


  coordinatorList.innerHTML =
    coordinators
      .map(
        (coordinator) => {

          const statusText =
            coordinator.active === true
              ? "Activo"
              : "Inactivo";

          return `
            <article class="card">

              <div class="section-header">

                <div>

                  <p class="eyebrow">
                    COORDINADOR MUNICIPAL
                  </p>

                  <h3>
                    ${escapeHtml(
                      coordinator.name
                    )}
                  </h3>

                  <p class="muted">
                    ${escapeHtml(
                      coordinator.email
                    )}
                  </p>

                  ${
                    coordinator.phone
                      ? `
                        <p class="muted">
                          Tel:
                          ${escapeHtml(
                            coordinator.phone
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

                </div>

              </div>

            </article>
          `;
        }
      )
      .join("");
}


// ======================================================
// ESCUCHAR COORDINADORES
// ======================================================

function listenCoordinators() {

  if (
    stopCoordinatorsListener
  ) {
    stopCoordinatorsListener();
  }


  const coordinatorsQuery =
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
        "municipalityId",
        "==",
        municipalityId
      ),

      where(
        "role",
        "==",
        "coordinador_municipal"
      ),

      orderBy(
        "name",
        "asc"
      )
    );


  stopCoordinatorsListener =
    onSnapshot(

      coordinatorsQuery,

      (snapshot) => {

        const coordinators =
          [];

        snapshot.forEach(
          (documentSnapshot) => {

            coordinators.push({
              uid:
                documentSnapshot.id,

              ...documentSnapshot.data()
            });
          }
        );

        renderCoordinators(
          coordinators
        );

        showStatus(
          coordinatorStatus,
          ""
        );
      },

      (error) => {

        console.error(
          "Error al consultar coordinadores municipales:",
          error
        );

        showStatus(
          coordinatorStatus,
          "No fue posible consultar los coordinadores municipales.",
          "error"
        );
      }
    );
}


// ======================================================
// CREAR COORDINADOR
// ======================================================

async function handleCreateCoordinator(
  event
) {

  event.preventDefault();


  const name =
    String(
      coordinatorNameInput?.value ||
      ""
    )
      .trim()
      .replace(/\s+/g, " ");


  const email =
    String(
      coordinatorEmailInput?.value ||
      ""
    )
      .trim()
      .toLowerCase();


  const phone =
    String(
      coordinatorPhoneInput?.value ||
      ""
    )
      .trim();


  const password =
    String(
      coordinatorPasswordInput?.value ||
      ""
    );


  if (
    name.length < 2
  ) {

    showStatus(
      formStatus,
      "Ingrese el nombre completo.",
      "error"
    );

    coordinatorNameInput?.focus();

    return;
  }


  if (!email) {

    showStatus(
      formStatus,
      "Ingrese un correo electrónico.",
      "error"
    );

    coordinatorEmailInput?.focus();

    return;
  }


  if (
    password.length < 6
  ) {

    showStatus(
      formStatus,
      "La contraseña temporal debe tener al menos 6 caracteres.",
      "error"
    );

    coordinatorPasswordInput?.focus();

    return;
  }


  saveCoordinatorButton.disabled =
    true;

  saveCoordinatorButton.textContent =
    "Guardando...";


  showStatus(
    formStatus,
    "Registrando coordinador municipal..."
  );


  try {

    const result =
      await createMunicipalCoordinatorFunction({
        name,
        email,
        phone,
        password,
        municipalityId
      });


    const coordinator =
      result?.data?.user;


    showStatus(
      formStatus,
      coordinator?.name
        ? `${coordinator.name} registrado correctamente.`
        : "Coordinador registrado correctamente.",
      "success"
    );


    setTimeout(
      () => {
        closeCoordinatorModal();
      },
      900
    );


  } catch (error) {

    console.error(
      "Error al crear coordinador municipal:",
      error
    );


    showStatus(
      formStatus,
      getErrorMessage(error),
      "error"
    );


  } finally {

    saveCoordinatorButton.disabled =
      false;

    saveCoordinatorButton.textContent =
      "Guardar coordinador";
  }
}


// ======================================================
// EVENTOS
// ======================================================

newCoordinatorButton?.addEventListener(
  "click",
  openCoordinatorModal
);


closeCoordinatorModalButton?.addEventListener(
  "click",
  closeCoordinatorModal
);


coordinatorForm?.addEventListener(
  "submit",
  handleCreateCoordinator
);


coordinatorModal
  ?.querySelector(
    ".modal__backdrop"
  )
  ?.addEventListener(
    "click",
    closeCoordinatorModal
  );


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


      await loadMunicipality();


      listenCoordinators();


    } catch (error) {

      console.error(
        "Error al iniciar módulo de municipio:",
        error
      );


      alert(
        error.message ||
        "No fue posible abrir el municipio."
      );


      window.location.href =
        "./municipios.html";
    }
  }
);
