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
  orderBy,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


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
    uid: snapshot.id,
    ...snapshot.data()
  };

  if (profile.active !== true) {
    throw new Error(
      "El usuario está desactivado."
    );
  }

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
    currentUserProfile.campaignId ||
    "CAM-001";

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

        label.appendChild(
          checkbox
        );

        const text =
          document.createTextNode(
            ` ${
              person.name ||
              person.email ||
              person.uid
            }`
          );

        label.appendChild(
          text
        );

        missionAssigneeList
          .appendChild(
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
      window.location.href =
        "./login.html";

      return;
    }

    currentUser = user;

    try {

      currentUserProfile =
        await loadCurrentUserProfile(user);

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

      setTimeout(
        async () => {

          await signOut(auth);

          window.location.href =
            "./login.html";

        },
        2500
      );
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

newMissionButton.addEventListener(
  "click",
  () => {

    missionForm.reset();

    missionFormMessage.textContent =
      "";

    missionModal.hidden = false;

    missionTitleInput.focus();
  }
);


// ======================================================
// CERRAR MODAL
// ======================================================

function closeMissionModal() {

  missionModal.hidden = true;

  missionForm.reset();

  missionFormMessage.textContent =
    "";
}


cancelMissionButton.addEventListener(
  "click",
  closeMissionModal
);


document
  .querySelectorAll(
    "[data-close-mission-modal]"
  )
  .forEach((element) => {

    element.addEventListener(
      "click",
      closeMissionModal
    );
  });


// ======================================================
// GUARDAR MISIÓN
// ======================================================

missionForm.addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();

    if (
      !currentUser ||
      !currentUserProfile
    ) {

      missionFormMessage.textContent =
        "La sesión todavía no está disponible.";

      return;
    }

    const title =
      missionTitleInput.value.trim();

    const description =
      missionDescriptionInput.value.trim();

    const missionDate =
      missionDateInput.value || null;

    const locality =
      missionLocalityInput.value.trim();

   const selectedAssignees =
  Array.from(
    missionAssigneeList.querySelectorAll(
      ".mission-assignee-checkbox:checked"
    )
  );

if (!title) {

  missionFormMessage.textContent =
    "Escriba el nombre de la misión.";

  missionTitleInput.focus();

  return;
}

if (!selectedAssignees.length) {

  missionFormMessage.textContent =
    "Seleccione al menos una persona.";

  return;
}
    
    saveMissionButton.disabled = true;

    saveMissionButton.textContent =
      "Guardando...";

    missionFormMessage.textContent =
      "";

   try {

  const selectedPeople = [];

  for (
    const checkbox
    of selectedAssignees
  ) {

    const assigneeId =
      checkbox.value;

    const assigneeRef =
      doc(
        db,
        "usuarios",
        assigneeId
      );

    const assigneeSnapshot =
      await getDoc(
        assigneeRef
      );

    if (
      !assigneeSnapshot.exists()
    ) {

      throw new Error(
        "Una de las personas seleccionadas no existe."
      );
    }

    const assignee = {
      uid:
        assigneeSnapshot.id,

      ...assigneeSnapshot.data()
    };

    if (
      assignee.active !== true
    ) {

      throw new Error(
        `La persona ${
          assignee.name ||
          assignee.email ||
          assignee.uid
        } está desactivada.`
      );
    }

    selectedPeople.push(
      assignee
    );
  }


  // ==================================================
  // CREAR UNA MISIÓN INDIVIDUAL POR DESTINATARIO
  // BUILD-116 — TRANSICIÓN A MULTIASIGNACIÓN
  // ==================================================

  for (
    const assignee
    of selectedPeople
  ) {

    const missionRef =
      doc(
        collection(
          db,
          "misiones"
        )
      );

    const missionId =
      missionRef.id;

    await setDoc(
      missionRef,
      {

        id:
          missionId,

        campaignId:
          currentUserProfile.campaignId ||
          "CAM-001",

        title,

        description,

        missionDate,

        locality,

        active:
          true,

        createdBy:
          currentUser.uid,

        createdByName:
          currentUserProfile.name ||
          currentUser.email ||
          "Sin identificar",

        createdByRole:
          currentUserProfile.role,

        assignedTo:
          assignee.uid,

        assignedToName:
          assignee.name ||
          assignee.email ||
          "Sin identificar",

        assignedToRole:
          assignee.role ||
          "",

        municipalityId:
          assignee.municipalityId ||
          "",

        municipalityName:
          assignee.municipalityName ||
          "",

        structureId:
          assignee.structureId ||
          "",

        structureName:
          assignee.structureName ||
          "",

        createdAt:
          serverTimestamp(),

        updatedAt:
          serverTimestamp(),

        version:
          2
      }
    );
  }


  missionFormMessage.textContent =
    selectedPeople.length === 1
      ? "✅ Misión creada correctamente."
      : `✅ ${selectedPeople.length} asignaciones creadas correctamente.`;


  await loadMissions();


  setTimeout(
    () => {

      closeMissionModal();
    },
    900
  );


} catch (error) {

  console.error(
    "Error al guardar misión:",
    error
  );

  if (
    error.code ===
    "permission-denied"
  ) {

    missionFormMessage.textContent =
      "Firestore rechazó la creación de la misión por las reglas de seguridad.";

  } else {

    missionFormMessage.textContent =
      error.message ||
      "No fue posible guardar la misión.";
  }

} finally {

  saveMissionButton.disabled =
    false;

  saveMissionButton.textContent =
    "Guardar misión";
}

    } catch (error) {

      console.error(
        "Error al guardar misión:",
        error
      );

      if (
        error.code ===
        "permission-denied"
      ) {

        missionFormMessage.textContent =
          "Firestore rechazó la creación de la misión por las reglas de seguridad.";

      } else {

        missionFormMessage.textContent =
          "No fue posible guardar la misión.";
      }

    } finally {

      saveMissionButton.disabled = false;

      saveMissionButton.textContent =
        "Guardar misión";
    }
  }
);


// ======================================================
// CARGAR MISIONES
// BUILD-116 — RECIBIDAS + ASIGNADAS POR MÍ
// ======================================================

async function loadMissions() {

  if (!currentUserProfile) {
    return;
  }

  missionsMessage.textContent =
    "Cargando misiones...";

  const campaignId =
    currentUserProfile.campaignId ||
    "CAM-001";

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


      const [
        receivedSnapshot,
        createdSnapshot
      ] =
        await Promise.all([
          getDocs(
            receivedQuery
          ),

          getDocs(
            createdQuery
          )
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
                  data-open-mission="${mission.id}"
                >
                  Ver misión
                </button>

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

  // Todavía no existe el módulo de evidencias.
  totalEvidenceElement.textContent =
    "0";

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
