// ======================================================
// TERRA CAMPAIGN
// MÓDULO PRIVADO DE MISIONES
// PRIMERA IMPLEMENTACIÓN FUNCIONAL
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
  getDocs,
  query,
  where,
  orderBy
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


import {getFunctions, httpsCallable} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js";
const functions = getFunctions(auth.app, "us-central1");
const createLinkedMissions = httpsCallable(functions, "createLinkedMissions");
const getMissionBranchProgress = httpsCallable(functions, "getMissionBranchProgress");
const missionAssigneeList = document.querySelector("#missionAssigneeList");
const missionSelectAll = document.querySelector("#missionSelectAll");
let parentMission = null;
let dispatchRequestId = null;
let submitting = false;

// ======================================================
// ELEMENTOS DE PANTALLA
// ======================================================

const logoutButton =
  document.querySelector("#logoutButton");

const newMissionButton =
  document.querySelector("#newMissionButton");

const refreshMissionsButton =
  document.querySelector("#refreshMissionsButton");

const missionsMessage =
  document.querySelector("#missionsMessage");

const missionsList =
  document.querySelector("#missionsList");

const totalMissionsElement =
  document.querySelector("#totalMissions");

const activeMissionsElement =
  document.querySelector("#activeMissions");

const totalEvidenceElement =
  document.querySelector("#totalEvidence");

const lastActivityElement =
  document.querySelector("#lastActivity");


// ======================================================
// MODAL
// ======================================================

const missionModal =
  document.querySelector("#missionModal");

const missionForm =
  document.querySelector("#missionForm");

const missionTitleInput =
  document.querySelector("#missionTitle");

const missionDescriptionInput =
  document.querySelector("#missionDescription");

const missionDateInput =
  document.querySelector("#missionDate");

const missionLocalityInput =
  document.querySelector("#missionLocality");

const missionAssigneeInput =
  document.querySelector("#missionAssignee");

const cancelMissionButton =
  document.querySelector("#cancelMissionButton");

const saveMissionButton =
  document.querySelector("#saveMissionButton");

const missionFormMessage =
  document.querySelector("#missionFormMessage");


// ======================================================
// ESTADO
// ======================================================

let currentUser = null;
let currentUserProfile = null;

let missions = [];


// ======================================================
// CARGAR PERFIL
// ======================================================

async function loadCurrentUserProfile(user) {

  const userRef =
    doc(db, "usuarios", user.uid);

  const snapshot =
    await getDoc(userRef);

  if (!snapshot.exists()) {
    throw new Error(
      "El usuario no tiene perfil autorizado."
    );
  }

  const profile = {
    ...snapshot.data(),
    uid: snapshot.id
  };

  if (profile.active !== true) {
    throw new Error(
      "El usuario está desactivado."
    );
  }

  if (!profile.campaignId) throw new Error("El perfil no tiene campaña asignada.");
  return profile;
}


// ======================================================
// VALIDAR ACCESO A MISIONES
// ======================================================

function validateMissionAccess(profile) {

  const allowedRoles = [
    "admin",
    "coordinador_municipal",
    "jefe_estructura",
    "integrante",
    "participante"
  ];

  if (!allowedRoles.includes(profile.role)) {
    throw new Error(
      "Tu usuario no tiene acceso al módulo de Misiones."
    );
  }
}

// ======================================================
function getAssignableRole(profile) {

  if (!profile) {
    return null;
  }

  switch (profile.role) {

    case "admin":
      return "coordinador_municipal";

    case "coordinador_municipal":
      return "jefe_estructura";

    case "jefe_estructura":
      return "integrante";

    case "integrante":
      return "participante";

    case "participante":
      return null;

    default:
      return null;
  }
}


// ======================================================
// APLICAR INTERFAZ SEGÚN ROL
// ======================================================

function applyRoleInterface() {

  if (!currentUserProfile) {
    return;
  }

  const assignableRole =
    getAssignableRole(
      currentUserProfile
    );

  newMissionButton.hidden =
    !assignableRole;
}


// ======================================================
// CARGAR PERSONAS DISPONIBLES PARA MISIÓN
// ======================================================

// ======================================================
// CARGAR SUBORDINADOS DIRECTOS PARA MISIÓN
// BUILD-116 — SELECCIÓN MÚLTIPLE
// ======================================================

