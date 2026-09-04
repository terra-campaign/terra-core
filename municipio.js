// ======================================================
// TERRA CAMPAIGN
// ADMINISTRACIÓN DE MUNICIPIO
// COORDINADORES MUNICIPALES + ESTRUCTURAS
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


// ------------------------------------------------------
// COORDINADORES
// ------------------------------------------------------

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


// ------------------------------------------------------
// ESTRUCTURAS
// ------------------------------------------------------

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
      municipality.name ||
      "Municipio";
  }


  if (municipalityNameElement) {

    municipalityNameElement.textContent =
      municipality.name ||
      "Municipio";
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
// MODAL COORDINADOR
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
// SELECTOR DE COORDINADORES
// ======================================================

function renderCoordinatorOptions() {

  if (!structureCoordinatorSelect) {
    return;
  }


  const previousValue =
    structureCoordinatorSelect.value;


  structureCoordinatorSelect.innerHTML = `
    <option value="">
      Seleccione un coordinador
    </option>
  `;


  currentCoordinators.forEach(
    (coordinator) => {

      const option =
        document.createElement(
          "option"
        );


      option.value =
        coordinator.uid;


      option.textContent =
        coordinator.name ||
        coordinator.email ||
        coordinator.uid;


      structureCoordinatorSelect.appendChild(
        option
      );
    }
  );


  if (
    previousValue &&
    currentCoordinators.some(
      (coordinator) =>
        coordinator.uid ===
        previousValue
    )
  ) {

    structureCoordinatorSelect.value =
      previousValue;
  }
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


        currentCoordinators =
          coordinators;


        renderCoordinators(
          coordinators
        );


        renderCoordinatorOptions();


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
// MODAL ESTRUCTURA
// ======================================================

function openStructureModal() {

  structureForm?.reset();


  showStatus(
    structureFormStatus,
    ""
  );


  renderCoordinatorOptions();


  if (structureModal) {

    structureModal.hidden =
      false;
  }


  setTimeout(
    () => {

      structureNameInput?.focus();

    },
    50
  );
}


function closeStructureModal() {

  if (structureModal) {

    structureModal.hidden =
      true;
  }


  structureForm?.reset();


  showStatus(
    structureFormStatus,
    ""
  );
}


// ======================================================
// RENDER ESTRUCTURAS
// ======================================================

function renderStructures(
  structures
) {

  if (!structureList) {
    return;
  }


  if (
    structures.length === 0
  ) {

    structureList.innerHTML = `
      <div class="card">

        <p class="muted">
          Todavía no hay estructuras registradas.
        </p>

      </div>
    `;

    return;
  }


  structureList.innerHTML =
    structures
      .map(
        (structure) => {

          const statusText =
            structure.active === true
              ? "Activa"
              : "Inactiva";


          return `
            <article class="card">

              <div class="section-header">

                <div>

                  <p class="eyebrow">
                    ${escapeHtml(
                      structure.id
                    )}
                  </p>

                  <h3>
                    ${escapeHtml(
                      structure.name
                    )}
                  </h3>

                  <p class="muted">

                    Coordinador:
                    ${escapeHtml(
                      structure.coordinatorName ||
                      ""
                    )}

                  </p>

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
// ESCUCHAR ESTRUCTURAS
// ======================================================

function listenStructures() {

  if (
    stopStructuresListener
  ) {

    stopStructuresListener();
  }


  const structuresQuery =
    query(

      collection(
        db,
        "estructuras"
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

      orderBy(
        "name",
        "asc"
      )
    );


  stopStructuresListener =
    onSnapshot(

      structuresQuery,

      (snapshot) => {

        const structures =
          [];


        snapshot.forEach(
          (documentSnapshot) => {

            structures.push({

              firestoreId:
                documentSnapshot.id,

              ...documentSnapshot.data()
            });
          }
        );


        renderStructures(
          structures
        );


        showStatus(
          structureStatus,
          ""
        );
      },


      (error) => {

        console.error(
          "Error al consultar estructuras:",
          error
        );


        showStatus(
          structureStatus,
          "No fue posible consultar las estructuras.",
          "error"
        );
      }
    );
}


// ======================================================
// CREAR ESTRUCTURA
// ======================================================

async function handleCreateStructure(
  event
) {

  event.preventDefault();


  const name =
    String(
      structureNameInput?.value ||
      ""
    )
      .trim()
      .replace(/\s+/g, " ");


  const coordinatorId =
    String(
      structureCoordinatorSelect?.value ||
      ""
    )
      .trim();


  if (
    name.length < 2
  ) {

    showStatus(
      structureFormStatus,
      "Ingrese un nombre válido para la estructura.",
      "error"
    );


    structureNameInput?.focus();

    return;
  }


  if (!coordinatorId) {

    showStatus(
      structureFormStatus,
      "Seleccione un coordinador municipal.",
      "error"
    );


    structureCoordinatorSelect?.focus();

    return;
  }


  saveStructureButton.disabled =
    true;


  saveStructureButton.textContent =
    "Guardando...";


  showStatus(
    structureFormStatus,
    "Registrando estructura..."
  );


  try {

    const result =
      await createStructureFunction({

        name,

        municipalityId,

        coordinatorId
      });


    const structure =
      result?.data?.structure;


    showStatus(
      structureFormStatus,
      structure?.name
        ? `${structure.name} registrada correctamente.`
        : "Estructura registrada correctamente.",
      "success"
    );


    setTimeout(
      () => {

        closeStructureModal();

      },
      900
    );


  } catch (error) {

    console.error(
      "Error al crear estructura:",
      error
    );


    showStatus(
      structureFormStatus,
      getErrorMessage(error),
      "error"
    );


  } finally {

    saveStructureButton.disabled =
      false;


    saveStructureButton.textContent =
      "Guardar estructura";
  }
}


// ======================================================
// EVENTOS COORDINADOR
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


// ======================================================
// EVENTOS ESTRUCTURA
// ======================================================

newStructureButton?.addEventListener(
  "click",
  openStructureModal
);


closeStructureModalButton?.addEventListener(
  "click",
  closeStructureModal
);


structureForm?.addEventListener(
  "submit",
  handleCreateStructure
);


structureModal
  ?.querySelector(
    ".modal__backdrop"
  )
  ?.addEventListener(
    "click",
    closeStructureModal
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


      await loadMunicipality();


      listenCoordinators();


      listenStructures();


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
