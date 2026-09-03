// ======================================================
// TERRA CAMPAIGN
// ADMINISTRACIÓN DE MUNICIPIOS
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

const newMunicipalityButton =
  document.querySelector("#newMunicipalityButton");

const municipalityList =
  document.querySelector("#municipalityList");

const municipalityStatus =
  document.querySelector("#municipalityStatus");

const municipalityModal =
  document.querySelector("#municipalityModal");

const closeMunicipalityModalButton =
  document.querySelector("#closeMunicipalityModalButton");

const municipalityForm =
  document.querySelector("#municipalityForm");

const municipalityNameInput =
  document.querySelector("#municipalityName");

const saveMunicipalityButton =
  document.querySelector("#saveMunicipalityButton");

const formStatus =
  document.querySelector("#formStatus");


// ======================================================
// ESTADO
// ======================================================

let currentUser = null;
let currentUserProfile = null;
let stopMunicipalitiesListener = null;


// ======================================================
// CLOUD FUNCTIONS
// ======================================================

const functions =
  getFunctions(
    undefined,
    "us-central1"
  );

const createMunicipalityFunction =
  httpsCallable(
    functions,
    "createMunicipality"
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
    message.includes(
      "Ese municipio ya está registrado"
    )
  ) {
    return "Ese municipio ya está registrado.";
  }

  if (
    error?.code ===
    "functions/already-exists"
  ) {
    return "Ese municipio ya está registrado.";
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

  const userReference =
    doc(
      db,
      "usuarios",
      user.uid
    );

  const userSnapshot =
    await getDoc(
      userReference
    );

  if (!userSnapshot.exists()) {
    throw new Error(
      "El usuario no tiene un perfil autorizado."
    );
  }

  const profile = {
    uid:
      userSnapshot.id,

    ...userSnapshot.data()
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
      "El administrador no tiene una campaña asignada."
    );
  }

  return profile;
}


// ======================================================
// MODAL
// ======================================================

function openMunicipalityModal() {

  municipalityForm?.reset();

  showStatus(
    formStatus,
    ""
  );

  if (
    municipalityModal
  ) {
    municipalityModal.hidden =
      false;
  }

  setTimeout(
    () => {
      municipalityNameInput?.focus();
    },
    50
  );
}


function closeMunicipalityModal() {

  if (
    municipalityModal
  ) {
    municipalityModal.hidden =
      true;
  }

  municipalityForm?.reset();

  showStatus(
    formStatus,
    ""
  );
}


// ======================================================
// RENDER MUNICIPIOS
// ======================================================

function renderMunicipalities(
  municipalities
) {

  if (
    !municipalityList
  ) {
    return;
  }

  if (
    municipalities.length === 0
  ) {

    municipalityList.innerHTML = `
      <div class="card">
        <p class="muted">
          Todavía no hay municipios registrados.
        </p>
      </div>
    `;

    return;
  }


  municipalityList.innerHTML =
    municipalities
      .map(
        (municipality) => {

          const statusText =
            municipality.active === true
              ? "Activo"
              : "Inactivo";

          return `
            <article class="card">

              <div class="section-header">

                <div>

                  <p class="eyebrow">
                    ${escapeHtml(
                      municipality.id
                    )}
                  </p>

                  <h3>
                    ${escapeHtml(
                      municipality.name
                    )}
                  </h3>

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
// ESCUCHAR MUNICIPIOS
// ======================================================

function listenMunicipalities() {

  if (
    stopMunicipalitiesListener
  ) {
    stopMunicipalitiesListener();
  }

  const municipalitiesQuery =
    query(
      collection(
        db,
        "municipios"
      ),

      where(
        "campaignId",
        "==",
        currentUserProfile.campaignId
      ),

      orderBy(
        "name",
        "asc"
      )
    );


  stopMunicipalitiesListener =
    onSnapshot(

      municipalitiesQuery,

      (snapshot) => {

        const municipalities =
          [];

        snapshot.forEach(
          (documentSnapshot) => {

            municipalities.push({
              id:
                documentSnapshot.id,

              ...documentSnapshot.data()
            });
          }
        );

        renderMunicipalities(
          municipalities
        );

        showStatus(
          municipalityStatus,
          ""
        );
      },

      (error) => {

        console.error(
          "Error al consultar municipios:",
          error
        );

        showStatus(
          municipalityStatus,
          "No fue posible consultar los municipios.",
          "error"
        );
      }
    );
}


// ======================================================
// CREAR MUNICIPIO
// ======================================================

async function handleCreateMunicipality(
  event
) {

  event.preventDefault();

  const name =
    String(
      municipalityNameInput?.value ||
      ""
    )
      .trim()
      .replace(/\s+/g, " ");

  if (
    name.length < 2
  ) {

    showStatus(
      formStatus,
      "Ingrese un nombre válido para el municipio.",
      "error"
    );

    municipalityNameInput?.focus();

    return;
  }


  saveMunicipalityButton.disabled =
    true;

  saveMunicipalityButton.textContent =
    "Guardando...";

  showStatus(
    formStatus,
    "Registrando municipio..."
  );


  try {

    const result =
      await createMunicipalityFunction({
        name
      });

    const municipality =
      result?.data?.municipality;

    showStatus(
      formStatus,
      municipality?.name
        ? `${municipality.name} registrado correctamente.`
        : "Municipio registrado correctamente.",
      "success"
    );


    setTimeout(
      () => {
        closeMunicipalityModal();
      },
      700
    );

  } catch (error) {

    console.error(
      "Error al crear municipio:",
      error
    );

    showStatus(
      formStatus,
      getErrorMessage(error),
      "error"
    );

  } finally {

    saveMunicipalityButton.disabled =
      false;

    saveMunicipalityButton.textContent =
      "Guardar municipio";
  }
}


// ======================================================
// EVENTOS
// ======================================================

newMunicipalityButton?.addEventListener(
  "click",
  openMunicipalityModal
);


closeMunicipalityModalButton?.addEventListener(
  "click",
  closeMunicipalityModal
);


municipalityForm?.addEventListener(
  "submit",
  handleCreateMunicipality
);


municipalityModal
  ?.querySelector(
    ".modal__backdrop"
  )
  ?.addEventListener(
    "click",
    closeMunicipalityModal
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

      listenMunicipalities();

    } catch (error) {

      console.error(
        "Error al iniciar módulo de municipios:",
        error
      );

      alert(
        error.message ||
        "No tiene acceso al módulo de municipios."
      );

      window.location.href =
        "./admin.html";
    }
  }
);
