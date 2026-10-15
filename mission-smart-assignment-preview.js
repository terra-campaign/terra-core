"use strict";

// TERRA Campaign V1 - B8: Dos vistas alternativas y preseleccion segura.
// B7 sigue escribiendo por su funcion existente. B8 NO realiza escrituras.
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js";
import {buildSmartAssignmentPayload} from "./mission-smart-assignment-payload.mjs?v=b8-18-safe-001";
import {inputDeadline} from "./mission-deadline.js?v=cierre-001";

const activitySelect = document.querySelector(".mission-activity-field select");
const assigneeList = document.querySelector("#missionAssigneeList");
const directField = document.querySelector("#missionAssigneeField");
const directSelectAll = document.querySelector("#missionSelectAll");
const modal = document.querySelector("#missionModal");
if (!activitySelect || !assigneeList || !directField || !directSelectAll || !modal) {
  throw new Error("B8: formulario de misiones incompleto");
}
const form = modal.querySelector("#missionForm");
const formMessage = modal.querySelector("#missionFormMessage");
const consultar = httpsCallable(
  getFunctions(auth.app, "us-central1"),
  "getSmartAssignmentCandidates"
);
const roleNames = {
  integrante: "Integrantes",
  participante: "Participantes",
  colaborador_base: "Colaboradores de Base",
  apoyo_territorial: "Apoyos Territoriales"
};
const roleOrder = Object.keys(roleNames);
const MAX_SELECTION = 50; // Limite vigente del escritor B8; no hacer selecciones parciales silenciosas.
// B8-20I: enlace preparado pero bloqueado intencionalmente hasta nueva autorizacion.
// Mantener FALSE: NO se hacen solicitudes de escritura B8 en este build.
const B8_ROOT_WRITE_RELEASE_ENABLED = true;
const b8RootWriter = B8_ROOT_WRITE_RELEASE_ENABLED
  ? httpsCallable(getFunctions(auth.app, "us-central1"), "createSmartAssignedMissions")
  : null;
// B8-20V5E: independent READ release. NOT deployed or exported.
const B8_RECEIPT_STATUS_RELEASE_ENABLED = true;
const b8ReceiptStatusReader = B8_RECEIPT_STATUS_RELEASE_ENABLED
  ? httpsCallable(getFunctions(auth.app, "us-central1"), "getSmartAssignmentReceiptStatus")
  : null;
const saveMissionButton = form.querySelector("#saveMissionButton");
const cancelMissionButton = form.querySelector("#cancelMissionButton");
let b8Submitting = false;
let b8WriteConfirmed = false;
// B8-20N: un resultado de red incierto NO autoriza una segunda solicitud.
// Se guarda solo el requestId (no nombres ni destinatarios), por UID y origen.
const B8_PENDING_PREFIX = "terra-campaign-b8-pending-v1:";
const B8_UNCERTAIN_MESSAGE =
  "B8: resultado de guardado no confirmado. Puede haberse creado la misión. " +
  "Por seguridad no se permiten nuevos envíos ni cerrar este borrador " +
  "hasta verificar el resultado con la administración. NO repitas la solicitud.";
let b8OutcomeUnknown = false;
let b8PendingOwnsDisable = false;
function b8PendingKey() {
  const uid = auth.currentUser?.uid;
  if (typeof uid !== "string" || !uid.trim()) {
    throw new Error("B8: inicia sesión para verificar solicitudes pendientes.");
  }
  return B8_PENDING_PREFIX + uid;
}
function b8HasPendingWrite() {
  // A pending B8 request stays protected EVEN if writing was later disabled.
  if (b8OutcomeUnknown) return true;
  if (!auth.currentUser?.uid) return false;
  try {
    return Boolean(localStorage.getItem(b8PendingKey()));
  } catch (_) {
    // Sin almacenamiento disponible el B8 escritor fallara ANTES de enviar.
    return false;
  }
}
function b8RecordPendingWrite(requestId) {
  const key = b8PendingKey();
  if (localStorage.getItem(key)) {
    throw new Error(B8_UNCERTAIN_MESSAGE);
  }
  const record = JSON.stringify({requestId, createdAt:Date.now()});
  localStorage.setItem(key, record);
  if (localStorage.getItem(key) !== record) {
    throw new Error("B8: no se pudo proteger la solicitud antes de enviarla.");
  }
  return key;
}

