import {
  auth
} from "./firebase-config.js";


import {
  createTerraWhatsAppCommunication
} from "./terra-whatsapp.js?v=build-118a-3b-002";


import {
  applyTerraUpdateFeedback,
  clearTerraUpdateFeedback
} from "./terra-feedback.js?v=build-118c-3b3e-3g-a4";


import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";


import {
  getFunctions,
  httpsCallable
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js";


const functions =
  getFunctions(
    auth.app,
    "us-central1"
  );


const getEventWorkspace =
  httpsCallable(
    functions,
    "getEventWorkspace"
  );


const createEventInvitations =
  httpsCallable(
    functions,
    "createEventInvitations"
  );


const createGeneralEvent =
  httpsCallable(
    functions,
    "createGeneralEvent"
  );


const resolveGeneralEventScope =
  httpsCallable(
    functions,
    "resolveGeneralEventScope"
  );




const respondToEventInvitation =
  httpsCallable(
    functions,
    "respondToEventInvitation"
  );



const getMyEventTransportNeed =
  httpsCallable(
    functions,
    "getMyEventTransportNeed"
  );


const setMyEventTransportNeed =
  httpsCallable(
    functions,
    "setMyEventTransportNeed"
  );



// ======================================================
// BUILD-118C-3B3E-3G-B4B
// WORKSPACE VISUAL DE TRANSPORTE
// ======================================================

const createEventTransportVehicle =
  httpsCallable(
    functions,
    "createEventTransportVehicle"
  );


const configureEventTransportSeatLayout =
  httpsCallable(
    functions,
    "configureEventTransportSeatLayout"
  );


const createEventTransportAllocation =
  httpsCallable(
    functions,
    "createEventTransportAllocation"
  );


const getEventTransportAllocationTargets =
  httpsCallable(
    functions,
    "getEventTransportAllocationTargets"
  );



const getEventTransportPassengerCandidates =
  httpsCallable(
    functions,
    "getEventTransportPassengerCandidates"
  );


const createEventTransportPassengerAssignment =
  httpsCallable(
    functions,
    "createEventTransportPassengerAssignment"
  );


const confirmEventTransportPassengerAssignment =
  httpsCallable(
    functions,
    "confirmEventTransportPassengerAssignment"
  );


const recordEventTransportPassengerBoarding =
  httpsCallable(
    functions,
    "recordEventTransportPassengerBoarding"
  );


const getEventTransportWorkspace =
  httpsCallable(
    functions,
    "getEventTransportWorkspace"
  );


const reportEventIncident =
  httpsCallable(
    functions,
    "reportEventIncident"
  );



const getEventAttendanceWorkspace =
  httpsCallable(
    functions,
    "getEventAttendanceWorkspace"
  );


const recordEventAttendance =
  httpsCallable(
    functions,
    "recordEventAttendance"
  );



const recordDoorEventAttendance =
  httpsCallable(
    functions,
    "recordDoorEventAttendance"
  );



const searchPersonCandidates =
  httpsCallable(
    functions,
    "searchPersonCandidates"
  );


const $ =
  id =>
    document.getElementById(id);


const EVENT_RESPONSE_LABELS = {
  pending:
    "Pendiente",

  attending:
    "Asistir\u00e9",

  not_attending:
    "No puedo asistir"};


const EVENT_RESPONSE_OPTIONS = [
  {
    status: "attending",
    label: "Asistir\u00e9"
  },
  {
    status: "not_attending",
    label: "No puedo asistir"
  }];



const EVENT_INCIDENT_REASONS = [
  {
    value: "transport",
    label: "Transporte"
  },
  {
    value: "health",
    label: "Salud"
  },
  {
    value: "family",
    label: "Familia"
  },
  {
    value: "work",
    label: "Trabajo"
  },
  {
    value: "other",
    label: "Otro"
  }
];


function eventIncidentReasonLabel(
  value
) {

  return (
    EVENT_INCIDENT_REASONS.find(
      option =>
        option.value === value
    )?.label ||
    "Otro"
  );
}


const ROLE_LABELS = {
  admin:
    "Administrador",

  lider_principal:
    "Líder principal",

  coordinador_municipal:
    "Responsable de organización",

  jefe_estructura:
    "Responsable de estructura",

  integrante:
    "Integrante",

  participante:
    "Participante",

  colaborador_base:
    "Colaborador de base"
};


let workspace = null;
let generation = 0;
let createAttempt = null;
let delegateAttempt = null;
let selectedInvitationId = null;
let busy = false;

let attendanceWorkspace = null;
let selectedAttendanceEventId = null;
let attendanceBusy = false;



let transportWorkspace = null;
let selectedTransportEventId = null;
let transportBusy = false;

let transportVehicleBusy = false;
let transportVehicleAttempt = null;

let transportSeatLayoutBusy = false;
let transportSeatLayoutVehicleId = null;
let transportSeatLayoutAttempt = null;

let transportAllocationTargets = [];
let transportAllocationTargetsEventId = null;
let transportAllocationTargetsBusy = false;
let transportAllocationTargetsError = "";

let transportAllocationBusy = false;
let transportAllocationVehicleId = null;
let transportAllocationAttempt = null;


let transportPassengerCandidatesByAllocation =
  new Map();

let transportPassengerBusy =
  false;

let transportPassengerAllocationId =
  null;

let transportPassengerAttempt =
  null;


let transportPassengerActionBusy =
  false;

let transportPassengerActionAssignmentId =
  null;

let transportPassengerActionType =
  "";

let transportPassengerActionAttempt =
  null;

let transportPassengerActionMessages =
  new Map();



let attendanceIdentitySearchBusy =
  false;



let doorAttendanceBusy =
  false;


const requestedInvitationId =
  new URLSearchParams(
    window.location.search
  ).get("invitation");


const validRequestedInvitationId =
  typeof requestedInvitationId === "string" &&
  /^[A-Za-z0-9_-]{1,128}$/.test(
    requestedInvitationId
  );


let requestedInvitationFocused =
  false;


// ======================================================
// UTILIDADES
// ======================================================

function node(
  tag,
  text = ""
) {

  const element =
    document.createElement(tag);

  element.textContent =
    text;

  return element;
}


function eventResponseLabel(
  status
) {

  return EVENT_RESPONSE_LABELS[
    status
  ] ||
    EVENT_RESPONSE_LABELS.pending;
}


function canChangeEventResponse(
  event
) {

  if (
    !event ||
    event.active !== true
  ) {
    return false;
  }


  const closesAt =
    Number.isFinite(
      event.confirmationClosesAtMillis
    )
      ? event.confirmationClosesAtMillis
      : (
          Date.parse(
            event.startsAt || ""
          ) -
          60 * 60 * 1000
        );


  return (
    Number.isFinite(
      closesAt
    ) &&
    closesAt >
      Date.now()
  );
}


async function saveEventResponse(
  invitation,
  event,
  status,
  message,
  buttons
) {

  if (
    !invitation?.id ||
    !EVENT_RESPONSE_LABELS[
      status
    ] ||
    status === "pending"
  ) {
    return;
  }


  if (
    !canChangeEventResponse(
      event
    )
  ) {

    message.textContent =
      "El cierre de confirmaciones ya ocurrió. La respuesta normal ya no puede modificarse.";


    await reload();

    return;
  }


  buttons.forEach(
    button => {
      button.disabled = true;
    }
  );


  message.textContent =
    "Guardando respuesta...";


  try {

    await respondToEventInvitation({
      invitationId:
        invitation.id,

      status
    });


    message.textContent =
      "Respuesta guardada.";


    await reload();

  } catch (error) {

    message.textContent =
      error.message ||
      "No fue posible guardar la respuesta.";


    buttons.forEach(
      button => {
        button.disabled = false;
      }
    );
  }
}


// ======================================================
// BUILD-118C-3B3E-3G-A2
// NECESIDAD DE TRANSPORTE — AUTOGESTION DIGITAL
// ======================================================

function createEventTransportPanel(
  invitation
) {

  const panel =
    node("div");


  panel.className =
    "event-transport-panel";


  panel.style.cssText =
    [
      "margin-top:14px",
      "padding:14px",
      "border:1px solid #d7dee8",
      "border-radius:12px",
      "background:#f8fafc"
    ].join(";");


  const heading =
    node(
      "p",
      "¿Necesitas transporte?"
    );


  heading.style.cssText =
    "font-weight:700;margin:0 0 8px";


  const status =
    node(
      "p",
      "Consultando transporte..."
    );


  status.className =
    "event-meta";


  status.style.margin =
    "0 0 10px";


  const actions =
    node("div");


  actions.style.cssText =
    "display:flex;flex-wrap:wrap;gap:8px";


  const yesButton =
    node(
      "button",
      "Sí, necesito transporte"
    );


  yesButton.type =
    "button";


  const noButton =
    node(
      "button",
      "No necesito transporte"
    );


  noButton.type =
    "button";


  const buttons = [
    yesButton,
    noButton
  ];


  function setBusy(value) {

    buttons.forEach(
      button => {
        button.disabled =
          value;
      }
    );
  }


  function renderState(
    data,
    emphasize = false
  ) {

    const eligible =
      data?.eligible === true;


    const request =
      data?.request ||
      null;


    if (!eligible) {

      status.textContent =
        "La necesidad de transporte no está disponible para esta invitación.";


      applyTerraUpdateFeedback(
        status,
        "warning",
        emphasize
      );


      yesButton.className =
        "button button--secondary";

      noButton.className =
        "button button--secondary";

      setBusy(true);

      return;
    }


    if (!request) {

      status.textContent =
        "Aún no has indicado si necesitas transporte.";


      clearTerraUpdateFeedback(
        status
      );


      yesButton.className =
        "button button--secondary";

      noButton.className =
        "button button--secondary";

      setBusy(false);

      return;
    }


    if (
      request.needsTransport ===
      true
    ) {

      status.textContent =
        emphasize
          ? "✓ Actualización guardada: necesitas transporte."
          : "Transporte solicitado.";


      applyTerraUpdateFeedback(
        status,
        "success",
        emphasize
      );


      yesButton.className =
        "button";

      noButton.className =
        "button button--secondary";

      yesButton.disabled =
        true;

      noButton.disabled =
        false;

      return;
    }


    status.textContent =
      emphasize
        ? "✓ Actualización guardada: no necesitas transporte."
        : "Has indicado que no necesitas transporte.";


    applyTerraUpdateFeedback(
      status,
      "info",
      emphasize
    );


    yesButton.className =
      "button button--secondary";

    noButton.className =
      "button";

    yesButton.disabled =
      false;

    noButton.disabled =
      true;
  }


  async function loadTransportNeed() {

    try {

      const result =
        await getMyEventTransportNeed({
          invitationId:
            invitation.id
        });


      if (
        !document.body.contains(
          panel
        )
      ) {
        return;
      }


      renderState(
        result.data,
        false
      );

    } catch (error) {

      if (
        !document.body.contains(
          panel
        )
      ) {
        return;
      }


      status.textContent =
        error.message ||
        "No fue posible consultar el transporte.";


      applyTerraUpdateFeedback(
        status,
        "danger",
        false
      );


      setBusy(false);
    }
  }


  async function saveTransportNeed(
    needsTransport
  ) {

    setBusy(true);


    status.textContent =
      "Guardando transporte...";


    applyTerraUpdateFeedback(
      status,
      "warning",
      true
    );


    try {

      await setMyEventTransportNeed({
        invitationId:
          invitation.id,

        needsTransport
      });


      const result =
        await getMyEventTransportNeed({
          invitationId:
            invitation.id
        });


      if (
        !document.body.contains(
          panel
        )
      ) {
        return;
      }


      renderState(
        result.data,
        true
      );

    } catch (error) {

      status.textContent =
        error.message ||
        "No fue posible guardar el transporte.";


      applyTerraUpdateFeedback(
        status,
        "danger",
        true
      );


      setBusy(false);
    }
  }


  yesButton.onclick =
    () =>
      saveTransportNeed(
        true
      );


  noButton.onclick =
    () =>
      saveTransportNeed(
        false
      );


  actions.append(
    yesButton,
    noButton
  );


  panel.append(
    heading,
    status,
    actions
  );


  void loadTransportNeed();


  return panel;
}


function canReportEventIncidentUi(
  invitation,
  event
) {

  if (
    invitation?.incident ||
    invitation?.response?.status !==
      "attending"
  ) {
    return false;
  }


  const closesAtMillis =
    Number.isFinite(
      event?.confirmationClosesAtMillis
    )
      ? event.confirmationClosesAtMillis
      : (
          Date.parse(
            event?.startsAt || ""
          ) -
          60 * 60 * 1000
        );


  const startsAtMillis =
    Date.parse(
      event?.startsAt || ""
    );


  const now =
    Date.now();


  return (
    Number.isFinite(
      closesAtMillis
    ) &&
    Number.isFinite(
      startsAtMillis
    ) &&
    now >= closesAtMillis &&
    now < startsAtMillis
  );
}


function createIncidentSummary(
  incident,
  title = "IMPREVISTO REPORTADO"
) {

  const box =
    node("div");


  box.style.cssText =
    [
      "margin-top:12px",
      "padding:12px",
      "border:1px solid #d7a94a",
      "border-radius:10px",
      "background:#fffaf0"
    ].join(";");


  const heading =
    node(
      "p",
      title
    );


  heading.style.cssText =
    "font-weight:800;margin:0 0 8px";


  box.append(
    heading
  );


  box.append(
    node(
      "p",
      `Motivo: ${
        eventIncidentReasonLabel(
          incident?.reason
        )
      }`
    )
  );


  if (
    incident?.note
  ) {

    box.append(
      node(
        "p",
        `Nota: ${incident.note}`
      )
    );
  }


  if (
    incident?.reportedAt
  ) {

    box.append(
      node(
        "p",
        `Reportado: ${
          formatDate(
            incident.reportedAt
          )
        }`
      )
    );
  }


  box
    .querySelectorAll("p")
    .forEach(
      paragraph => {

        if (
          paragraph !== heading
        ) {
          paragraph.className =
            "event-meta";

          paragraph.style.margin =
            "4px 0";
        }
      }
    );


  return box;
}


async function saveEventIncident(
  invitation,
  reason,
  note,
  message,
  controls
) {

  controls.forEach(
    control => {
      control.disabled = true;
    }
  );


  message.textContent =
    "Registrando imprevisto...";


  try {

    await reportEventIncident({
      invitationId:
        invitation.id,

      reason,

      note
    });


    message.textContent =
      "Imprevisto registrado correctamente.";


    await reload();

  } catch (error) {

    message.textContent =
      error.message ||
      "No fue posible registrar el imprevisto.";


    controls.forEach(
      control => {
        control.disabled = false;
      }
    );
  }
}


function createIncidentReportForm(
  invitation
) {

  const wrapper =
    node("div");


  wrapper.style.cssText =
    [
      "margin-top:12px",
      "padding:12px",
      "border:1px solid #d7dee8",
      "border-radius:10px",
      "background:#ffffff"
    ].join(";");


  const intro =
    node(
      "p",
      "Reporta únicamente un imprevisto ocurrido después del cierre de confirmaciones."
    );


  intro.className =
    "event-meta";


  intro.style.margin =
    "0 0 10px";


  wrapper.append(
    intro
  );


  const reasonLabel =
    node(
      "label"
    );


  reasonLabel.style.cssText =
    "display:block;font-weight:700;margin-bottom:10px";


  const reasonText =
    node(
      "span",
      "Motivo del imprevisto"
    );


  const select =
    document.createElement(
      "select"
    );


  select.style.cssText =
    [
      "display:block",
      "width:100%",
      "margin-top:6px",
      "padding:9px 10px",
      "border:1px solid #8fa8bf",
      "border-radius:7px",
      "background:#fff"
    ].join(";");


  for (
    const optionData of
    EVENT_INCIDENT_REASONS
  ) {

    const option =
      document.createElement(
        "option"
      );


    option.value =
      optionData.value;


    option.textContent =
      optionData.label;


    select.append(
      option
    );
  }


  reasonLabel.append(
    reasonText,
    select
  );


  wrapper.append(
    reasonLabel
  );


  const noteLabel =
    node(
      "label"
    );


  noteLabel.style.cssText =
    "display:block;font-weight:700;margin-bottom:10px";


  noteLabel.append(
    node(
      "span",
      "Nota opcional"
    )
  );


  const textarea =
    document.createElement(
      "textarea"
    );


  textarea.maxLength =
    300;


  textarea.rows =
    3;


  textarea.placeholder =
    "Describe brevemente el imprevisto";


  textarea.style.cssText =
    [
      "display:block",
      "width:100%",
      "box-sizing:border-box",
      "margin-top:6px",
      "padding:9px 10px",
      "border:1px solid #8fa8bf",
      "border-radius:7px",
      "background:#fff",
      "resize:vertical"
    ].join(";");


  noteLabel.append(
    textarea
  );


  wrapper.append(
    noteLabel
  );


  const message =
    node("p");


  message.className =
    "event-meta";


  message.style.margin =
    "8px 0";


  wrapper.append(
    message
  );


  const actions =
    node("div");


  actions.style.cssText =
    "display:flex;flex-wrap:wrap;gap:8px";


  const confirmButton =
    node(
      "button",
      "Confirmar imprevisto"
    );


  confirmButton.type =
    "button";


  confirmButton.className =
    "button";


  const cancelButton =
    node(
      "button",
      "Cancelar"
    );


  cancelButton.type =
    "button";


  cancelButton.className =
    "button button--secondary";


  confirmButton.onclick =
    () => {

      saveEventIncident(
        invitation,
        select.value,
        textarea.value.trim(),
        message,
        [
          confirmButton,
          cancelButton,
          select,
          textarea
        ]
      );
    };


  cancelButton.onclick =
    () => {
      wrapper.remove();
    };


  actions.append(
    confirmButton,
    cancelButton
  );


  wrapper.append(
    actions
  );


  return wrapper;
}


function createEventResponsePanel(
  invitation,
  event
) {

  const panel =
    node("div");


  panel.className =
    "event-response-panel";


  panel.style.cssText =
    [
      "margin-top:14px",
      "padding:14px",
      "border:1px solid #d7dee8",
      "border-radius:12px",
      "background:#f8fafc"
    ].join(";");


  const currentStatus =
    invitation.response?.status ||
    "pending";


  const heading =
    node(
      "p",
      `Tu respuesta: ${
        eventResponseLabel(
          currentStatus
        )
      }`
    );


  heading.style.cssText =
    "font-weight:700;margin:0 0 10px";


  panel.append(
    heading
  );


  const canChange =
    canChangeEventResponse(
      event
    );


  const confirmationClosesAt =
    event.confirmationClosesAt ||
    (
      Number.isFinite(
        event.confirmationClosesAtMillis
      )
        ? new Date(
            event.confirmationClosesAtMillis
          ).toISOString()
        : ""
    );


  const message =
    node(
      "p",
      canChange
        ? `Puedes cambiar tu respuesta hasta ${formatDate(
            confirmationClosesAt
          )}. Después de esa hora, tu confirmación quedará cerrada.`
        : `El cierre de confirmaciones fue ${formatDate(
            confirmationClosesAt
          )}. La respuesta normal ya no puede modificarse.`
    );


  message.className =
    "event-meta";


  message.style.margin =
    "0 0 10px";


  panel.append(
    message
  );


  if (!canChange) {

    if (
      invitation.incident
    ) {

      panel.append(
        createIncidentSummary(
          invitation.incident
        )
      );


      return panel;
    }


    if (
      canReportEventIncidentUi(
        invitation,
        event
      )
    ) {

      const commitment =
        node(
          "p",
          "Tu compromiso quedó confirmado. Si ocurrió un imprevisto posterior al cierre, puedes registrarlo aquí."
        );


      commitment.className =
        "event-meta";


      commitment.style.margin =
        "0 0 10px";


      panel.append(
        commitment
      );


      const button =
        node(
          "button",
          "Reportar imprevisto"
        );


      button.type =
        "button";


      button.className =
        "button button--secondary";


      button.onclick =
        () => {

          if (
            panel.querySelector(
              ".event-incident-form"
            )
          ) {
            return;
          }


          const form =
            createIncidentReportForm(
              invitation
            );


          form.classList.add(
            "event-incident-form"
          );


          panel.append(
            form
          );
        };


      panel.append(
        button
      );
    }


    return panel;
  }


  const actions =
    node("div");


  actions.style.cssText =
    "display:flex;flex-wrap:wrap;gap:8px";


  const buttons = [];


  for (
    const option of
    EVENT_RESPONSE_OPTIONS
  ) {

    const selected =
      option.status ===
      currentStatus;


    const button =
      node(
        "button",
        selected
          ? `\u2713 ${option.label}`
          : option.label
      );


    button.type =
      "button";


    button.className =
      selected
        ? "button"
        : "button button--secondary";


    button.disabled =
      selected;


    button.onclick =
      () =>
        saveEventResponse(
          invitation,
          event,
          option.status,
          message,
          buttons
        );


    buttons.push(
      button
    );


    actions.append(
      button
    );
  }


  panel.append(
    actions
  );


  const closesAtMillis =
    Number.isFinite(
      event.confirmationClosesAtMillis
    )
      ? event.confirmationClosesAtMillis
      : (
          Date.parse(
            event.startsAt || ""
          ) -
          60 * 60 * 1000
        );


  const remainingMillis =
    closesAtMillis -
    Date.now();


  if (
    remainingMillis > 0 &&
    remainingMillis <=
      2147483647
  ) {

    window.setTimeout(
      () => {

        if (
          auth.currentUser &&
          document.body.contains(
            panel
          )
        ) {
          reload();
        }
      },

      remainingMillis + 1000
    );
  }


  return panel;
}


function createdInvitationResponseView(
  invitation
) {

  const status =
    invitation.response?.status ||
    "pending";


  const wrapper =
    node("div");


  const paragraph =
    node(
      "p",
      `Respuesta de ${
        invitation.assignedToName ||
        "destinatario"
      }: ${
        eventResponseLabel(
          status
        )
      }`
    );


  paragraph.className =
    "event-meta";


  paragraph.style.fontWeight =
    "700";


  wrapper.append(
    paragraph
  );


  if (
    invitation.incident
  ) {

    wrapper.append(
      createIncidentSummary(
        invitation.incident,
        `Imprevisto reportado por ${
          invitation.assignedToName ||
          "destinatario"
        }`
      )
    );
  }


  return wrapper;
}


function eventById(
  eventId
) {

  return workspace?.events?.find(
    event =>
      event.id === eventId
  ) || null;
}


function eventState(
  event
) {

  if (!event?.active) {
    return {
      code:
        "inactive",

      label:
        "Inactivo"
    };
  }


  const time =
    Date.parse(
      event.startsAt
    );


  if (
    Number.isFinite(time) &&
    time <= Date.now()
  ) {
    return {
      code:
        "past",

      label:
        "Iniciado / concluido"
    };
  }


  return {
    code:
      "future",

    label:
      "Próximo"
  };
}


function formatDate(
  value
) {

  const date =
    new Date(value);


  if (
    !Number.isFinite(
      date.getTime()
    )
  ) {
    return "Sin fecha válida";
  }


  return date.toLocaleString(
    "es-MX",
    {
      dateStyle:
        "medium",

      timeStyle:
        "short"
    }
  );
}


function canDelegateInvitation(
  invitation
) {

  if (
    !workspace?.assignableRole ||
    invitation?.active !== true
  ) {
    return false;
  }


  const event =
    eventById(
      invitation.eventId
    );


  if (!event?.active) {
    return false;
  }


  const starts =
    Date.parse(
      event.startsAt
    );


  return (
    Number.isFinite(starts) &&
    starts > Date.now()
  );
}


// ======================================================
// PERSONAS DISPONIBLES
// ======================================================

function assigneeOption(
  person,
  className
) {

  const label =
    node(
      "label"
    );


  label.className =
    "event-assignee-option";


  const checkbox =
    document.createElement(
      "input"
    );


  checkbox.type =
    "checkbox";

  checkbox.value =
    person.uid;

  checkbox.className =
    className;


  const info =
    node(
      "span"
    );


  const name =
    node(
      "strong",
      person.name
    );


  const detail =
    node(
      "small",
      [
        ROLE_LABELS[
          person.role
        ] || person.role,

        person.municipalityName ||
          person.municipalityId,

        person.structureName ||
          person.structureId
      ]
        .filter(Boolean)
        .join(" · ")
    );


  info.append(
    name,
    document.createElement("br"),
    detail
  );


  label.append(
    checkbox,
    info
  );


  return label;
}


function renderAssignees() {

  const list =
    $("assigneeList");


  list.replaceChildren();


  for (
    const person of
    workspace.assignees
  ) {

    list.append(
      assigneeOption(
        person,
        "event-assignee-checkbox"
      )
    );
  }


  if (
    !workspace.assignees.length
  ) {

    list.append(
      node(
        "p",
        "No hay personas activas disponibles en tu nivel inmediato."
      )
    );
  }


  $("selectAllAssignees").checked =
    false;
}


function renderDelegateAssignees() {

  const list =
    $("delegateAssigneeList");


  list.replaceChildren();


  for (
    const person of
    workspace.assignees
  ) {

    list.append(
      assigneeOption(
        person,
        "delegate-assignee-checkbox"
      )
    );
  }


  if (
    !workspace.assignees.length
  ) {

    list.append(
      node(
        "p",
        "No hay personas disponibles para delegar este evento."
      )
    );
  }


  const selectAll =
    $("delegateSelectAllAssignees");


  if (selectAll) {
    selectAll.checked = false;
    selectAll.indeterminate = false;
    selectAll.disabled =
      !workspace.assignees.length;
  }
}


function syncDelegateSelectAll() {

  const master =
    $("delegateSelectAllAssignees");


  if (!master) {
    return;
  }


  const checkboxes =
    [
      ...document.querySelectorAll(
        ".delegate-assignee-checkbox"
      )
    ];


  const checked =
    checkboxes.filter(
      checkbox =>
        checkbox.checked
    ).length;


  master.checked =
    checkboxes.length > 0 &&
    checked === checkboxes.length;


  master.indeterminate =
    checked > 0 &&
    checked < checkboxes.length;
}


// ======================================================
// COMUNICACIÓN DE EVENTO
// ======================================================

function eventInvitationLoginUrl(
  invitation
) {

  const url =
    new URL(
      "./login.html",
      window.location.href
    );


  url.searchParams.set(
    "eventInvitation",
    invitation.id
  );


  return url.toString();
}


function eventWhatsAppMessage(
  invitation,
  event
) {

  return [
    "TERRA CAMPAIGN · Nuevo evento",
    "",
    `Hola, ${
      invitation.assignedToName ||
      "participante"
    }.`,
    "",
    "Tienes un nuevo evento asignado:",
    "",
    event.title ||
      "Evento sin título",
    "",
    `Fecha y hora: ${
      formatDate(event.startsAt)
    }`,
    `Lugar: ${
      event.venue ||
      "Sin especificar"
    }`,
    `Localidad: ${
      event.locality ||
      "Sin especificar"
    }`,
    "",
    "Consulta los detalles del evento en TERRA:",
    eventInvitationLoginUrl(
      invitation
    ),
    "",
    "Este aviso fue preparado por TERRA Campaign."
  ].join("\n");
}


// ======================================================
// TARJETAS
// ======================================================

function createEventCard(
  invitation,
  mode
) {

  const event =
    eventById(
      invitation.eventId
    );


  const card =
    node(
      "article"
    );


  card.className =
    "event-card";


  if (invitation.id) {
    card.dataset.invitationId =
      invitation.id;
  }


  if (
    mode === "received" &&
    validRequestedInvitationId &&
    invitation.id ===
      requestedInvitationId &&
    !requestedInvitationFocused
  ) {

    requestedInvitationFocused =
      true;

    card.style.outline =
      "3px solid #2563eb";

    card.style.outlineOffset =
      "3px";


    setTimeout(
      () =>
        card.scrollIntoView({
          behavior: "smooth",
          block: "center"
        }),
      120
    );
  }


  if (!event) {

    card.append(
      node(
        "p",
        "El evento relacionado no está disponible."
      )
    );

    return card;
  }


  const state =
    eventState(
      event
    );


  const heading =
    node(
      "h3",
      event.title ||
        "Evento sin título"
    );


  const description =
    node(
      "p",
      event.description ||
        "Sin descripción."
    );


  const venue =
    node(
      "p",
      `Lugar: ${
        event.venue ||
        "Sin especificar"
      }`
    );


  venue.className =
    "event-meta";


  const locality =
    node(
      "p",
      `Localidad: ${
        event.locality ||
        "Sin especificar"
      }`
    );


  locality.className =
    "event-meta";


  const date =
    node(
      "p",
      `Fecha y hora: ${
        formatDate(
          event.startsAt
        )
      }`
    );


  date.className =
    "event-meta";


  const confirmationDeadline =
    node(
      "p",
      `Cierre de confirmaciones: ${
        formatDate(
          event.confirmationClosesAt ||
          (
            Number.isFinite(
              event.confirmationClosesAtMillis
            )
              ? new Date(
                  event.confirmationClosesAtMillis
                ).toISOString()
              : ""
          )
        )
      }`
    );


  confirmationDeadline.className =
    "event-meta";


  const status =
    node(
      "p",
      `Estado: ${state.label}`
    );


  status.className =
    `event-status event-status--${state.code}`;


  card.append(
    heading,
    description,
    venue,
    locality,
    date,
    confirmationDeadline,
    status
  );


  if (
    mode === "received"
  ) {

    card.append(
      node(
        "p",
        `Asignado por: ${
          invitation.createdByName ||
          "Sin nombre"
        }`
      )
    );

    card.append(
      createEventResponsePanel(
        invitation,
        event
      )
    );


    if (
      invitation.response?.status ===
      "attending"
    ) {

      card.append(
        createEventTransportPanel(
          invitation
        )
      );
    }




    if (
      canDelegateInvitation(
        invitation
      ) &&
      eventDelegationIsOpen(
        event
      )
    ) {

      const delegateButton =
        node(
          "button",
          "Delegar al siguiente nivel"
        );


      delegateButton.type =
        "button";

      delegateButton.className =
        "button";


      delegateButton.onclick =
        () =>
          openDelegate(
            invitation.id
          );


      card.append(
        delegateButton
      );
    }

  } else {

    card.append(
      node(
        "p",
        `Asignado a: ${
          invitation.assignedToName ||
          "Sin nombre"
        }`
      )
    );


    card.append(
      node(
        "p",
        `Nivel: ${
          ROLE_LABELS[
            invitation.assignedToRole
          ] ||
          invitation.assignedToRole ||
          "Sin nivel"
        }`
      )
    );

    card.append(
      createdInvitationResponseView(
        invitation
      )
    );




    if (
      eventDelegationIsOpen(
        event
      )
    ) {

      const communicationPanel =
        createTerraWhatsAppCommunication({
          recipientName:
            invitation.assignedToName ||
            "destinatario",

          phone:
            invitation.assignedToPhone ||
            "",

          hasWhatsApp:
            invitation.assignedToHasWhatsApp ===
            true,

          message:
            eventWhatsAppMessage(
              invitation,
              event
            ),

          buttonLabel:
            "Comunicar evento por WhatsApp",

          panelTitle:
            "Comunicar evento por WhatsApp"
        });


      card.append(
        communicationPanel
      );


      const communicationClosesAtMillis =
        Number.isFinite(
          event.confirmationClosesAtMillis
        )
          ? event.confirmationClosesAtMillis
          : (
              Date.parse(
                event.startsAt || ""
              ) -
              (
                Number.isFinite(
                  event.confirmationLeadMinutes
                )
                  ? event.confirmationLeadMinutes
                  : 60
              ) *
              60 *
              1000
            );


      const communicationRemainingMillis =
        communicationClosesAtMillis -
        Date.now();


      if (
        communicationRemainingMillis > 0 &&
        communicationRemainingMillis <=
          2147483647
      ) {

        window.setTimeout(
          () => {

            if (
              document.body.contains(
                communicationPanel
              )
            ) {
              communicationPanel.remove();
            }
          },

          communicationRemainingMillis +
          1000
        );
      }
    }
  }


  return card;
}


// ======================================================
// ATAJOS SUPERIORES DE EVENTOS
// ======================================================

function eventScrollTarget(
  id
) {

  const base =
    $(id);

  return (
    base?.closest(".card") ||
    base ||
    null
  );
}


function scrollToEventSection(
  id
) {

  const target =
    eventScrollTarget(id);

  if (!target) {
    return;
  }

  target.style.scrollMarginTop =
    "18px";

  target.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}


function mountEventShortcuts() {

  const formCard =
    $("newEventForm")
      ?.closest(".card");

  if (!formCard) {
    return;
  }

  let bar =
    $("eventShortcuts");

  if (!bar) {
    bar =
      node("div");

    bar.id =
      "eventShortcuts";

    bar.className =
      "event-shortcuts";

    bar.style.cssText =
      "display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin:0 0 12px";

    formCard.insertAdjacentElement(
      "beforebegin",
      bar
    );
  }

  bar.replaceChildren();

  const isBaseCollaborator =
    workspace?.viewer?.role ===
    "colaborador_base";

  const items = [
    {
      label:
        "↓ Eventos que me asignaron",
      id:
        "receivedEvents"
    },

    ...(
      isBaseCollaborator
        ? []
        : [
            {
              label:
                "↓ Invitaciones que he creado",
              id:
                "createdEvents"
            }
          ]
    )
  ];

  for (const item of items) {

    const button =
      node(
        "button",
        item.label
      );

    button.type =
      "button";

    button.className =
      "button";

    button.onclick =
      () =>
        scrollToEventSection(
          item.id
        );

    bar.append(
      button
    );
  }
}




// ======================================================
// BUILD-118C-3B3E-3G-B4B
// WORKSPACE OPERATIVO DE TRANSPORTE · UI SOLO LECTURA
// ======================================================

function transportEventIds() {

  return [
    ...new Set(
      (
        workspace?.events ||
        []
      )
        .map(
          event =>
            event?.id
        )
        .filter(Boolean)
    )
  ];
}


function setTransportMetric(
  id,
  value
) {

  const element =
    $(id);


  if (!element) {
    return;
  }


  element.textContent =
    String(
      Number(value) ||
      0
    );
}


function renderTransportEventChooser() {

  const section =
    $("transportSection");

  const list =
    $("transportEventChooser");

  const shortcut =
    $("transportShortcut");


  if (
    !section ||
    !list
  ) {
    return;
  }


  const ids =
    transportEventIds();


  const visible =
    workspace?.viewer?.role !==
      "colaborador_base" &&
    ids.length > 0;


  section.hidden =
    !visible;


  if (shortcut) {
    shortcut.hidden =
      !visible;
  }


  list.replaceChildren();


  if (!visible) {
    return;
  }


  for (const eventId of ids) {

    const event =
      eventById(
        eventId
      );


    if (!event) {
      continue;
    }


    const card =
      node(
        "article"
      );


    card.className =
      "attendance-event-option";


    const title =
      node(
        "strong",
        event.title ||
          "Evento"
      );


    const meta =
      node(
        "p",
        `${
          formatDate(
            event.startsAt
          )
        } · ${
          event.venue ||
          "Lugar sin especificar"
        }`
      );


    meta.className =
      "event-meta";


    const button =
      node(
        "button",
        selectedTransportEventId ===
          eventId
          ? "Actualizar transporte"
          : "Abrir transporte"
      );


    button.type =
      "button";

    button.className =
      "button";


    button.onclick =
      () =>
        openTransportControl(
          eventId
        );


    card.append(
      title,
      meta,
      button
    );


    list.append(
      card
    );
  }
}


// ======================================================
// BUILD-118C-3B3E-3G-B4D1
// REGISTRO OPERATIVO DE VEHÍCULOS
//
// origin + departureAt pertenecen a la unidad.
// El punto/hora individual de abordaje pertenece
// posteriormente a PassengerAssignment.
// ======================================================

function transportOperationRequestId(
  prefix =
    "transport"
) {

  const randomPart =
    globalThis.crypto
      ?.randomUUID
      ?.()
      ?.replaceAll(
        "-",
        ""
      ) ||
    (
      Date.now().toString(36) +
      Math.random()
        .toString(36)
        .slice(2)
    );


  return `${prefix}_${randomPart}`
    .replace(
      /[^A-Za-z0-9_-]/g,
      ""
    )
    .slice(
      0,
      128
    );
}


function syncTransportVehicleForm() {

  const form =
    $("transportVehicleForm");

  const submit =
    $("transportVehicleSubmit");


  if (!form) {
    return;
  }


  const enabled =
    Boolean(
      selectedTransportEventId &&
      transportWorkspace
        ?.scope
        ?.canManageTransport ===
          true
    );


  form
    .querySelectorAll(
      "input, select, button"
    )
    .forEach(
      control => {

        control.disabled =
          !enabled ||
          transportVehicleBusy;
      }
    );


  if (submit) {

    submit.textContent =
      transportVehicleBusy
        ? "Registrando unidad…"
        : "+ Registrar vehículo";
  }
}


function vehiclePayloadKey(
  payload
) {

  return JSON.stringify({
    eventId:
      payload.eventId,

    name:
      payload.name,

    vehicleType:
      payload.vehicleType,

    capacity:
      payload.capacity,

    origin:
      payload.origin,

    destination:
      payload.destination,

    departureAt:
      payload.departureAt
  });
}


async function refreshTransportWorkspace(
  eventId
) {

  const {
    data
  } =
    await getEventTransportWorkspace({
      eventId
    });


  if (
    selectedTransportEventId !==
      eventId
  ) {

    return;
  }


  const current =
    data?.workspace ||
    null;


  if (!current) {

    throw new Error(
      "TERRA no devolvió el workspace de transporte."
    );
  }


  transportWorkspace =
    current;


  renderTransportControl();
}


async function submitTransportVehicle(
  event
) {

  event.preventDefault();


  if (
    transportVehicleBusy ||
    !selectedTransportEventId ||
    !transportWorkspace
  ) {

    return;
  }


  const name =
    $("transportVehicleName")
      ?.value
      ?.trim() ||
    "";


  const vehicleType =
    $("transportVehicleType")
      ?.value
      ?.trim() ||
    "";


  const capacity =
    Number(
      $("transportVehicleCapacity")
        ?.value
    );


  const origin =
    $("transportVehicleOrigin")
      ?.value
      ?.trim() ||
    "";


  const destination =
    $("transportVehicleDestination")
      ?.value
      ?.trim() ||
    "";


  const departureLocal =
    $("transportVehicleDepartureAt")
      ?.value ||
    "";


  if (
    !name ||
    !vehicleType ||
    !Number.isInteger(
      capacity
    ) ||
    capacity < 1 ||
    capacity > 120 ||
    !origin ||
    !departureLocal
  ) {

    $("transportStatus").textContent =
      "Completa nombre, tipo, capacidad, punto de salida y hora de salida.";

    return;
  }


  const departureDate =
    new Date(
      departureLocal
    );


  if (
    Number.isNaN(
      departureDate.getTime()
    )
  ) {

    $("transportStatus").textContent =
      "La fecha u hora de salida no es válida.";

    return;
  }


  const payload = {
    eventId:
      selectedTransportEventId,

    name,

    vehicleType,

    capacity,

    origin,

    destination,

    departureAt:
      departureDate.toISOString()
  };


  const payloadKey =
    vehiclePayloadKey(
      payload
    );


  if (
    !transportVehicleAttempt ||
    transportVehicleAttempt
      .payloadKey !==
        payloadKey
  ) {

    transportVehicleAttempt = {
      payloadKey,

      requestId:
        transportOperationRequestId(
          "vehicle"
        )
    };
  }


  transportVehicleBusy =
    true;


  syncTransportVehicleForm();


  $("transportStatus").textContent =
    "Registrando vehículo y creando sus asientos…";


  try {

    const eventId =
      selectedTransportEventId;


    await createEventTransportVehicle({
      ...payload,

      requestId:
        transportVehicleAttempt
          .requestId
    });


    transportVehicleAttempt =
      null;

    transportSeatLayoutBusy =
      false;

    transportSeatLayoutVehicleId =
      null;

    transportSeatLayoutAttempt =
      null;


    $("transportVehicleForm")
      ?.reset();


    $("transportStatus").textContent =
      "Vehículo registrado. Actualizando transporte…";


    await refreshTransportWorkspace(
      eventId
    );


    $("transportStatus").textContent =
      "✓ Vehículo registrado correctamente.";


  } catch (error) {

    console.error(
      "createEventTransportVehicle",
      error
    );


    $("transportStatus").textContent =
      error?.message ||
      "No fue posible registrar el vehículo.";


  } finally {

    transportVehicleBusy =
      false;


    syncTransportVehicleForm();
  }
}


// ======================================================
// BUILD-118C-3B3E-3G-B4D2A
// MAPA FÍSICO DE ASIENTOS
//
// Referencia:
// mirando hacia el frente desde el interior:
// left  = lado del chofer
// right = lado del copiloto
// ======================================================

function transportUsesPhysicalSeatMap(
  vehicle
) {

  const type =
    String(
      vehicle?.vehicleType ||
      ""
    )
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .trim()
      .toLowerCase();


  return (
    type.includes("autobus") ||
    type.includes("camion") ||
    type === "bus"
  );
}


function transportStandard2x2Sides(
  capacity
) {

  const number =
    Number(
      capacity
    );


  if (
    !Number.isInteger(
      number
    ) ||
    number < 4 ||
    number > 120 ||
    number % 4 !== 0
  ) {

    return null;
  }


  const left = [];
  const right = [];


  for (
    let first = 1;
    first <= number;
    first += 4
  ) {

    left.push(
      first,
      first + 1
    );


    right.push(
      first + 2,
      first + 3
    );
  }


  return {
    left,
    right,
    center: []
  };
}


async function configureTransportStandard2x2(
  vehicleId
) {

  if (
    transportSeatLayoutBusy ||
    !vehicleId ||
    !selectedTransportEventId ||
    !transportWorkspace
  ) {

    return;
  }


  const vehicle =
    (
      transportWorkspace
        .vehicles ||
      []
    ).find(
      item =>
        item?.id ===
          vehicleId
    );


  if (!vehicle) {

    $("transportStatus").textContent =
      "No fue posible localizar el vehículo.";

    return;
  }


  if (
    vehicle.seatLayoutConfigured ===
      true
  ) {

    $("transportStatus").textContent =
      "El mapa de asientos de esta unidad ya está configurado.";

    return;
  }


  const sides =
    transportStandard2x2Sides(
      vehicle.capacity
    );


  if (!sides) {

    $("transportStatus").textContent =
      "La plantilla 2+2 requiere una capacidad múltiplo de 4.";

    return;
  }


  const attemptKey =
    `${vehicleId}|standard_2x2`;


  if (
    !transportSeatLayoutAttempt ||
    transportSeatLayoutAttempt
      .attemptKey !==
        attemptKey
  ) {

    transportSeatLayoutAttempt = {
      attemptKey,

      requestId:
        transportOperationRequestId(
          "seatlayout"
        )
    };
  }


  transportSeatLayoutBusy =
    true;

  transportSeatLayoutVehicleId =
    vehicleId;


  renderTransportControl();


  $("transportStatus").textContent =
    `Configurando mapa 2+2 de ${
      vehicle.name ||
      "la unidad"
    }…`;


  let finalMessage =
    "";


  try {

    const eventId =
      selectedTransportEventId;


    await configureEventTransportSeatLayout({
      vehicleId,

      requestId:
        transportSeatLayoutAttempt
          .requestId,

      layoutTemplate:
        "standard_2x2"
    });


    transportSeatLayoutAttempt =
      null;


    await refreshTransportWorkspace(
      eventId
    );


    finalMessage =
      "✓ Mapa de asientos 2+2 configurado correctamente.";


  } catch (error) {

    console.error(
      "configureEventTransportSeatLayout",
      error
    );


    finalMessage =
      error?.message ||
      "No fue posible configurar el mapa de asientos.";


  } finally {

    transportSeatLayoutBusy =
      false;

    transportSeatLayoutVehicleId =
      null;


    renderTransportControl();


    if (finalMessage) {

      $("transportStatus").textContent =
        finalMessage;
    }
  }
}


// ======================================================
// BUILD-118C-3B3E-3G-B4D2B
// REPARTO DE CUPOS
// ======================================================

function transportAllocationRoleLabel(
  role
) {

  const labels = {
    lider_principal:
      "Líder principal",

    coordinador_municipal:
      "Coordinador municipal",

    jefe_estructura:
      "Responsable de estructura",

    integrante:
      "Integrante",

    participante:
      "Participante"
  };


  return (
    labels[role] ||
    role ||
    "Responsable"
  );
}


function transportAllocationTargetLabel(
  target
) {

  const parts = [
    target?.name ||
      "Sin nombre",

    transportAllocationRoleLabel(
      target?.role
    )
  ];


  if (target?.structureName) {

    parts.push(
      target.structureName
    );
  }


  return parts
    .filter(Boolean)
    .join(" · ");
}


async function loadTransportAllocationTargets(
  eventId
) {

  if (
    !eventId ||
    transportAllocationTargetsBusy
  ) {

    return;
  }


  transportAllocationTargetsBusy =
    true;

  transportAllocationTargetsEventId =
    eventId;

  transportAllocationTargetsError =
    "";


  try {

    const {
      data
    } =
      await getEventTransportAllocationTargets({
        eventId
      });


    if (
      selectedTransportEventId !==
        eventId
    ) {

      return;
    }


    transportAllocationTargets =
      Array.isArray(
        data?.targets
      )
        ? data.targets
        : [];


  } catch (error) {

    console.error(
      "getEventTransportAllocationTargets",
      error
    );


    if (
      selectedTransportEventId ===
        eventId
    ) {

      transportAllocationTargets =
        [];

      transportAllocationTargetsError =
        error?.message ||
        "No fue posible cargar los responsables elegibles.";
    }


  } finally {

    transportAllocationTargetsBusy =
      false;


    if (
      selectedTransportEventId ===
        eventId
    ) {

      renderTransportControl();
    }
  }
}


function ensureTransportAllocationTargets() {

  const eventId =
    selectedTransportEventId;


  if (
    !eventId ||
    transportAllocationTargetsBusy ||
    transportAllocationTargetsEventId ===
      eventId
  ) {

    return;
  }


  transportAllocationTargets =
    [];

  transportAllocationTargetsError =
    "";


  loadTransportAllocationTargets(
    eventId
  );
}


async function submitTransportCapacityAllocation(
  vehicle,
  targetSelect,
  capacityInput,
  localStatus
) {

  if (
    transportAllocationBusy ||
    !vehicle ||
    !targetSelect ||
    !capacityInput
  ) {

    return;
  }


  if (
    transportUsesPhysicalSeatMap(
      vehicle
    )
  ) {

    localStatus.textContent =
      "En autobús/camión los cupos se asignarán seleccionando asientos concretos.";

    return;
  }


  const allocatedToUserId =
    String(
      targetSelect.value ||
      ""
    ).trim();


  const allocatedCapacity =
    Number(
      capacityInput.value
    );


  const available =
    Number(
      vehicle.availableSeatCount
    ) || 0;


  if (!allocatedToUserId) {

    localStatus.textContent =
      "Selecciona al responsable del cupo.";

    return;
  }


  if (
    !Number.isInteger(
      allocatedCapacity
    ) ||
    allocatedCapacity < 1
  ) {

    localStatus.textContent =
      "Indica una cantidad válida de lugares.";

    return;
  }


  if (
    allocatedCapacity >
      available
  ) {

    localStatus.textContent =
      `Solo existen ${available} lugares disponibles.`;

    return;
  }


  const attemptKey =
    [
      vehicle.id,
      allocatedToUserId,
      allocatedCapacity
    ].join("|");


  if (
    !transportAllocationAttempt ||
    transportAllocationAttempt
      .attemptKey !==
        attemptKey
  ) {

    transportAllocationAttempt = {
      attemptKey,

      requestId:
        transportOperationRequestId(
          "allocation"
        )
    };
  }


  transportAllocationBusy =
    true;

  transportAllocationVehicleId =
    vehicle.id;


  renderTransportControl();


  localStatus.textContent =
    "Asignando cupos…";


  let finalMessage =
    "";


  try {

    const eventId =
      selectedTransportEventId;


    const {
      data
    } =
      await createEventTransportAllocation({
        vehicleId:
          vehicle.id,

        allocatedToUserId,

        allocationType:
          "capacity_block",

        allocatedCapacity,

        zone:
          "none",

        requestId:
          transportAllocationAttempt
            .requestId
      });


    transportAllocationAttempt =
      null;


    await refreshTransportWorkspace(
      eventId
    );


    const assigned =
      Number(
        data?.allocation
          ?.allocatedCapacity
      ) ||
      allocatedCapacity;


    finalMessage =
      `✓ ${assigned} lugar${
        assigned === 1 ? "" : "es"
      } asignado${
        assigned === 1 ? "" : "s"
      } correctamente.`;


  } catch (error) {

    console.error(
      "createEventTransportAllocation",
      error
    );


    finalMessage =
      error?.message ||
      "No fue posible asignar los cupos.";


  } finally {

    transportAllocationBusy =
      false;

    transportAllocationVehicleId =
      null;


    renderTransportControl();


    const status =
      document.querySelector(
        `[data-transport-allocation-status="${vehicle.id}"]`
      );


    if (status) {

      status.textContent =
        finalMessage;
    }
  }
}


// ======================================================
// BUILD-118C-3B3E-3G-B4D3C
// PASAJEROS DEL CUPO
// ======================================================

function transportPassengerCandidatesState(
  allocationId
) {

  let state =
    transportPassengerCandidatesByAllocation
      .get(
        allocationId
      );


  if (!state) {

    state = {
      loaded:
        false,

      busy:
        false,

      error:
        "",

      message:
        "",

      items:
        []
    };


    transportPassengerCandidatesByAllocation
      .set(
        allocationId,
        state
      );
  }


  return state;
}


function transportPassengerCandidateLabel(
  candidate
) {

  const name =
    candidate?.name ||
    "Persona";


  const details = [];


  if (candidate?.locality) {

    details.push(
      candidate.locality
    );
  }


  if (candidate?.role) {

    details.push(
      String(
        candidate.role
      )
        .replaceAll(
          "_",
          " "
        )
    );
  }


  return details.length
    ? `${name} · ${details.join(" · ")}`
    : name;
}


function transportDatetimeLocalValue(
  value
) {

  if (!value) {

    return "";
  }


  const date =
    new Date(
      value
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return "";
  }


  const pad =
    number =>
      String(
        number
      ).padStart(
        2,
        "0"
      );


  return `${
    date.getFullYear()
  }-${
    pad(
      date.getMonth() + 1
    )
  }-${
    pad(
      date.getDate()
    )
  }T${
    pad(
      date.getHours()
    )
  }:${
    pad(
      date.getMinutes()
    )
  }`;
}


async function ensureTransportPassengerCandidates(
  allocationId
) {

  if (
    !allocationId ||
    !selectedTransportEventId
  ) {

    return;
  }


  const state =
    transportPassengerCandidatesState(
      allocationId
    );


  if (
    state.loaded ||
    state.busy ||
    state.error
  ) {

    return;
  }


  const eventId =
    selectedTransportEventId;


  state.busy =
    true;

  state.error =
    "";


  try {

    const {
      data
    } =
      await getEventTransportPassengerCandidates({
        allocationId
      });


    if (
      selectedTransportEventId !==
        eventId
    ) {

      return;
    }


    state.items =
      Array.isArray(
        data?.candidates
      )
        ? data.candidates
        : [];


    state.loaded =
      true;


  } catch (error) {

    console.error(
      "getEventTransportPassengerCandidates",
      error
    );


    state.items =
      [];

    state.loaded =
      false;

    state.error =
      error?.message ||
      "No fue posible consultar las personas elegibles.";


  } finally {

    state.busy =
      false;


    if (
      selectedTransportEventId ===
        eventId
    ) {

      renderTransportControl();
    }
  }
}


async function submitTransportPassengerAssignment(
  allocation,
  vehicle,
  personSelect,
  boardingInput,
  timeInput
) {

  if (
    transportPassengerBusy ||
    !allocation?.id ||
    !vehicle?.id
  ) {

    return;
  }


  const state =
    transportPassengerCandidatesState(
      allocation.id
    );


  const personId =
    String(
      personSelect?.value ||
      ""
    ).trim();


  const boardingPoint =
    String(
      boardingInput?.value ||
      ""
    ).trim();


  const scheduledRaw =
    String(
      timeInput?.value ||
      ""
    ).trim();


  if (!personId) {

    state.message =
      "Selecciona la persona que ocupará el lugar.";

    renderTransportControl();

    return;
  }


  if (
    boardingPoint.length <
      2
  ) {

    state.message =
      "Indica el punto de abordaje.";

    renderTransportControl();

    return;
  }


  const scheduledMillis =
    Date.parse(
      scheduledRaw
    );


  if (
    !scheduledRaw ||
    !Number.isFinite(
      scheduledMillis
    )
  ) {

    state.message =
      "Indica una fecha y hora válida de abordaje.";

    renderTransportControl();

    return;
  }


  const scheduledBoardingAt =
    new Date(
      scheduledMillis
    ).toISOString();


  const attemptKey =
    JSON.stringify({
      allocationId:
        allocation.id,

      personId,

      boardingPoint,

      scheduledBoardingAt
    });


  if (
    !transportPassengerAttempt ||
    transportPassengerAttempt
      .attemptKey !==
        attemptKey
  ) {

    transportPassengerAttempt = {
      attemptKey,

      requestId:
        transportOperationRequestId(
          "passenger"
        )
    };
  }


  transportPassengerBusy =
    true;

  transportPassengerAllocationId =
    allocation.id;

  state.message =
    "Asignando pasajero…";


  renderTransportControl();


  try {

    const eventId =
      selectedTransportEventId;


    const selectedName =
      personSelect
        ?.selectedOptions?.[0]
        ?.textContent
        ?.split(" · ")[0] ||
      "La persona";


    await createEventTransportPassengerAssignment({
      allocationId:
        allocation.id,

      personId,

      // En capacity_block NO enviamos seatNumber.
      // B4D3A lo asigna internamente.
      boardingPoint,

      scheduledBoardingAt,

      requestId:
        transportPassengerAttempt
          .requestId
    });


    transportPassengerAttempt =
      null;


    state.loaded =
      false;

    state.items =
      [];

    state.error =
      "";

    state.message =
      `✓ ${selectedName} quedó asignado al transporte.`;


    await refreshTransportWorkspace(
      eventId
    );


  } catch (error) {

    console.error(
      "createEventTransportPassengerAssignment",
      error
    );


    state.message =
      error?.message ||
      "No fue posible asignar al pasajero.";


  } finally {

    transportPassengerBusy =
      false;

    transportPassengerAllocationId =
      null;


    renderTransportControl();
  }
}



function transportPassengerActionMessage(
  assignmentId
) {

  return (
    transportPassengerActionMessages
      .get(
        assignmentId
      ) ||
    null
  );
}


function transportPassengerOperationalStatus(
  assignment
) {

  const confirmationStatus =
    assignment
      ?.confirmationStatus ||
    "pending";

  const boardingStatus =
    assignment
      ?.boardingStatus ||
    "pending";


  if (
    boardingStatus ===
      "boarded"
  ) {

    return {
      state:
        "boarded",

      label:
        "Abordó ✓"
    };
  }


  if (
    confirmationStatus ===
      "confirmed"
  ) {

    return {
      state:
        "confirmed",

      label:
        "Confirmado · pendiente de abordaje"
    };
  }


  return {
    state:
      "pending",

    label:
      "Pendiente de confirmación"
  };
}


async function submitTransportPassengerAction(
  assignment,
  action
) {

  if (
    transportPassengerActionBusy
  ) {

    return;
  }


  const eventId =
    selectedTransportEventId;

  const assignmentId =
    String(
      assignment?.id ||
      ""
    ).trim();


  if (
    !eventId ||
    !assignmentId
  ) {

    return;
  }


  if (
    action !==
      "confirm" &&
    action !==
      "board"
  ) {

    return;
  }


  const status =
    transportPassengerOperationalStatus(
      assignment
    );


  if (
    action ===
      "confirm" &&
    status.state !==
      "pending"
  ) {

    return;
  }


  if (
    action ===
      "board" &&
    status.state !==
      "confirmed"
  ) {

    return;
  }


  const attemptKey =
    `${action}:${assignmentId}`;


  if (
    !transportPassengerActionAttempt ||
    transportPassengerActionAttempt
      .key !==
      attemptKey
  ) {

    transportPassengerActionAttempt = {
      key:
        attemptKey,

      requestId:
        transportOperationRequestId(
          action === "confirm"
            ? "passenger-confirm"
            : "passenger-board"
        )
    };
  }


  const requestId =
    transportPassengerActionAttempt
      .requestId;


  transportPassengerActionBusy =
    true;

  transportPassengerActionAssignmentId =
    assignmentId;

  transportPassengerActionType =
    action;


  transportPassengerActionMessages.set(
    assignmentId,
    {
      type:
        "info",

      text:
        action === "confirm"
          ? "Registrando confirmación..."
          : "Registrando abordaje..."
    }
  );


  renderTransportControl();


  try {

    if (
      action ===
        "confirm"
    ) {

      await confirmEventTransportPassengerAssignment({
        assignmentId,
        requestId
      });

    } else {

      await recordEventTransportPassengerBoarding({
        assignmentId,
        requestId
      });
    }


    if (
      selectedTransportEventId !==
        eventId
    ) {

      return;
    }


    transportPassengerActionAttempt =
      null;


    transportPassengerActionMessages.set(
      assignmentId,
      {
        type:
          "success",

        text:
          action === "confirm"
            ? "✓ Confirmación registrada."
            : "✓ Abordaje registrado."
      }
    );


    await refreshTransportWorkspace(
      eventId
    );

  } catch (error) {

    console.error(
      "B4D4A transport passenger action",
      error
    );


    transportPassengerActionMessages.set(
      assignmentId,
      {
        type:
          "error",

        text:
          error?.message ||
          (
            action === "confirm"
              ? "No fue posible confirmar al pasajero."
              : "No fue posible registrar el abordaje."
          )
      }
    );

  } finally {

    transportPassengerActionBusy =
      false;

    transportPassengerActionAssignmentId =
      null;

    transportPassengerActionType =
      "";

    renderTransportControl();
  }
}


function renderTransportControl() {

  ensureTransportAllocationTargets();


  const panel =
    $("transportControlPanel");

  const details =
    $("transportDetails");


  if (
    !panel ||
    !details
  ) {
    return;
  }


  if (!transportWorkspace) {

    panel.hidden =
      true;

    details.replaceChildren();

    return;
  }


  const event =
    transportWorkspace.event ||
    {};


  panel.hidden =
    false;


  syncTransportVehicleForm();


  $("transportTitle").textContent =
    event.title ||
    "Transporte del evento";


  $("transportEventMeta").textContent =
    `${
      formatDate(
        event.startsAt
      )
    } · ${
      event.venue ||
      "Lugar sin especificar"
    }${
      event.locality
        ? ` · ${event.locality}`
        : ""
    }`;


  const summary =
    transportWorkspace.summary ||
    {};


  setTransportMetric(
    "transportVehicleCount",
    summary.vehicleCount
  );

  setTransportMetric(
    "transportAllocationCount",
    summary.allocationCount
  );

  setTransportMetric(
    "transportResponseCount",
    summary.transportResponseCount
  );

  setTransportMetric(
    "transportRequestedCount",
    summary.transportRequestedCount
  );

  setTransportMetric(
    "transportNotRequestedCount",
    summary.transportNotRequestedCount
  );

  setTransportMetric(
    "transportAssignedCount",
    summary.assignedPassengerCount
  );

  setTransportMetric(
    "transportConfirmedCount",
    summary.confirmedPassengerCount
  );

  setTransportMetric(
    "transportBoardedCount",
    summary.boardedCount
  );


  details.replaceChildren();


  const vehicles =
    Array.isArray(
      transportWorkspace.vehicles
    )
      ? transportWorkspace.vehicles
      : [];


  if (!vehicles.length) {

    details.append(
      node(
        "p",
        "Este evento todavía no tiene vehículos de transporte registrados."
      )
    );

  } else {

    for (const vehicle of vehicles) {

      const card =
        node(
          "article"
        );


      card.className =
        "attendance-event-option";


      const title =
        node(
          "strong",
          vehicle.name ||
          "Vehículo"
        );


      const capacity =
        Number(
          vehicle.capacity
        ) || 0;

      const allocated =
        Number(
          vehicle.allocatedSeatCount
        ) || 0;

      const available =
        Number(
          vehicle.availableSeatCount
        ) || 0;

      const assigned =
        Number(
          vehicle.assignedSeatCount
        ) || 0;

      const occupied =
        Number(
          vehicle.occupiedCount
        ) || 0;


      const meta =
        node(
          "p",
          `Capacidad: ${capacity} · ` +
          `Cupos asignados: ${allocated} · ` +
          `Disponibles: ${available} · ` +
          `Pasajeros asignados: ${assigned} · ` +
          `Abordados: ${occupied}`
        );


      meta.className =
        "event-meta";


      const operationMeta =
        node(
          "p",
          `${
            vehicle.vehicleType ||
            "Vehículo"
          }${
            vehicle.departureAt
              ? ` · Salida general: ${
                  formatDate(
                    vehicle.departureAt
                  )
                }`
              : ""
          }`
        );


      operationMeta.className =
        "event-meta";


      card.append(
        title,
        operationMeta,
        meta
      );


      if (
        vehicle.origin ||
        vehicle.destination
      ) {

        const route =
          node(
            "p",
            `${
              vehicle.origin ||
              "Origen pendiente"
            } → ${
              vehicle.destination ||
              "Destino pendiente"
            }`
          );


        route.className =
          "event-meta";


        card.append(
          route
        );
      }


      const usesPhysicalSeatMap =
        transportUsesPhysicalSeatMap(
          vehicle
        );


      if (!usesPhysicalSeatMap) {

        const automaticInfo =
          node(
            "p",
            "Lugares: asignación automática por capacidad"
          );


        automaticInfo.className =
          "event-meta";


        card.append(
          automaticInfo
        );


      } else {

        const layoutConfigured =
          vehicle.seatLayoutConfigured ===
            true;


        const layoutTemplate =
          vehicle.seatLayoutTemplate ||
          "";


        const layoutTitle =
          node(
            "p",
            layoutConfigured
              ? (
                  layoutTemplate ===
                    "standard_2x2"
                    ? "Mapa de asientos: ✓ Estándar 2+2"
                    : "Mapa de asientos: ✓ Configurado"
                )
              : "Mapa de asientos: Sin configurar"
          );


        layoutTitle.className =
          "event-meta";


        card.append(
          layoutTitle
        );


        if (layoutConfigured) {

          if (
            layoutTemplate ===
              "standard_2x2"
          ) {

            const sides =
              transportStandard2x2Sides(
                vehicle.capacity
              );


            if (sides) {

              const leftInfo =
                node(
                  "p",
                  `Lado chofer: ${
                    sides.left.join(
                      ", "
                    )
                  }`
                );


              leftInfo.className =
                "event-meta";


              const rightInfo =
                node(
                  "p",
                  `Lado copiloto: ${
                    sides.right.join(
                      ", "
                    )
                  }`
                );


              rightInfo.className =
                "event-meta";


              card.append(
                leftInfo,
                rightInfo
              );
            }

          } else {

            const counts =
              node(
                "p",
                `Chofer: ${
                  Number(
                    vehicle.leftSeatCount
                  ) || 0
                } · Copiloto: ${
                  Number(
                    vehicle.rightSeatCount
                  ) || 0
                } · Centro: ${
                  Number(
                    vehicle.centerSeatCount
                  ) || 0
                }`
              );


            counts.className =
              "event-meta";


            card.append(
              counts
            );
          }


        } else {

          const sides =
            transportStandard2x2Sides(
              vehicle.capacity
            );


          if (sides) {

            const layoutButton =
              node(
                "button",
                (
                  transportSeatLayoutBusy &&
                  transportSeatLayoutVehicleId ===
                    vehicle.id
                )
                  ? "Configurando 2+2…"
                  : "Configurar asientos 2+2"
              );


            layoutButton.type =
              "button";

            layoutButton.className =
              "button button--secondary";

            layoutButton.disabled =
              transportSeatLayoutBusy;


            layoutButton.onclick =
              () =>
                configureTransportStandard2x2(
                  vehicle.id
                );


            card.append(
              layoutButton
            );


          } else {

            const customNotice =
              node(
                "p",
                "Este autobús requiere una distribución personalizada de asientos."
              );


            customNotice.className =
              "message";


            card.append(
              customNotice
            );
          }
        }
      }


      // ==============================================
      // B4D2B · CUPOS YA REPARTIDOS
      // ==============================================

      const vehicleAllocations =
        (
          transportWorkspace
            .allocations ||
          []
        ).filter(
          allocation =>
            allocation.vehicleId ===
              vehicle.id &&
            allocation.active !==
              false
        );


      if (vehicleAllocations.length) {

        const allocationsTitle =
          node(
            "p",
            "Cupos repartidos"
          );


        allocationsTitle.className =
          "event-meta";


        card.append(
          allocationsTitle
        );


        for (
          const allocation of
          vehicleAllocations
        ) {

          const amount =
            Number(
              allocation
                .allocatedCapacity
            ) || 0;


          const allocationInfo =
            node(
              "p",
              `${
                allocation
                  .allocatedToName ||
                "Responsable"
              } · ${
                amount
              } lugar${
                amount === 1
                  ? ""
                  : "es"
              } · ${
                transportAllocationRoleLabel(
                  allocation
                    .allocatedToRole
                )
              }`
            );


          allocationInfo.className =
            "event-meta";


          card.append(
            allocationInfo
          );



          // ==============================================
          // B4D3C · PASAJEROS DEL CUPO
          // ==============================================

          const allocationAssignments =
            (
              transportWorkspace
                .assignments ||
              []
            ).filter(
              assignment =>
                assignment
                  .allocationId ===
                    allocation.id &&
                assignment.active !==
                  false
            );


          const assignedPassengerCount =
            allocationAssignments.length;


          const remainingPassengerPlaces =
            Math.max(
              0,
              amount -
                assignedPassengerCount
            );


          const passengerSummary =
            node(
              "p",
              `Pasajeros: ${
                assignedPassengerCount
              } de ${
                amount
              } asignado${
                amount === 1
                  ? ""
                  : "s"
              }`
            );


          passengerSummary.className =
            "event-meta";


          card.append(
            passengerSummary
          );


          for (
            const assignment of
            allocationAssignments
          ) {

            const passengerParts = [
              `✓ ${
                assignment.personName ||
                "Persona asignada"
              }`
            ];


            if (
              transportUsesPhysicalSeatMap(
                vehicle
              ) &&
              Number(
                assignment.seatNumber
              ) > 0
            ) {

              passengerParts.push(
                `Asiento ${
                  assignment.seatNumber
                }`
              );
            }


            if (
              assignment.boardingPoint
            ) {

              passengerParts.push(
                `Abordaje: ${
                  assignment.boardingPoint
                }`
              );
            }


            if (
              assignment
                .scheduledBoardingAt
            ) {

              passengerParts.push(
                formatDate(
                  assignment
                    .scheduledBoardingAt
                )
              );
            }


            const passengerInfo =
              node(
                "p",
                passengerParts.join(
                  " · "
                )
              );


            passengerInfo.className =
              "event-meta";


            card.append(
              passengerInfo
            );


            const passengerStatus =
              transportPassengerOperationalStatus(
                assignment
              );


            const passengerStatusInfo =
              node(
                "p",
                `Estado: ${
                  passengerStatus.label
                }`
              );


            passengerStatusInfo.className =
              "event-meta";


            card.append(
              passengerStatusInfo
            );


            const passengerActionMessage =
              transportPassengerActionMessage(
                assignment.id
              );


            if (
              passengerActionMessage
            ) {

              const message =
                node(
                  "p",
                  passengerActionMessage
                    .text
                );


              message.className =
                "event-meta";


              card.append(
                message
              );
            }


            const passengerActionIsBusy =
              transportPassengerActionBusy &&
              transportPassengerActionAssignmentId ===
                assignment.id;


            if (
              passengerStatus.state ===
                "pending"
            ) {

              const confirmButton =
                node(
                  "button",
                  passengerActionIsBusy &&
                  transportPassengerActionType ===
                    "confirm"
                    ? "Confirmando..."
                    : "Confirmar pasajero"
                );


              confirmButton.type =
                "button";

              confirmButton.className =
                "button button--small button--secondary";

              confirmButton.disabled =
                transportPassengerActionBusy;


              confirmButton.addEventListener(
                "click",
                () => {

                  void submitTransportPassengerAction(
                    assignment,
                    "confirm"
                  );
                }
              );


              card.append(
                confirmButton
              );

            } else if (
              passengerStatus.state ===
                "confirmed"
            ) {

              const boardingButton =
                node(
                  "button",
                  passengerActionIsBusy &&
                  transportPassengerActionType ===
                    "board"
                    ? "Registrando..."
                    : "Registrar abordaje"
                );


              boardingButton.type =
                "button";

              boardingButton.className =
                "button button--small button--secondary";

              boardingButton.disabled =
                transportPassengerActionBusy;


              boardingButton.addEventListener(
                "click",
                () => {

                  void submitTransportPassengerAction(
                    assignment,
                    "board"
                  );
                }
              );


              card.append(
                boardingButton
              );
            }
          }


          if (
            allocation.allocationType ===
              "capacity_block" &&
            !transportUsesPhysicalSeatMap(
              vehicle
            ) &&
            remainingPassengerPlaces >
              0
          ) {

            const candidateState =
              transportPassengerCandidatesState(
                allocation.id
              );


            void ensureTransportPassengerCandidates(
              allocation.id
            );


            const passengerBox =
              node(
                "div",
                ""
              );


            passengerBox.style.cssText =
              [
                "margin-top:10px",
                "margin-bottom:14px",
                "padding:12px",
                "border:1px solid #d4dee7",
                "border-radius:9px",
                "background:#ffffff"
              ].join(
                ";"
              );


            const passengerTitle =
              node(
                "strong",
                "Agregar pasajero"
              );


            const remainingInfo =
              node(
                "p",
                `${
                  remainingPassengerPlaces
                } lugar${
                  remainingPassengerPlaces ===
                    1
                    ? ""
                    : "es"
                } disponible${
                  remainingPassengerPlaces ===
                    1
                    ? ""
                    : "s"
                } en este cupo.`
              );


            remainingInfo.className =
              "event-meta";


            const passengerStatus =
              node(
                "p",
                ""
              );


            passengerStatus.className =
              "message";

            passengerStatus.dataset
              .transportPassengerStatus =
                allocation.id;


            passengerBox.append(
              passengerTitle,
              remainingInfo
            );


            if (
              candidateState.busy
            ) {

              passengerStatus.textContent =
                candidateState.message ||
                "Cargando personas elegibles…";


              passengerBox.append(
                passengerStatus
              );


            } else if (
              candidateState.error
            ) {

              passengerStatus.textContent =
                candidateState.error;


              const retryButton =
                node(
                  "button",
                  "Reintentar personas"
                );


              retryButton.type =
                "button";

              retryButton.className =
                "button button--secondary";


              retryButton.onclick =
                () => {

                  candidateState.loaded =
                    false;

                  candidateState.error =
                    "";

                  candidateState.message =
                    "";


                  void ensureTransportPassengerCandidates(
                    allocation.id
                  );


                  renderTransportControl();
                };


              passengerBox.append(
                passengerStatus,
                retryButton
              );


            } else if (
              !candidateState.items.length
            ) {

              passengerStatus.textContent =
                candidateState.message ||
                "No hay personas elegibles pendientes para este cupo.";


              passengerBox.append(
                passengerStatus
              );


            } else {

              const personLabel =
                document.createElement(
                  "label"
                );


              personLabel.textContent =
                "Persona";


              const personSelect =
                document.createElement(
                  "select"
                );


              personSelect.style.width =
                "100%";


              const emptyPersonOption =
                document.createElement(
                  "option"
                );


              emptyPersonOption.value =
                "";

              emptyPersonOption.textContent =
                "Selecciona persona";


              personSelect.append(
                emptyPersonOption
              );


              for (
                const candidate of
                candidateState.items
              ) {

                const option =
                  document.createElement(
                    "option"
                  );


                option.value =
                  candidate.personId;

                option.textContent =
                  transportPassengerCandidateLabel(
                    candidate
                  );


                personSelect.append(
                  option
                );
              }


              personLabel.append(
                personSelect
              );


              const boardingLabel =
                document.createElement(
                  "label"
                );


              boardingLabel.textContent =
                "Punto de abordaje";


              const boardingInput =
                document.createElement(
                  "input"
                );


              boardingInput.type =
                "text";

              boardingInput.maxLength =
                200;

              boardingInput.placeholder =
                "Ej. Plaza principal de Compostela";

              boardingInput.value =
                vehicle.origin ||
                "";

              boardingInput.style.width =
                "100%";


              boardingLabel.append(
                boardingInput
              );


              const timeLabel =
                document.createElement(
                  "label"
                );


              timeLabel.textContent =
                "Hora de abordaje";


              const timeInput =
                document.createElement(
                  "input"
                );


              timeInput.type =
                "datetime-local";

              timeInput.value =
                transportDatetimeLocalValue(
                  vehicle.departureAt
                );

              timeInput.style.width =
                "100%";


              timeLabel.append(
                timeInput
              );


              const passengerButton =
                node(
                  "button",
                  (
                    transportPassengerBusy &&
                    transportPassengerAllocationId ===
                      allocation.id
                  )
                    ? "Asignando pasajero…"
                    : "Asignar pasajero"
                );


              passengerButton.type =
                "button";

              passengerButton.className =
                "button button--secondary";

              passengerButton.disabled =
                transportPassengerBusy;


              passengerButton.onclick =
                () =>
                  submitTransportPassengerAssignment(
                    allocation,
                    vehicle,
                    personSelect,
                    boardingInput,
                    timeInput
                  );


              passengerStatus.textContent =
                candidateState.message ||
                "TERRA asignará automáticamente un lugar disponible dentro del cupo.";


              passengerBox.append(
                personLabel,
                boardingLabel,
                timeLabel,
                passengerButton,
                passengerStatus
              );
            }


            card.append(
              passengerBox
            );
          }
        }
      }


      // ==============================================
      // B4D2B · REPARTIR NUEVOS CUPOS
      // ==============================================

      const availableForAllocation =
        Number(
          vehicle.availableSeatCount
        ) || 0;


      if (
        availableForAllocation >
          0
      ) {

        const allocationBox =
          node(
            "div",
            ""
          );


        const allocationTitle =
          node(
            "strong",
            "Repartir cupos"
          );


        allocationBox.append(
          allocationTitle
        );


        const allocationStatus =
          node(
            "p",
            ""
          );


        allocationStatus.className =
          "message";

        allocationStatus.dataset
          .transportAllocationStatus =
            vehicle.id;


        if (
          transportUsesPhysicalSeatMap(
            vehicle
          )
        ) {

          allocationStatus.textContent =
            "Autobús/camión: el reparto se hará seleccionando asientos concretos.";


          allocationBox.append(
            allocationStatus
          );


        } else if (
          transportAllocationTargetsBusy
        ) {

          allocationStatus.textContent =
            "Cargando responsables elegibles…";


          allocationBox.append(
            allocationStatus
          );


        } else if (
          transportAllocationTargetsError
        ) {

          allocationStatus.textContent =
            transportAllocationTargetsError;


          const retryButton =
            node(
              "button",
              "Reintentar responsables"
            );


          retryButton.type =
            "button";

          retryButton.className =
            "button button--secondary";


          retryButton.onclick =
            () => {

              transportAllocationTargetsEventId =
                null;

              transportAllocationTargetsError =
                "";

              ensureTransportAllocationTargets();

              renderTransportControl();
            };


          allocationBox.append(
            allocationStatus,
            retryButton
          );


        } else if (
          !transportAllocationTargets.length
        ) {

          allocationStatus.textContent =
            "No hay responsables elegibles para recibir cupos en este evento.";


          allocationBox.append(
            allocationStatus
          );


        } else {

          const targetLabel =
            document.createElement(
              "label"
            );


          targetLabel.textContent =
            "Responsable";


          const targetSelect =
            document.createElement(
              "select"
            );


          const emptyOption =
            document.createElement(
              "option"
            );


          emptyOption.value =
            "";

          emptyOption.textContent =
            "Selecciona responsable";


          targetSelect.append(
            emptyOption
          );


          for (
            const target of
            transportAllocationTargets
          ) {

            const option =
              document.createElement(
                "option"
              );


            option.value =
              target.uid;

            option.textContent =
              transportAllocationTargetLabel(
                target
              );


            targetSelect.append(
              option
            );
          }


          targetLabel.append(
            targetSelect
          );


          const capacityLabel =
            document.createElement(
              "label"
            );


          capacityLabel.textContent =
            "Cantidad de lugares";


          const capacityInput =
            document.createElement(
              "input"
            );


          capacityInput.type =
            "number";

          capacityInput.min =
            "1";

          capacityInput.max =
            String(
              availableForAllocation
            );

          capacityInput.step =
            "1";

          capacityInput.placeholder =
            `1 a ${availableForAllocation}`;


          capacityLabel.append(
            capacityInput
          );


          const submitButton =
            node(
              "button",
              (
                transportAllocationBusy &&
                transportAllocationVehicleId ===
                  vehicle.id
              )
                ? "Asignando cupos…"
                : "Asignar cupos"
            );


          submitButton.type =
            "button";

          submitButton.className =
            "button button--secondary";

          submitButton.disabled =
            transportAllocationBusy;


          submitButton.onclick =
            () =>
              submitTransportCapacityAllocation(
                vehicle,
                targetSelect,
                capacityInput,
                allocationStatus
              );


          allocationBox.append(
            targetLabel,
            capacityLabel,
            submitButton,
            allocationStatus
          );
        }


        card.append(
          allocationBox
        );
      }


      details.append(
        card
      );
    }
  }


  $("transportStatus").textContent =
    "Información de transporte actualizada.";
}


async function openTransportControl(
  eventId
) {

  if (
    transportBusy ||
    !eventId
  ) {
    return;
  }


  transportBusy =
    true;

  selectedTransportEventId =
    eventId;

  transportWorkspace =
    null;


  transportPassengerCandidatesByAllocation =
    new Map();


  transportPassengerActionBusy =
    false;

  transportPassengerActionAssignmentId =
    null;

  transportPassengerActionType =
    "";

  transportPassengerActionAttempt =
    null;

  transportPassengerActionMessages =
    new Map();

  transportPassengerBusy =
    false;

  transportPassengerAllocationId =
    null;

  transportPassengerAttempt =
    null;


  const panel =
    $("transportControlPanel");


  if (panel) {
    panel.hidden =
      false;
  }


  $("transportStatus").textContent =
    "Consultando transporte…";


  renderTransportEventChooser();


  try {

    const {
      data
    } =
      await getEventTransportWorkspace({
        eventId
      });


    const current =
      data?.workspace ||
      null;


    if (!current) {

      throw new Error(
        "TERRA no devolvió el workspace de transporte."
      );
    }


    if (
      selectedTransportEventId !==
      eventId
    ) {
      return;
    }


    transportWorkspace =
      current;


    renderTransportControl();


    $("transportControlPanel")
      ?.scrollIntoView({
        behavior:
          "smooth",

        block:
          "start"
      });


  } catch (error) {

    transportWorkspace =
      null;


    if (panel) {
      panel.hidden =
        false;
    }


    $("transportStatus").textContent =
      error.message ||
      "No fue posible consultar el transporte de este evento.";


  } finally {

    transportBusy =
      false;


    renderTransportEventChooser();
  }
}


function closeTransportControl() {

  selectedTransportEventId =
    null;

  transportWorkspace =
    null;

  transportBusy =
    false;

  transportVehicleBusy =
    false;

  transportVehicleAttempt =
    null;

  transportSeatLayoutBusy =
    false;

  transportSeatLayoutVehicleId =
    null;

  transportSeatLayoutAttempt =
    null;

  transportAllocationTargets =
    [];

  transportAllocationTargetsEventId =
    null;

  transportAllocationTargetsBusy =
    false;

  transportAllocationTargetsError =
    "";

  transportAllocationBusy =
    false;

  transportAllocationVehicleId =
    null;

  transportAllocationAttempt =
    null;


  transportPassengerCandidatesByAllocation =
    new Map();


  transportPassengerActionBusy =
    false;

  transportPassengerActionAssignmentId =
    null;

  transportPassengerActionType =
    "";

  transportPassengerActionAttempt =
    null;

  transportPassengerActionMessages =
    new Map();

  transportPassengerBusy =
    false;

  transportPassengerAllocationId =
    null;

  transportPassengerAttempt =
    null;


  const panel =
    $("transportControlPanel");


  if (panel) {
    panel.hidden =
      true;
  }


  const status =
    $("transportStatus");


  if (status) {
    status.textContent =
      "";
  }


  renderTransportEventChooser();
}


// ======================================================
// BUILD-118C-2B
// CONTROL MANUAL DE ASISTENCIA
// ======================================================

function attendanceEventIds() {

  return [
    ...new Set(
      (
        workspace
          ?.createdInvitations ||
        []
      )
        .map(
          invitation =>
            invitation.eventId
        )
        .filter(Boolean)
    )
  ];
}


const ATTENDANCE_EARLY_MINUTES =
  45;


const ATTENDANCE_LATE_MINUTES =
  90;


function attendanceCheckInWindow(
  event
) {

  const startsAtMillis =
    Number.isFinite(
      event?.startsAtMillis
    )
      ? event.startsAtMillis
      : Date.parse(
          event?.startsAt || ""
        );


  if (
    !Number.isFinite(
      startsAtMillis
    )
  ) {
    return null;
  }


  return {

    opensAtMillis:
      startsAtMillis -
      (
        ATTENDANCE_EARLY_MINUTES *
        60 *
        1000
      ),

    closesAtMillis:
      startsAtMillis +
      (
        ATTENDANCE_LATE_MINUTES *
        60 *
        1000
      )
  };
}


function attendanceCheckInIsOpen(
  event
) {

  if (!event?.active) {
    return false;
  }


  const window =
    attendanceCheckInWindow(
      event
    );


  if (!window) {
    return false;
  }


  const now =
    Date.now();


  return (
    now >=
      window.opensAtMillis &&
    now <
      window.closesAtMillis
  );
}


function attendanceCheckInHasClosed(
  event
) {

  const window =
    attendanceCheckInWindow(
      event
    );


  return Boolean(
    event?.active &&
    window &&
    Date.now() >=
      window.closesAtMillis
  );
}


function attendanceResponseLabel(
  invitation
) {

  const status =
    invitation
      ?.response
      ?.status ||
    "pending";


  return (
    EVENT_RESPONSE_LABELS[
      status
    ] ||
    "Pendiente"
  );
}


function renderAttendanceEventChooser() {

  const section =
    $("attendanceSection");

  const list =
    $("attendanceEventChooser");


  if (
    !section ||
    !list
  ) {
    return;
  }


  const ids =
    attendanceEventIds();


  section.hidden =
    !ids.length;


  list.replaceChildren();


  if (!ids.length) {
    return;
  }


  for (const eventId of ids) {

    const event =
      eventById(
        eventId
      );


    if (!event) {
      continue;
    }


    const card =
      node(
        "article",
        ""
      );


    card.className =
      "attendance-event-option";


    const title =
      node(
        "strong",
        event.title ||
        "Evento"
      );


    const meta =
      node(
        "p",
        `${
          formatDate(
            event.startsAt
          )
        } · ${
          event.venue ||
          "Lugar sin especificar"
        }`
      );


    meta.className =
      "event-meta";


    const button =
      node(
        "button",
        selectedAttendanceEventId ===
          eventId
          ? "Actualizar control"
          : "Abrir control de asistencia"
      );


    button.type =
      "button";

    button.className =
      "button";

    button.onclick =
      () =>
        openAttendanceControl(
          eventId
        );


    card.append(
      title,
      meta,
      button
    );


    list.append(
      card
    );
  }
}


function renderAttendancePeople() {

  const list =
    $("attendancePeople");

  const search =
    $("attendanceSearch");


  if (
    !list ||
    !attendanceWorkspace
  ) {
    return;
  }


  const event =
    attendanceWorkspace.event;


  const checkInOpen =
    attendanceCheckInIsOpen(
      event
    );


  const checkInClosed =
    attendanceCheckInHasClosed(
      event
    );


  const query =
    String(
      search?.value ||
      ""
    )
      .trim()
      .toLocaleLowerCase(
        "es-MX"
      );


  const invitations =
    (
      attendanceWorkspace
        .invitations ||
      []
    )
      .filter(
        invitation => {

          if (!query) {
            return true;
          }


          return String(
            invitation
              .assignedToName ||
            ""
          )
            .toLocaleLowerCase(
              "es-MX"
            )
            .includes(
              query
            );
        }
      );


  list.replaceChildren();


  if (!invitations.length) {

    list.append(
      node(
        "p",
        query
          ? "No hay personas que coincidan con la búsqueda."
          : "No hay personas disponibles en este padrón."
      )
    );

    return;
  }


  for (
    const invitation of
    invitations
  ) {

    const card =
      node(
        "article",
        ""
      );


    card.className =
      "attendance-person";


    const header =
      document.createElement(
        "div"
      );


    header.className =
      "attendance-person-header";


    const name =
      node(
        "strong",
        invitation
          .assignedToName ||
        "Sin nombre"
      );


    header.append(
      name
    );


    if (
      invitation
        .attendance
        ?.attended ===
      true
    ) {

      const badge =
        node(
          "span",
          "PRESENTE"
        );


      badge.className =
        "attendance-badge attendance-badge--present";


      header.append(
        badge
      );
    }


    card.append(
      header
    );


    card.append(
      node(
        "p",
        `Nivel: ${
          ROLE_LABELS[
            invitation.assignedToRole
          ] ||
          invitation.assignedToRole ||
          "Sin nivel"
        }`
      )
    );


    card.append(
      node(
        "p",
        `Respuesta: ${
          attendanceResponseLabel(
            invitation
          )
        }`
      )
    );


    if (
      invitation.incident
    ) {

      card.append(
        node(
          "p",
          `Imprevisto: ${
            eventIncidentReasonLabel(
              invitation
                .incident
                .reason
            )
          }${
            invitation
              .incident
              .note
              ? " · " +
                invitation
                  .incident
                  .note
              : ""
          }`
        )
      );
    }


    if (
      invitation
        .attendance
        ?.attended ===
      true
    ) {

      const attendance =
        invitation.attendance;


      card.append(
        node(
          "p",
          `Registrado: ${
            attendance.checkedInAt
              ? formatDate(
                  attendance.checkedInAt
                )
              : "Sin hora disponible"
          }`
        )
      );


      card.append(
        node(
          "p",
          `Validado por: ${
            attendance
              .validatedByName ||
            "Sin nombre"
          }`
        )
      );


      list.append(
        card
      );


      continue;
    }


    if (!checkInOpen) {

      const waiting =
        node(
          "p",
          checkInClosed
            ? "ASISTENCIA CERRADA. El registro terminó 1 hora 30 minutos después de la hora citada."
            : "El registro de presencia se habilitará 45 minutos antes de la hora citada."
        );


      waiting.className =
        "attendance-waiting";


      card.append(
        waiting
      );


      list.append(
        card
      );


      continue;
    }


    const button =
      node(
        "button",
        "Marcar presente"
      );


    button.type =
      "button";

    button.className =
      "button";

    button.disabled =
      attendanceBusy;


    button.onclick =
      () =>
        markAttendancePresent(
          invitation
        );


    card.append(
      button
    );


    list.append(
      card
    );
  }
}


const ATTENDANCE_IDENTITY_REASON_LABELS = {
  phone:
    "Teléfono",

  name:
    "Nombre",

  locality:
    "Población",

  street:
    "Calle",

  houseNumber:
    "Número"
};


function clearAttendanceIdentitySearch(
  clearInputs = true
) {

  if (clearInputs) {

    $("attendanceIdentityPhone").value =
      "";

    $("attendanceIdentityName").value =
      "";

    $("attendanceIdentityLocality").value =
      "";
  }


  $("attendanceIdentityResults")
    .replaceChildren();


  $("attendanceIdentityStatus")
    .textContent =
    "";
}


async function validateDoorCandidateAttendance(
  candidate,
  button
) {

  if (
    doorAttendanceBusy ||
    !auth.currentUser ||
    !selectedAttendanceEventId
  ) {
    return;
  }


  const candidateRef =
    typeof candidate?.candidateRef ===
      "string"
      ? candidate.candidateRef
      : "";


  if (
    !/^[a-f0-9]{64}$/.test(
      candidateRef
    )
  ) {

    $("attendanceIdentityStatus")
      .textContent =
      "Esta coincidencia no tiene una referencia válida. Vuelve a realizar la búsqueda.";

    return;
  }


  const name =
    candidate.name ||
    "esta persona";


  const confirmed =
    window.confirm(
      `¿Confirmas que ${name} es la persona correcta y está físicamente presente en este evento?`
    );


  if (!confirmed) {
    return;
  }


  const eventId =
    selectedAttendanceEventId;


  const uid =
    auth.currentUser.uid;


  const currentGeneration =
    generation;


  doorAttendanceBusy =
    true;


  if (button) {

    button.disabled =
      true;

    button.textContent =
      "Validando participación…";
  }


  $("attendanceIdentityStatus")
    .textContent =
    `Validando a ${name} en TERRA…`;


  try {

    const {
      data
    } =
      await recordDoorEventAttendance({

        eventId,

        candidateRef,

        checkInMethod:
          "manual"
      });


    if (
      currentGeneration !==
        generation ||
      auth.currentUser?.uid !==
        uid ||
      selectedAttendanceEventId !==
        eventId
    ) {
      return;
    }


    if (
      data?.success !==
        true ||
      data?.affiliationVerified !==
        true
    ) {

      throw new Error(
        "TERRA no confirmó la afiliación de esta persona."
      );
    }


    $("attendanceIdentityStatus")
      .textContent =
      data.unchanged === true
        ? `✅ PERSONA CONFIRMADA EN TERRA. La participación de ${name} ya estaba registrada en este evento.`
        : `✅ PERSONA CONFIRMADA EN TERRA. Participación operativa de ${name} validada correctamente.`;


    if (button) {

      button.disabled =
        true;

      button.textContent =
        data.unchanged === true
          ? "Participación ya validada"
          : "✅ Participación validada";
    }


  } catch (error) {

    $("attendanceIdentityStatus")
      .textContent =
      error.message ||
      "No fue posible validar la participación.";


    if (button) {

      button.disabled =
        false;

      button.textContent =
        "Confirmar persona y validar participación";
    }


  } finally {

    doorAttendanceBusy =
      false;
  }
}


function renderAttendanceIdentityCandidates(
  data
) {

  const list =
    $("attendanceIdentityResults");


  list.replaceChildren();


  const candidates =
    Array.isArray(
      data?.candidates
    )
      ? data.candidates
      : [];


  if (!candidates.length) {

    $("attendanceIdentityStatus")
      .textContent =
      "PERSONA NO REGISTRADA EN TERRA. Pregúntale quién lo invitó y dile que busque a esa persona para que complete su afiliación desde su propio dispositivo. Después debe volver a pasar por recepción para validar su primera misión dentro de la estructura. Recepción no asigna estructura, tutor ni nivel.";

    return;
  }


  const total =
    Number(
      data?.totalCandidates
    ) ||
    candidates.length;


  $("attendanceIdentityStatus")
    .textContent =
    `${total} posible${
      total === 1 ? "" : "s"
    } coincidencia${
      total === 1 ? "" : "s"
    }. Revisa antes de continuar.`;


  for (
    const candidate of
    candidates
  ) {

    const card =
      node(
        "article",
        ""
      );


    card.className =
      "attendance-person";


    card.append(
      node(
        "strong",
        candidate.name ||
        "Sin nombre"
      )
    );


    if (candidate.locality) {

      card.append(
        node(
          "p",
          `Población: ${
            candidate.locality
          }`
        )
      );
    }


    if (candidate.phoneHint) {

      card.append(
        node(
          "p",
          `Teléfono: ${
            candidate.phoneHint
          }`
        )
      );
    }


    const reasons =
      (
        candidate.matchReasons ||
        []
      )
        .map(
          reason =>
            ATTENDANCE_IDENTITY_REASON_LABELS[
              reason
            ] ||
            reason
        )
        .join(", ");


    if (reasons) {

      card.append(
        node(
          "p",
          `Coincidencias: ${reasons}`
        )
      );
    }


    const warning =
      node(
        "p",
        "Posible persona ya registrada. Requiere revisión humana antes de crear o reasignar."
      );


    warning.className =
      "message";


    const validateButton =
      node(
        "button",
        "Confirmar persona y validar participación"
      );


    validateButton.type =
      "button";

    validateButton.className =
      "button";


    const candidateRef =
      typeof candidate.candidateRef ===
        "string"
        ? candidate.candidateRef
        : "";


    if (
      !/^[a-f0-9]{64}$/.test(
        candidateRef
      )
    ) {

      validateButton.disabled =
        true;

      validateButton.title =
        "Vuelve a buscar esta persona para obtener una referencia válida.";

    } else {

      validateButton.onclick =
        () =>
          validateDoorCandidateAttendance(
            candidate,
            validateButton
          );
    }


    card.append(
      warning,
      validateButton
    );


    list.append(
      card
    );
  }


  if (data?.limited) {

    list.append(
      node(
        "p",
        "Hay más coincidencias de las mostradas. Refina la búsqueda."
      )
    );
  }
}


async function searchAttendanceIdentity() {

  if (
    attendanceIdentitySearchBusy ||
    !auth.currentUser ||
    !attendanceWorkspace ||
    !selectedAttendanceEventId
  ) {
    return;
  }


  const phone =
    $("attendanceIdentityPhone")
      .value
      .trim();


  const name =
    $("attendanceIdentityName")
      .value
      .trim();


  const locality =
    $("attendanceIdentityLocality")
      .value
      .trim();


  const phoneDigits =
    phone.replace(
      /\D/g,
      ""
    );


  if (
    !phoneDigits &&
    (
      name.length < 4 ||
      locality.length < 2
    )
  ) {

    $("attendanceIdentityStatus")
      .textContent =
      "Ingresa un teléfono o escribe nombre completo y población.";

    return;
  }


  if (
    phoneDigits &&
    (
      phoneDigits.length < 10 ||
      phoneDigits.length > 15
    )
  ) {

    $("attendanceIdentityStatus")
      .textContent =
      "Revisa el teléfono. Debe contener entre 10 y 15 dígitos.";

    return;
  }


  attendanceIdentitySearchBusy =
    true;


  $("attendanceIdentitySearchButton")
    .disabled =
    true;


  $("attendanceIdentityStatus")
    .textContent =
    "Buscando posibles coincidencias…";


  $("attendanceIdentityResults")
    .replaceChildren();


  const uid =
    auth.currentUser.uid;


  const currentGeneration =
    generation;


  const currentEventId =
    selectedAttendanceEventId;


  try {

    const {
      data
    } =
      await searchPersonCandidates({
        phone,
        name,
        locality
      });


    if (
      currentGeneration !==
        generation ||
      auth.currentUser?.uid !==
        uid ||
      selectedAttendanceEventId !==
        currentEventId
    ) {
      return;
    }


    renderAttendanceIdentityCandidates(
      data
    );

  } catch (error) {

    $("attendanceIdentityStatus")
      .textContent =
      error.message ||
      "No fue posible buscar posibles coincidencias.";

  } finally {

    attendanceIdentitySearchBusy =
      false;


    $("attendanceIdentitySearchButton")
      .disabled =
      false;
  }
}


function renderAttendanceControl() {

  const panel =
    $("attendanceControlPanel");


  if (
    !panel ||
    !attendanceWorkspace
  ) {
    return;
  }


  const event =
    attendanceWorkspace.event ||
    {};


  const summary =
    attendanceWorkspace.summary ||
    {};


  panel.hidden =
    false;


  $("attendanceTitle")
    .textContent =
    event.title ||
    "Control de asistencia";


  $("attendanceEventMeta")
    .textContent =
    `${
      formatDate(
        event.startsAt
      )
    } · ${
      event.venue ||
      "Lugar sin especificar"
    }`;


  $("attendanceScope")
    .textContent =
    attendanceWorkspace
      .canValidateWholeEvent
      ? "Control completo del evento."
      : "Control de tus invitaciones directas.";


  $("attendanceTotal")
    .textContent =
    String(
      summary.total || 0
    );


  $("attendanceConfirmed")
    .textContent =
    String(
      summary.attending || 0
    );


  $("attendancePresent")
    .textContent =
    String(
      summary.checkedIn || 0
    );


  $("attendancePending")
    .textContent =
    String(
      summary.pending || 0
    );


  $("attendanceNotAttending")
    .textContent =
    String(
      summary.notAttending || 0
    );


  const checkInOpen =
    attendanceCheckInIsOpen(
      event
    );


  const checkInClosed =
    attendanceCheckInHasClosed(
      event
    );


  $("attendanceTimingStatus")
    .textContent =
    checkInOpen
      ? "La recepción de asistentes está abierta. Puedes registrar presencia física."
      : (
          checkInClosed
            ? "ASISTENCIA CERRADA. El registro terminó 1 hora 30 minutos después de la hora citada."
            : "Puedes consultar el padrón. La recepción se habilitará 45 minutos antes de la hora citada."
        );


  renderAttendancePeople();
}


async function openAttendanceControl(
  eventId
) {

  if (
    attendanceBusy ||
    !auth.currentUser
  ) {
    return;
  }


  const attendanceEventChanged =
    selectedAttendanceEventId !==
    eventId;


  selectedAttendanceEventId =
    eventId;


  if (attendanceEventChanged) {

    clearAttendanceIdentitySearch(
      true
    );
  }


  attendanceBusy =
    true;


  $("attendanceStatus")
    .textContent =
    "Consultando padrón de asistencia…";


  $("attendanceControlPanel")
    .hidden =
    false;


  const uid =
    auth.currentUser.uid;


  const currentGeneration =
    generation;


  try {

    const {
      data
    } =
      await getEventAttendanceWorkspace({
        eventId
      });


    if (
      currentGeneration !==
        generation ||
      auth.currentUser?.uid !==
        uid
    ) {
      return;
    }


    attendanceWorkspace =
      data;


    renderAttendanceEventChooser();

    renderAttendanceControl();


    $("attendanceStatus")
      .textContent =
      data?.limits
        ?.invitationsTruncated
        ? "El padrón alcanzó el límite de consulta."
        : "Padrón actualizado.";


    $("attendanceControlPanel")
      .scrollIntoView({
        behavior:
          "smooth",

        block:
          "start"
      });

  } catch (error) {

    attendanceWorkspace =
      null;


    $("attendanceStatus")
      .textContent =
      error.message ||
      "No fue posible consultar la asistencia.";

  } finally {

    attendanceBusy =
      false;


    renderAttendancePeople();
  }
}


async function markAttendancePresent(
  invitation
) {

  if (
    attendanceBusy ||
    !attendanceWorkspace ||
    !selectedAttendanceEventId
  ) {
    return;
  }


  const name =
    invitation
      .assignedToName ||
    "esta persona";


  const confirmed =
    window.confirm(
      `¿Confirmas que ${name} está físicamente presente en el evento?`
    );


  if (!confirmed) {
    return;
  }


  attendanceBusy =
    true;


  $("attendanceStatus")
    .textContent =
    `Registrando asistencia de ${name}…`;


  renderAttendancePeople();


  try {

    await recordEventAttendance({
      invitationId:
        invitation.id,

      checkInMethod:
        "manual"
    });


    $("attendanceStatus")
      .textContent =
      `Asistencia registrada para ${name}.`;


    attendanceBusy =
      false;


    await openAttendanceControl(
      selectedAttendanceEventId
    );

  } catch (error) {

    $("attendanceStatus")
      .textContent =
      error.message ||
      "No fue posible registrar la asistencia.";


    attendanceBusy =
      false;


    renderAttendancePeople();
  }
}


function closeAttendanceControl() {

  attendanceWorkspace =
    null;

  selectedAttendanceEventId =
    null;

  attendanceBusy =
    false;


  $("attendanceControlPanel")
    .hidden =
    true;


  $("attendanceSearch")
    .value =
    "";


  $("attendanceStatus")
    .textContent =
    "";


  attendanceIdentitySearchBusy =
    false;


  clearAttendanceIdentitySearch(
    true
  );


  renderAttendanceEventChooser();
}


// ======================================================
// RENDER GENERAL
// ======================================================

function renderWorkspace() {

  if (!workspace) {
    return;
  }

  const isBaseCollaborator =
    workspace.viewer.role ===
    "colaborador_base";


  mountEventShortcuts();


  const attendanceShortcut =
    $("attendanceShortcut");

  if (attendanceShortcut) {
    attendanceShortcut.hidden =
      isBaseCollaborator;
  }


  const createdMetric =
    $("createdCount")
      ?.closest(".card");

  if (createdMetric) {
    createdMetric.hidden =
      isBaseCollaborator;
  }


  const assigneeMetric =
    $("assigneeCount")
      ?.closest(".card");

  if (assigneeMetric) {
    assigneeMetric.hidden =
      isBaseCollaborator;
  }


  $("sessionLabel").textContent =
    `Sesión: ${
      workspace.viewer.name
    } · ${
      ROLE_LABELS[
        workspace.viewer.role
      ] ||
      workspace.viewer.role
    }`;


  $("metricsSection").hidden =
    false;


  $("receivedSection").hidden =
    false;


  $("createdSection").hidden =
    isBaseCollaborator;


  $("newEventSection").hidden =
    !(
      workspace.viewer.role ===
        "coordinador_municipal" &&
      workspace.canCreateEvent
    );


  $("totalEvents").textContent =
    String(
      workspace.events.length
    );


  $("receivedCount").textContent =
    String(
      workspace.receivedInvitations
        .length
    );


  $("createdCount").textContent =
    String(
      workspace.createdInvitations
        .length
    );


  $("assigneeCount").textContent =
    String(
      workspace.assignees.length
    );


  renderAssignees();


  renderTransportEventChooser();

  renderAttendanceEventChooser();


  const received =
    $("receivedEvents");


  received.replaceChildren();


  for (
    const invitation of
    workspace.receivedInvitations
  ) {

    received.append(
      createEventCard(
        invitation,
        "received"
      )
    );
  }


  if (
    !workspace.receivedInvitations
      .length
  ) {

    received.append(
      node(
        "p",
        "No tienes eventos asignados."
      )
    );
  }


  const created =
    $("createdEvents");


  created.replaceChildren();


  for (
    const invitation of
    workspace.createdInvitations
  ) {

    created.append(
      createEventCard(
        invitation,
        "created"
      )
    );
  }


  if (
    !workspace.createdInvitations
      .length
  ) {

    created.append(
      node(
        "p",
        "Todavía no has creado invitaciones de eventos."
      )
    );
  }


  const warnings = [];


  if (
    workspace.limits
      ?.assigneesTruncated
  ) {
    warnings.push(
      "La lista de personas alcanzó el límite de consulta."
    );
  }


  if (
    workspace.limits
      ?.receivedTruncated
  ) {
    warnings.push(
      "La lista de eventos recibidos alcanzó el límite de consulta."
    );
  }


  if (
    workspace.limits
      ?.createdTruncated
  ) {
    warnings.push(
      "La lista de invitaciones creadas alcanzó el límite de consulta."
    );
  }


  $("workspaceStatus").textContent =
    warnings.length
      ? warnings.join(" ")
      : "Eventos actualizados.";
}


// ======================================================
// CARGA
// ======================================================

async function reload() {

  const uid =
    auth.currentUser?.uid;


  if (!uid) {
    return;
  }


  const currentGeneration =
    ++generation;


  $("refreshButton").disabled =
    true;


  $("workspaceStatus").textContent =
    "Consultando eventos…";


  try {

    const {
      data
    } =
      await getEventWorkspace({});


    if (
      currentGeneration !==
        generation ||
      auth.currentUser?.uid !==
        uid
    ) {
      return;
    }


    workspace =
      data;


    renderWorkspace();

  } catch (error) {

    if (
      currentGeneration !==
        generation
    ) {
      return;
    }


    $("workspaceStatus").textContent =
      error.message ||
      "No fue posible cargar los eventos.";

  } finally {

    if (
      currentGeneration ===
        generation
    ) {

      $("refreshButton").disabled =
        false;
    }
  }
}


// ======================================================
// CREAR EVENTO
// ======================================================

$("selectAllAssignees")
  .addEventListener(
    "change",
    () => {

      document
        .querySelectorAll(
          ".event-assignee-checkbox"
        )
        .forEach(
          checkbox => {

            checkbox.checked =
              $("selectAllAssignees")
                .checked;
          }
        );
    }
  );


$("delegateSelectAllAssignees")
  .addEventListener(
    "change",
    () => {

      document
        .querySelectorAll(
          ".delegate-assignee-checkbox"
        )
        .forEach(
          checkbox => {

            checkbox.checked =
              $("delegateSelectAllAssignees")
                .checked;
          }
        );


      syncDelegateSelectAll();
    }
  );


$("delegateAssigneeList")
  .addEventListener(
    "change",
    event => {

      if (
        event.target.matches(
          ".delegate-assignee-checkbox"
        )
      ) {
        syncDelegateSelectAll();
      }
    }
  );


$("newEventForm")
  .addEventListener(
    "submit",

    async event => {

      event.preventDefault();


      if (
        busy ||
        !workspace
      ) {

        return;
      }


      if (
        workspace.viewer.role !==
          "coordinador_municipal"
      ) {

        $("newEventStatus")
          .textContent =
          "Tu perfil no puede crear eventos generales.";

        return;
      }


      const starts =
        new Date(
          $("eventStartsAt").value
        );


      if (
        !Number.isFinite(
          starts.getTime()
        ) ||
        starts.getTime() <=
          Date.now()
      ) {

        $("newEventStatus")
          .textContent =
          "Selecciona una fecha y hora futura.";

        return;
      }


      const payload = {

        title:
          $("eventTitle")
            .value
            .trim(),

        description:
          $("eventDescription")
            .value
            .trim(),

        venue:
          $("eventVenue")
            .value
            .trim(),

        locality:
          $("eventLocality")
            .value
            .trim(),

        startsAt:
          starts.toISOString(),

        confirmationLeadMinutes:
          Number(
            $("eventConfirmationLeadMinutes")
              .value
          )
      };


      const fingerprint =
        JSON.stringify(
          payload
        );


      if (
        createAttempt
          ?.fingerprint !==
        fingerprint
      ) {

        createAttempt = {
          fingerprint,

          requestId:
            crypto.randomUUID()
        };
      }


      busy =
        true;


      $("saveEventButton")
        .disabled =
        true;


      $("newEventStatus")
        .textContent =
        "Creando evento y resolviendo alcance…";


      try {

        // ==============================================
        // 1. CREAR EVENTO GENERAL
        // ==============================================

        const creationResult =
          await createGeneralEvent({
            ...payload,

            requestId:
              createAttempt.requestId
          });


        const eventId =
          creationResult
            ?.data
            ?.eventId;


        if (!eventId) {

          throw new Error(
            "TERRA creó una respuesta incompleta para el evento."
          );
        }


        $("newEventStatus")
          .textContent =
          "Evento creado. Identificando personas dentro del alcance…";


        // ==============================================
        // 2. RESOLVER EVENT SCOPE AUTOMATICAMENTE
        // ==============================================

        const scopeResult =
          await resolveGeneralEventScope({

            eventId,

            requestId:
              `${createAttempt.requestId}-scope`
          });


        const scope =
          scopeResult?.data ||
          {};


        const memberCount =
          Number(
            scope.memberCount
          ) || 0;


        const digitalCount =
          Number(
            scope.digitalMemberCount
          ) || 0;


        const accountlessCount =
          Number(
            scope.accountlessMemberCount
          ) || 0;


        // ==============================================
        // 3. EXITO
        // ==============================================

        createAttempt =
          null;


        $("newEventForm")
          .reset();


        $("newEventStatus")
          .textContent =
          `✓ Evento general creado. ` +
          `Personas dentro del alcance: ${memberCount}. ` +
          `Con cuenta digital: ${digitalCount}. ` +
          `Sin cuenta digital: ${accountlessCount}.`;


        await reload();


        // ==============================================
        // 4. CONTINUIDAD UX
        // ==============================================

        const transportSection =
          $("transportSection");


        if (
          transportSection &&
          !transportSection.hidden
        ) {

          transportSection
            .scrollIntoView({
              behavior:
                "smooth",

              block:
                "start"
            });
        }

      } catch (error) {

        $("newEventStatus")
          .textContent =
          `${
            error.message ||
            "No se pudo completar la creación del evento."
          } Puedes reintentar sin cambiar los datos.`;

      } finally {

        busy =
          false;


        $("saveEventButton")
          .disabled =
          false;
      }
    }
  );


// ======================================================
// DELEGAR EVENTO RECIBIDO
// ======================================================

function eventDelegationIsOpen(
  event
) {

  if (
    !event ||
    event.active !== true
  ) {
    return false;
  }


  const closesAtMillis =
    Number.isFinite(
      event.confirmationClosesAtMillis
    )
      ? event.confirmationClosesAtMillis
      : (
          Date.parse(
            event.startsAt || ""
          ) -
          (
            Number.isFinite(
              event.confirmationLeadMinutes
            )
              ? event.confirmationLeadMinutes
              : 60
          ) *
          60 *
          1000
        );


  const startsAtMillis =
    Date.parse(
      event.startsAt || ""
    );


  return (
    Number.isFinite(
      closesAtMillis
    ) &&
    Number.isFinite(
      startsAtMillis
    ) &&
    Date.now() <
      closesAtMillis &&
    Date.now() <
      startsAtMillis
  );
}


function openDelegate(
  invitationId
) {

  const invitation =
    workspace
      ?.receivedInvitations
      ?.find(
        item =>
          item.id ===
          invitationId
      );


  if (
    !invitation ||
    !canDelegateInvitation(
      invitation
    )
  ) {
    return;
  }


  const event =
    eventById(
      invitation.eventId
    );


  if (
    !eventDelegationIsOpen(
      event
    )
  ) {

    $("delegateSection").hidden =
      true;

    return;
  }


  selectedInvitationId =
    invitationId;


  delegateAttempt =
    null;


  $("delegateTitle")
    .textContent =
    `Delegar: ${
      event?.title ||
      "Evento"
    }`;


  $("delegateDescription")
    .textContent =
    `Fecha: ${
      formatDate(
        event?.startsAt
      )
    } · Lugar: ${
      event?.venue ||
      "Sin especificar"
    }`;


  $("delegateStatus")
    .textContent =
    "";


  renderDelegateAssignees();


  $("delegateSection").hidden =
    false;


  $("delegateSection")
    .scrollIntoView({
      behavior:
        "smooth",

      block:
        "start"
    });
}


$("delegateCancelButton")
  .addEventListener(
    "click",
    () => {

      selectedInvitationId =
        null;

      delegateAttempt =
        null;

      $("delegateSection").hidden =
        true;

      $("delegateForm").reset();

      $("delegateStatus")
        .textContent =
        "";
    }
  );


$("delegateForm")
  .addEventListener(
    "submit",

    async event => {

      event.preventDefault();


      if (
        busy ||
        !workspace ||
        !selectedInvitationId
      ) {
        return;
      }


      const assigneeIds =
        [
          ...document
            .querySelectorAll(
              ".delegate-assignee-checkbox:checked"
            )
        ]
          .map(
            input =>
              input.value
          )
          .sort();


      if (
        !assigneeIds.length ||
        assigneeIds.length > 50
      ) {

        $("delegateStatus")
          .textContent =
          "Selecciona entre 1 y 50 personas.";

        return;
      }


      const payload = {
        parentInvitationId:
          selectedInvitationId,

        assigneeIds
      };


      const fingerprint =
        JSON.stringify(
          payload
        );


      if (
        delegateAttempt
          ?.fingerprint !==
        fingerprint
      ) {

        delegateAttempt = {
          fingerprint,

          requestId:
            crypto.randomUUID()
        };
      }


      busy =
        true;


      $("delegateSaveButton")
        .disabled =
        true;


      $("delegateStatus")
        .textContent =
        "Delegando evento…";


      try {

        const {
          data
        } =
          await createEventInvitations({
            ...payload,

            requestId:
              delegateAttempt.requestId
          });


        delegateAttempt =
          null;


        $("delegateStatus")
          .textContent =
          `Delegación guardada. Nuevas: ${
            data.created
          }. Ya existentes: ${
            data.alreadyAssigned
          }.`;


        await reload();


        selectedInvitationId =
          null;


        $("delegateSection").hidden =
          true;


        $("delegateForm").reset();

      } catch (error) {

        $("delegateStatus")
          .textContent =
          `${
            error.message ||
            "No se pudo delegar el evento."
          } Puedes reintentar sin cambiar la selección.`;

      } finally {

        busy =
          false;


        $("delegateSaveButton")
          .disabled =
          false;
      }
    }
  );


// ======================================================
// ASISTENCIA · EVENTOS DE INTERFAZ
// ======================================================

$("attendanceSearch")
  .addEventListener(
    "input",
    renderAttendancePeople
  );


$("attendanceCloseButton")
  .addEventListener(
    "click",
    closeAttendanceControl
  );



$("transportCloseButton")
  .addEventListener(
    "click",
    closeTransportControl
  );


$("transportVehicleForm")
  .addEventListener(
    "submit",
    submitTransportVehicle
  );


// ======================================================
// BOTONES GENERALES
// ======================================================

$("refreshButton")
  .addEventListener(
    "click",
    reload
  );


$("backButton")
  .addEventListener(
    "click",
    () => {

      if (
        history.length > 1
      ) {

        history.back();

      } else {

        location.href =
          "./login.html";
      }
    }
  );


$("logoutButton")
  .addEventListener(
    "click",

    async () => {

      await signOut(auth);

      location.replace(
        "./login.html"
      );
    }
  );


$("attendanceIdentitySearchForm")
  .addEventListener(
    "submit",

    event => {

      event.preventDefault();

      searchAttendanceIdentity();
    }
  );


$("attendanceIdentityClearButton")
  .addEventListener(
    "click",

    () => {

      clearAttendanceIdentitySearch(
        true
      );
    }
  );



// ======================================================
// SESIÓN
// ======================================================

onAuthStateChanged(
  auth,

  user => {

    generation++;

    workspace =
      null;

    createAttempt =
      null;

    delegateAttempt =
      null;

    selectedInvitationId =
      null;

    attendanceWorkspace =
      null;

    selectedAttendanceEventId =
      null;

    attendanceBusy =
      false;

    transportWorkspace =
      null;

    selectedTransportEventId =
      null;

    transportBusy =
      false;

    attendanceIdentitySearchBusy =
      false;


    $("metricsSection").hidden =
      true;

    $("newEventSection").hidden =
      true;

    $("receivedSection").hidden =
      true;

    $("createdSection").hidden =
      true;

    $("transportSection").hidden =
      true;

    $("transportControlPanel").hidden =
      true;

    $("attendanceSection").hidden =
      true;

    $("attendanceControlPanel").hidden =
      true;

    $("delegateSection").hidden =
      true;


    if (!user) {

      location.replace(
        "./login.html"
      );

      return;
    }


    reload();
  }
);
