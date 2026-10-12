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
    <strong>Importante:</strong>
    esta sección todavía no asigna misiones.
    La asignación directa B7 funciona por separado.
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

let authorizedChief = false;
let requestVersion = 0;

function clearResults() {
  requestVersion += 1;
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
  integrante: "Integrante",
  participante: "Participante",
  colaborador_base: "Colaborador de base",
  apoyo_territorial: "Apoyo territorial"
};

const roleOrder = Object.keys(roleNames);

button.addEventListener("click", async () => {
  if (!authorizedChief || activitySelect.disabled) {
    return;
  }

  const activityCode = String(
    activitySelect.value || ""
  ).trim();

  if (!activityCode) return;

  const version = ++requestVersion;

  button.disabled = true;
  results.replaceChildren();
  status.textContent = "Consultando estructura autorizada...";

  try {
    const response = await consultar({ activityCode });
    const data = response.data;

    if (
      version !== requestVersion ||
      modal.hidden ||
      activitySelect.disabled ||
      activitySelect.value !== activityCode
    ) {
      return;
    }

    if (!Array.isArray(data?.eligible)) {
      throw new Error("Respuesta de candidatos invalida");
    }

    const people = data.eligible.filter(
      person => person.preferenceSelected === true
    );

    const others = data.eligible.filter(
      person => person.preferenceSelected !== true
    );

    status.textContent =
      `${people.length} personas seleccionaron esta actividad en el onboarding.`;

    if (people.length === 0) {
      const empty = document.createElement("p");
      empty.textContent =
        "Nadie selecciono esta actividad. Puedes consultar las demas personas.";
      results.appendChild(empty);
    }
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
      heading.textContent =
        `${roleNames[role]} (${group.length})`;

      results.appendChild(heading);

      for (const person of group) {
        const row = document.createElement("div");

        row.style.cssText =
          "padding:8px 0;border-bottom:1px solid #e5e7eb";

        const name = document.createElement("strong");
        name.textContent = person.name || "Sin nombre";

        const details = document.createElement("div");
        details.style.fontSize = "0.85rem";

        details.textContent =
          "Preferencia en onboarding: " +
          (person.preferenceSelected ? "SI" : "NO") +
          " | Cuenta digital: " +
          (person.hasDigitalAccount ? "SI" : "NO");

        row.append(name, details);
        results.appendChild(row);
      }
    }

    const note = document.createElement("p");
    note.textContent =
      "La preferencia no acredita aptitud, " +
      "disponibilidad ni aceptacion. " +
      "Consulta B8: sin escritura de asignaciones.";

    results.appendChild(note);
    if (others.length > 0) {
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.id = "smartAssignmentShowOthers";
      toggle.className = "button button--secondary";
      toggle.style.marginTop = "12px";
      toggle.textContent =
        `Mostrar otras ${others.length} personas`;
      toggle.setAttribute("aria-expanded", "false");

      const extra = document.createElement("div");
      extra.id = "smartAssignmentOtherResults";
      extra.hidden = true;

      const heading = document.createElement("p");
      heading.textContent =
        "Personas que no seleccionaron esta actividad. Esto no significa falta de aptitud.";

      extra.appendChild(heading);

      for (const role of roleOrder) {
        const group = others
          .filter(person => person.role === role)
          .sort((a, b) =>
            String(a.name || "").localeCompare(
              String(b.name || ""), "es"
            )
          );

        if (!group.length) continue;

        const title = document.createElement("h4");
        title.textContent =
          `${roleNames[role]} (${group.length})`;
        extra.appendChild(title);

        for (const person of group) {
          const row = document.createElement("div");
          row.style.cssText =
            "padding:8px 0;border-bottom:1px solid #e5e7eb";

          const name = document.createElement("strong");
          name.textContent = person.name || "Sin nombre";

          const detail = document.createElement("div");
          detail.style.fontSize = "0.85rem";
          detail.textContent =
            "Preferencia no seleccionada | Cuenta digital: " +
            (person.hasDigitalAccount ? "SI" : "NO");

          row.append(name, detail);
          extra.appendChild(row);
        }
      }

      toggle.addEventListener("click", () => {
        extra.hidden = !extra.hidden;
        toggle.setAttribute(
          "aria-expanded",
          String(!extra.hidden)
        );
        toggle.textContent = extra.hidden
          ? `Mostrar otras ${others.length} personas`
          : `Ocultar otras ${others.length} personas`;
      });

      results.append(toggle, extra);
    }

  } catch (error) {
    if (version === requestVersion) {
      console.error("Consulta inteligente B8:", error);
      status.textContent =
        "No fue posible consultar la estructura. " +
        "Verifica la autorizacion o revisa la consola.";
    }

  } finally {
    if (version === requestVersion) {
      updateVisibility();
    }
  }
});