// B8-20V5E: read-only recovery control, never initiates another write.
const b8ReceiptPanel = document.createElement("section");
b8ReceiptPanel.id = "b8ReceiptRecovery";
b8ReceiptPanel.hidden = true;
b8ReceiptPanel.setAttribute("aria-label", "Verificar solicitud de guardado B8");
const b8ReceiptButton = document.createElement("button");
b8ReceiptButton.id = "b8ReceiptVerifyButton";
b8ReceiptButton.type = "button";
b8ReceiptButton.className = "button button--secondary";
b8ReceiptButton.textContent = "Consultar estado de guardado B8";
const b8ReceiptNotice = document.createElement("p");
b8ReceiptNotice.id = "b8ReceiptVerifyStatus";
b8ReceiptNotice.setAttribute("role", "status");
b8ReceiptNotice.setAttribute("aria-live", "polite");
b8ReceiptPanel.append(b8ReceiptButton, b8ReceiptNotice);
formMessage?.insertAdjacentElement("afterend", b8ReceiptPanel);
let b8ReceiptBusy = false;
let b8ReceiptLastUid = null;
function b8ReadPendingRecord() {
  if (!auth.currentUser?.uid) return {state:"none"};
  try {
    const key = b8PendingKey();
    const raw = localStorage.getItem(key);
    if (!raw) return {state:"none"};
    const obj = JSON.parse(raw);
    const id = obj?.requestId;
    if (typeof id !== "string" || !id || id.length > 128 ||
        id !== id.trim() || id.includes("/")) return {state:"invalid"};
    return {state:"valid", key, raw, requestId:id};
  } catch (_) {
    // Inaccessible or corrupted storage MUST NOT imply a safe retry.
    return {state:"invalid"};
  }
}
function b8RefreshReceiptPanel() {
  const uid = auth.currentUser?.uid || null;
  if (b8ReceiptLastUid !== uid) {
    b8ReceiptLastUid = uid;
    b8ReceiptNotice.textContent = "";
  }
  const pending = uid && b8HasPendingWrite();
  b8ReceiptPanel.hidden = !pending || modal.hidden;
  b8ReceiptButton.disabled = !authorizedChief || b8Submitting || b8ReceiptBusy;
  if (pending && !b8ReceiptNotice.textContent &&
      !B8_RECEIPT_STATUS_RELEASE_ENABLED) {
    b8ReceiptNotice.textContent =
      "Consulta remota aún no habilitada. No repitas la solicitud; " +
      "solicita verificación a la administración.";
  }
}
b8ReceiptButton.addEventListener("click", async () => {
  if (b8ReceiptBusy || b8Submitting || !authorizedChief || modal.hidden) return;
  const uid = auth.currentUser?.uid;
  if (!uid || !b8HasPendingWrite()) return;
  const pending = b8ReadPendingRecord();
  if (pending.state !== "valid") {
    b8ReceiptNotice.textContent = "Pendiente ilegible. Requiere revisión administrativa; NO repitas el envío.";
    return;
  }
  if (!B8_RECEIPT_STATUS_RELEASE_ENABLED || !b8ReceiptStatusReader) {
    b8ReceiptNotice.textContent = "Consulta remota deshabilitada. La solicitud sigue protegida; NO repitas el envío.";
    return;
  }
  b8ReceiptBusy = true;
  b8ReceiptNotice.textContent = "Verificando el resultado. No se enviará ninguna misión.";
  updateVisibility();
  try {
    const {data} = await b8ReceiptStatusReader({requestId:pending.requestId});
    // Fail closed if session, ownership or stored request changed while waiting.
    if (auth.currentUser?.uid !== uid || !authorizedChief ||
        localStorage.getItem(pending.key) !== pending.raw) {
      throw new Error("identity-or-request-changed");
    }
    if (!data || data.safeToRetry !== false) {
      throw new Error("invalid-server-status");
    }
    if (data.status === "confirmed" &&
        Number.isSafeInteger(data.created) && data.created >= 1 &&
        data.alreadyAssigned === 0) {
      // Only a verified tagged B8 receipt can close this exact local pending.
      localStorage.removeItem(pending.key);
      if (localStorage.getItem(pending.key) !== null) {
        throw new Error("storage-clear-failed");
      }
      b8WriteConfirmed = true;
      b8OutcomeUnknown = false;
      b8ReceiptNotice.textContent =
        `Guardado B8 confirmado: ${data.created} asignaciones. ` +
        "Actualiza Misiones. No se repetirá el envío.";
      if (formMessage) formMessage.textContent = b8ReceiptNotice.textContent;
    } else if (data.status === "unconfirmed") {
      b8ReceiptNotice.textContent = "Resultado todavía incierto. Conserva este borrador; NO repitas el envío.";
    } else if (data.status === "needs-review") {
      b8ReceiptNotice.textContent = "El recibo requiere revisión administrativa. NO repitas el envío.";
    } else {
      throw new Error("unexpected-server-status");
    }
  } catch (error) {
    console.error("B8: no se pudo conciliar la solicitud", error);
    b8ReceiptNotice.textContent =
      "No se pudo confirmar el resultado. La solicitud permanece protegida; NO repitas el envío.";
  } finally {
    b8ReceiptBusy = false;
    updateVisibility();
  }
});

// Atajo lateral, junto al titulo, no debajo de una lista larga.
const directTitle = directField.querySelector(".mission-assignee-title");
if (!directTitle) throw new Error("B8: titulo de destinatarios directos no encontrado");
const directHeader = document.createElement("div");
directHeader.className = "b8-direct-header";
directTitle.insertAdjacentElement("beforebegin", directHeader);
directHeader.appendChild(directTitle);
const openStructure = document.createElement("button");
openStructure.type = "button";
openStructure.id = "b8OpenStructure";
openStructure.className = "button button--secondary";
openStructure.textContent = "Ver estructura completa →";
openStructure.hidden = true;
directHeader.appendChild(openStructure);

// B8-19H6-FILTRO: controles de directos.
const directFilterPanel = document.createElement("div");
directFilterPanel.id = "b8DirectFilterPanel";
directFilterPanel.hidden = true;
directFilterPanel.innerHTML = `
  <strong>Mostrar mis directos</strong>
  <label>
    <input type="radio" name="b8DirectFilter" value="interested" checked>
    Solo interesados en esta actividad
  </label>
  <label>
    <input type="radio" name="b8DirectFilter" value="all">
    Todos mis directos elegibles
  </label>
  <p id="b8DirectFilterStatus" role="status" aria-live="polite"></p>
`;
directHeader.insertAdjacentElement("afterend", directFilterPanel);

const directFilterStatus =
  directFilterPanel.querySelector("#b8DirectFilterStatus");
let directFilterMode = "interested";
let directFilterActivity = "";
let directFilterReady = false;
let directFilterLoading = false;
let directFilterRequest = 0;
let directInterestedRefs = new Set();

