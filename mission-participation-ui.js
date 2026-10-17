"use strict";

import {auth} from "./firebase-config.js";

import {
  buildMissionResponseWhatsAppUrl
} from "./mission-response-whatsapp-message.mjs?v=b8-whatsapp-001";

import {
  parsePendingResponse,
  verifyPendingReceipt
} from "./mission-response-recovery.mjs?v=b8-recovery-001";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  getFunctions,
  httpsCallable
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js";

import {
  describeParticipation
} from "./mission-participation-ui-model.mjs?v=b8-confirmaciones-002";

const section = document.querySelector("#missionParticipationSection");
const statusEl = document.querySelector("#missionParticipationStatus");
const feedback = document.querySelector("#missionParticipationFeedback");
const accept = document.querySelector("#missionParticipationAccept");
const decline = document.querySelector("#missionParticipationDecline");

const whatsappButton =
  document.querySelector("#missionParticipationWhatsApp");

const whatsappFallback =
  document.querySelector("#missionParticipationWhatsAppFallback");

const recoverButton =
  document.querySelector("#missionParticipationRecover");

if (!section || !statusEl || !feedback || !accept || !decline ||
    !whatsappButton || !whatsappFallback || !recoverButton) {
  throw new Error("B8: faltan controles de participación.");
}

const missionId = new URLSearchParams(
  window.location.search
).get("id");

const functions = getFunctions(auth.app,"us-central1");

const getStatus = httpsCallable(
  functions,
  "getMissionParticipationStatus"
);

const record = httpsCallable(
  functions,
  "recordMissionParticipationResponse"
);

const getOwnerWhatsApp = httpsCallable(
  functions,
  "getMissionResponseOwnerWhatsApp"
);

const PREFIX = "terra-b8-participation-pending-v1:";

let generation = 0;
let currentUid = null;
let state = null;
let saving = false;
let preparingWhatsApp = false;

function key(uid) {
  return PREFIX + uid + ":" + missionId;
}

function current(uid,token) {
  return generation === token &&
    currentUid === uid &&
    auth.currentUser?.uid === uid;
}

function disable() {
  accept.disabled = true;
  decline.disabled = true;

  whatsappButton.disabled = true;
  whatsappButton.hidden = true;
  whatsappButton.style.display = "none";

  whatsappFallback.hidden = true;
  whatsappFallback.style.display = "none";
  whatsappFallback.removeAttribute("href");

  recoverButton.disabled = true;
  recoverButton.hidden = true;
  recoverButton.style.display = "none";
}

function render() {
  disable();

  if (!state) return;

  const model = describeParticipation(state);

  const confirmationClosed = state.canChange === false && Boolean(state.startAt);
  statusEl.classList.toggle(
    "terra-participation-status--closed",
    confirmationClosed
  );
  accept.classList.toggle(
    "terra-participation-button--closed",
    confirmationClosed
  );
  decline.classList.toggle(
    "terra-participation-button--closed",
    confirmationClosed
  );

  statusEl.textContent = confirmationClosed
    ? "Confirmación cerrada. Tu respuesta: " + model.label + ". " +
      model.explanation +
      " Este plazo solo afecta la confirmación de participación. " +
      "El registro de evidencias tiene un plazo independiente."
    : "Tu respuesta: " + model.label + ". " + model.explanation;

  if (saving || preparingWhatsApp) return;

  // Cualquier resultado incierto bloquea nuevas solicitudes.
  if (localStorage.getItem(key(currentUid))) {
    recoverButton.hidden = false;
    recoverButton.disabled = false;
    recoverButton.style.display = "inline-flex";

    feedback.textContent =
      "Hay un envío pendiente de verificar. " +
      "Utiliza Verificar envío pendiente para consultar " +
      "el resultado sin generar otra solicitud.";
    return;
  }

  accept.disabled = !model.acceptEnabled;
  decline.disabled = !model.declineEnabled;

  // También puede avisar después del cierre de T-60,
  // siempre que exista una decisión registrada.
  if (["ACCEPTED","DECLINED"].includes(state.status)) {
    whatsappButton.hidden = false;
    whatsappButton.style.display = "inline-flex";
    whatsappButton.disabled = false;
  }
}