async function loadAvailableAssignees() {

  if (!currentUserProfile) {
    return;
  }

  missionAssigneeList.innerHTML = `
    <p>
      Cargando personas...
    </p>
  `;

  missionSelectAll.checked =
    false;

  const campaignId =
    currentUserProfile.campaignId;

  const assignableRole =
    getAssignableRole(
      currentUserProfile
    );

  if (!assignableRole) {

    missionAssigneeList.innerHTML = `
      <p>
        No tienes personas disponibles para asignar misiones.
      </p>
    `;

    return;
  }

  try {

    let usersQuery;

    if (
      currentUserProfile.role ===
      "admin"
    ) {

      usersQuery =
        query(
          collection(
            db,
            "usuarios"
          ),

          where(
            "campaignId",
            "==",
            campaignId
          ),

          where(
            "role",
            "==",
            assignableRole
          )
        );

    } else {

      usersQuery =
        query(
          collection(
            db,
            "usuarios"
          ),

          where(
            "campaignId",
            "==",
            campaignId
          ),

          where(
            "role",
            "==",
            assignableRole
          ),

          where(
            "parentUserId",
            "==",
            currentUserProfile.uid
          )
        );
    }

    const snapshot =
      await getDocs(
        usersQuery
      );

    const people = [];

    snapshot.forEach(
      (documentSnapshot) => {

        const person = {
          uid:
            documentSnapshot.id,

          ...documentSnapshot.data()
        };

        if (
          person.active !== true
        ) {
          return;
        }

        if (
          currentUserProfile.role ===
          "admin"
        ) {

          people.push(person);

          return;
        }

        if (
          person.parentUserId ===
          currentUserProfile.uid
        ) {

          people.push(person);
        }
      }
    );

    people.sort(
      (a, b) =>
        String(
          a.name || ""
        ).localeCompare(
          String(
            b.name || ""
          ),
          "es"
        )
    );

    missionAssigneeList.innerHTML =
      "";

    people.forEach(
      (person) => {

        const label =
  document.createElement(
    "label"
  );

label.className =
  "mission-assignee-option";


const checkbox =
  document.createElement(
    "input"
  );

checkbox.type =
  "checkbox";

checkbox.className =
  "mission-assignee-checkbox";

checkbox.value =
  person.uid;

checkbox.dataset.name =
  person.name ||
  person.email ||
  person.uid;

checkbox.dataset.role =
  person.role ||
  "";

checkbox.dataset.municipalityId =
  person.municipalityId ||
  "";

checkbox.dataset.structureId =
  person.structureId ||
  "";


const info =
  document.createElement(
    "span"
  );

info.className =
  "mission-assignee-info";


const name =
  document.createElement(
    "strong"
  );

name.textContent =
  person.name ||
  person.email ||
  person.uid;


const role =
  document.createElement(
    "small"
  );

const roleLabels = {
  coordinador_municipal:
    "Responsable de organización",

  jefe_estructura:
    "Responsable de estructura",

  integrante:
    "Integrante",

  participante:
    "Participante"
};

role.textContent =
  roleLabels[
    person.role
  ] ||
  person.role ||
  "Persona";


info.appendChild(
  name
);

info.appendChild(
  role
);

label.appendChild(
  checkbox
);

label.appendChild(
  info
);

missionAssigneeList.appendChild(
  label
);
        
      }
    );

    if (!people.length) {

      missionAssigneeList.innerHTML = `
        <p>
          No existen personas disponibles en tu nivel inmediato inferior.
        </p>
      `;

      missionFormMessage.textContent =
        "No existen personas disponibles en tu nivel inmediato inferior.";
    }

  } catch (error) {

    console.error(
      "Error al cargar subordinados directos:",
      error
    );

    missionAssigneeList.innerHTML = `
      <p>
        No fue posible cargar las personas disponibles.
      </p>
    `;

    missionFormMessage.textContent =
      "No fue posible cargar las personas disponibles.";
  }
}


// ======================================================
// SELECCIONAR TODOS
// ======================================================

missionSelectAll.addEventListener(
  "change",
  () => {

    const checkboxes =
      missionAssigneeList
        .querySelectorAll(
          ".mission-assignee-checkbox"
        );

    checkboxes.forEach(
      (checkbox) => {

        checkbox.checked =
          missionSelectAll.checked;
      }
    );
  }
);

// ======================================================
// INICIO DE SESIÓN
// ======================================================

onAuthStateChanged(
  auth,
  async (user) => {

    if (!user) {
      currentUser = null;
      currentUserProfile = null;
      missions = [];
      missionsList.replaceChildren();
      missionModal.hidden = true;
      window.location.href =
        "./login.html";

      return;
    }

    currentUser = user;

    try {

      const loadedProfile = await loadCurrentUserProfile(user);
      if (auth.currentUser?.uid !== user.uid) return;
      currentUserProfile = loadedProfile;

      validateMissionAccess(
        currentUserProfile
      );

      applyRoleInterface();
await loadAvailableAssignees();
      await loadMissions();

    } catch (error) {

      console.error(
        "Acceso a Misiones rechazado:",
        error
      );

      missionsMessage.textContent =
        error.message ||
        "No fue posible validar el acceso.";

    }
  }
);


