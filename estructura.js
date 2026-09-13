// ======================================================
// TERRA CAMPAIGN
// ADMINISTRACIÓN DE ESTRUCTURA
// RESPONSABLE DE ESTRUCTURA + INTEGRANTES
// ======================================================

import {
  auth,
  db
} from "./firebase-config.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
  getFunctions,
  httpsCallable
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js";


// ======================================================
// ELEMENTOS
// ======================================================

const structureTitle =
  document.querySelector("#structureTitle");

const structureNameElement =
  document.querySelector("#structureName");

const structureIdElement =
  document.querySelector("#structureId");

const structureCoordinatorElement =
  document.querySelector("#structureCoordinator");

const structureMunicipalityElement =
  document.querySelector("#structureMunicipality");

const structureStatus =
  document.querySelector("#structureStatus");

const backButton =
  document.querySelector("#backButton");

const logoutButton =
  document.querySelector("#logoutButton");


// ======================================================
// RESPONSABLE DE ESTRUCTURA
// ======================================================

const newStructureChiefButton =
  document.querySelector("#newStructureChiefButton");

const structureChiefStatus =
  document.querySelector("#structureChiefStatus");

const structureChiefContainer =
  document.querySelector("#structureChiefContainer");

const structureChiefModal =
  document.querySelector("#structureChiefModal");

const closeStructureChiefModalButton =
  document.querySelector("#closeStructureChiefModalButton");

const structureChiefForm =
  document.querySelector("#structureChiefForm");

const structureChiefNameInput =
  document.querySelector("#structureChiefName");

const structureChiefEmailInput =
  document.querySelector("#structureChiefEmail");

const structureChiefPhoneInput =
  document.querySelector("#structureChiefPhone");

const structureChiefPasswordInput =
  document.querySelector("#structureChiefPassword");

const saveStructureChiefButton =
  document.querySelector("#saveStructureChiefButton");

const structureChiefFormStatus =
  document.querySelector("#structureChiefFormStatus");

const structureChiefWelcome =
  document.querySelector("#structureChiefWelcome");

const structureChiefWelcomeRecipient =
  document.querySelector("#structureChiefWelcomeRecipient");

const structureChiefWelcomePhone =
  document.querySelector("#structureChiefWelcomePhone");

const structureChiefWelcomeMessage =
  document.querySelector("#structureChiefWelcomeMessage");

const structureChiefWelcomeDirect =
  document.querySelector("#structureChiefWelcomeDirect");

const structureChiefWelcomeManual =
  document.querySelector("#structureChiefWelcomeManual");


// ======================================================
// INTEGRANTES
// ======================================================

const newMemberButton =
  document.querySelector("#newMemberButton");

const memberStatus =
  document.querySelector("#memberStatus");

const memberList =
  document.querySelector("#memberList");

const memberModal =
  document.querySelector("#memberModal");

const closeMemberModalButton =
  document.querySelector("#closeMemberModalButton");

const memberForm =
  document.querySelector("#memberForm");

const memberNameInput =
  document.querySelector("#memberName");

const memberEmailInput =
  document.querySelector("#memberEmail");

const memberPhoneInput =
  document.querySelector("#memberPhone");

const memberWhatsAppYesInput =
  document.querySelector("#memberWhatsAppYes");

const memberWhatsAppNoInput =
  document.querySelector("#memberWhatsAppNo");

const memberLocalityInput =
  document.querySelector("#memberLocality");

const memberStreetInput =
  document.querySelector("#memberStreet");

const memberHouseNumberInput =
  document.querySelector("#memberHouseNumber");

const memberPasswordInput =
  document.querySelector("#memberPassword");

const saveMemberButton =
  document.querySelector("#saveMemberButton");

const memberFormStatus =
  document.querySelector("#memberFormStatus");

const memberWelcome =
  document.querySelector("#memberWelcome");

const memberWelcomeRecipient =
  document.querySelector("#memberWelcomeRecipient");

const memberWelcomePhone =
  document.querySelector("#memberWelcomePhone");

const memberWelcomeChannelStatus =
  document.querySelector("#memberWelcomeChannelStatus");

const memberWelcomeWhatsApp =
  document.querySelector("#memberWelcomeWhatsApp");

const memberWelcomeMessage =
  document.querySelector("#memberWelcomeMessage");

const memberWelcomeDirect =
  document.querySelector("#memberWelcomeDirect");

const memberWelcomeManual =
  document.querySelector("#memberWelcomeManual");


// ======================================================
// ESTADO
// ======================================================

let currentUser = null;
let currentUserProfile = null;
let currentStructure = null;

let currentStructureChief = null;
let currentMembers = [];

let stopStructureUsersListener = null;


// ======================================================
// URL
// ======================================================

const urlParams =
  new URLSearchParams(
    window.location.search
  );

const structureDocumentId =
  String(
    urlParams.get("id") || ""
  ).trim();


