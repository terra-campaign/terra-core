import {
  auth
} from "./firebase-config.js";


import {
  getFunctions,
  httpsCallable
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js";


const functions =
  getFunctions(
    auth.app,
    "us-central1"
  );


const getDoorTutorCandidates =
  httpsCallable(
    functions,
    "getDoorTutorCandidates"
  );


const $ =
  id =>
    document.getElementById(id);


let busy =
  false;

let selectedTutorRef =
  null;


// ======================================================
// DOM
// ======================================================

function element(
  tag,
  text = ""
) {

  const node =
    document.createElement(
      tag
    );


  if (text) {
    node.textContent =
      text;
  }


  return node;
}


function setStatus(
  text
) {

  const status =
    $("doorTutorStatus");


  if (status) {
    status.textContent =
      text || "";
  }
}


// ======================================================
// PANEL
// ======================================================

function ensureTutorPanel() {

  const existing =
    $("doorTutorPanel");


  if (existing) {
    return existing;
  }


  const inviterResults =
    $("doorInviterResults");


  if (!inviterResults) {
    return null;
  }


  const panel =
    element(
      "div"
    );


  panel.id =
    "doorTutorPanel";

  panel.className =
    "event-form-card";

  panel.hidden =
    true;


  const title =
    element(
      "h4",
      "Resolver tutor territorial"
    );


  const explanation =
    element(
      "p",
      "TERRA mostrará únicamente tutores compatibles con la rama territorial del invitador."
    );


  explanation.className =
    "message";


  const status =
    element(
      "p"
    );


  status.id =
    "doorTutorStatus";

  status.className =
    "message";

  status.setAttribute(
    "role",
    "status"
  );


  const results =
    element(
      "div"
    );


  results.id =
    "doorTutorResults";

  results.className =
    "attendance-person-list";


  panel.append(
    title,
    explanation,
    status,
    results
  );


  inviterResults.insertAdjacentElement(
    "afterend",
    panel
  );


  return panel;
}


// ======================================================
// RENDER
// ======================================================

function renderTutorCandidates(
  data
) {

  const panel =
    ensureTutorPanel();


  if (!panel) {
    return;
  }


  panel.hidden =
    false;


  const results =
    $("doorTutorResults");


  results.replaceChildren();


  selectedTutorRef =
    null;


  if (
    data?.requiresBranchResolution ===
      true
  ) {

    setStatus(
      data.message ||
      "Primero debe resolverse la estructura territorial."
    );

    return;
  }


  const candidates =
    Array.isArray(
      data?.candidates
    )
      ? data.candidates
      : [];


  if (!candidates.length) {

    setStatus(
      data?.message ||
      "No existe todavía un tutor territorial válido dentro de esta rama."
    );

    return;
  }


  // ==================================================
  // PARTICIPANTE INVITADOR
  // Tutor determinístico: él mismo.
  // ==================================================

  if (
    data?.deterministic === true &&
    candidates.length === 1
  ) {

    const tutor =
      candidates[0];


    selectedTutorRef =
      tutor.tutorRef ||
      null;


    const card =
      element(
        "article"
      );


    card.className =
      "attendance-person";


    card.append(
      element(
        "strong",
        tutor.name ||
        "Sin nombre"
      )
    );


    card.append(
      element(
        "p",
        "Nivel: Participante"
      )
    );


    if (tutor.locality) {

      card.append(
        element(
          "p",
          `Población: ${
            tutor.locality
          }`
        )
      );
    }


    card.append(
      element(
        "p",
        `Estructura: ${
          tutor.structureName ||
          "Sin estructura"
        }`
      )
    );


    results.append(
      card
    );


    setStatus(
      `TUTOR TERRITORIAL RESUELTO: ${
        tutor.name ||
        "Sin nombre"
      }. Envíalo con este tutor para completar su alta en TERRA.`
    );


    return;
  }


  // ==================================================
  // UNO O VARIOS TUTORES VALIDOS
  // La selección requiere confirmación humana.
  // ==================================================

  setStatus(
    data?.message ||
    "Confirma con el invitador o responsable de la rama quién será el tutor."
  );


  for (
    const tutor of
    candidates
  ) {

    const card =
      element(
        "article"
      );


    card.className =
      "attendance-person";


    card.append(
      element(
        "strong",
        tutor.name ||
        "Sin nombre"
      )
    );


    card.append(
      element(
        "p",
        "Nivel: Participante"
      )
    );


    if (tutor.locality) {

      card.append(
        element(
          "p",
          `Población: ${
            tutor.locality
          }`
        )
      );
    }


    card.append(
      element(
        "p",
        `Estructura: ${
          tutor.structureName ||
          "Sin estructura"
        }`
      )
    );


    const choose =
      element(
        "button",
        "Confirmar tutor indicado"
      );


    choose.type =
      "button";

    choose.className =
      "button button--secondary";


    choose.addEventListener(
      "click",
      () => {

        selectedTutorRef =
          tutor.tutorRef ||
          null;


        setStatus(
          `TUTOR TERRITORIAL RESUELTO: ${
            tutor.name ||
            "Sin nombre"
          }. Envíalo con este tutor para completar su alta en TERRA.`
        );
      }
    );


    card.append(
      choose
    );


    results.append(
      card
    );
  }


  if (data?.limited) {

    results.append(
      element(
        "p",
        "Hay más tutores territoriales de los mostrados."
      )
    );
  }
}


// ======================================================
// RESOLVER
// ======================================================

export async function resolveDoorTutor({
  residenceMunicipalityId,
  inviterRef
} = {}) {

  const panel =
    ensureTutorPanel();


  if (!panel) {
    return;
  }


  panel.hidden =
    false;


  $("doorTutorResults")
    ?.replaceChildren();


  selectedTutorRef =
    null;


  if (
    !auth.currentUser
  ) {

    setStatus(
      "Inicia sesión para resolver el tutor territorial."
    );

    return;
  }


  if (
    !residenceMunicipalityId ||
    !inviterRef
  ) {

    setStatus(
      "Primero confirma el municipio y quién invitó a la persona."
    );

    return;
  }


  if (busy) {
    return;
  }


  busy =
    true;


  setStatus(
    "Resolviendo tutor territorial…"
  );


  const uid =
    auth.currentUser.uid;


  try {

    const {
      data
    } =
      await getDoorTutorCandidates({
        residenceMunicipalityId,
        inviterRef
      });


    if (
      auth.currentUser?.uid !==
        uid
    ) {
      return;
    }


    renderTutorCandidates(
      data
    );


  } catch (error) {

    setStatus(
      error.message ||
      "No fue posible resolver el tutor territorial."
    );

  } finally {

    busy =
      false;
  }
}


// ======================================================
// RESET
// ======================================================

export function resetDoorTutor() {

  selectedTutorRef =
    null;


  const panel =
    $("doorTutorPanel");


  if (!panel) {
    return;
  }


  panel.hidden =
    true;


  $("doorTutorResults")
    ?.replaceChildren();


  setStatus(
    ""
  );
}
