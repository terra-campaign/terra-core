// ======================================================
// TERRA CAMPAIGN
// BUILD-115 — PERFIL OPERATIVO DE PERSONA
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
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


// ======================================================
// ELEMENTOS
// ======================================================

const loadingSection =
  document.getElementById("loadingSection");

const errorSection =
  document.getElementById("errorSection");

const errorMessage =
  document.getElementById("errorMessage");

const profileSection =
  document.getElementById("profileSection");

const backButton =
  document.getElementById("backButton");

const logoutButton =
  document.getElementById("logoutButton");


// ======================================================
// CAMPOS DEL PERFIL
// ======================================================

const personName =
  document.getElementById("personName");

const personEmail =
  document.getElementById("personEmail");

const personPhone =
  document.getElementById("personPhone");

const personLocality =
  document.getElementById("personLocality");

const personStatus =
  document.getElementById("personStatus");

const personRole =
  document.getElementById("personRole");

const personMunicipality =
  document.getElementById("personMunicipality");

const personStructure =
  document.getElementById("personStructure");

const personStructureChief =
  document.getElementById("personStructureChief");

const personParent =
  document.getElementById("personParent");

const personUid =
  document.getElementById("personUid");

const personCampaign =
  document.getElementById("personCampaign");


// ======================================================
// INDICADORES
// ======================================================

const missionsAssigned =
  document.getElementById("missionsAssigned");

const missionsCompleted =
  document.getElementById("missionsCompleted");

const evidenceCount =
  document.getElementById("evidenceCount");

const eventsCount =
  document.getElementById("eventsCount");


// ======================================================
// UTILIDADES
// ======================================================

function cleanText(value) {
  return String(value || "").trim();
}


function showError(message) {

  loadingSection.hidden = true;
  profileSection.hidden = true;

  errorMessage.textContent =
    message || "Ocurrió un error.";

  errorSection.hidden = false;
}


function roleLabel(role) {

  const labels = {

    admin:
      "Administrador",

    coordinador:
      "Coordinador",

    coordinador_municipal:
      "Responsable de organización",

    jefe_estructura:
      "Responsable de estructura",

    integrante:
      "Integrante",

    participante:
      "Participante",

    brigadista:
      "Brigadista"
  };

  return labels[role] || role || "Sin definir";
}


// ======================================================
// RESPONSABLE DIRECTO
// ======================================================

async function getParentName(
  parentUserId,
  fallbackName = ""
) {

  if (fallbackName) {
    return fallbackName;
  }

  if (!parentUserId) {
    return "—";
  }

  try {

    const parentSnapshot =
      await getDoc(
        doc(
          db,
          "usuarios",
          parentUserId
        )
      );

    if (!parentSnapshot.exists()) {
      return "—";
    }

    const parent =
      parentSnapshot.data();

    return (
      cleanText(parent.name) ||
      cleanText(parent.email) ||
      "—"
    );

  } catch (error) {

    console.error(
      "Error al consultar responsable directo:",
      error
    );

    return "—";
  }
}


// ======================================================
// CARGAR PERFIL
// ======================================================

async function loadPersonProfile(uid) {

  try {

    const personReference =
      doc(
        db,
        "usuarios",
        uid
      );

    const personSnapshot =
      await getDoc(
        personReference
      );

    if (!personSnapshot.exists()) {

      showError(
        "La persona solicitada no existe."
      );

      return;
    }

    const person =
      personSnapshot.data();


    // ==================================================
    // RESPONSABLE DIRECTO
    // ==================================================

    const parentName =
      await getParentName(
        person.parentUserId,
        person.parentUserName
      );


    // ==================================================
    // DATOS GENERALES
    // ==================================================

    personName.textContent =
      cleanText(person.name) || "Sin nombre";

    personEmail.textContent =
      cleanText(person.email) || "—";

    personPhone.textContent =
      cleanText(person.phone) || "—";

    personLocality.textContent =
      cleanText(person.locality) || "—";

    personStatus.textContent =
      person.active === true
        ? "Activo"
        : "Inactivo";


    // ==================================================
    // ORGANIZACIÓN
    // ==================================================

    personRole.textContent =
      roleLabel(person.role);

    personMunicipality.textContent =
      cleanText(
        person.municipalityName
      ) ||
      cleanText(
        person.municipalityId
      ) ||
      "—";

    personStructure.textContent =
      cleanText(
        person.structureName
      ) ||
      cleanText(
        person.structureId
      ) ||
      "—";

    personStructureChief.textContent =
      cleanText(
        person.structureChiefName
      ) ||
      cleanText(
        person.chiefName
      ) ||
      "—";

    personParent.textContent =
      parentName;


    // ==================================================
    // TRAZABILIDAD
    // ==================================================

    personUid.textContent =
      person.uid || uid;

    personCampaign.textContent =
      cleanText(
        person.campaignId
      ) || "—";


    // ==================================================
    // ACTIVIDAD
    // BUILD-115 BASE
    //
    // Por ahora estos contadores se mantienen en cero.
    // Se conectarán con Misiones V2 y Eventos.
    // ==================================================

    missionsAssigned.textContent =
      "0";

    missionsCompleted.textContent =
      "0";

    evidenceCount.textContent =
      "0";

    eventsCount.textContent =
      "0";


    // ==================================================
    // MOSTRAR PERFIL
    // ==================================================

    loadingSection.hidden = true;
    errorSection.hidden = true;
    profileSection.hidden = false;

  } catch (error) {

    console.error(
      "Error al cargar perfil operativo:",
      error
    );

    showError(
      "No fue posible consultar el perfil operativo."
    );
  }
}


// ======================================================
// OBTENER UID DESDE URL
// ======================================================

const parameters =
  new URLSearchParams(
    window.location.search
  );

const targetUid =
  cleanText(
    parameters.get("id")
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

    if (!targetUid) {

      showError(
        "No se recibió el identificador de la persona."
      );

      return;
    }

    await loadPersonProfile(
      targetUid
    );
  }
);


// ======================================================
// VOLVER
// ======================================================

backButton.addEventListener(
  "click",
  () => {

    if (
      window.history.length > 1
    ) {

      window.history.back();

      return;
    }

    window.location.href =
      "./admin.html";
  }
);


// ======================================================
// SALIR
// ======================================================

logoutButton.addEventListener(
  "click",
  async () => {

    try {

      await signOut(auth);

      window.location.href =
        "./login.html";

    } catch (error) {

      console.error(
        "Error al cerrar sesión:",
        error
      );
    }
  }
);
