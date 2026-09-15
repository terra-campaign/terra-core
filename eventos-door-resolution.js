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


const getDoorRegistrationContext =
  httpsCallable(
    functions,
    "getDoorRegistrationContext"
  );


const searchDoorInviterCandidates =
  httpsCallable(
    functions,
    "searchDoorInviterCandidates"
  );


const $ =
  id =>
    document.getElementById(id);


let doorContext =
  null;

let doorContextUid =
  null;

let busy =
  false;

let selectedInviterRef =
  null;


// ======================================================
// UTILIDADES DOM
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
  id,
  text
) {

  const target =
    $(id);


  if (target) {
    target.textContent =
      text || "";
  }
}


// ======================================================
// CONSTRUIR PANEL
// ======================================================

function ensureDoorPanel() {

  const existing =
    $("doorResolutionPanel");


  if (existing) {
    return existing;
  }


  const identityResults =
    $("attendanceIdentityResults");


  if (!identityResults) {
    return null;
  }


  const panel =
    element("div");


  panel.id =
    "doorResolutionPanel";

  panel.className =
    "event-form-card";

  panel.hidden =
    true;


  const title =
    element(
      "h4",
      "Persona no encontrada · resolver origen"
    );


  const explanation =
    element(
      "p",
      "Pregunta dónde vive y quién la invitó. La recepción no debe escoger una estructura por conveniencia."
    );


  explanation.className =
    "message";


  const municipalityLabel =
    element(
      "label",
      "Municipio donde vive"
    );


  municipalityLabel.htmlFor =
    "doorResidenceMunicipality";


  const municipality =
    element(
      "select"
    );


  municipality.id =
    "doorResidenceMunicipality";

  municipality.className =
    "attendance-search";


  const jurisdictionStatus =
    element(
      "p"
    );


  jurisdictionStatus.id =
    "doorResolutionStatus";

  jurisdictionStatus.className =
    "message";

  jurisdictionStatus.setAttribute(
    "role",
    "status"
  );


  // ==================================================
  // INVITADOR
  // ==================================================

  const inviterSection =
    element(
      "div"
    );


  inviterSection.id =
    "doorInviterSection";

  inviterSection.hidden =
    true;


  const inviterForm =
    element(
      "form"
    );


  inviterForm.id =
    "doorInviterSearchForm";


  const inviterLabel =
    element(
      "label",
      "¿Quién te invitó o con quién vienes?"
    );


  inviterLabel.htmlFor =
    "doorInviterName";


  const inviterInput =
    element(
      "input"
    );


  inviterInput.id =
    "doorInviterName";

  inviterInput.className =
    "attendance-search";

  inviterInput.type =
    "text";

  inviterInput.autocomplete =
    "off";

  inviterInput.placeholder =
    "Escribe el nombre";


  const actions =
    element(
      "div"
    );


  actions.className =
    "event-actions";


  const searchButton =
    element(
      "button",
      "Buscar quién lo invitó"
    );


  searchButton.id =
    "doorInviterSearchButton";

  searchButton.className =
    "button";

  searchButton.type =
    "submit";


  const noInviterButton =
    element(
      "button",
      "Llegó por su cuenta / no sabe"
    );


  noInviterButton.id =
    "doorNoInviterButton";

  noInviterButton.className =
    "button button--secondary";

  noInviterButton.type =
    "button";


  actions.append(
    searchButton,
    noInviterButton
  );


  inviterForm.append(
    inviterLabel,
    inviterInput,
    actions
  );


  const inviterStatus =
    element(
      "p"
    );


  inviterStatus.id =
    "doorInviterStatus";

  inviterStatus.className =
    "message";

  inviterStatus.setAttribute(
    "role",
    "status"
  );


  const inviterResults =
    element(
      "div"
    );


  inviterResults.id =
    "doorInviterResults";

  inviterResults.className =
    "attendance-person-list";


  inviterSection.append(
    inviterForm,
    inviterStatus,
    inviterResults
  );


  panel.append(
    title,
    explanation,
    municipalityLabel,
    municipality,
    jurisdictionStatus,
    inviterSection
  );


  identityResults.insertAdjacentElement(
    "afterend",
    panel
  );


  municipality.addEventListener(
    "change",
    handleMunicipalityChange
  );


  inviterForm.addEventListener(
    "submit",
    event => {

      event.preventDefault();

      searchInviter();
    }
  );


  noInviterButton.addEventListener(
    "click",
    markNoInviter
  );


  return panel;
}


// ======================================================
// MUNICIPIOS
// ======================================================

