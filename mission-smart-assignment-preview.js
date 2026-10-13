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
document.head.appendChild(style);

function b7Checkboxes() {
  return Array.from(assigneeList.querySelectorAll(".mission-assignee-checkbox"));
}
function syncDirectMaster() {
  const boxes = b7Checkboxes().filter(box => !box.disabled);
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
  const eligibleChief = authorizedChief && !activitySelect.disabled;
  openStructure.hidden = !eligibleChief;
  if (!eligibleChief) view = "direct";
  directField.hidden = view !== "direct" && eligibleChief;
  panel.hidden = view !== "preferred" || !eligibleChief;
  openStructure.disabled = !eligibleChief;
  refreshButton.disabled = !eligibleChief || !String(activitySelect.value || "").trim();
  if (!eligibleChief && (selectedRefs.size || results.childNodes.length)) clearResults();
}
function activityLabel() {
  return activitySelect.selectedOptions?.[0]?.textContent?.trim() || "la actividad elegida";
}

// B8 - Validacion local del formulario. NO realiza escrituras.
// B7 conserva su controlador original cuando no hay seleccion B8.
form.addEventListener("submit", event => {
  const anyB8 = selectedRefs.size > 0;

  if (!anyB8 && view === "direct") return;

  event.preventDefault();
  event.stopImmediatePropagation();

  if (!formMessage) return;

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

    formMessage.textContent =
      `B8: solicitud validada localmente para ` +
      `${payload.assigneeRefs.length} personas. ` +
      "El envio inteligente sigue DESHABILITADO. " +
      "NO se guardo ninguna mision.";

  } catch (error) {
    formMessage.textContent =
      `${error.message || "Error de validacion B8."} ` +
      "NO se guardo ninguna mision.";
  }

  formMessage.scrollIntoView?.({block:"nearest"});
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
});

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
  selectedRefs.clear();
  updateSelectionCount();
  results.replaceChildren();
  notice.textContent = "";
  status.textContent = "Consultando los interesados de tu estructura...";
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
      status.textContent = "No fue posible consultar la estructura. Revisa autorización y conexión.";
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
activitySelect.addEventListener("change", () => {
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
  }
  updateVisibility();
}).observe(modal, {attributes:true, attributeFilter:["hidden"]});
updateSelectionCount();
updateVisibility();
