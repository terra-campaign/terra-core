import {
  auth
} from "./firebase-config.js";


import {
  createTerraWhatsAppCommunication
} from "./terra-whatsapp.js?v=build-118a-3b-002";


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


const $ =
  id =>
    document.getElementById(id);


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
    "Participante"
};


let workspace = null;
let generation = 0;
let createAttempt = null;
let delegateAttempt = null;
let selectedInvitationId = null;
let busy = false;


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


    if (
      canDelegateInvitation(
        invitation
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
      })
    );
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

  const items = [
    {
      label:
        "↓ Eventos que me asignaron",
      id:
        "receivedEvents"
    },
    {
      label:
        "↓ Invitaciones que he creado",
      id:
        "createdEvents"
    }
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
// RENDER GENERAL
// ======================================================

function renderWorkspace() {

  if (!workspace) {
    return;
  }

  mountEventShortcuts();


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
    false;


  $("newEventSection").hidden =
    !workspace.canCreateEvent;


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


      const assigneeIds =
        [
          ...document
            .querySelectorAll(
              ".event-assignee-checkbox:checked"
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

        $("newEventStatus")
          .textContent =
          "Selecciona entre 1 y 50 personas.";

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
        assigneeIds,

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
          starts.toISOString()
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
        "Guardando evento…";


      try {

        const {
          data
        } =
          await createEventInvitations({
            ...payload,

            requestId:
              createAttempt.requestId
          });


        createAttempt =
          null;


        $("newEventForm")
          .reset();


        $("newEventStatus")
          .textContent =
          `Evento guardado. Invitaciones nuevas: ${
            data.created
          }. Ya existentes: ${
            data.alreadyAssigned
          }.`;


        await reload();

      } catch (error) {

        $("newEventStatus")
          .textContent =
          `${
            error.message ||
            "No se pudo guardar el evento."
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


    $("metricsSection").hidden =
      true;

    $("newEventSection").hidden =
      true;

    $("receivedSection").hidden =
      true;

    $("createdSection").hidden =
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
