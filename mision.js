import {deadlineText} from "./mission-deadline.js?v=vigencia-001";
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

// Campos visibles y accesibles, también en móvil.
const evidenceFieldStyle = document.createElement("style");
evidenceFieldStyle.textContent = `
  #evidenceForm #reportedByName,
  #evidenceForm #evidenceDescription,
  #evidenceForm #evidenceUrl {
    display: block;
    width: 100%;
    box-sizing: border-box;
    border: 1px solid #64748b;
    border-radius: 6px;
    background: #fff;
    color: #17324d;
    padding: 10px 12px;
    margin: 6px 0 14px;
    min-height: 44px;
    font: inherit;
    font-size: 16px;
  }
  #evidenceForm #reportedByName[readonly] { background: #edf2f7; }
  #evidenceForm #reportedByName:focus,
  #evidenceForm #evidenceDescription:focus,
  #evidenceForm #evidenceUrl:focus {
    outline: 2px solid #145c9e;
    outline-offset: 2px;
  }
`;
document.head.appendChild(evidenceFieldStyle);
if (reportedByNameInput) {
  reportedByNameInput.readOnly = true;
  reportedByNameInput.title = "Nombre de la cuenta que registra la evidencia";
}

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
let selectedEvidencePhotos = [];
const extraPreviewUrls = [];
const extraPreviews = document.createElement("div");
evidencePhotoPreview.after(extraPreviews);
evidencePhotoInput.multiple = true;
evidencePhotoInput.removeAttribute("capture");
evidencePhotoButton.textContent = "Seleccionar imágenes (hasta 5)";
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
  evidenceForm.closest("section").hidden = evidenceForm.hidden =
    !isAssignee || currentMission.active !== true;

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

      if (reportedByNameInput) {
        const accountName = currentUserProfile.name || user.email || "Sin identificar";
        reportedByNameInput.defaultValue = accountName;
        reportedByNameInput.value = accountName;
      }

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

      evidenceForm.closest("section").hidden = evidenceForm.hidden =
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

    const files = Array.from(evidencePhotoInput.files || []);
    clearSelectedEvidencePhoto();
    if (!files.length) return;
    if (files.length > 5 || files.some(file => !file.type.startsWith("image/"))) {
      evidencePhotoInput.value = "";
      evidencePhotoStatus.textContent = "Selecciona entre 1 y 5 imágenes.";
      return;
    }
    selectedEvidencePhotos = files;
    const file = files[0];
    for (const extra of files.slice(1)) {
      const url = URL.createObjectURL(extra);
      extraPreviewUrls.push(url);
      const img = document.createElement("img");
      img.src = url;
      img.alt = "Vista previa de " + extra.name;
      img.style.cssText = "max-width:180px;max-height:180px;margin:6px;object-fit:contain";
      extraPreviews.append(img);
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
      `${files.length} imágenes listas para guardar.`;
  }
);


// ======================================================
// LIMPIAR IMAGEN
// ======================================================

function clearSelectedEvidencePhoto() {
  selectedEvidencePhotos = [];
  extraPreviewUrls.splice(0).forEach(url => URL.revokeObjectURL(url));
  extraPreviews.replaceChildren();

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

    if (currentMission.active !== true) {
      evidenceFormMessage.textContent = 'Esta misión está desactivada.';
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

    if (saveEvidenceButton.disabled) return;
    evidencePhotoButton.disabled = true;
    evidencePhotoInput.disabled = true;
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

      await loadMission();
      if (currentMission.active !== true) throw new Error('La misión fue desactivada. No se guardó el reporte.');
      const imagePaths = [];
      for (const [index, file] of selectedEvidencePhotos.entries()) {
        const compressedPhoto = await compressEvidencePhoto(file);
        if (compressedPhoto.size >= 8 * 1024 * 1024) throw new Error("Una imagen supera el límite de 8 MB.");
        const path = `missions/${currentMission.campaignId}/${currentMission.id}/evidence/${evidenceId}-${index + 1}.jpg`;
        saveEvidenceButton.textContent = `Subiendo imagen ${index + 1} de ${selectedEvidencePhotos.length}...`;
        await uploadBytes(ref(storage, path), compressedPhoto, {contentType: "image/jpeg"});
        imagePaths.push(path);
      }
      const imagePath = imagePaths[0];
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
    imagePaths,

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

    version: 4
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
      evidencePhotoButton.disabled = false;
      evidencePhotoInput.disabled = false;
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
      ["Fecha", formatFirestoreDate(evidence.createdAt)],
      ["Plazo", !currentMission.deadlineAt ? "Sin fecha límite" :
        !evidence.createdAt?.toMillis ? "Pendiente de confirmar fecha" :
        evidence.createdAt.toMillis() > Date.parse(currentMission.deadlineAt) ? "Reportado fuera de plazo" : "Reportado dentro del plazo"]
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
    const paths = Array.isArray(evidence.imagePaths) && evidence.imagePaths.length
      ? evidence.imagePaths.slice(0, 5) : (evidence.imagePath ? [evidence.imagePath] : []);
    imageBox.replaceChildren();
    if (!paths.length) imageBox.textContent = "Este reporte no tiene fotografía adjunta.";
    for (const path of paths) {
      const photoBox = document.createElement("div");
      const status = document.createElement("p");
      status.textContent = "Cargando fotografía...";
      photoBox.append(status);
      imageBox.append(photoBox);
    try {
      const prefix = "missions/" + mission.campaignId + "/" + mission.id + "/evidence/";

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
      photoBox.replaceChildren(img);
    } catch (error) {
      if (version !== evidenceRenderVersion || auth.currentUser?.uid !== uid) return;
      status.textContent = "No fue posible cargar la fotografía con tu sesión.";
      console.error("Carga de fotografía:", error.code || error.message);
    }
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
const deadlineNotice = document.createElement('p');
deadlineNotice.style.cssText = 'padding:12px;border:1px solid #64748b;border-radius:6px;font-weight:600';
missionMessage.after(deadlineNotice);
function refreshDeadlineNotice() {
  if (!currentMission) return;
  let message = deadlineText(currentMission);
  if (currentMission.active === true && currentMission.deadlineAt && Date.parse(currentMission.deadlineAt) <= Date.now() && !evidenceItems.length) message = 'Vencida sin reporte. ' + message;
  if (currentMission.active === false && currentMission.deactivationReason) message += ' Motivo: ' + currentMission.deactivationReason;
  deadlineNotice.textContent = message;
}
setInterval(refreshDeadlineNotice,1000);
