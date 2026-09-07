// ======================================================
// TERRA CAMPAIGN
// DETALLE PRIVADO DE MISIÓN + EVIDENCIAS
// ======================================================

import {
  auth,
  db,
  storage
} from "./firebase-config.js";


import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";


import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


import {
  getBlob,
  ref,
  uploadBytes
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-storage.js";


// ======================================================
// ELEMENTOS DE PANTALLA
// ======================================================

const logoutButton =
  document.querySelector("#logoutButton");

const missionTitleElement =
  document.querySelector("#missionTitle");

const missionDescriptionElement =
  document.querySelector("#missionDescription");

const missionLocalityElement =
  document.querySelector("#missionLocality");

const missionDateElement =
  document.querySelector("#missionDate");

const missionBrigadeElement =
  document.querySelector("#missionBrigade");

const missionStatusElement =
  document.querySelector("#missionStatus");

const missionMessage =
  document.querySelector("#missionMessage");

const missionEvidenceCountElement =
  document.querySelector("#missionEvidenceCount");

const lastEvidenceDateElement =
  document.querySelector("#lastEvidenceDate");


// ======================================================
// FORMULARIO DE EVIDENCIA
// ======================================================

const evidenceForm =
  document.querySelector("#evidenceForm");

const reportedByNameInput =
  document.querySelector("#reportedByName");

const evidenceDescriptionInput =
  document.querySelector("#evidenceDescription");

const evidenceUrlInput =
  document.getElementById("evidenceUrl");

const evidencePhotoButton =
  document.querySelector("#evidencePhotoButton");

const evidencePhotoInput =
  document.querySelector("#evidencePhoto");

const evidencePhotoPreview =
  document.querySelector("#evidencePhotoPreview");

const evidencePhotoStatus =
  document.querySelector("#evidencePhotoStatus");

const saveEvidenceButton =
  document.querySelector("#saveEvidenceButton");

const evidenceFormMessage =
  document.querySelector("#evidenceFormMessage");


// ======================================================
// LISTA DE EVIDENCIAS
// ======================================================

const evidenceList =
  document.querySelector("#evidenceList");

const evidenceListMessage =
  document.querySelector("#evidenceListMessage");

const refreshEvidenceButton =
  document.querySelector("#refreshEvidenceButton");


// ======================================================
// ESTADO
// ======================================================

let currentUser = null;
let currentUserProfile = null;

let currentMission = null;

let evidenceItems = [];

let selectedEvidencePhoto = null;
let previewEvidenceUrl = "";


// ======================================================
// ID DE MISIÓN DESDE URL
// ======================================================

const urlParameters =
  new URLSearchParams(
    window.location.search
  );

const missionId =
  urlParameters.get("id");


// ======================================================
// CARGAR PERFIL
// ======================================================

async function loadCurrentUserProfile(user) {

  const userRef =
    doc(
      db,
      "usuarios",
      user.uid
    );

  const snapshot =
    await getDoc(userRef);

  if (!snapshot.exists()) {
    throw new Error(
      "El usuario no tiene perfil autorizado."
    );
  }

  const profile = {
    uid: snapshot.id,
    ...snapshot.data()
  };

  if (profile.active !== true) {
    throw new Error(
      "El usuario está desactivado."
    );
  }

  return profile;
}


// ======================================================
// VALIDAR ROL
// ======================================================

function validateMissionModuleAccess(profile) {
  const allowedRoles = [
    "admin",
    "coordinador_municipal",
    "jefe_estructura",
    "integrante",
    "participante"
  ];

  if (!profile || !allowedRoles.includes(profile.role)) {
    throw new Error(
      "Tu usuario no tiene acceso a Misiones."
    );
  }
}


// ======================================================
// CARGAR MISIÓN
// ======================================================

async function loadMission() {

  if (!missionId) {

    throw new Error(
      "No se especificó una misión."
    );
  }

  const missionRef =
    doc(
      db,
      "misiones",
      missionId
    );

  const snapshot =
    await getDoc(
      missionRef
    );

  if (!snapshot.exists()) {

    throw new Error(
      "La misión no existe."
    );
  }

  const mission = {
    id: snapshot.id,
    ...snapshot.data()
  };

  validateMissionScope(
    mission
  );

  currentMission =
    mission;

  renderMission();
}


// ======================================================
// VALIDAR ALCANCE DE LA MISIÓN
// BUILD-116 — SUPERVISIÓN JERÁRQUICA
// ======================================================

function validateMissionScope(mission) {

  const campaignId =
    currentUserProfile.campaignId ||
    "CAM-001";

  if (
    mission.campaignId !==
    campaignId
  ) {
    throw new Error(
      "La misión pertenece a otra campaña."
    );
  }

  // ADMIN puede consultar cualquier misión
  // de su misma campaña.
  if (
    currentUserProfile.role ===
    "admin"
  ) {
    return;
  }

  // Destinatario directo.
  if (
    mission.assignedTo ===
    currentUser.uid
  ) {
    return;
  }

  // Creador directo.
  if (
    mission.createdBy ===
    currentUser.uid
  ) {
    return;
  }

  // Supervisión del detalle.
// El Responsable de organización conserva únicamente
// el acceso como destinatario o creador directo.
if (
  currentUserProfile.role !== "coordinador_municipal" &&
  Array.isArray(mission.supervisorIds) &&
  mission.supervisorIds.includes(currentUser.uid)
) {
  return;
}

  throw new Error(
    "No tienes acceso a esta misión."
  );
}


// ======================================================
// RENDERIZAR MISIÓN
// BUILD-116 — EJECUTOR VS SUPERVISOR
// ======================================================

function renderMission() {

  if (
    !currentMission ||
    !currentUser
  ) {
    return;
  }

  missionTitleElement.textContent =
    currentMission.title ||
    "Misión sin nombre";

  missionDescriptionElement.textContent =
    currentMission.description ||
    "Sin descripción.";

  missionLocalityElement.textContent =
    currentMission.locality ||
    "Sin localidad";

  missionDateElement.textContent =
    currentMission.missionDate ||
    "Sin fecha";

  missionBrigadeElement.textContent =
    currentMission.brigadeId ||
    "Sin brigada";

  missionStatusElement.textContent =
    currentMission.active === true
      ? "ACTIVA"
      : "INACTIVA";

  missionMessage.textContent =
    "";

  // ====================================================
  // BUILD-116 — RELACIÓN DEL USUARIO CON LA MISIÓN
  // ====================================================

  const isAssignee =
    currentMission.assignedTo ===
    currentUser.uid;

  const isCreator =
    currentMission.createdBy ===
    currentUser.uid;

  // El destinatario puede registrar evidencia.
  evidenceForm.hidden =
    !isAssignee;

  // El creador/supervisor solo consulta.
  if (
    isCreator &&
    !isAssignee
  ) {

    missionMessage.textContent =
      "Modo supervisión: consulta las evidencias enviadas por la persona asignada.";
  }
}


// ===================

// ======================================================
// INICIO DE SESIÓN
// ======================================================

onAuthStateChanged(
  auth,
  async (user) => {

    clearEvidenceImages();
    currentMission = null;
    currentUserProfile = null;
    evidenceItems = [];

    if (!user) {

      window.location.href =
        "./login.html";

      return;
    }

    currentUser =
      user;

    try {

      currentUserProfile =
        await loadCurrentUserProfile(
          user
        );

      validateMissionModuleAccess(
        currentUserProfile
      );

      await loadMission();

      await loadEvidence();

    } catch (error) {

      console.error(
        "Acceso a misión rechazado:",
        error
      );

      missionMessage.textContent =
        error.message ||
        "No fue posible cargar la misión.";

      evidenceForm.hidden =
        true;
    }
  }
);


// ======================================================
// CERRAR SESIÓN
// ======================================================

logoutButton.addEventListener(
  "click",
  async () => {

    logoutButton.disabled =
      true;

    logoutButton.textContent =
      "Saliendo...";

    try {

      await signOut(auth);

      window.location.href =
        "./login.html";

    } catch (error) {

      console.error(
        "Error al cerrar sesión:",
        error
      );

      logoutButton.disabled =
        false;

      logoutButton.textContent =
        "Salir";

      alert(
        "No fue posible cerrar la sesión."
      );
    }
  }
);


// ======================================================
// SELECCIONAR IMAGEN
// ======================================================

evidencePhotoButton.addEventListener(
  "click",
  () => {

    evidencePhotoInput.click();
  }
);


evidencePhotoInput.addEventListener(
  "change",
  () => {

    const file =
      evidencePhotoInput.files?.[0];

    if (!file) {

      clearSelectedEvidencePhoto();

      return;
    }

    if (
      !file.type.startsWith(
        "image/"
      )
    ) {

      evidencePhotoInput.value =
        "";

      clearSelectedEvidencePhoto();

      evidencePhotoStatus.textContent =
        "El archivo seleccionado no es una imagen.";

      return;
    }

    selectedEvidencePhoto =
      file;

    if (
      previewEvidenceUrl
    ) {

      URL.revokeObjectURL(
        previewEvidenceUrl
      );
    }

    previewEvidenceUrl =
      URL.createObjectURL(
        file
      );

    evidencePhotoPreview.src =
      previewEvidenceUrl;

    evidencePhotoPreview.style.display =
      "block";

    evidencePhotoStatus.textContent =
      "Imagen lista para guardar.";
  }
);


// ======================================================
// LIMPIAR IMAGEN
// ======================================================

function clearSelectedEvidencePhoto() {

  selectedEvidencePhoto =
    null;

  if (
    previewEvidenceUrl
  ) {

    URL.revokeObjectURL(
      previewEvidenceUrl
    );

    previewEvidenceUrl =
      "";
  }

  evidencePhotoPreview.removeAttribute(
    "src"
  );

  evidencePhotoPreview.style.display =
    "none";

  evidencePhotoStatus.textContent =
    "Ninguna imagen seleccionada.";
}


// ======================================================
// COMPRIMIR IMAGEN
// ======================================================

async function compressEvidencePhoto(file) {

  const imageBitmap =
    await createImageBitmap(
      file
    );

  const maximumWidth =
    1600;

  const maximumHeight =
    1600;

  let targetWidth =
    imageBitmap.width;

  let targetHeight =
    imageBitmap.height;

  const reductionRatio =
    Math.min(
      maximumWidth / targetWidth,
      maximumHeight / targetHeight,
      1
    );

  targetWidth =
    Math.round(
      targetWidth *
      reductionRatio
    );

  targetHeight =
    Math.round(
      targetHeight *
      reductionRatio
    );

  const canvas =
    document.createElement(
      "canvas"
    );

  canvas.width =
    targetWidth;

  canvas.height =
    targetHeight;

  const context =
    canvas.getContext(
      "2d"
    );

  if (!context) {

    imageBitmap.close();

    throw new Error(
      "No fue posible preparar la evidencia."
    );
  }

  context.drawImage(
    imageBitmap,
    0,
    0,
    targetWidth,
    targetHeight
  );

  imageBitmap.close();

  return new Promise(
    (resolve, reject) => {

      canvas.toBlob(
        (blob) => {

          if (!blob) {

            reject(
              new Error(
                "No fue posible comprimir la imagen."
              )
            );

            return;
          }

          resolve(blob);
        },

        "image/jpeg",

        0.78
      );
    }
  );
}


// ======================================================
// GUARDAR EVIDENCIA
// ======================================================

evidenceForm.addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();

    if (
      !currentUser ||
      !currentUserProfile ||
      !currentMission
    ) {

      evidenceFormMessage.textContent =
        "La misión todavía no está disponible.";

      return;
    }

    if (auth.currentUser?.uid !== currentUser.uid ||
        currentMission.assignedTo !== currentUser.uid) {
      evidenceFormMessage.textContent = "Solo el destinatario puede registrar evidencia.";
      return;
    }

    if (
      !selectedEvidencePhoto
    ) {

      evidenceFormMessage.textContent =
        "Seleccione una imagen como evidencia.";

      return;
    }

    const reportedByName =
  currentUserProfile.name ||
  currentUser.email ||
  "Sin identificar";

    const description =
      evidenceDescriptionInput.value.trim();

    const evidenceUrl =
  evidenceUrlInput.value.trim();

    saveEvidenceButton.disabled =
      true;

    saveEvidenceButton.textContent =
      "Preparando evidencia...";

    evidenceFormMessage.textContent =
      "";

    try {

      const evidenceRef =
        doc(
          collection(
            db,
            "missionEvidence"
          )
        );

      const evidenceId =
        evidenceRef.id;

      const compressedPhoto =
        await compressEvidencePhoto(
          selectedEvidencePhoto
        );

      const imagePath =
        `missions/${currentMission.campaignId}/${currentMission.id}/evidence/${evidenceId}.jpg`;

      const imageReference =
        ref(
          storage,
          imagePath
        );

      saveEvidenceButton.textContent =
        "Subiendo evidencia...";

      await uploadBytes(
        imageReference,
        compressedPhoto,
        {
          contentType:
            "image/jpeg"
        }
      );

      saveEvidenceButton.textContent =
        "Guardando registro...";

     await setDoc(
  evidenceRef,
  {

    id:
      evidenceId,

    missionId:
      currentMission.id,

    campaignId:
      currentMission.campaignId,

    assignedTo:
      currentMission.assignedTo,

    assignedToName:
      currentMission.assignedToName ||
      "",

    reportedByName,

   description,

evidenceUrl,

source:
  "whatsapp",

    imagePath,

    imageURL: "",

    uploadedBy:
      currentUser.uid,

    uploadedByName:
      currentUserProfile.name ||
      currentUser.email ||
      "Sin identificar",

    uploadedByRole:
      currentUserProfile.role,

    status:
      "received",

    createdAt:
      serverTimestamp(),

    updatedAt:
      serverTimestamp(),

    version: 3
  }
);
      evidenceFormMessage.textContent =
        "✅ Evidencia guardada correctamente.";

      evidenceForm.reset();

      clearSelectedEvidencePhoto();

      await loadEvidence();

      setTimeout(
        () => {

          evidenceFormMessage.textContent =
            "";
        },
        3500
      );

    } catch (error) {

      console.error(
        "Error al guardar evidencia:",
        error
      );

      if (
        error.code ===
        "permission-denied"
      ) {

        evidenceFormMessage.textContent =
          "Firebase rechazó la operación por las reglas de seguridad.";

      } else {

        evidenceFormMessage.textContent =
          "No fue posible guardar la evidencia.";
      }

    } finally {

      saveEvidenceButton.disabled =
        false;

      saveEvidenceButton.textContent =
        "Guardar evidencia";
    }
  }
);