// ======================================================
// CERRAR SESIÓN
// ======================================================

logoutButton.addEventListener(
  "click",
  async () => {

    logoutButton.disabled = true;

    logoutButton.textContent =
      "Saliendo...";

    try {

      await signOut(auth);

      window.location.href =
        "./login.html";

    } catch (error) {

      console.error(
        "Error al cerrar sesión:",
        error
      );

      logoutButton.disabled = false;

      logoutButton.textContent =
        "Salir";

      alert(
        "No fue posible cerrar la sesión."
      );
    }
  }
);


// ======================================================
// ABRIR MODAL
// ======================================================

function openMissionModal(parent = null) {
  parentMission = parent;
  dispatchRequestId = crypto.randomUUID();
  missionForm.reset();
  missionFormMessage.textContent = "";
  document.querySelector("#missionModalTitle").textContent = parent ? "Delegar misión recibida" : "Nueva misión";
  for (const [input, field] of [[missionTitleInput,"title"], [missionDescriptionInput,"description"], [missionDateInput,"missionDate"], [missionLocalityInput,"locality"]]) {
    input.value = parent?.[field] || "";
    input.readOnly = !!parent;
  }
  missionModal.hidden = false;
  loadAvailableAssignees();
  (parent ? cancelMissionButton : missionTitleInput).focus();
}
newMissionButton.addEventListener("click", () => openMissionModal());
function closeMissionModal() {
  if (submitting) return;
  missionModal.hidden = true;
  missionForm.reset();
  parentMission = null;
  dispatchRequestId = null;
  newMissionButton.focus();
}
cancelMissionButton.addEventListener("click", closeMissionModal);
document.querySelectorAll("[data-close-mission-modal]").forEach(el => el.addEventListener("click", closeMissionModal));
document.addEventListener("keydown", event => { if (event.key === "Escape" && !missionModal.hidden) closeMissionModal(); });
missionForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (submitting || !currentUserProfile || !currentUser) return;
  const assigneeIds = Array.from(missionAssigneeList.querySelectorAll(".mission-assignee-checkbox:checked"), el => el.value);
  if (!assigneeIds.length || assigneeIds.length > 50) {
    missionFormMessage.textContent = "Selecciona entre 1 y 50 personas.";
    return;
  }
  const payload = {requestId:dispatchRequestId, parentMissionId:parentMission?.id || null, assigneeIds,
    title:missionTitleInput.value.trim(), description:missionDescriptionInput.value.trim(),
    missionDate:missionDateInput.value || null, locality:missionLocalityInput.value.trim()};
  submitting = true;
  const controls = Array.from(missionForm.elements);
  controls.forEach(el => el.disabled = true);
  saveMissionButton.textContent = "Guardando...";
  missionFormMessage.textContent = "";
  let saved = false;
  try {
    const {data} = await createLinkedMissions(payload);
    saved = true;
    missionsMessage.textContent = `${data.created} asignaciones creadas; ${data.alreadyAssigned} ya estaban asignadas.`;
  } catch (error) {
    console.error("Creación de misión:", error);
    missionFormMessage.textContent = error.message || "No fue posible guardar. Puedes reintentar.";
  } finally {
    submitting = false;
    controls.forEach(el => el.disabled = false);
    saveMissionButton.textContent = "Guardar misión";
  }
  if (saved) { closeMissionModal(); await loadMissions(); }
});

// ======================================================
// CARGAR MISIONES
// BUILD-116 — RECIBIDAS + ASIGNADAS POR MÍ
// ======================================================

