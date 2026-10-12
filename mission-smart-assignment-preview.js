"use strict";

import { auth, db } from "./firebase-config.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
  getFunctions,
  httpsCallable
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js";

const activitySelect = document.querySelector(
  ".mission-activity-field select"
);

const assigneeList = document.querySelector(
  "#missionAssigneeList"
);

const modal = document.querySelector("#missionModal");

if (!activitySelect || !assigneeList || !modal) {
  throw new Error("B8: formulario de misiones no disponible");
}

const consultar = httpsCallable(
  getFunctions(auth.app, "us-central1"),
  "getSmartAssignmentCandidates"
);

const panel = document.createElement("section");
panel.id = "smartAssignmentPreview";
panel.hidden = true;
panel.style.cssText = [
  "border:1px solid #cbd5e1",
  "border-radius:12px",
  "padding:16px",
  "margin-top:18px"
].join(";");

panel.innerHTML = `
  <h3 style="margin:0 0 8px">
    Asignación inteligente B8 — Mi estructura completa
  </h3>
  <p>
    Consulta candidatos de todos los niveles autorizados
    de tu estructura, según el tipo de actividad.
  </p>
  <p>
    <strong>Preselección B8:</strong>
    marca personas de tu estructura para preparar una asignación.
    El guardado B8 todavía está deshabilitado; B7 sigue independiente.
  </p>
  <button
    type="button"
    id="smartAssignmentSearch"
    class="button button--secondary"
    disabled
  >
    Consultar mi estructura completa
  </button>
  <p
    id="smartAssignmentStatus"
    aria-live="polite"
  ></p>
  <p id="smartAssignmentSelectedCount" aria-live="polite"></p>
  <div id="smartAssignmentResults"></div>
`;

assigneeList.insertAdjacentElement("afterend", panel);

const button = panel.querySelector(
  "#smartAssignmentSearch"
);

const status = panel.querySelector(
  "#smartAssignmentStatus"
);

const results = panel.querySelector(
  "#smartAssignmentResults"
);
const selectionCounter = panel.querySelector(
  "#smartAssignmentSelectedCount"
);
const missionForm = modal.querySelector("#missionForm");
const formMessage = modal.querySelector("#missionFormMessage");
const selectedRefs = new Set();

// El estilo se aplica SOLO al panel B8.
const style = document.createElement("style");
style.id = "b8-preselection-styles-001";
style.textContent = `
  #smartAssignmentResults .b8-role-heading {
    font-size: 1.05rem;
    font-weight: 800;
    background: #e8f1fb;
    border-left: 4px solid #173e66;
    border-radius: 6px;
    padding: 10px 12px;
    margin: 16px 0 6px;
  }
  #smartAssignmentResults .b8-person-option {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 11px 8px;
    margin: 0;
    border-bottom: 1px solid #dbe3ec;
    cursor: pointer;
    box-sizing: border-box;
  }
  #smartAssignmentResults .b8-person-option:focus-within {
    outline: 2px solid #0a3d91;
    outline-offset: 1px;
  }
  #smartAssignmentResults .b8-person-option input {
    flex: none;
    width: 20px;
    height: 20px;
    margin: 2px 0 0;
  }
  #smartAssignmentResults .b8-person-details {
    display: block;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  #smartAssignmentResults .b8-person-details strong {
    display: block;
    font-size: 1rem;
    margin-bottom: 4px;
  }
  #smartAssignmentResults .b8-person-details small {
    display: block;
    font-size: .9rem;
    line-height: 1.45;
  }
  #smartAssignmentSelectedCount {
    font-weight: 700;
    color: #173e66;
  }
`;
document.head.appendChild(style);

function updateSelectionCount() {
  const count = selectedRefs.size;
  selectionCounter.textContent = count
    ? `${count} personas preseleccionadas en B8. Todavía no se asignan misiones.`
    : "Ninguna persona preseleccionada en B8.";
}

// Impide enviar solo B7 por accidente si existen destinatarios B8.
// Fase UI: ninguna casilla B8 participa en createLinkedMissions.
missionForm.addEventListener("submit", event => {
  if (selectedRefs.size === 0) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (formMessage) {
    formMessage.textContent =
      `Hay ${selectedRefs.size} personas preseleccionadas en B8. ` +
      "La escritura B8 todavía está deshabilitada: NO se guardó la misión. " +
      "Desmarca la preselección B8 para usar B7 por separado.";
    formMessage.scrollIntoView?.({block: "nearest"});
  }
}, true);

let authorizedChief = false;
let requestVersion = 0;
updateSelectionCount();

function clearResults() {
  requestVersion += 1;
  selectedRefs.clear();
  updateSelectionCount();
  results.replaceChildren();
  status.textContent = "";
}

function updateVisibility() {
  const visible =
    authorizedChief &&
    activitySelect.disabled !== true;

  panel.hidden = !visible;

  button.disabled =
    !visible ||
    !String(activitySelect.value || "").trim();

  if (!visible) {
    clearResults();
  }
}

onAuthStateChanged(auth, async user => {
  authorizedChief = false;
  updateVisibility();

  if (!user) return;

  try {
    const profile = await getDoc(
      doc(db, "usuarios", user.uid)
    );

    if (auth.currentUser?.uid !== user.uid) return;

    const data = profile.exists()
      ? profile.data()
      : null;

    authorizedChief =
      data?.active === true &&
      data?.role === "jefe_estructura";

  } catch (error) {
    console.error("B8: perfil no disponible", error.code);
    authorizedChief = false;
  }

  updateVisibility();
});