// ======================================================
// CARGAR EVIDENCIAS
// ======================================================

async function loadEvidence() {

  if (
    !currentMission ||
    !currentUserProfile
  ) {

    return;
  }

  evidenceListMessage.textContent =
    "Cargando evidencias...";

  try {

    const evidenceQuery =
      query(
        collection(
          db,
          "missionEvidence"
        ),

        where(
          "missionId",
          "==",
          currentMission.id
        ),

        where(
          "campaignId",
          "==",
          currentMission.campaignId
        ),

        orderBy(
          "createdAt",
          "desc"
        )
      );

    const snapshot =
      await getDocs(
        evidenceQuery
      );

    evidenceItems =
      [];

    snapshot.forEach(
      (documentSnapshot) => {

        evidenceItems.push({
          id:
            documentSnapshot.id,

          ...documentSnapshot.data()
        });
      }
    );

    await renderEvidence();

    updateEvidenceMetrics();

    evidenceListMessage.textContent =
      evidenceItems.length
        ? ""
        : "Todavía no existen evidencias.";

  } catch (error) {

    console.error(
      "Error al cargar evidencias:",
      error
    );

    if (
      error.code ===
      "failed-precondition"
    ) {

      evidenceListMessage.textContent =
        "Firestore requiere un índice para consultar las evidencias.";

      return;
    }

    evidenceListMessage.textContent =
      "No fue posible consultar las evidencias.";
  }
}