async function refresh(uid,token) {
  disable();
  statusEl.textContent = "Consultando tu participación...";

  try {
    const {data} = await getStatus({missionId});

    if (!current(uid,token)) return;

    state = {
      status:data?.status,
      canChange:data?.canChange,
      startAt:data?.startAt
    };

    section.hidden = false;
    render();

  } catch (error) {
    if (!current(uid,token)) return;

    state = null;
    disable();

    if (error?.code === "functions/permission-denied" ||
        error?.code === "functions/unauthenticated") {
      section.hidden = true;
      return;
    }

    section.hidden = false;
    statusEl.textContent =
      "No fue posible consultar tu participación.";

    feedback.textContent =
      "Las confirmaciones no están disponibles por ahora.";
  }
}

onAuthStateChanged(auth, async user => {
  const token = ++generation;

  currentUid = user?.uid ?? null;
  state = null;
  saving = false;
  preparingWhatsApp = false;

  section.hidden = true;
  disable();
  statusEl.textContent = "";
  feedback.textContent = "";

  if (!user || !missionId) return;

  await refresh(user.uid,token);
});

function definitive(error) {
  return [
    "functions/failed-precondition",
    "functions/permission-denied",
    "functions/invalid-argument",
    "functions/unauthenticated",
    "functions/already-exists"
  ].includes(error?.code);
}

async function submit(decision) {
  const uid = currentUid;
  const token = generation;

  if (!uid || !current(uid,token) || saving ||
      !state || state.canChange !== true) {
    return;
  }

  if (decision === state.status) return;

  disable();

  let requestId;
  let markerWritten = false;

  try {
    if (localStorage.getItem(key(uid))) {
      throw new Error("Ya existe una solicitud pendiente.");
    }

    requestId = crypto.randomUUID();

    const marker = JSON.stringify({
      requestId,
      decision,
      createdAt:Date.now()
    });

    localStorage.setItem(key(uid),marker);

    if (localStorage.getItem(key(uid)) !== marker) {
      throw new Error("No se pudo proteger la solicitud.");
    }

    markerWritten = true;

  } catch (error) {
    feedback.textContent =
      "No fue posible preparar el guardado. " +
      "No se envió una nueva decisión.";
    disable();
    return;
  }

  saving = true;
  feedback.textContent = "Guardando tu decisión...";

  try {
    const {data} = await record({
      missionId,
      requestId,
      decision
    });

    if (!data || data.recorded !== true ||
        data.status !== decision) {
      throw new Error("Guardado no confirmado.");
    }

    localStorage.removeItem(key(uid));

    if (localStorage.getItem(key(uid)) !== null) {
      throw new Error("No se pudo verificar el guardado local.");
    }

    if (!current(uid,token)) return;

    saving = false;
    state = {...state,status:decision};

    feedback.textContent =
      "✅ Tu decisión quedó guardada correctamente en TERRA.";

    await refresh(uid,token);

    if (current(uid,token) && state) {
      feedback.textContent =
        "✅ Tu decisión quedó guardada correctamente en TERRA.";
    }

  } catch (error) {
    // Conservar el requestId original incluso si el servidor
    // devuelve un error: la recuperacion verificara el mismo
    // identificador. Nunca inventar uno para este reintento.

    if (!current(uid,token)) return;

    saving = false;
    disable();

    feedback.textContent = definitive(error)
      ? "El servidor rechazó la decisión: " +
        (error.message || "No se registró un cambio.")
      : "El resultado del guardado es incierto. " +
        "No repitas la solicitud. " +
        "La administración debe verificarla.";

    if (definitive(error)) {
      await refresh(uid,token);
    }
  }
}

accept.addEventListener("click",() => {
  void submit("ACCEPTED");
});

decline.addEventListener("click",() => {
  void submit("DECLINED");
});