activitySelect.addEventListener("change", () => {
  clearResults();
  updateVisibility();
});

new MutationObserver(() => {
  updateVisibility();
}).observe(activitySelect, {
  attributes: true,
  attributeFilter: ["disabled"]
});

new MutationObserver(() => {
  if (modal.hidden) {
    clearResults();
  }
  updateVisibility();
}).observe(modal, {
  attributes: true,
  attributeFilter: ["hidden"]
});

const roleNames = {
  integrante: "Integrantes",
  participante: "Participantes",
  colaborador_base: "Colaboradores de Base",
  apoyo_territorial: "Apoyos Territoriales"
};
const roleOrder = Object.keys(roleNames);

function candidateRow(person) {
  const row = document.createElement("label");
  row.className = "b8-person-option";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "b8-preselect-checkbox";
  checkbox.value = person.assigneeRef;
  checkbox.checked = selectedRefs.has(person.assigneeRef);
  checkbox.addEventListener("change", () => {
    if (checkbox.checked) {
      selectedRefs.add(person.assigneeRef);
    } else {
      selectedRefs.delete(person.assigneeRef);
    }
    updateSelectionCount();
  });

  const details = document.createElement("span");
  details.className = "b8-person-details";
  const name = document.createElement("strong");
  name.textContent = person.name || "Sin nombre";
  const subtitle = document.createElement("small");
  subtitle.textContent =
    "Preferencia en onboarding: " +
    (person.preferenceSelected ? "SÍ" : "NO") +
    " | Cuenta digital: " +
    (person.hasDigitalAccount ? "SÍ" : "NO");
  details.append(name, subtitle);
  row.append(checkbox, details);
  return row;
}

function renderGroup(container, people) {
  for (const role of roleOrder) {
    const group = people
      .filter(person => person.role === role)
      .sort((a, b) =>
        String(a.name || "").localeCompare(
          String(b.name || ""), "es"
        )
      );
    if (!group.length) continue;
    const heading = document.createElement("h4");
    heading.className = "b8-role-heading";
    heading.textContent = `${roleNames[role]} (${group.length})`;
    container.appendChild(heading);
    for (const person of group) {
      container.appendChild(candidateRow(person));
    }
  }
}

button.addEventListener("click", async () => {
  if (!authorizedChief || activitySelect.disabled || modal.hidden) {
    return;
  }

  const activityCode = String(activitySelect.value || "").trim();
  if (!activityCode) return;

  const version = ++requestVersion;
  button.disabled = true;
  selectedRefs.clear();
  updateSelectionCount();
  results.replaceChildren();
  status.textContent = "Consultando estructura autorizada...";

  try {
    const response = await consultar({ activityCode });
    const data = response.data;

    if (
      version !== requestVersion ||
      modal.hidden ||
      activitySelect.disabled ||
      activitySelect.value !== activityCode ||
      !authorizedChief
    ) {
      return;
    }

    if (!Array.isArray(data?.eligible)) {
      throw new Error("Respuesta de candidatos inválida");
    }

    // No renderizar referencias vacías, duplicadas o roles desconocidos.
    const seen = new Set();
    const eligible = data.eligible.filter(person => {
      const ref = person && typeof person.assigneeRef === "string"
        ? person.assigneeRef.trim() : "";
      if (!ref || seen.has(ref) || !roleNames[person.role]) return false;
      seen.add(ref);
      return true;
    });
    const preferred = eligible.filter(person =>
      person.preferenceSelected === true
    );
    const others = eligible.filter(person =>
      person.preferenceSelected !== true
    );

    status.textContent =
      `${preferred.length} personas seleccionaron esta actividad en el onboarding.`;

    if (eligible.length === 0) {
      const empty = document.createElement("p");
      empty.textContent =
        "No se encontraron candidatos elegibles en tu estructura para esta actividad.";
      results.appendChild(empty);
    } else if (preferred.length === 0) {
      const empty = document.createElement("p");
      empty.textContent =
        "Nadie seleccionó esta actividad en su onboarding; " +
        "puedes consultar las demás personas elegibles.";
      results.appendChild(empty);
    }

    renderGroup(results, preferred);

    if (others.length > 0) {
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.id = "smartAssignmentShowOthers";
      toggle.className = "button button--secondary";
      toggle.style.marginTop = "12px";
      toggle.setAttribute("aria-expanded", "false");

      const extra = document.createElement("div");
      extra.id = "smartAssignmentOtherResults";
      extra.hidden = true;

      const heading = document.createElement("p");
      heading.textContent =
        "No seleccionaron esta preferencia. Eso no significa falta de aptitud.";
      extra.appendChild(heading);
      renderGroup(extra, others);

      function updateToggle() {
        toggle.textContent = extra.hidden
          ? `Mostrar otras ${others.length} personas`
          : `Ocultar otras ${others.length} personas`;
      }
      updateToggle();
      toggle.addEventListener("click", () => {
        extra.hidden = !extra.hidden;
        toggle.setAttribute("aria-expanded", String(!extra.hidden));
        updateToggle();
      });
      results.append(toggle, extra);
    }

    const note = document.createElement("p");
    note.textContent =
      "La preferencia no acredita aptitud, disponibilidad ni aceptación. " +
      "Estas casillas son solo una preselección; todavía NO crean misiones.";
    results.appendChild(note);
  } catch (error) {
    if (version === requestVersion) {
      console.error("Consulta inteligente B8:", error);
      status.textContent =
        "No fue posible consultar la estructura. " +
        "Verifica la autorización o revisa la consola.";
    }
  } finally {
    if (version === requestVersion) {
      updateVisibility();
    }
  }
});
