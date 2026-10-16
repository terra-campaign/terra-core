"use strict";

import {auth} from "./firebase-config.js";
import {onAuthStateChanged}
  from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {getFunctions,httpsCallable}
  from "https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js";
import {normalizeConfirmationIndex}
  from "./mission-confirmation-index-view.mjs?v=b8-indice-001";

const missionId =
  new URLSearchParams(location.search).get("id");

const titleEl = document.querySelector("#confirmationMissionTitle");
const messageEl = document.querySelector("#confirmationMessage");
const resultsEl = document.querySelector("#confirmationResults");
const refreshButton = document.querySelector("#refreshConfirmations");
const returnLink = document.querySelector("#returnMission");
const rowsEl = document.querySelector("#confirmationRows");

const counters = {
  total: document.querySelector("#confirmationTotal"),
  accepted: document.querySelector("#confirmationAccepted"),
  declined: document.querySelector("#confirmationDeclined"),
  pending: document.querySelector("#confirmationPending")
};

const readIndex = httpsCallable(
  getFunctions(auth.app,"us-central1"),
  "getMissionConfirmationIndex"
);

let generation = 0;
let currentUid = null;

if (missionId) {
  returnLink.href =
    "./mision.html?id=" + encodeURIComponent(missionId);
}

function clearData() {
  resultsEl.hidden = true;
  rowsEl.replaceChildren();
  titleEl.textContent = "Confirmaciones de misión";
  refreshButton.disabled = true;

  for (const element of Object.values(counters)) {
    element.textContent = "0";
  }
}

function stillCurrent(uid,token) {
  return generation === token &&
    currentUid === uid &&
    auth.currentUser?.uid === uid;
}

async function loadIndex(uid) {
  const token = ++generation;

  clearData();
  messageEl.textContent = "Consultando confirmaciones...";

  if (!missionId) {
    messageEl.textContent =
      "No se especificó la misión que deseas consultar.";
    return;
  }

  try {
    const {data} = await readIndex({missionId});

    if (!stillCurrent(uid,token)) return;

    if (data?.missionId !== missionId) {
      throw new Error("La respuesta corresponde a otra misión.");
    }

    const view = normalizeConfirmationIndex(data);

    titleEl.textContent = view.title;
    counters.total.textContent = String(view.total);
    counters.accepted.textContent =
      String(view.totals.accepted);
    counters.declined.textContent =
      String(view.totals.declined);
    counters.pending.textContent =
      String(view.totals.noResponse);

    const fragment = document.createDocumentFragment();

    for (const item of view.rows) {
      const tr = document.createElement("tr");
      const name = document.createElement("td");
      const status = document.createElement("td");

      name.textContent = item.name;
      status.textContent = item.label;

      status.className =
        item.status === "ACCEPTED" ? "accepted" :
        item.status === "DECLINED" ? "declined" :
        "pending";

      tr.append(name,status);
      fragment.append(tr);
    }

    rowsEl.replaceChildren(fragment);
    resultsEl.hidden = false;
    refreshButton.disabled = false;

    messageEl.textContent =
      "Confirmaciones consultadas correctamente.";

  } catch (error) {
    if (!stillCurrent(uid,token)) return;

    clearData();

    messageEl.textContent =
      error?.code === "functions/permission-denied"
      ? "No tienes autorización para consultar este índice."
      : "No fue posible consultar las confirmaciones.";

    console.error("B8: índice de confirmaciones:",error);
  }
}

onAuthStateChanged(auth,user => {
  generation++;
  currentUid = user?.uid ?? null;
  clearData();

  if (!user) {
    messageEl.textContent =
      "Inicia sesión en TERRA para consultar confirmaciones.";
    return;
  }

  void loadIndex(user.uid);
});

refreshButton.addEventListener("click",() => {
  if (currentUid && auth.currentUser?.uid === currentUid) {
    void loadIndex(currentUid);
  }
});