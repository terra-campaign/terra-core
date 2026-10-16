"use strict";

import {auth} from "./firebase-config.js";
import {onAuthStateChanged}
  from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {getFunctions,httpsCallable}
  from "https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js";

const section =
  document.querySelector("#missionConfirmationIndexSection");

const link =
  document.querySelector("#missionConfirmationIndexLink");

if (!section || !link) {
  throw new Error("B8: falta el acceso a confirmaciones.");
}

const missionId =
  new URLSearchParams(location.search).get("id");

const readIndex = httpsCallable(
  getFunctions(auth.app,"us-central1"),
  "getMissionConfirmationIndex"
);

let generation = 0;

onAuthStateChanged(auth,async user => {
  const token = ++generation;

  section.hidden = true;

  if (!user || !missionId) return;

  try {
    const {data} = await readIndex({missionId});

    if (generation !== token ||
        auth.currentUser?.uid !== user.uid ||
        data?.missionId !== missionId) {
      return;
    }

    link.href =
      "./confirmaciones-mision.html?id=" +
      encodeURIComponent(missionId);

    section.hidden = false;

  } catch {
    // No exponer el enlace sin autorización del backend.
    section.hidden = true;
  }
});