async function loadMissions() {

  if (!currentUserProfile) {
    return;
  }

  const loadingUid = currentUser.uid;
  missionsMessage.textContent =
    "Cargando misiones...";

  const campaignId =
    currentUserProfile.campaignId;

  try {

    // ==================================================
    // ADMIN
    // Ve todas las misiones de la campaña.
    // ==================================================

    if (
      currentUserProfile.role ===
      "admin"
    ) {

      const adminQuery =
        query(
          collection(
            db,
            "misiones"
          ),

          where(
            "campaignId",
            "==",
            campaignId
          ),

          orderBy(
            "createdAt",
            "desc"
          )
        );

      const snapshot =
        await getDocs(
          adminQuery
        );

      missions = [];

      snapshot.forEach(
        (documentSnapshot) => {

          missions.push({
            id:
              documentSnapshot.id,

            ...documentSnapshot.data()
          });
        }
      );

    } else {

      // ==================================================
      // NUEVA JERARQUÍA
      //
      // 1. Misiones recibidas por el usuario.
      // 2. Misiones creadas/asignadas por el usuario.
      // ==================================================

      const receivedQuery =
        query(
          collection(
            db,
            "misiones"
          ),

          where(
            "campaignId",
            "==",
            campaignId
          ),

          where(
            "assignedTo",
            "==",
            currentUserProfile.uid
          ),

          orderBy(
            "createdAt",
            "desc"
          )
        );


      const createdQuery =
        query(
          collection(
            db,
            "misiones"
          ),

          where(
            "campaignId",
            "==",
            campaignId
          ),

          where(
            "createdBy",
            "==",
            currentUserProfile.uid
          ),

          orderBy(
            "createdAt",
            "desc"
          )
        );

      const supervisedQuery =
  query(
    collection(
      db,
      "misiones"
    ),

    where(
      "campaignId",
      "==",
      campaignId
    ),

    where(
      "supervisorIds",
      "array-contains",
      currentUserProfile.uid
    ),

    orderBy(
      "createdAt",
      "desc"
    )
  );


   const [
  receivedSnapshot,
  createdSnapshot,
  supervisedSnapshot
] = await Promise.all([
  getDocs(receivedQuery),

  getDocs(createdQuery),

  currentUserProfile.role === "coordinador_municipal"
    ? Promise.resolve(null)
    : getDocs(supervisedQuery)
]);


      // ==================================================
      // UNIR RESULTADOS SIN DUPLICADOS
      // ==================================================

      const missionMap =
        new Map();


      receivedSnapshot.forEach(
        (documentSnapshot) => {

          missionMap.set(
            documentSnapshot.id,
            {
              id:
                documentSnapshot.id,

              ...documentSnapshot.data()
            }
          );
        }
      );


      createdSnapshot.forEach(
        (documentSnapshot) => {

          missionMap.set(
            documentSnapshot.id,
            {
              id:
                documentSnapshot.id,

              ...documentSnapshot.data()
            }
          );
        }
      );


    supervisedSnapshot?.forEach((documentSnapshot) => {
  missionMap.set(
    documentSnapshot.id,
    {
      ...documentSnapshot.data(),
      id: documentSnapshot.id
    }
  );
});
      


      missions =
        Array.from(
          missionMap.values()
        );


      // ==================================================
      // ORDENAR POR FECHA DE CREACIÓN
      // ==================================================

      missions.sort(
        (a, b) => {

          const aTime =
            a.createdAt?.toMillis?.() ||
            0;

          const bTime =
            b.createdAt?.toMillis?.() ||
            0;

          return bTime - aTime;
        }
      );
    }


    // ==================================================
    // RENDER
    // ==================================================

    if (auth.currentUser?.uid !== loadingUid) return;
    renderMissions();

    updateMissionMetrics();

    missionsMessage.textContent =
      missions.length
        ? ""
        : "Todavía no existen misiones registradas.";


  } catch (error) {

    console.error(
      "Error al cargar misiones:",
      error
    );


    if (
      error.code ===
      "failed-precondition"
    ) {

      missionsMessage.textContent =
        "Firestore requiere un índice para consultar las misiones.";

      return;
    }


    missionsMessage.textContent =
      "No fue posible consultar las misiones.";
  }
}

// ======================================================
// RENDERIZAR MISIONES
// ======================================================

function renderMissions() {

  if (!missions.length) {

    missionsList.innerHTML = `
      <p>
        Todavía no existen misiones registradas.
      </p>
    `;

    return;
  }

  missionsList.innerHTML =
    missions
      .map(
        (mission) => {

          const dateText =
            mission.missionDate ||
            "Fecha no definida";

          const localityText =
            mission.locality ||
            "Sin zona definida";

          const statusText =
            mission.active === true
              ? "ACTIVA"
              : "INACTIVA";

          return `

            <article class="visit-item">

              <div>

                <strong>
                  ${escapeHtml(
                    mission.title ||
                    "Misión sin nombre"
                  )}
                </strong>

                <p>
                  ${escapeHtml(
                    localityText
                  )}
                </p>

              </div>

              <div>

                <p>
                  Estado:
                  <strong>
                    ${statusText}
                  </strong>
                </p>

                <p>
                  Fecha:
                  <strong>
                    ${escapeHtml(
                      dateText
                    )}
                  </strong>
                </p>

                <p>
                  Creada por:
                  <strong>
                    ${escapeHtml(
                      mission.createdByName ||
                      "Sin identificar"
                    )}
                  </strong>
                </p>

                <button
                  class="button button--small"
                  type="button"
                  data-open-mission="${escapeHtml(mission.id)}"
                >
                  Ver misión
                </button>
                ${mission.linkedVersion === 1 && (currentUserProfile.role === "admin" || mission.createdBy === currentUser.uid || mission.assignedTo === currentUser.uid) ? `
                  <button class="button button--small button--secondary" type="button" data-progress-mission="${escapeHtml(mission.id)}">Ver avance</button>` : ""}
                ${mission.linkedVersion === 1 && mission.active === true && mission.assignedTo === currentUser.uid && getAssignableRole(currentUserProfile) ? `
                  <button class="button button--small button--secondary" type="button" data-delegate-mission="${escapeHtml(mission.id)}">Delegar</button>` : ""}
                <p>Asignada a: ${escapeHtml(mission.assignedToName || "Sin nombre")}</p>
                <p class="message" data-branch-progress aria-live="polite"></p>


              </div>

            </article>

          `;
        }
      )
      .join("");

}