// ======================================================
// CLOUD FUNCTIONS
// ======================================================

const functions =
  getFunctions(
    undefined,
    "us-central1"
  );

const createStructureChiefFunction =
  httpsCallable(
    functions,
    "createStructureChief"
  );

const createStructureMemberFunction =
  httpsCallable(
    functions,
    "createStructureMember"
  );


// ======================================================
// UTILIDADES
// ======================================================

function escapeHtml(value) {

  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


function showStatus(
  element,
  message,
  type = ""
) {

  if (!element) {
    return;
  }

  element.textContent =
    message;

  element.hidden =
    !message;

  element.className =
    "status";

  if (type) {
    element.classList.add(
      `status--${type}`
    );
  }
}


function getErrorMessage(error) {

  const message =
    error?.message ||
    error?.details ||
    "";

  if (
    error?.code ===
    "functions/already-exists"
  ) {
    return (
      message ||
      "Ya existe un registro con esos datos."
    );
  }

  if (
    error?.code ===
    "functions/permission-denied"
  ) {
    return "No tiene permisos para realizar esta operación.";
  }

  if (
    error?.code ===
    "functions/unauthenticated"
  ) {
    return "La sesión no es válida. Inicie sesión nuevamente.";
  }

  if (
    error?.code ===
    "functions/not-found"
  ) {
    return (
      message ||
      "No se encontró el registro solicitado."
    );
  }

  if (
    error?.code ===
    "functions/invalid-argument"
  ) {
    return (
      message ||
      "Revise los datos ingresados."
    );
  }

  if (
    error?.code ===
    "functions/failed-precondition"
  ) {
    return (
      message ||
      "No se cumplen las condiciones necesarias para realizar esta operación."
    );
  }

  return (
    message ||
    "No fue posible completar la operación."
  );
}


// ======================================================
// PERFIL DEL USUARIO
// ======================================================

async function loadCurrentUserProfile(
  user
) {

  const reference =
    doc(
      db,
      "usuarios",
      user.uid
    );

  const snapshot =
    await getDoc(
      reference
    );

  if (!snapshot.exists()) {
    throw new Error(
      "El usuario no tiene un perfil autorizado."
    );
  }

  const profile = {
    uid:
      snapshot.id,

    ...snapshot.data()
  };

  if (
    profile.active !== true
  ) {
    throw new Error(
      "El usuario está desactivado."
    );
  }

 if (
  ![
  "admin",
  "coordinador_municipal",
  "jefe_estructura"
].includes(profile.role)
) {
  throw new Error(
    "No tienes autorización para administrar esta estructura."
  );
}

  if (
    !profile.campaignId
  ) {
    throw new Error(
      "El administrador no tiene campaña asignada."
    );
  }

  return profile;
}


// ======================================================
// CARGAR ESTRUCTURA
// ======================================================

async function loadStructure() {

  if (!structureDocumentId) {
    throw new Error(
      "No se especificó una estructura."
    );
  }

  const reference =
    doc(
      db,
      "estructuras",
      structureDocumentId
    );

  const snapshot =
    await getDoc(
      reference
    );

  if (!snapshot.exists()) {
    throw new Error(
      "La estructura no existe."
    );
  }

  const structure = {
    firestoreId:
      snapshot.id,

    ...snapshot.data()
  };

  if (
    structure.campaignId !==
    currentUserProfile.campaignId
  ) {
    throw new Error(
      "La estructura no pertenece a esta campaña."
    );
  }

  if (
  currentUserProfile.role ===
    "coordinador_municipal" &&
  structure.municipalityId !==
    currentUserProfile.municipalityId
) {
  throw new Error(
    "No tienes autorización para administrar estructuras de otro municipio."
  );
}

  // El responsable sólo puede abrir su estructura asignada.
if (
  currentUserProfile.role === "jefe_estructura" &&
  (
    !currentUserProfile.structureId ||
    !structure.id ||
    structure.id !== currentUserProfile.structureId
  )
) {
  throw new Error(
    "No tienes autorización para consultar esta estructura."
  );
}

  currentStructure =
    structure;

  if (structureTitle) {
    structureTitle.textContent =
      structure.name ||
      "Estructura";
  }

  if (structureNameElement) {
    structureNameElement.textContent =
      structure.name ||
      "Estructura";
  }

  if (structureIdElement) {
    structureIdElement.textContent =
      structure.id ||
      "";
  }

  if (structureCoordinatorElement) {
    structureCoordinatorElement.textContent =
  structure.coordinatorName
    ? `Responsable de organización: ${structure.coordinatorName}`
    : "";
  }

 if (structureCoordinatorElement) {
  structureCoordinatorElement.textContent = "";
}

  showStatus(
    structureStatus,
    ""
  );
}


// ======================================================
// RENDER RESPONSABLE DE ESTRUCTURA
// ======================================================

function renderStructureChief(
  chief
) {

  if (!structureChiefContainer) {
    return;
  }

  currentStructureChief =
    chief || null;

  if (structureCoordinatorElement) {
  structureCoordinatorElement.textContent = chief
    ? `Responsable de estructura: ${chief.name || "Sin nombre"}`
    : "Responsable de estructura: pendiente de asignación";
}

  if (!chief) {

    structureChiefContainer.innerHTML = `
      <div class="card">
        <p class="muted">
          Todavía no hay RESPONSABLE DE ESTRUCTURA asignado.
        </p>
      </div>
    `;

    if (newStructureChiefButton) {
      newStructureChiefButton.disabled =
        false;

      newStructureChiefButton.textContent =
        "+ Asignar responsable";
    }

    return;
  }

  const statusText =
    chief.active === true
      ? "Activo"
      : "Inactivo";

  structureChiefContainer.innerHTML = `
    <article class="card">

      <p class="eyebrow">
        RESPONSABLE DE ESTRUCTURA
      </p>

      <h3>
        ${escapeHtml(
          chief.name
        )}
      </h3>

      <p class="muted">
        ${escapeHtml(
          chief.email
        )}
      </p>

      ${
        chief.phone
          ? `
            <p class="muted">
              Tel:
              ${escapeHtml(
                chief.phone
              )}
            </p>
          `
          : ""
      }

      <p class="muted">
        Estado:
        ${escapeHtml(
          statusText
        )}
      </p>

            <div class="form-actions">

        <a
          class="button button--secondary button--small"
          href="./persona.html?id=${encodeURIComponent(
            chief.uid
          )}"
        >
          Ver perfil
        </a>

      </div>

    </article>
  `;

  if (newStructureChiefButton) {
    newStructureChiefButton.disabled =
      true;

    newStructureChiefButton.textContent =
      "Responsable asignado";
  }
}


// ======================================================
// RENDER INTEGRANTES
// ======================================================

function renderMembers(
  members
) {

  if (!memberList) {
    return;
  }

  currentMembers =
    members;

  if (
    members.length === 0
  ) {

    memberList.innerHTML = `
      <div class="card">
        <p class="muted">
          Todavía no hay integrantes registrados.
        </p>
      </div>
    `;

    return;
  }

  memberList.innerHTML =
    members
      .map(
        (member) => {

          const statusText =
            member.active === true
              ? "Activo"
              : "Inactivo";

         return `
  <article class="card">

    <p class="eyebrow">
      INTEGRANTE
    </p>

    <h3>
      ${escapeHtml(
        member.name
      )}
    </h3>

    <p class="muted">
      ${escapeHtml(
        member.email
      )}
    </p>

    ${
      member.phone
        ? `
          <p class="muted">
            Tel:
            ${escapeHtml(
              member.phone
            )}
          </p>
        `
        : ""
    }

    <p class="muted">
      Estado:
      ${escapeHtml(
        statusText
      )}
    </p>

    <div class="form-actions">

      <a
        class="button button--secondary"
        href="./participantes.html?id=${encodeURIComponent(
          member.uid
        )}"
      >
        Administrar participantes
      </a>

<a
  class="button button--secondary button--small"
  href="./persona.html?id=${encodeURIComponent(
    member.uid
  )}"
>
  Ver perfil
</a>
    </div>

  </article>
`;
        }
      )
      .join("");
}


// ======================================================
// ESCUCHAR PERSONAS DE LA ESTRUCTURA
// ======================================================

function listenStructureUsers() {

  if (
    stopStructureUsersListener
  ) {
    stopStructureUsersListener();
  }

 const structureUsersQuery =
  currentUserProfile.role ===
  "coordinador_municipal"

    ? query(

        collection(
          db,
          "usuarios"
        ),

        where(
          "campaignId",
          "==",
          currentUserProfile.campaignId
        ),

       where(
  "parentUserId",
  "==",
  currentUser.uid
),

        where(
          "structureId",
          "==",
          currentStructure.id
        )
      )

    : query(

        collection(
          db,
          "usuarios"
        ),

        where(
          "campaignId",
          "==",
          currentUserProfile.campaignId
        ),

        where(
          "structureId",
          "==",
          currentStructure.id
        )
      );

  

  stopStructureUsersListener =
    onSnapshot(

      structureUsersQuery,

      (snapshot) => {

        const users =
          [];

        snapshot.forEach(
          (documentSnapshot) => {

            users.push({
              uid:
                documentSnapshot.id,

              ...documentSnapshot.data()
            });
          }
        );

        const chief =
          users.find(
            (user) =>
              user.role ===
              "jefe_estructura"
          ) || null;

        const members =
          users.filter(
            (user) =>
              user.role ===
              "integrante"
          );

        renderStructureChief(
          chief
        );

        if (
  currentUserProfile.role ===
  "coordinador_municipal"
) {

  currentMembers = [];

  if (memberList) {
    memberList.innerHTML = `
      <div class="card">
        <p class="muted">
          El detalle del equipo está reservado
          al responsable de estructura.
        </p>
        <p class="muted">
          Consulta el avance reportado en el resumen de esta estructura.
        </p>
      </div>
    `;
  }

} else {

  renderMembers(
    members
  );
}

        showStatus(
          structureChiefStatus,
          ""
        );

        showStatus(
          memberStatus,
          ""
        );
      },

      (error) => {

        console.error(
          "Error al consultar personas de la estructura:",
          error
        );

        showStatus(
          structureChiefStatus,
          "No fue posible consultar el responsable de la estructura.",
          "error"
        );

        showStatus(
          memberStatus,
          "No fue posible consultar los integrantes.",
          "error"
        );
      }
    );
}


// ======================================================
// WHATSAPP · BIENVENIDA RESPONSABLE DE ESTRUCTURA
// ======================================================

function normalizeStructureChiefWhatsAppPhone(
  value
) {

  const digits =
    String(value || "")
      .replace(/\D/g, "");


  if (
    /^52\d{10}$/.test(digits)
  ) {
    return digits;
  }


  if (
    /^\d{10}$/.test(digits)
  ) {
    return `52${digits}`;
  }


  return "";
}


function showStructureChiefWelcome(
  user
) {

  const name =
    String(
      user?.name ||
      "Responsable de estructura"
    ).trim();


  const email =
    String(
      user?.email || ""
    ).trim();


  const structureName =
    String(
      user?.structureName ||
      currentStructure?.name ||
      ""
    ).trim();


  const municipalityName =
    String(
      user?.municipalityName ||
      currentStructure?.municipalityName ||
      ""
    ).trim();


  const whatsappNumber =
    normalizeStructureChiefWhatsAppPhone(
      user?.phone
    );


  const hasWhatsApp =
    user?.hasWhatsApp === true;


  const message = [
    "TERRA CAMPAIGN · Bienvenida",
    "",
    `Hola, ${name}.`,
    "",
    `Has sido registrado como Responsable de estructura${structureName ? " de " + structureName : ""}.`,
    municipalityName
      ? `Municipio: ${municipalityName}.`
      : "",
    "",
    "Tu acceso a TERRA CAMPAIGN ya está habilitado.",
    "",
    "Usuario:",
    email,
    "",
    "Ingresa aquí:",
    "https://terra-campaign.github.io/terra-core/login.html",
    "",
    "Por seguridad, tu contraseña temporal no se comparte en este mensaje.",
    "Recíbela por separado del responsable que realizó tu registro.",
    "",
    "Bienvenido al equipo territorial."
  ]
    .filter(
      (line, index, array) =>
        line !== "" ||
        index === 0 ||
        array[index - 1] !== ""
    )
    .join("\n");


  if (structureChiefWelcomeRecipient) {
    structureChiefWelcomeRecipient.textContent =
      `Destinatario: ${name}`;
  }


  if (structureChiefWelcomePhone) {
    structureChiefWelcomePhone.textContent =
      whatsappNumber
        ? `Teléfono: +${whatsappNumber}`
        : "Teléfono registrado no disponible o inválido.";
  }


  if (structureChiefWelcomeMessage) {
    structureChiefWelcomeMessage.value =
      message;
  }


  const updateLinks = () => {

    const preparedMessage =
      structureChiefWelcomeMessage?.value ||
      message;


    if (structureChiefWelcomeManual) {
      structureChiefWelcomeManual.href =
        "https://wa.me/?text=" +
        encodeURIComponent(
          preparedMessage
        );
    }


    if (
      structureChiefWelcomeDirect
    ) {

      if (
        hasWhatsApp &&
        whatsappNumber
      ) {

        structureChiefWelcomeDirect.hidden =
          false;

        structureChiefWelcomeDirect.textContent =
          `Abrir WhatsApp con ${name}`;

        structureChiefWelcomeDirect.href =
          "https://wa.me/" +
          whatsappNumber +
          "?text=" +
          encodeURIComponent(
            preparedMessage
          );

      } else {

        structureChiefWelcomeDirect.hidden =
          true;

        structureChiefWelcomeDirect
          .removeAttribute("href");
      }
    }
  };


  if (structureChiefWelcomeMessage) {
    structureChiefWelcomeMessage.oninput =
      updateLinks;
  }


  updateLinks();


  if (structureChiefWelcome) {
    structureChiefWelcome.hidden =
      false;
  }
}


// ======================================================
// MODAL RESPONSABLE DE ESTRUCTURA
// ======================================================

function openStructureChiefModal() {

  if (
    currentStructureChief
  ) {
    return;
  }

  structureChiefForm?.reset();

  if (structureChiefWelcome) {
    structureChiefWelcome.hidden =
      true;
  }

  if (structureChiefWelcomeMessage) {
    structureChiefWelcomeMessage.value =
      "";
  }

  showStatus(
    structureChiefFormStatus,
    ""
  );

  if (structureChiefModal) {
    structureChiefModal.hidden =
      false;
  }

  setTimeout(
    () => {
      structureChiefNameInput?.focus();
    },
    50
  );
}


function closeStructureChiefModal() {

  if (structureChiefModal) {
    structureChiefModal.hidden =
      true;
  }

  structureChiefForm?.reset();

  if (structureChiefWelcome) {
    structureChiefWelcome.hidden =
      true;
  }

  if (structureChiefWelcomeMessage) {
    structureChiefWelcomeMessage.value =
      "";
  }

  showStatus(
    structureChiefFormStatus,
    ""
  );
}


// ======================================================
// CREAR RESPONSABLE DE ESTRUCTURA
// ======================================================

async function handleCreateStructureChief(
  event
) {

  event.preventDefault();

  const name =
    String(
      structureChiefNameInput?.value ||
      ""
    )
      .trim()
      .replace(/\s+/g, " ");

  const email =
    String(
      structureChiefEmailInput?.value ||
      ""
    )
      .trim()
      .toLowerCase();

  const phone =
    String(
      structureChiefPhoneInput?.value ||
      ""
    )
      .trim();

  const hasWhatsApp =
    document.querySelector(
      "#structureChiefWhatsAppYes"
    )?.checked
      ? true
      : document.querySelector(
          "#structureChiefWhatsAppNo"
        )?.checked
        ? false
        : null;


  const password =
    String(
      structureChiefPasswordInput?.value ||
      ""
    );

  if (
    name.length < 2
  ) {

    showStatus(
      structureChiefFormStatus,
      "Ingrese el nombre completo.",
      "error"
    );

    structureChiefNameInput?.focus();

    return;
  }

  if (!email) {

    showStatus(
      structureChiefFormStatus,
      "Ingrese un correo electrónico.",
      "error"
    );

    structureChiefEmailInput?.focus();

    return;
  }

  if (
    hasWhatsApp === null
  ) {

    showStatus(
      structureChiefFormStatus,
      "Indica si este número tiene WhatsApp.",
      "error"
    );

    return;
  }


  if (
    hasWhatsApp === true &&
    !phone
  ) {

    showStatus(
      structureChiefFormStatus,
      "Si seleccionas WhatsApp: Sí, debes registrar un teléfono.",
      "error"
    );

    structureChiefPhoneInput?.focus();

    return;
  }


  if (
    password.length < 6
  ) {

    showStatus(
      structureChiefFormStatus,
      "La contraseña temporal debe tener al menos 6 caracteres.",
      "error"
    );

    structureChiefPasswordInput?.focus();

    return;
  }

  saveStructureChiefButton.disabled =
    true;

  saveStructureChiefButton.textContent =
    "Guardando...";

  showStatus(
    structureChiefFormStatus,
    "Registrando RESPONSABLE DE ESTRUCTURA..."
  );

  try {

    const result =
      await createStructureChiefFunction({
        name,
        email,
        phone,
        hasWhatsApp,
        password,
        structureDocumentId
      });

    const chief =
      result?.data?.user;

    showStatus(
      structureChiefFormStatus,
      chief?.name
        ? `${chief.name} registrado correctamente.`
        : "RESPONSABLE DE ESTRUCTURA registrado correctamente.",
      "success"
    );

    const createdChief =
      chief || {
        name,
        email,
        phone,
        hasWhatsApp,
        structureName:
          currentStructure?.name || "",
        municipalityName:
          currentStructure?.municipalityName || "",
        mustChangePassword:
          true
      };


    structureChiefForm?.reset();


    showStructureChiefWelcome(
      createdChief
    );

  } catch (error) {

    console.error(
      "Error al crear RESPONSABLE DE ESTRUCTURA:",
      error
    );

    showStatus(
      structureChiefFormStatus,
      getErrorMessage(error),
      "error"
    );

  } finally {

    saveStructureChiefButton.disabled =
      false;

    saveStructureChiefButton.textContent =
      "Guardar RESPONSABLE DE ESTRUCTURA";
  }
}


// ======================================================
// WHATSAPP · BIENVENIDA INTEGRANTE
// BUILD-116E-1
// ======================================================

function normalizeMemberWhatsAppPhone(value) {

  const digits =
    String(value || "")
      .replace(/\D/g, "");

  if (/^52\d{10}$/.test(digits)) {
    return digits;
  }

  if (/^\d{10}$/.test(digits)) {
    return `52${digits}`;
  }

  return "";
}


function resetMemberWelcome() {

  if (memberWelcome) {
    memberWelcome.hidden = true;
  }

  if (memberWelcomeWhatsApp) {
    memberWelcomeWhatsApp.hidden = true;
  }

  if (memberWelcomeMessage) {
    memberWelcomeMessage.value = "";
    memberWelcomeMessage.oninput = null;
  }

  if (memberWelcomeDirect) {
    memberWelcomeDirect.hidden = true;
    memberWelcomeDirect.removeAttribute("href");
  }

  if (memberWelcomeManual) {
    memberWelcomeManual.removeAttribute("href");
  }
}


function showMemberWelcome(user) {

  const name =
    String(
      user?.name ||
      "Integrante"
    ).trim();

  const email =
    String(
      user?.email || ""
    ).trim();

  const phone =
    String(
      user?.phone || ""
    ).trim();

  const hasWhatsApp =
    user?.hasWhatsApp === true;

  const structureName =
    String(
      user?.structureName ||
      currentStructure?.name ||
      ""
    ).trim();

  const municipalityName =
    String(
      user?.municipalityName ||
      currentStructure?.municipalityName ||
      ""
    ).trim();

  const whatsappNumber =
    normalizeMemberWhatsAppPhone(phone);


  if (memberWelcomeRecipient) {
    memberWelcomeRecipient.textContent =
      `Destinatario: ${name}`;
  }

  if (memberWelcomePhone) {
    memberWelcomePhone.textContent =
      phone
        ? `Teléfono: ${phone}`
        : "Teléfono: no registrado";
  }

  if (memberWelcome) {
    memberWelcome.hidden = false;
  }


  // --------------------------------------------------
  // USUARIO SIN WHATSAPP
  // --------------------------------------------------

  if (!hasWhatsApp) {

    if (memberWelcomeChannelStatus) {
      memberWelcomeChannelStatus.textContent =
        "WhatsApp: No. Entregue el usuario y la contraseña temporal por otro medio.";
    }

    if (memberWelcomeWhatsApp) {
      memberWelcomeWhatsApp.hidden = true;
    }

    return;
  }


  // --------------------------------------------------
  // USUARIO CON WHATSAPP
  // --------------------------------------------------

  if (memberWelcomeChannelStatus) {
    memberWelcomeChannelStatus.textContent =
      "WhatsApp: Sí.";
  }


  const message = [
    "TERRA CAMPAIGN · Bienvenida",
    "",
    `Hola, ${name}.`,
    "",
    `Has sido registrado como Integrante${structureName ? " de " + structureName : ""}.`,
    municipalityName
      ? `Municipio: ${municipalityName}.`
      : "",
    "",
    "Tu acceso a TERRA CAMPAIGN ya está habilitado.",
    "",
    "Usuario:",
    email,
    "",
    "Ingresa aquí:",
    "https://terra-campaign.github.io/terra-core/login.html",
    "",
    "Por seguridad, tu contraseña temporal no se comparte en este mensaje.",
    "Recíbela por separado del responsable que realizó tu registro.",
    "",
    "Bienvenido al equipo territorial."
  ]
    .filter(
      (line, index, array) =>
        line !== "" ||
        index === 0 ||
        array[index - 1] !== ""
    )
    .join("\n");


  if (memberWelcomeMessage) {
    memberWelcomeMessage.value = message;
  }


  const updateLinks = () => {

    const preparedMessage =
      memberWelcomeMessage?.value ||
      message;

    if (memberWelcomeManual) {
      memberWelcomeManual.href =
        "https://wa.me/?text=" +
        encodeURIComponent(
          preparedMessage
        );
    }

    if (memberWelcomeDirect) {

      if (whatsappNumber) {

        memberWelcomeDirect.hidden =
          false;

        memberWelcomeDirect.textContent =
          `Abrir WhatsApp con ${name}`;

        memberWelcomeDirect.href =
          "https://wa.me/" +
          whatsappNumber +
          "?text=" +
          encodeURIComponent(
            preparedMessage
          );

      } else {

        memberWelcomeDirect.hidden =
          true;

        memberWelcomeDirect
          .removeAttribute("href");
      }
    }
  };


  if (memberWelcomeMessage) {
    memberWelcomeMessage.oninput =
      updateLinks;
  }

  updateLinks();

  if (memberWelcomeWhatsApp) {
    memberWelcomeWhatsApp.hidden =
      false;
  }
}


// ======================================================
// MODAL INTEGRANTE
// ======================================================

function openMemberModal() {

  memberForm?.reset();

  resetMemberWelcome();

  showStatus(
    memberFormStatus,
    ""
  );

  if (memberModal) {
    memberModal.hidden =
      false;
  }

  setTimeout(
    () => {
      memberNameInput?.focus();
    },
    50
  );
}


function closeMemberModal() {

  if (memberModal) {
    memberModal.hidden =
      true;
  }

  memberForm?.reset();

  resetMemberWelcome();

  showStatus(
    memberFormStatus,
    ""
  );
}


// ======================================================
// CREAR INTEGRANTE
// ======================================================

async function handleCreateMember(event) {

  event.preventDefault();

  if (
    currentUserProfile?.active !== true ||
    currentUserProfile?.role !== "jefe_estructura"
  ) {
    showStatus(
      memberFormStatus,
      "Sólo el Responsable de estructura puede crear integrantes.",
      "error"
    );
    return;
  }

  if (
    !currentUserProfile.structureId ||
    !currentUserProfile.campaignId ||
    !currentStructure?.id ||
    !structureDocumentId ||
    currentStructure.id !== currentUserProfile.structureId ||
    currentStructure.campaignId !== currentUserProfile.campaignId ||
    currentStructure.firestoreId !== structureDocumentId
  ) {
    showStatus(
      memberFormStatus,
      "La estructura no coincide con tu asignación. Recarga la página.",
      "error"
    );
    return;
  }

  if (!saveMemberButton || saveMemberButton.disabled) {
    return;
  }

  const name = String(memberNameInput?.value || "")
    .trim()
    .replace(/\s+/g, " ");

  const email = String(memberEmailInput?.value || "")
    .trim()
    .toLowerCase();

  const phone = String(memberPhoneInput?.value || "")
    .trim();

  const hasWhatsApp =
    memberWhatsAppYesInput?.checked
      ? true
      : memberWhatsAppNoInput?.checked
        ? false
        : null;

  const locality = String(memberLocalityInput?.value || "")
    .trim()
    .replace(/\s+/g, " ");

  const street = String(memberStreetInput?.value || "")
    .trim()
    .replace(/\s+/g, " ");

  const houseNumber = String(memberHouseNumberInput?.value || "")
    .trim()
    .replace(/\s+/g, " ");

  const password = String(memberPasswordInput?.value || "");

  if (name.length < 2) {
    showStatus(
      memberFormStatus,
      "Ingrese el nombre completo.",
      "error"
    );
    memberNameInput?.focus();
    return;
  }

  if (!email) {
    showStatus(
      memberFormStatus,
      "Ingrese un correo electrónico.",
      "error"
    );
    memberEmailInput?.focus();
    return;
  }

  if (hasWhatsApp === null) {
    showStatus(
      memberFormStatus,
      "Indique si el teléfono tiene WhatsApp.",
      "error"
    );
    return;
  }

  if (
    hasWhatsApp === true &&
    !phone
  ) {
    showStatus(
      memberFormStatus,
      "Ingrese el teléfono que tiene WhatsApp.",
      "error"
    );
    memberPhoneInput?.focus();
    return;
  }

  if (locality.length < 2) {
    showStatus(
      memberFormStatus,
      "Ingrese la población.",
      "error"
    );
    memberLocalityInput?.focus();
    return;
  }

  if (street.length < 2) {
    showStatus(
      memberFormStatus,
      "Ingrese la calle.",
      "error"
    );
    memberStreetInput?.focus();
    return;
  }

  if (!houseNumber) {
    showStatus(
      memberFormStatus,
      "Ingrese el número o S/N.",
      "error"
    );
    memberHouseNumberInput?.focus();
    return;
  }

  if (password.length < 6) {
    showStatus(
      memberFormStatus,
      "La contraseña temporal debe tener al menos 6 caracteres.",
      "error"
    );
    memberPasswordInput?.focus();
    return;
  }

  saveMemberButton.disabled = true;
  saveMemberButton.textContent = "Guardando...";

  showStatus(
    memberFormStatus,
    "Registrando integrante..."
  );

  try {

    const result = await createStructureMemberFunction({
      name,
      email,
      phone,
      hasWhatsApp,
      locality,
      street,
      houseNumber,
      password,
      structureDocumentId
    });

    const member = result?.data?.user;

    showStatus(
      memberFormStatus,
      member?.name
        ? `${member.name} registrado correctamente.`
        : "Integrante registrado correctamente.",
      "success"
    );

    const createdMember =
      member || {
        name,
        email,
        phone,
        hasWhatsApp,
        locality,
        street,
        houseNumber,
        structureName:
          currentStructure?.name || "",
        municipalityName:
          currentStructure?.municipalityName || "",
        mustChangePassword:
          true
      };


    memberForm?.reset();


    showMemberWelcome(
      createdMember
    );

  } catch (error) {

    console.error(
      "Error al crear integrante:",
      error
    );

    showStatus(
      memberFormStatus,
      getErrorMessage(error),
      "error"
    );

  } finally {

    saveMemberButton.disabled = false;
    saveMemberButton.textContent = "Guardar integrante";
  }
}


// ======================================================
// EVENTOS JEFE
// ======================================================

newStructureChiefButton?.addEventListener(
  "click",
  openStructureChiefModal
);

closeStructureChiefModalButton?.addEventListener(
  "click",
  closeStructureChiefModal
);

structureChiefForm?.addEventListener(
  "submit",
  handleCreateStructureChief
);

structureChiefModal
  ?.querySelector(
    ".modal__backdrop"
  )
  ?.addEventListener(
    "click",
    closeStructureChiefModal
  );


// ======================================================
// EVENTOS INTEGRANTE
// ======================================================

newMemberButton?.addEventListener(
  "click",
  () => {

    if (
      currentUserProfile?.role !==
      "jefe_estructura"
    ) {
      console.warn(
        "Sólo el Responsable de estructura puede crear integrantes."
      );

      return;
    }

    openMemberModal();
  }
);


memberForm?.addEventListener(
  "submit",
  (event) => {

    event.preventDefault();

    if (
      currentUserProfile?.role !==
      "jefe_estructura"
    ) {
      console.warn(
        "Sólo el Responsable de estructura puede crear integrantes."
      );

      return;
    }

    handleCreateMember(
      event
    );
  }
);


closeMemberModalButton?.addEventListener(
  "click",
  closeMemberModal
);


memberModal
  ?.querySelector(
    ".modal__backdrop"
  )
  ?.addEventListener(
    "click",
    closeMemberModal
  );


// ======================================================
// VOLVER
// ======================================================

backButton?.addEventListener(
  "click",
  () => {

    if (
      currentStructure?.municipalityId
    ) {

      window.location.href =
        `./municipio.html?id=${encodeURIComponent(
          currentStructure.municipalityId
        )}`;

      return;
    }

    window.location.href =
      "./municipios.html";
  }
);


// ======================================================
// LOGOUT
// ======================================================

logoutButton?.addEventListener(
  "click",
  async () => {

    try {

      await signOut(
        auth
      );

    } finally {

      window.location.href =
        "./login.html";
    }
  }
);


// ======================================================
// AUTENTICACIÓN
// ======================================================

onAuthStateChanged(
  auth,

  async (user) => {

    if (!user) {

      window.location.href =
        "./login.html";

      return;
    }

    try {

      currentUser =
        user;

      currentUserProfile =
        await loadCurrentUserProfile(
          user
        );

      if (newMemberButton) {
  newMemberButton.hidden =
    currentUserProfile.role !== "jefe_estructura";
}

      await loadStructure();

      listenStructureUsers();
      void loadStructureProgress();

    } catch (error) {

      console.error(
        "Error al iniciar módulo de estructura:",
        error
      );

      alert(
        error.message ||
        "No fue posible abrir la estructura."
      );

      window.location.href =
        "./municipios.html";
    }
  }
);
// RESUMEN AGREGADO: la autorización y los cálculos se realizan en servidor.
const progressSection = document.createElement("section");
progressSection.className = "card";
progressSection.hidden = true;
progressSection.innerHTML = '<h2>Avance reportado</h2><p>Historial de misiones de las personas actualmente asignadas a esta estructura, incluido su responsable. Incluye misiones activas e inactivas.</p><p>Una evidencia indica un reporte; no certifica el cumplimiento.</p><button type="button" class="button button--secondary">Actualizar resumen</button><div aria-live="polite"></div>';
document.querySelector("main.workspace")?.prepend(progressSection);
const progressButton = progressSection.querySelector("button");
const progressOutput = progressSection.querySelector("[aria-live]");
const getStructureProgress = httpsCallable(functions, "getStructureProgress");
let progressVersion = 0;
onAuthStateChanged(auth, () => {
  progressVersion++;
  progressSection.hidden = true;
  progressOutput.replaceChildren();
});
progressButton.addEventListener("click", loadStructureProgress);

async function loadStructureProgress() {
  const uid = auth.currentUser?.uid;
  if (!uid || !currentStructure) return;
  const version = ++progressVersion;
  progressSection.hidden = false;
  progressButton.disabled = true;
  progressOutput.textContent = "Calculando resumen...";
  try {
    const {data} = await getStructureProgress({structureDocumentId});
    if (version !== progressVersion || auth.currentUser?.uid !== uid) return;
    progressOutput.replaceChildren();
    for (const [label, value] of [
      ["Misiones asignadas", data.total],
      ["Con evidencia", data.withEvidence],
      ["Sin evidencia", data.withoutEvidence],
      ["Avance reportado", data.percentage === null ? "Sin misiones" : data.percentage + "%"],
      ["Última evidencia", data.lastActivity === null ? "Sin evidencia" : new Date(data.lastActivity).toLocaleString("es-MX")],
      ["Resumen actualizado", new Date(data.calculatedAt).toLocaleString("es-MX")]
    ]) {
      const line = document.createElement("p");
      line.textContent = label + ": " + value;
      progressOutput.append(line);
    }
  } catch (error) {
    if (version !== progressVersion || auth.currentUser?.uid !== uid) return;
    progressOutput.textContent = "No fue posible obtener el resumen. " + getErrorMessage(error);
  } finally {
    if (version === progressVersion) progressButton.disabled = false;
  }
}