const panel = document.createElement("section");
panel.id = "smartAssignmentPreview";
panel.hidden = true;
panel.className = "b8-structure-panel";
panel.innerHTML = `
  <div class="b8-structure-header">
    <div>
      <h3>Interesados en esta actividad — mi estructura</h3>
      <p id="smartAssignmentActivityNote"></p>
    </div>
    <button type="button" id="b8BackToDirect" class="button button--secondary">
      ← Mis directos
    </button>
  </div>
  <p class="b8-explanatory-note">
    Solo personas que eligieron esta actividad en su onboarding.
    El interés no significa disponibilidad ni aceptación de la misión.
  </p>
  <p class="b8-writing-note">
    Esta vista permite preseleccionar. El guardado de esta modalidad aún está deshabilitado.
  </p>
  <button type="button" id="smartAssignmentSearch"
    class="button button--secondary">Actualizar interesados</button>
  <p id="smartAssignmentStatus" aria-live="polite"></p>
  <p id="smartAssignmentSelectedCount" aria-live="polite"></p>
  <p id="smartAssignmentSelectionNotice" role="status" aria-live="polite"></p>
  <div id="smartAssignmentResults"></div>
`;
directField.insertAdjacentElement("afterend", panel);
const backButton = panel.querySelector("#b8BackToDirect");
const refreshButton = panel.querySelector("#smartAssignmentSearch");
const activityNote = panel.querySelector("#smartAssignmentActivityNote");
const status = panel.querySelector("#smartAssignmentStatus");
const counter = panel.querySelector("#smartAssignmentSelectedCount");
const notice = panel.querySelector("#smartAssignmentSelectionNotice");
const results = panel.querySelector("#smartAssignmentResults");
const selectedRefs = new Set();

// B8-19H1-CONTADORES: resumen informativo, sin escrituras.
const selectionSummary = document.createElement("section");
selectionSummary.id = "b8SelectionSummary";
selectionSummary.hidden = true;
selectionSummary.setAttribute("aria-label", "Resumen de destinatarios");
selectionSummary.innerHTML = `
  <div class="b8-summary-title">Estado de seleccion</div>
  <div class="b8-summary-columns">
    <div><strong id="b8DirectCount">0</strong>
      <span>Mis directos (B7)</span>
      <small>Seleccionados para asignacion manual</small>
    </div>
    <div><strong id="b8StructureCount">0</strong>
      <span>Estructura completa (B8)</span>
      <small>Preseleccionados, sin asignacion</small>
    </div>
  </div>
  <p>Son selecciones independientes. Marcar una persona en una vista
  no la transfiere automaticamente a la otra.</p>
`;
directField.insertAdjacentElement("beforebegin", selectionSummary);

const directCountNode = selectionSummary.querySelector("#b8DirectCount");
const structureCountNode = selectionSummary.querySelector("#b8StructureCount");

function updateSelectionSummary() {
  const directCount = assigneeList.querySelectorAll(
    ".mission-assignee-checkbox:checked"
  ).length;
  directCountNode.textContent = String(directCount);
  structureCountNode.textContent = String(selectedRefs.size);
}

assigneeList.addEventListener("change", updateSelectionSummary);
directSelectAll.addEventListener("change", () => {
  queueMicrotask(updateSelectionSummary);
});
new MutationObserver(updateSelectionSummary).observe(assigneeList, {
  childList: true,
  subtree: true
});
let b8RequestId = null;
let b8RequestSignature = null;
let authorizedChief = false;
let requestVersion = 0;
let view = "direct";

