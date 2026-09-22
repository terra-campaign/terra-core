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

const adminCampaignSelect =
  document.querySelector("#adminCampaignSelect");

const adminCampaignMessage =
  document.querySelector("#adminCampaignMessage");


// ======================================================
// ESTADO
// ======================================================

let currentUser = null;
let currentUserProfile = null;

let adminCampaigns = [];
let selectedAdminCampaignId = "";

const requestedAdminCampaignId =
  String(
    new URLSearchParams(
      window.location.search
    ).get(
      "campaignId"
    ) ||
    ""
  )
    .trim();
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

const listAdminCampaignsFunction =
  httpsCallable(
    functions,
    "listAdminCampaigns"
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


  return profile;
}


// ======================================================
// CONTEXTO MULTI-CAMPAÑA DEL ADMIN
// ======================================================

function syncAdminCampaignUrl(
  campaignId
) {

  if (!campaignId) {
    return;
  }


  const url =
    new URL(
      window.location.href
    );

  url.searchParams.set(
    "campaignId",
    campaignId
  );

  window.history.replaceState(
    {},
    "",
    `${url.pathname}${url.search}${url.hash}`
  );
}


function adminCampaignLabel(
  campaign
) {

  return (
    campaign?.name ||
    campaign?.displayName ||
    campaign?.campaignName ||
    campaign?.title ||
    campaign?.campaignId ||
    "Campaña"
  );
}


async function loadAdminCampaigns() {

  if (adminCampaignSelect) {
    adminCampaignSelect.disabled =
      true;

    adminCampaignSelect.innerHTML =
      "";
  }

  if (newMunicipalityButton) {
    newMunicipalityButton.disabled =
      true;
  }

  showStatus(
    adminCampaignMessage,
    "Consultando campañas autorizadas..."
  );


  const result =
    await listAdminCampaignsFunction({});

  adminCampaigns =
    Array.isArray(
      result?.data?.campaigns
    )
      ? result.data.campaigns
      : [];


  const requestedDefault =
    String(
      result?.data?.selectedCampaignId ||
      ""
    )
      .trim();


  const requestedFromUrlIsAuthorized =
    Boolean(
      requestedAdminCampaignId &&
      adminCampaigns.some(
        (campaign) =>
          campaign.campaignId ===
          requestedAdminCampaignId
      )
    );


  const requestedDefaultIsAuthorized =
    Boolean(
      requestedDefault &&
      adminCampaigns.some(
        (campaign) =>
          campaign.campaignId ===
          requestedDefault
      )
    );


  selectedAdminCampaignId =
    requestedFromUrlIsAuthorized
      ? requestedAdminCampaignId
      : requestedDefaultIsAuthorized
        ? requestedDefault
        : (
            adminCampaigns[0]?.campaignId ||
            ""
          );


  syncAdminCampaignUrl(
    selectedAdminCampaignId
  );


  if (adminCampaignSelect) {

    for (
      const campaign
      of adminCampaigns
    ) {

      const option =
        document.createElement(
          "option"
        );

      option.value =
        campaign.campaignId;

      option.textContent =
        `${adminCampaignLabel(
          campaign
        )} · ${campaign.campaignId}`;

      adminCampaignSelect.append(
        option
      );
    }

    adminCampaignSelect.value =
      selectedAdminCampaignId;

    adminCampaignSelect.disabled =
      !selectedAdminCampaignId;
  }


  if (newMunicipalityButton) {
    newMunicipalityButton.disabled =
      !selectedAdminCampaignId;
  }


  showStatus(
    adminCampaignMessage,
    selectedAdminCampaignId
      ? `Administrando municipios de ${selectedAdminCampaignId}.`
      : "No hay campañas activas autorizadas para esta cuenta.",
    selectedAdminCampaignId
      ? ""
      : "error"
  );


  return Boolean(
    selectedAdminCampaignId
  );
}


// ======================================================
// MODAL
// ======================================================

function openMunicipalityModal() {

  if (!selectedAdminCampaignId) {

    showStatus(
      municipalityStatus,
      "Seleccione una campaña autorizada.",
      "error"
    );

    return;
  }

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

      <div class="topbar__actions">

        <a
          class="button button--secondary"
          href="./municipio.html?id=${encodeURIComponent(
            municipality.id
          )}&campaignId=${encodeURIComponent(
            municipality.campaignId ||
            selectedAdminCampaignId
          )}"
        >
          Administrar
        </a>

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

    stopMunicipalitiesListener =
      null;
  }


  if (!selectedAdminCampaignId) {

    renderMunicipalities([]);

    showStatus(
      municipalityStatus,
      "Seleccione una campaña autorizada.",
      "error"
    );

    return;
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
        selectedAdminCampaignId
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


  if (!selectedAdminCampaignId) {

    showStatus(
      formStatus,
      "Seleccione una campaña autorizada.",
      "error"
    );

    return;
  }

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
        name,
        campaignId:
          selectedAdminCampaignId
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
  (event) => {
    event.preventDefault();
    console.log("SUBMIT MUNICIPIO DETECTADO");
    handleCreateMunicipality(event);
  }
);


municipalityModal
  ?.querySelector(
    ".modal__backdrop"
  )
  ?.addEventListener(
    "click",
    closeMunicipalityModal
  );


adminCampaignSelect
  ?.addEventListener(
    "change",
    () => {

      const campaignId =
        String(
          adminCampaignSelect.value ||
          ""
        )
          .trim();


      if (
        !adminCampaigns.some(
          (campaign) =>
            campaign.campaignId ===
            campaignId
        )
      ) {
        return;
      }


      selectedAdminCampaignId =
        campaignId;

      syncAdminCampaignUrl(
        selectedAdminCampaignId
      );


      showStatus(
        adminCampaignMessage,
        `Administrando municipios de ${selectedAdminCampaignId}.`
      );


      listenMunicipalities();
    }
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

      const hasCampaign =
        await loadAdminCampaigns();


      if (!hasCampaign) {

        renderMunicipalities([]);

        return;
      }


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