function renderMunicipalities() {

  const select =
    $("doorResidenceMunicipality");


  if (
    !select ||
    !doorContext
  ) {
    return;
  }


  select.replaceChildren();


  const placeholder =
    element(
      "option",
      "Selecciona el municipio donde vive"
    );


  placeholder.value =
    "";


  select.append(
    placeholder
  );


  const municipalities =
    Array.isArray(
      doorContext.municipalities
    )
      ? doorContext.municipalities
      : [];


  for (
    const municipality of
    municipalities
  ) {

    if (!municipality?.id) {
      continue;
    }


    const option =
      element(
        "option",
        municipality.name ||
        municipality.id
      );


    option.value =
      municipality.id;


    select.append(
      option
    );
  }
}


// ======================================================
// MOSTRAR PANEL
// ======================================================

export async function showDoorResolution() {

  const panel =
    ensureDoorPanel();


  if (!panel) {
    return;
  }


  panel.hidden =
    false;


  const uid =
    auth.currentUser?.uid;


  if (!uid) {

    setStatus(
      "doorResolutionStatus",
      "Inicia sesión para resolver el origen territorial."
    );

    return;
  }


  if (
    doorContext &&
    doorContextUid === uid
  ) {

    renderMunicipalities();


    setStatus(
      "doorResolutionStatus",
      `Recepción territorial: ${
        doorContext.receiver
          ?.municipalityName ||
        "municipio asignado"
      }. Pregunta a la persona dónde vive.`
    );

    return;
  }


  if (busy) {
    return;
  }


  busy =
    true;


  setStatus(
    "doorResolutionStatus",
    "Consultando jurisdicción territorial…"
  );


  try {

    const {
      data
    } =
      await getDoorRegistrationContext(
        {}
      );


    if (
      auth.currentUser?.uid !==
        uid
    ) {
      return;
    }


    doorContext =
      data;

    doorContextUid =
      uid;


    renderMunicipalities();


    if (
      !data?.canResolveOwnMunicipality
    ) {

      setStatus(
        "doorResolutionStatus",
        "Tu perfil no tiene un municipio territorial asignado. No puedes incorporar personas desde esta recepción."
      );

      return;
    }


    setStatus(
      "doorResolutionStatus",
      `Recepción territorial: ${
        data.receiver
          ?.municipalityName ||
        "municipio asignado"
      }. Pregunta a la persona dónde vive.`
    );


  } catch (error) {

    setStatus(
      "doorResolutionStatus",
      error.message ||
      "No fue posible consultar la jurisdicción territorial."
    );

  } finally {

    busy =
      false;
  }
}


// ======================================================
// CAMBIO DE MUNICIPIO
// ======================================================

function handleMunicipalityChange() {

  selectedInviterRef =
    null;


  $("doorInviterResults")
    ?.replaceChildren();


  setStatus(
    "doorInviterStatus",
    ""
  );


  const inviterInput =
    $("doorInviterName");


  if (inviterInput) {
    inviterInput.value =
      "";
  }


  const inviterSection =
    $("doorInviterSection");


  if (inviterSection) {
    inviterSection.hidden =
      true;
  }


  const residenceMunicipalityId =
    $("doorResidenceMunicipality")
      ?.value ||
    "";


  if (!residenceMunicipalityId) {

    setStatus(
      "doorResolutionStatus",
      "Selecciona el municipio donde vive la persona."
    );

    return;
  }


  const receiver =
    doorContext?.receiver ||
    {};


  const residence =
    (
      doorContext?.municipalities ||
      []
    )
      .find(
        municipality =>
          municipality.id ===
            residenceMunicipalityId
      );


  const residenceName =
    residence?.name ||
    "el municipio seleccionado";


  if (
    residenceMunicipalityId !==
      receiver.municipalityId
  ) {

    setStatus(
      "doorResolutionStatus",
      `La persona vive en ${residenceName}. No debe incorporarse a una estructura de ${
        receiver.municipalityName ||
        "este municipio"
      }. Debe canalizarse al municipio correspondiente.`
    );

    return;
  }


  setStatus(
    "doorResolutionStatus",
    `La persona pertenece a ${
      receiver.municipalityName ||
      residenceName
    }. Ahora pregúntale quién la invitó o con quién viene.`
  );


  if (inviterSection) {
    inviterSection.hidden =
      false;
  }
}


// ======================================================
// RESULTADOS DE INVITADOR
// ======================================================