const style = document.createElement("style");
style.id = "b8-two-views-styles-001";
style.textContent = `
  #missionAssigneeField[hidden], #smartAssignmentPreview[hidden],
  #b8OpenStructure[hidden] { display: none !important; }
  #missionModal .b8-direct-header, #missionModal .b8-structure-header {
    display:flex; align-items:center; justify-content:space-between;
    gap:12px; flex-wrap:wrap; margin: 4px 0 12px;
  }
  #missionModal .b8-direct-header .mission-assignee-title { margin:0; font-weight:800; }
  #missionModal #b8OpenStructure, #missionModal #b8BackToDirect {
    min-height:44px; font-size: .95rem; white-space:normal; text-align:center;
  }
  #missionModal #missionAssigneeList { max-height:310px; overflow-y:auto; overscroll-behavior:contain; }
  #missionModal .b8-structure-panel {
    border:1px solid #cbd5e1; border-radius:12px; padding:16px 14px;
    margin-top:12px; box-sizing:border-box;
  }
  #missionModal .b8-structure-header h3 { margin:0 0 6px; font-size:1.12rem; }
  #missionModal .b8-structure-header p { margin:0; }
  #missionModal .b8-explanatory-note { margin:8px 0; }
  #missionModal .b8-writing-note { padding:9px 12px; background:#fff4da;
    border-radius:6px; border-left:4px solid #a76d0c; }
  #smartAssignmentResults .b8-role-heading { font-size:1rem; font-weight:800;
    background:#e8f1fb; border-left:4px solid #173e66;
    border-radius:6px; padding:9px 12px; margin:16px 0 5px; }
  #smartAssignmentResults .b8-role-select-all { display:flex; gap:11px;
    align-items:center; cursor:pointer; min-height:44px; }
  #smartAssignmentResults .b8-role-select-all input { flex:none; width:22px;
    height:22px; margin:0; }
  #smartAssignmentResults .b8-role-select-all strong { display:block;
    font-weight:800; }
  #smartAssignmentResults .b8-role-select-all small { display:block;
    font-size:.82rem; font-weight:400; margin-top:2px; }
  #smartAssignmentResults .b8-person-option { display:flex; gap:12px;
    align-items:flex-start; padding:11px 8px; border-bottom:1px solid #dbe3ec;
    cursor:pointer; min-height:44px; box-sizing:border-box; }
  #smartAssignmentResults .b8-person-option:focus-within,
  #smartAssignmentResults .b8-role-select-all:focus-within {
    outline:2px solid #0a3d91; outline-offset:2px; }
  #smartAssignmentResults .b8-person-option input { flex:none;
    width:20px; height:20px; margin:2px 0 0; }
  #smartAssignmentResults .b8-person-details { display:block;
    min-width:0; overflow-wrap:anywhere; }
  #smartAssignmentResults .b8-person-details strong { display:block;
    font-size:1rem; margin-bottom:4px; }
  #smartAssignmentResults .b8-person-details small { display:block;
    font-size:.9rem; line-height:1.4; }
  #smartAssignmentSelectedCount { font-weight:700; color:#173e66; }
  #smartAssignmentSelectionNotice:not(:empty) { color:#9a3412; font-weight:700; }
  @media (max-width: 640px) {
    #missionModal .b8-direct-header { align-items:stretch; }
    #missionModal .b8-direct-header .mission-assignee-title { flex:1; min-width:110px; }
    #missionModal #b8OpenStructure { max-width:60%; }
    #missionModal #missionAssigneeList { max-height:270px; }
    #missionModal .b8-structure-panel { padding:12px; }
  }
`;
style.textContent += `
  #missionModal #b8SelectionSummary[hidden] { display:none !important; }
  #missionModal #b8SelectionSummary {
    border:1px solid #cbd5e1;
    border-radius:12px;
    padding:12px;
    margin:12px 0;
    background:#f8fafc;
  }
  #missionModal .b8-summary-title {
    font-weight:800;
    margin-bottom:10px;
  }
  #missionModal .b8-summary-columns {
    display:grid;
    grid-template-columns:repeat(2, minmax(0, 1fr));
    gap:10px;
  }
  #missionModal .b8-summary-columns > div {
    border:1px solid #dbe3ec;
    border-radius:8px;
    background:white;
    padding:10px;
  }
  #missionModal .b8-summary-columns strong {
    display:block;
    font-size:1.6rem;
    color:#173e66;
  }
  #missionModal .b8-summary-columns span {
    display:block;
    font-weight:700;
  }
  #missionModal .b8-summary-columns small {
    display:block;
    margin-top:4px;
  }
  #missionModal #b8SelectionSummary p {
    font-size:.88rem;
    margin:10px 0 0;
  }
  @media(max-width:480px) {
    #missionModal .b8-summary-columns {
      grid-template-columns:1fr;
    }
  }
`;
document.head.appendChild(style);
style.textContent += `
  #missionModal #b8DirectFilterPanel[hidden],
  #missionModal #missionAssigneeList .mission-assignee-option[hidden] {
    display:none !important;
  }
  #missionModal #b8DirectFilterPanel {
    border:1px solid #cbd5e1;
    border-radius:9px;
    padding:12px;
    margin:8px 0 12px;
    background:#f8fafc;
  }
  #missionModal #b8DirectFilterPanel strong {
    display:block;
    margin-bottom:8px;
  }
  #missionModal #b8DirectFilterPanel label {
    display:flex;
    align-items:center;
    gap:10px;
    min-height:38px;
    cursor:pointer;
  }
  #missionModal #b8DirectFilterPanel input {
    flex:none;
    width:19px;
    height:19px;
  }
  #missionModal #b8DirectFilterStatus {
    margin:8px 0 0;
    font-size:.89rem;
    line-height:1.4;
  }
`;

function b7Checkboxes() {
  return Array.from(assigneeList.querySelectorAll(".mission-assignee-checkbox"));
}

function resetDirectInterestFilter() {
  directFilterRequest++;
  directFilterActivity = "";
  directFilterReady = false;
  directFilterLoading = false;
  directInterestedRefs = new Set();
}

function visibleDirectCheckboxes() {
  return b7Checkboxes().filter(box => {
    const row = box.closest(".mission-assignee-option");
    return !box.disabled && row && !row.hidden;
  });
}

function applyDirectInterestFilter() {
  const activity = String(activitySelect.value || "").trim();
  const filtering =
    authorizedChief &&
    directFilterMode === "interested" &&
    directFilterReady &&
    directFilterActivity === activity;

  let shown = 0;
  let manualExceptions = 0;

  for (const box of b7Checkboxes()) {
    const row = box.closest(".mission-assignee-option");
    if (!row) continue;

    const interested = directInterestedRefs.has(box.value);

    // Una persona ya seleccionada nunca queda oculta.
    const visible = !filtering || interested || box.checked;
    row.hidden = !visible;

    if (visible) shown++;
    if (filtering && box.checked && !interested) {
      manualExceptions++;
    }
  }

  if (directFilterMode === "all") {
    directFilterStatus.textContent =
      "Se muestran todos los directos elegibles autorizados por B7.";
  } else if (!activity) {
    directFilterStatus.textContent =
      "Selecciona primero un tipo de actividad.";
  } else if (directFilterLoading) {
    directFilterStatus.textContent =
      "Verificando intereses. Mientras tanto se muestran los elegibles.";
  } else if (!directFilterReady) {
    directFilterStatus.textContent =
      "No se pudieron confirmar las preferencias. No se oculta a nadie; " +
      "puedes elegir Todos mis directos elegibles.";
  } else {
    directFilterStatus.textContent =
      shown + (shown === 1 ? " directo visible. " : " directos visibles. ") +
      (manualExceptions
        ? manualExceptions +
          (manualExceptions === 1
            ? " persona seleccionada manualmente sin interes declarado permanece visible."
            : " personas seleccionadas manualmente sin interes declarado permanecen visibles.")
        : "Las personas sin interes declarado se pueden consultar en Todos los elegibles.");
  }

  syncDirectMaster();
  updateSelectionSummary();
}