// ======================================================
// INDICADORES
// ======================================================

function updateMissionMetrics() {

  const total =
    missions.length;

  const active =
    missions.filter(
      (mission) =>
        mission.active === true
    ).length;

  totalMissionsElement.textContent =
    total;

  activeMissionsElement.textContent =
    active;

  totalEvidenceElement.textContent = "—";
  totalEvidenceElement.title = "Consulta el avance por misión; el total de evidencias no se calcula en este listado.";
  lastActivityElement.previousElementSibling.textContent = "Última misión creada";

  if (!missions.length) {

    lastActivityElement.textContent =
      "Sin actividad";

    return;
  }

  const latest =
    missions[0];

  lastActivityElement.textContent =
    formatFirestoreDate(
      latest.createdAt
    );
}


// ======================================================
// BOTÓN ACTUALIZAR
// ======================================================

refreshMissionsButton.addEventListener(
  "click",
  async () => {

    refreshMissionsButton.disabled =
      true;

    refreshMissionsButton.textContent =
      "Actualizando...";

    await loadMissions();

    refreshMissionsButton.disabled =
      false;

    refreshMissionsButton.textContent =
      "Actualizar";
  }
);


// ======================================================
// EVENTO FUTURO — ABRIR MISIÓN
// ======================================================

missionsList.addEventListener(
  "click",
  (event) => {

    const button =
      event.target.closest(
        "[data-open-mission]"
      );

    if (!button) {
      return;
    }

    const missionId =
      button.dataset.openMission;

    if (!missionId) {
      return;
    }

    // En el siguiente BUILD este botón
    // abrirá la galería privada de evidencias.

    window.location.href =
  `./mision.html?id=${encodeURIComponent(missionId)}`;
  }
);


// ======================================================
// FECHA
// ======================================================

function formatFirestoreDate(
  timestamp
) {

  if (
    !timestamp ||
    typeof timestamp.toDate !==
      "function"
  ) {

    return "Sin fecha";
  }

  return timestamp
    .toDate()
    .toLocaleString(
      "es-MX",
      {
        dateStyle:
          "short",

        timeStyle:
          "short"
      }
    );
}


// ======================================================
// SEGURIDAD DE TEXTO
// ======================================================

function escapeHtml(value) {

  return String(value)
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
}
// Linked progress contains counts only. The callable independently checks access.
missionsList.addEventListener("click", async event => {
  const delegate = event.target.closest("[data-delegate-mission]");
  if (delegate) {
    const mission = missions.find(m => m.id === delegate.dataset.delegateMission);
    if (mission) openMissionModal(mission);
    return;
  }
  const button = event.target.closest("[data-progress-mission]");
  if (!button) return;
  const output = button.closest("article").querySelector("[data-branch-progress]");
  const uid = auth.currentUser?.uid;
  button.disabled = true;
  output.textContent = "Calculando avance...";
  try {
    const {data} = await getMissionBranchProgress({missionId:button.dataset.progressMission});
    if (auth.currentUser?.uid !== uid) return;
    output.textContent = `Esta asignación y sus delegaciones: ${data.total}. Con evidencia: ${data.withEvidence}. Sin evidencia: ${data.withoutEvidence}. Avance reportado: ${data.percentage ?? "—"}%. Incluye todos los niveles, activos e inactivos. Una evidencia no certifica cumplimiento.`;
  } catch (error) {
    if (auth.currentUser?.uid === uid) output.textContent = error.message || "No fue posible consultar el avance.";
  } finally { button.disabled = false; }
});