function renderInviterCandidates(
  data
) {

  const results =
    $("doorInviterResults");


  if (!results) {
    return;
  }


  results.replaceChildren();


  if (
    data?.canRegisterHere === false
  ) {

    $("doorInviterSection").hidden =
      true;


    setStatus(
      "doorResolutionStatus",
      data.message ||
      "La persona pertenece a otro municipio."
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
      "doorInviterStatus",
      "No encontramos a esa persona dentro de este municipio. Revisa el nombre o marca «Llegó por su cuenta / no sabe»."
    );

    return;
  }


  const total =
    Number(
      data.totalCandidates
    ) ||
    candidates.length;


  setStatus(
    "doorInviterStatus",
    `${total} posible${
      total === 1 ? "" : "s"
    } referencia${
      total === 1 ? "" : "s"
    }. Confirma con el asistente antes de seleccionar.`
  );


  for (
    const candidate of
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
        candidate.name ||
        "Sin nombre"
      )
    );


    card.append(
      element(
        "p",
        `Nivel: ${
          candidate.roleLabel ||
          candidate.role ||
          "Sin nivel"
        }`
      )
    );


    if (
      candidate.locality
    ) {

      card.append(
        element(
          "p",
          `Población: ${
            candidate.locality
          }`
        )
      );
    }


    card.append(
      element(
        "p",
        `Estructura: ${
          candidate.structureName ||
          "Por resolver"
        }`
      )
    );


    const choose =
      element(
        "button",
        "Seleccionar como referencia"
      );


    choose.type =
      "button";

    choose.className =
      "button button--secondary";


    choose.addEventListener(
      "click",
      () => {

        selectedInviterRef =
          candidate.inviterRef ||
          null;


        setStatus(
          "doorInviterStatus",
          `Referencia confirmada: ${
            candidate.name ||
            "Sin nombre"
          }. Estructura: ${
            candidate.structureName ||
            "por resolver"
          }. El siguiente paso será resolver su tutor.`
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
        "Hay más resultados. Escribe un nombre más específico."
      )
    );
  }
}


// ======================================================
// BUSCAR INVITADOR
// ======================================================

async function searchInviter() {

  if (
    busy ||
    !auth.currentUser
  ) {
    return;
  }


  const residenceMunicipalityId =
    $("doorResidenceMunicipality")
      ?.value ||
    "";


  const inviterName =
    $("doorInviterName")
      ?.value
      .trim() ||
    "";


  if (!residenceMunicipalityId) {

    setStatus(
      "doorInviterStatus",
      "Primero selecciona el municipio donde vive."
    );

    return;
  }


  if (
    inviterName.length < 4
  ) {

    setStatus(
      "doorInviterStatus",
      "Escribe al menos 4 caracteres del nombre de quien la invitó."
    );

    return;
  }


  busy =
    true;

  selectedInviterRef =
    null;


  const searchButton =
    $("doorInviterSearchButton");

  const noInviterButton =
    $("doorNoInviterButton");


  if (searchButton) {
    searchButton.disabled =
      true;
  }


  if (noInviterButton) {
    noInviterButton.disabled =
      true;
  }


  $("doorInviterResults")
    ?.replaceChildren();


  setStatus(
    "doorInviterStatus",
    "Buscando referencia territorial…"
  );


  const uid =
    auth.currentUser.uid;


  try {

    const {
      data
    } =
      await searchDoorInviterCandidates({
        residenceMunicipalityId,
        inviterName
      });


    if (
      auth.currentUser?.uid !==
        uid
    ) {
      return;
    }


    renderInviterCandidates(
      data
    );


  } catch (error) {

    setStatus(
      "doorInviterStatus",
      error.message ||
      "No fue posible buscar a quien invitó a la persona."
    );

  } finally {

    busy =
      false;


    if (searchButton) {
      searchButton.disabled =
        false;
    }


    if (noInviterButton) {
      noInviterButton.disabled =
        false;
    }
  }
}


// ======================================================
// SIN INVITADOR
// ======================================================

function markNoInviter() {

  selectedInviterRef =
    null;


  $("doorInviterResults")
    ?.replaceChildren();


  const input =
    $("doorInviterName");


  if (input) {
    input.value =
      "";
  }


  setStatus(
    "doorInviterStatus",
    "La persona llegó por su cuenta o no sabe quién la invitó. No se asignará una estructura desde puerta; deberá resolverse territorialmente de forma neutral."
  );
}


// ======================================================
// LIMPIAR
// ======================================================

export function resetDoorResolution(
  clearInputs = true
) {

  selectedInviterRef =
    null;


  const panel =
    $("doorResolutionPanel");


  if (!panel) {
    return;
  }


  panel.hidden =
    true;


  $("doorInviterResults")
    ?.replaceChildren();


  setStatus(
    "doorResolutionStatus",
    ""
  );


  setStatus(
    "doorInviterStatus",
    ""
  );


  const inviterSection =
    $("doorInviterSection");


  if (inviterSection) {
    inviterSection.hidden =
      true;
  }


  if (clearInputs) {

    const municipality =
      $("doorResidenceMunicipality");

    const inviter =
      $("doorInviterName");


    if (municipality) {
      municipality.value =
        "";
    }


    if (inviter) {
      inviter.value =
        "";
    }
  }
}