async function consultDirectInterests() {
  if (!authorizedChief || activitySelect.disabled || modal.hidden) return;

  const activityCode = String(activitySelect.value || "").trim();

  if (!activityCode) {
    resetDirectInterestFilter();
    applyDirectInterestFilter();
    return;
  }

  const version = ++directFilterRequest;

  directFilterActivity = activityCode;
  directFilterReady = false;
  directFilterLoading = true;
  directInterestedRefs = new Set();

  applyDirectInterestFilter();

  try {
    // Misma consulta autorizada que utiliza B8.
    const response = await consultar({activityCode});

    if (
      version !== directFilterRequest ||
      modal.hidden ||
      activitySelect.disabled ||
      !authorizedChief ||
      activitySelect.value !== activityCode
    ) return;

    if (
      !Array.isArray(response.data?.eligible) ||
      (
        response.data.activityCode &&
        response.data.activityCode !== activityCode
      )
    ) {
      throw new Error("Respuesta de preferencias incompatible.");
    }

    const refs = new Set();
    const seen = new Set();

    for (const person of response.data.eligible) {
      const ref = person?.assigneeRef;

      if (
        typeof ref !== "string" ||
        !/^[0-9a-f]{64}$/.test(ref) ||
        seen.has(ref) ||
        typeof person.role !== "string" ||
        !Object.prototype.hasOwnProperty.call(roleNames, person.role) ||
        typeof person.preferenceSelected !== "boolean"
      ) {
        throw new Error("Candidato de preferencias invalido.");
      }

      seen.add(ref);

      if (person.preferenceSelected === true) refs.add(ref);
    }

    directInterestedRefs = refs;
    directFilterReady = true;
  } catch (error) {
    if (version !== directFilterRequest) return;
    console.error("B8-19: filtro de directos no disponible", error);
    directFilterReady = false;
    directInterestedRefs = new Set();
  } finally {
    if (version === directFilterRequest) {
      directFilterLoading = false;
      applyDirectInterestFilter();
    }
  }
}

directFilterPanel.addEventListener("change", event => {
  const input = event.target;

  if (!input?.matches?.('input[name="b8DirectFilter"]')) return;

  directFilterMode = input.value === "all" ? "all" : "interested";
  applyDirectInterestFilter();
});

// El controlador B7 escucha change en el mismo checkbox maestro.
// Capturamos primero para impedir que marque destinatarios ocultos.
directSelectAll.addEventListener("change", event => {
  if (
    !authorizedChief ||
    activitySelect.disabled ||
    view !== "direct" ||
    directFilterMode !== "interested"
  ) return;

  event.stopImmediatePropagation();

  if (!directFilterReady ||
      directFilterActivity !== String(activitySelect.value || "").trim()) {
    directSelectAll.checked = false;
    directSelectAll.indeterminate = false;
    directFilterStatus.textContent =
      "Espera a que termine la consulta de interesados o cambia a Todos los elegibles.";
    return;
  }

  const visibles = visibleDirectCheckboxes();
  const marcar = directSelectAll.checked;

  const adicionales = visibles.filter(box => !box.checked).length;
  const yaMarcados = b7Checkboxes().filter(box => box.checked).length;

  if (marcar && yaMarcados + adicionales > MAX_SELECTION) {
    syncDirectMaster();
    directFilterStatus.textContent =
      "No se selecciono el grupo: se superaria el maximo de 50 personas.";
    return;
  }

  for (const box of visibles) {
    box.checked = marcar;

    if (marcar) uncheckInB8(box.value);
  }

  applyDirectInterestFilter();
}, true);

assigneeList.addEventListener("change", () => {
  queueMicrotask(applyDirectInterestFilter);
});

new MutationObserver(applyDirectInterestFilter).observe(assigneeList, {
  childList: true,
  subtree: true
});