// ======================================================
// RENDERIZAR EVIDENCIAS
// ======================================================

let evidenceRenderVersion = 0;
const evidenceObjectUrls = new Set();

function clearEvidenceImages() {
  evidenceRenderVersion++;
  evidenceList.replaceChildren();
  for (const url of evidenceObjectUrls) URL.revokeObjectURL(url);
  evidenceObjectUrls.clear();
}

window.addEventListener("pagehide", clearEvidenceImages);
window.addEventListener("pageshow", (event) => {
  if (event.persisted) window.location.reload();
});

async function renderEvidence() {
  clearEvidenceImages();
  const version = evidenceRenderVersion;
  const uid = auth.currentUser?.uid;
  const mission = currentMission;
  if (!uid || !mission) return;

  for (const evidence of evidenceItems) {
    if (version !== evidenceRenderVersion || auth.currentUser?.uid !== uid) return;
    const article = document.createElement("article");
    article.className = "visit-item";
    const imageBox = document.createElement("div");
    const status = document.createElement("p");
    status.textContent = "Cargando fotografía...";
    imageBox.append(status);
    const details = document.createElement("div");
    for (const [label, value] of [
      ["Reportó", evidence.reportedByName || "Sin identificar"],
      ["Nota", evidence.description || "Sin nota"],
      ["Subida por", evidence.uploadedByName || "Sin identificar"],
      ["Fecha", formatFirestoreDate(evidence.createdAt)]
    ]) {
      const line = document.createElement("p");
      line.textContent = label + ": " + value;
      details.append(line);
    }
    // Los enlaces externos no se usan para cargar la fotografía.
    if (evidence.evidenceUrl) {
      try {
        const url = new URL(evidence.evidenceUrl);
        if (["https:", "http:"].includes(url.protocol) &&
            !["firebasestorage.googleapis.com", "storage.googleapis.com"].includes(url.hostname)) {
          const link = document.createElement("a");
          link.href = url.href;
          link.textContent = "Abrir enlace externo";
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          details.append(link);
        }
      } catch {}
    }
    article.append(imageBox, details);
    evidenceList.append(article);
    try {
      const prefix = "missions/" + mission.campaignId + "/" + mission.id + "/evidence/";
      const path = evidence.imagePath;
      if (typeof path !== "string" || !path.startsWith(prefix) ||
          !path.slice(prefix.length) || path.slice(prefix.length).includes("/")) {
        throw new Error("Ruta de fotografía inválida.");
      }
      const blob = await getBlob(ref(storage, path), 8 * 1024 * 1024);
      if (version !== evidenceRenderVersion || auth.currentUser?.uid !== uid) return;
      const url = URL.createObjectURL(blob);
      evidenceObjectUrls.add(url);
      const img = document.createElement("img");
      img.alt = "Evidencia de misión";
      img.style.cssText = "width:100%;max-width:420px;border-radius:10px;object-fit:cover";
      img.src = url;
      imageBox.replaceChildren(img);
    } catch (error) {
      if (version !== evidenceRenderVersion || auth.currentUser?.uid !== uid) return;
      status.textContent = "No fue posible cargar la fotografía con tu sesión.";
      console.error("Carga de fotografía:", error.code || error.message);
    }
  }
}