async function communicateDecisionByWhatsApp() {
  const uid = currentUid;
  const token = generation;

  if (!uid ||
      !current(uid,token) ||
      saving ||
      preparingWhatsApp ||
      !state ||
      !["ACCEPTED","DECLINED"].includes(state.status) ||
      whatsappButton.disabled ||
      whatsappButton.hidden) {
    return;
  }

  preparingWhatsApp = true;
  disable();

  feedback.textContent =
    "Verificando el contacto del responsable...";

  // Abrir una pestaña vacía desde el clic evita bloqueos
  // del navegador durante la consulta autenticada.
  let tab = null;
  let fallbackUrl = null;
  let success = false;
  let errorText = "";

  try {
    try {
      tab = window.open("about:blank","_blank");

      if (tab) {
        tab.opener = null;
        tab.document.title = "Preparando WhatsApp";
        tab.document.body.textContent =
          "TERRA está verificando el destinatario...";
      }
    } catch {
      tab = null;
    }

    // El servidor resuelve al creador de la misión
    // y verifica una respuesta ya registrada.
    const {data} = await getOwnerWhatsApp({missionId});

    if (!current(uid,token)) {
      if (tab && !tab.closed) tab.close();
      return;
    }

    const url = buildMissionResponseWhatsAppUrl(
      data,
      missionId,
      window.location.href
    );

    // La decisión enviada proviene del servidor,
    // no de un texto inventado en el navegador.
    state = {
      ...state,
      status:data.status
    };

    if (tab && !tab.closed) {
      try {
        tab.location.replace(url);
        success = true;
      } catch {
        try {
          tab.close();
        } catch {
          // El navegador puede haber cerrado la pestaña.
        }
        fallbackUrl = url;
        success = true;
      }
    } else {
      fallbackUrl = url;
      success = true;
    }

  } catch (error) {
    if (tab && !tab.closed) {
      try {
        tab.close();
      } catch {
        // Sin acciones adicionales.
      }
    }

    if (!current(uid,token)) return;

    errorText =
      error?.code === "functions/failed-precondition"
      ? "El contacto del responsable o la confirmación " +
        "requieren revisión. No se abrirá otro número."
      : "No fue posible preparar el aviso por WhatsApp.";

    console.error(
      "B8: contacto autorizado no disponible:",
      error
    );

  } finally {
    if (current(uid,token)) {
      preparingWhatsApp = false;
      render();

      if (success) {
        if (fallbackUrl) {
          whatsappFallback.href = fallbackUrl;
          whatsappFallback.hidden = false;
          whatsappFallback.style.display = "inline-flex";

          feedback.textContent =
            "El navegador bloqueó la apertura automática. " +
            "Utiliza el enlace verde para abrir WhatsApp.";
        } else {
          feedback.textContent =
            "WhatsApp está preparado. " +
            "Revisa el mensaje y pulsa Enviar si deseas comunicarlo.";
        }
      } else if (errorText) {
        feedback.textContent = errorText;
      }
    }
  }
}

whatsappButton.addEventListener("click",() => {
  void communicateDecisionByWhatsApp();
});

async function retryPendingResponse() {
  const uid = currentUid;
  const token = generation;

  if (!uid ||
      !current(uid,token) ||
      saving ||
      preparingWhatsApp ||
      !state) {
    return;
  }

  let pending;

  try {
    pending = parsePendingResponse(
      localStorage.getItem(key(uid))
    );
  } catch (error) {
    disable();
    feedback.textContent =
      "No se puede verificar el marcador local. " +
      "Solicita una revisión administrativa sin borrar " +
      "los datos pendientes.";
    return;
  }

  if (!pending) {
    render();
    return;
  }

  saving = true;
  disable();

  feedback.textContent =
    "Verificando la solicitud original en TERRA...";

  try {
    // El mismo requestId evita crear otra operación.
    // El servidor decidirá si ya existe en el historial
    // o si todavía es admisible registrarla.
    const {data} = await record({
      missionId,
      requestId:pending.requestId,
      decision:pending.decision
    });

    verifyPendingReceipt(data,pending);

    // No borrar un marcador que otra pestaña haya cambiado.
    if (localStorage.getItem(key(uid)) !== pending.raw) {
      throw new Error(
        "El marcador cambió durante la verificación."
      );
    }

    localStorage.removeItem(key(uid));

    if (localStorage.getItem(key(uid)) !== null) {
      throw new Error(
        "No se pudo verificar la limpieza local."
      );
    }

    if (!current(uid,token)) return;

    saving = false;

    // Consultar el estado actual, que puede diferir
    // de la decisión histórica del reintento.
    await refresh(uid,token);

    if (current(uid,token) && state) {
      feedback.textContent =
        "Solicitud original verificada. " +
        "La respuesta actual se consultó en TERRA.";
    }

  } catch (error) {
    if (!current(uid,token)) return;

    saving = false;
    render();

    feedback.textContent =
      "Todavía no fue posible acreditar el envío pendiente. " +
      "La solicitud original permanece protegida. " +
      "Puedes volver a verificarla o solicitar revisión " +
      "administrativa; no generes otra solicitud.";

    console.error(
      "B8: recuperación de confirmación:",
      error
    );
  }
}

recoverButton.addEventListener("click",() => {
  void retryPendingResponse();
});