function syncDirectMaster() {
  const boxes = b7Checkboxes().filter(box => {
    const row = box.closest(".mission-assignee-option");
    return !box.disabled && row && !row.hidden;
  });
  const checked = boxes.filter(box => box.checked).length;
  directSelectAll.checked = boxes.length > 0 && checked === boxes.length;
  directSelectAll.indeterminate = checked > 0 && checked < boxes.length;
}
function uncheckInDirect(ref) {
  for (const box of b7Checkboxes()) {
    if (box.value === ref) box.checked = false;
  }
  syncDirectMaster();
}
function uncheckInB8(ref) {
  if (!selectedRefs.delete(ref)) return;
  for (const box of results.querySelectorAll(".b8-preselect-checkbox")) {
    if (box.value === ref) box.checked = false;
  }
  updateGroupCheckAll();
  updateSelectionCount();
}
function updateSelectionCount() {
  const count = selectedRefs.size;
  counter.textContent = count
    ? `${count} ${count === 1 ? "persona preseleccionada" : "personas preseleccionadas"} en esta vista. Todavía no se asignan misiones.`
    : "Ninguna persona preseleccionada en esta vista.";
  updateSelectionSummary();
}
function updateGroupCheckAll() {
  for (const heading of results.querySelectorAll(".b8-role-heading")) {
    const master = heading.querySelector(".b8-group-select-all");
    const list = heading.nextElementSibling;
    if (!master || !list) continue;
    const boxes = Array.from(list.querySelectorAll(".b8-preselect-checkbox"));
    const count = boxes.filter(box => selectedRefs.has(box.value)).length;
    master.checked = boxes.length > 0 && count === boxes.length;
    master.indeterminate = count > 0 && count < boxes.length;
  }
}
function clearResults() {
  requestVersion++;
  selectedRefs.clear();
  updateSelectionCount();
  results.replaceChildren();
  status.textContent = "";
  notice.textContent = "";
}
function updateVisibility() {
  const eligibleChief = authorizedChief && (!activitySelect.disabled || b8Submitting);
  // B8-20I: indicar claramente que el boton NO guarda en esta version.
  if (saveMissionButton && !b8Submitting) {
    if (modal.hidden) saveMissionButton.textContent = "Guardar misión";
    else if (!activitySelect.disabled) {
      saveMissionButton.textContent =
        view === "preferred" && eligibleChief
          ? (B8_ROOT_WRITE_RELEASE_ENABLED
              ? "Guardar en estructura (B8)"
              : "Validar B8 (sin guardar)")
          : "Guardar misión";
    }
  }
  b8RefreshReceiptPanel();
  if (b8HasPendingWrite()) {
    if (saveMissionButton && !saveMissionButton.disabled) {
      saveMissionButton.disabled = true;
      b8PendingOwnsDisable = true;
    }
    if (!modal.hidden && formMessage) formMessage.textContent = B8_UNCERTAIN_MESSAGE;
  } else if (b8PendingOwnsDisable && !b8Submitting) {
    if (saveMissionButton) saveMissionButton.disabled = false;
    b8PendingOwnsDisable = false;
  }
  directFilterPanel.hidden = !eligibleChief;

  // B8-19H11A: no reiniciar preferencias por bloqueo temporal de B7.
  if (!authorizedChief || modal.hidden) {
    resetDirectInterestFilter();
  } else if (eligibleChief) {
    const code = String(activitySelect.value || "").trim();
    if (code && directFilterActivity !== code) {
      void consultDirectInterests();
    }
  }

  applyDirectInterestFilter();
  selectionSummary.hidden = !eligibleChief;
  openStructure.hidden = !eligibleChief;
  if (!eligibleChief) view = "direct";
  directField.hidden = view !== "direct" && eligibleChief;
  panel.hidden = view !== "preferred" || !eligibleChief;
  openStructure.disabled = !eligibleChief;
  refreshButton.disabled = !eligibleChief || !String(activitySelect.value || "").trim();
  // B8-19H11A: no borrar preselecciones durante un envío B7.
  // Limpiar únicamente al cerrar el modal o perder autorización.
  if ((!authorizedChief || modal.hidden) &&
      (selectedRefs.size || results.childNodes.length)) clearResults();
}
function activityLabel() {
  return activitySelect.selectedOptions?.[0]?.textContent?.trim() || "la actividad elegida";
}

// B8-20I: conexion preparada al escritor canonico, bajo bandera FALSE.
// B7 conserva intacto su submit y el escritor createLinkedMissions.
// B8 intercepta el submit en fase capture, ANTES del submit B7.
form.addEventListener("submit", async event => {
  // La barrera se ejecuta ANTES de discriminar entre B7 y B8.
  // Una operación B8 incierta podría afectar al mismo conjunto de personas.
  if (b8HasPendingWrite()) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (formMessage) formMessage.textContent = B8_UNCERTAIN_MESSAGE;
    return;
  }
  // B8-19H2-GUARDADO: la vista directa pertenece exclusivamente a B7.
  // Las preselecciones B8 ocultas no deben interceptar su envio.
  if (view === "direct") return;

  event.preventDefault();
  event.stopImmediatePropagation();

  if (!formMessage) return;

  if (b8Submitting) {
    formMessage.textContent = "B8: solicitud en curso. Espera el resultado.";
    return;
  }
  if (b8WriteConfirmed) {
    formMessage.textContent =
      "B8: asignacion confirmada. Cierra el formulario y actualiza la lista de misiones.";
    return;
  }

  if (view !== "preferred") {
    formMessage.textContent =
      "Existen personas preseleccionadas en B8. " +
      "Regresa a Ver estructura completa para revisarlas o " +
      "desmarcalas antes de guardar mediante Mis directos. " +
      "NO se guardo ninguna mision.";
    return;
  }

  if (!authorizedChief || activitySelect.disabled || modal.hidden) {
    formMessage.textContent =
      "B8: esta modalidad no esta disponible para tu perfil. " +
      "NO se guardo ninguna mision.";
    return;
  }

  try {
    const deadlineField = form
      .querySelector("#missionDate")
      ?.nextElementSibling
      ?.querySelector('input[type="datetime-local"]');

    if (!deadlineField) {
      throw new Error("No se encontro el campo de vencimiento.");
    }

    const directAssigneeRefs = Array.from(
      assigneeList.querySelectorAll(".mission-assignee-checkbox:checked"),
      box => box.value
    );

    const draft = {
      assigneeRefs: Array.from(selectedRefs),
      activityCode: activitySelect.value,
      title: form.querySelector("#missionTitle")?.value,
      description: form.querySelector("#missionDescription")?.value,
      locality: form.querySelector("#missionLocality")?.value,
      missionDate: form.querySelector("#missionDate")?.value || null,
      deadlineAt: inputDeadline(deadlineField.value)
    };

    const signature = JSON.stringify({
      ...draft,
      assigneeRefs: [...draft.assigneeRefs].sort()
    });

    if (b8RequestSignature !== signature) {
      b8RequestId = crypto.randomUUID();
      b8RequestSignature = signature;
    }

    const payload = buildSmartAssignmentPayload({
      requestId: b8RequestId,
      ...draft
    }, {directAssigneeRefs});

    if (!B8_ROOT_WRITE_RELEASE_ENABLED || !b8RootWriter) {
      formMessage.textContent =
        `B8: solicitud validada localmente para ${payload.assigneeRefs.length} personas. ` +
        "El envio inteligente sigue DESHABILITADO. NO se guardo ninguna mision.";
      formMessage.scrollIntoView?.({block:"nearest"});
      return;
    }

    // Solo ejecutable despues de una autorizacion de lanzamiento independiente.
    // Marcador durable ANTES de la llamada: también protege recargas y cierres.
    const pendingKey = b8RecordPendingWrite(payload.requestId);
    b8Submitting = true;
    const previousDisabled = Array.from(form.elements, el => [el, el.disabled]);
    previousDisabled.forEach(([el]) => { el.disabled = true; });
    if (saveMissionButton) saveMissionButton.textContent = "Guardando B8...";
    formMessage.textContent = "B8: enviando la asignacion...";
    try {
      const {data} = await b8RootWriter(payload);
      if (!data || !Number.isSafeInteger(data.created) || data.created < 0 ||
          !Number.isSafeInteger(data.alreadyAssigned) || data.alreadyAssigned < 0) {
        throw new Error("B8: el servidor no devolvio un recibo valido.");
      }
      b8WriteConfirmed = true;
      // Ya existe recibo confirmado. Borrar marcador; si falla, no desbloquear.
      try { localStorage.removeItem(pendingKey); } catch (storageError) {
        console.error("B8: marcador pendiente no se pudo limpiar", storageError);
      }
      formMessage.textContent =
        `B8: ${data.created} asignaciones creadas; ` +
        `${data.alreadyAssigned} ya existentes. ` +
        "Cierra y actualiza Misiones para consultar los resultados.";
    } catch (error) {
      console.error("B8: no se pudo confirmar la asignacion", error);
      // Puede haberse confirmado una transacción aunque falle la respuesta.
      // Mantener marcador e impedir otros requestId hasta reconciliación.
      b8OutcomeUnknown = true;
      formMessage.textContent = B8_UNCERTAIN_MESSAGE;
    } finally {
      b8Submitting = false;
      previousDisabled.forEach(([el, wasDisabled]) => { el.disabled = wasDisabled; });
      updateVisibility();
    }
  } catch (error) {
    formMessage.textContent =
      `${error.message || "Error de validacion B8."} ` +
      "No se envio ninguna solicitud de escritura.";
  }

  formMessage.scrollIntoView?.({block:"nearest"});
}, true);