// ======================================================
// INDICADORES
// ======================================================

function updateEvidenceMetrics() {

  missionEvidenceCountElement.textContent =
    evidenceItems.length;

  if (
    !evidenceItems.length
  ) {

    lastEvidenceDateElement.textContent =
      "Sin actividad";

    return;
  }

  lastEvidenceDateElement.textContent =
    formatFirestoreDate(
      evidenceItems[0].createdAt
    );
}


// ======================================================
// ACTUALIZAR
// ======================================================

refreshEvidenceButton.addEventListener(
  "click",
  async () => {

    refreshEvidenceButton.disabled =
      true;

    refreshEvidenceButton.textContent =
      "Actualizando...";

    await loadEvidence();

    refreshEvidenceButton.disabled =
      false;

    refreshEvidenceButton.textContent =
      "Actualizar";
  }
);


// ======================================================
// FECHA
// ======================================================

function formatFirestoreDate(
  timestamp
) {

  if (
    !timestamp ||
    typeof timestamp.toDate !==
      "function"
  ) {

    return "Sin fecha";
  }

  return timestamp
    .toDate()
    .toLocaleString(
      "es-MX",
      {
        dateStyle:
          "short",

        timeStyle:
          "short"
      }
    );
}


// ======================================================
// SEGURIDAD DE TEXTO
// ======================================================

function escapeHtml(value) {

  return String(value)
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
}


function escapeAttribute(value) {

  return escapeHtml(
    value
  );
}