// Si algun dia se autoriza el envio, impedir cancelacion y Escape durante
// la llamada asincrona; no tocar los controladores existentes de B7.
cancelMissionButton?.addEventListener("click", event => {
  if (!b8Submitting && !b8HasPendingWrite()) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (formMessage) formMessage.textContent = B8_UNCERTAIN_MESSAGE;
}, true);
document.addEventListener("keydown", event => {
  if ((!b8Submitting && !b8HasPendingWrite()) || event.key !== "Escape") return;
  event.preventDefault();
  event.stopImmediatePropagation();
}, true);

// B7 mantiene su selección masiva propia. Si B7 se marca, prevalece ese
// destinatario y se borra su preselección B8 con la MISMA referencia canónica.
assigneeList.addEventListener("change", event => {
  const box = event.target;
  if (!box?.matches?.(".mission-assignee-checkbox")) return;
  if (box.checked) uncheckInB8(box.value);
  syncDirectMaster();
});
directSelectAll.addEventListener("change", () => {
  // Se ejecuta después del manejador de B7 para respetar su selección real.
  queueMicrotask(() => {
    for (const box of b7Checkboxes()) {
      if (box.checked) uncheckInB8(box.value);
    }
    syncDirectMaster();
  });
}, true);

function candidateRow(person) {
  const row = document.createElement("label");
  row.className = "b8-person-option";
  const box = document.createElement("input");
  box.type = "checkbox";
  box.className = "b8-preselect-checkbox";
  box.value = person.assigneeRef;
  box.checked = selectedRefs.has(person.assigneeRef);
  box.addEventListener("change", () => {
    if (box.checked) {
      if (selectedRefs.size >= MAX_SELECTION) {
        box.checked = false;
        notice.textContent = `Máximo ${MAX_SELECTION} personas por envío. Para más, prepara otra misión.`;
      } else {
        selectedRefs.add(box.value);
        uncheckInDirect(box.value);
        notice.textContent = "";
      }
    } else {
      selectedRefs.delete(box.value);
      notice.textContent = "";
    }
    updateSelectionCount();
    updateGroupCheckAll();
  });
  const details = document.createElement("span");
  details.className = "b8-person-details";
  const name = document.createElement("strong");
  name.textContent = person.name || "Sin nombre";
  const subtitle = document.createElement("small");
  subtitle.textContent =
    `Interés registrado en onboarding | Cuenta digital: ${person.hasDigitalAccount ? "SÍ" : "NO"}`;
  details.append(name, subtitle);
  row.append(box, details);
  return row;
}
function renderGroups(preferred) {
  for (const role of roleOrder) {
    const group = preferred.filter(p => p.role === role).sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""), "es")
    );
    if (group.length === 0) continue;
    const heading = document.createElement("div");
    heading.className = "b8-role-heading";
    const label = document.createElement("label");
    label.className = "b8-role-select-all";
    const master = document.createElement("input");
    master.type = "checkbox";
    master.className = "b8-group-select-all";
    master.setAttribute("aria-label", `Seleccionar todos los ${roleNames[role]} interesados`);
    const text = document.createElement("span");
    const title = document.createElement("strong");
    title.textContent = `${roleNames[role]} (${group.length})`;
    const hint = document.createElement("small");
    hint.textContent = "Seleccionar todos los interesados de este nivel";
    text.append(title, hint);
    label.append(master, text);
    heading.appendChild(label);
    const list = document.createElement("div");
    list.className = "b8-role-members";
    for (const person of group) list.appendChild(candidateRow(person));
    master.addEventListener("change", () => {
      if (master.checked) {
        const missing = group.filter(person => !selectedRefs.has(person.assigneeRef));
        if (selectedRefs.size + missing.length > MAX_SELECTION) {
          notice.textContent = `No se seleccionó este nivel: superarías el máximo de ${MAX_SELECTION} personas por envío.`;
          updateGroupCheckAll();
          return;
        }
        for (const person of missing) {
          selectedRefs.add(person.assigneeRef);
          uncheckInDirect(person.assigneeRef);
        }
      } else {
        for (const person of group) selectedRefs.delete(person.assigneeRef);
      }
      for (const box of list.querySelectorAll(".b8-preselect-checkbox")) {
        box.checked = selectedRefs.has(box.value);
      }
      notice.textContent = "";
      updateSelectionCount();
      updateGroupCheckAll();
    });
    results.append(heading, list);
  }
}

async function consultCandidates() {
  if (!authorizedChief || activitySelect.disabled || modal.hidden || view !== "preferred") return;
  const activityCode = String(activitySelect.value || "").trim();
  if (!activityCode) {
    status.textContent = "Selecciona primero el tipo de actividad.";
    return;
  }
  const version = ++requestVersion;
  refreshButton.disabled = true;

  // B8-19H3-CONSERVACION:
  // Mantener seleccion y resultados mientras responde el servidor.
  // La reconciliacion se realiza solo con una respuesta valida y vigente.
  notice.textContent = "";
  status.textContent = "Actualizando interesados. Se conserva la seleccion durante la consulta...";
  try {
    const response = await consultar({activityCode});
    if (version !== requestVersion || modal.hidden || activitySelect.disabled ||
      activitySelect.value !== activityCode || !authorizedChief || view !== "preferred") return;
    if (!Array.isArray(response.data?.eligible)) throw new Error("Candidatos inválidos");
    const seen = new Set();
    const preferred = response.data.eligible.filter(person => {
      const ref = typeof person?.assigneeRef === "string" ? person.assigneeRef : "";
      if (!/^[0-9a-f]{64}$/.test(ref) || seen.has(ref) || (typeof person?.role !== "string" || !Object.prototype.hasOwnProperty.call(roleNames, person.role))) return false;
      seen.add(ref);
      return person.preferenceSelected === true;
    });
    // Conservar solo referencias que siguen autorizadas e interesadas.
    const validRefs = new Set(preferred.map(person => person.assigneeRef));
    const removed = Array.from(selectedRefs).filter(ref => !validRefs.has(ref));

    for (const ref of removed) {
      selectedRefs.delete(ref);
    }

    // Reemplazar el listado solo despues de validar la respuesta.
    results.replaceChildren();
    updateSelectionCount();

    notice.textContent = removed.length
      ? `${removed.length} ${removed.length === 1 ? "preselección retirada" : "preselecciones retiradas"} porque ya no cumplen los criterios de esta actividad.`
      : "";

    status.textContent = `${preferred.length} ${preferred.length === 1 ? "persona indicó" : "personas indicaron"} interés en esta actividad.`;
    if (!preferred.length) {
      const empty = document.createElement("p");
      empty.textContent = "Nadie de tu estructura autorizada seleccionó esta actividad en su onboarding.";
      results.appendChild(empty);
    } else {
      renderGroups(preferred);
      updateGroupCheckAll();
    }
  } catch (error) {
    if (version === requestVersion) {
      console.error("B8: consulta de interesados", error);
      status.textContent = results.childNodes.length
        ? "No fue posible actualizar los interesados. Se conservaron el listado y las preselecciones anteriores."
        : "No fue posible consultar la estructura. Revisa autorización y conexión.";
    }
  } finally {
    if (version === requestVersion) updateVisibility();
  }
}

function setView(next) {
  if (!authorizedChief || activitySelect.disabled || modal.hidden) return;
  view = next;
  activityNote.textContent = `Actividad: ${activityLabel()}`;
  updateVisibility();
  if (next === "preferred" && results.childNodes.length === 0) {
    consultCandidates();
  }
}
openStructure.addEventListener("click", () => setView("preferred"));
backButton.addEventListener("click", () => setView("direct"));
refreshButton.addEventListener("click", consultCandidates);

onAuthStateChanged(auth, async user => {
  authorizedChief = false;
  b8OutcomeUnknown = false;
  b8WriteConfirmed = false;
  view = "direct";
  clearResults();
  updateVisibility();
  if (!user) return;
  try {
    const profile = await getDoc(doc(db, "usuarios", user.uid));
    if (auth.currentUser?.uid !== user.uid) return;
    const data = profile.exists() ? profile.data() : null;
    authorizedChief = data?.active === true && data?.role === "jefe_estructura";
  } catch (error) {
    console.error("B8: perfil no disponible", error.code);
    authorizedChief = false;
  }
  updateVisibility();
});
activitySelect.addEventListener("change", event => {
  if (b8HasPendingWrite()) {
    event.stopImmediatePropagation();
    if (formMessage) formMessage.textContent = B8_UNCERTAIN_MESSAGE;
    return;
  }
  clearResults();
  view = "direct";
  updateVisibility();
});
new MutationObserver(() => updateVisibility()).observe(activitySelect, {
  attributes:true, attributeFilter:["disabled"]
});
new MutationObserver(() => {
  if (modal.hidden) {
    clearResults();
    view = "direct";
    b8RequestId = null;
    b8RequestSignature = null;
    b8WriteConfirmed = false;
  }
  updateVisibility();
}).observe(modal, {attributes:true, attributeFilter:["hidden"]});
updateSelectionCount();
updateVisibility();
