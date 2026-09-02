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
    "coordinador"
  ];

  if (!allowedRoles.includes(profile.role)) {
    throw new Error(
      "Tu usuario no tiene acceso al módulo de Misiones."
    );
  }
}


// ======================================================
// APLICAR INTERFAZ SEGÚN ROL
// ======================================================

function applyRoleInterface() {

  if (!currentUserProfile) {
    return;
  }

  const isAdmin =
    currentUserProfile.role === "admin";

  const isCoordinator =
    currentUserProfile.role === "coordinador";

  // Por ahora ambos pueden crear misiones.
  // Más adelante podemos restringir creación según jerarquía.
  newMissionButton.hidden =
    !(isAdmin || isCoordinator);
}


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

    if (!title) {

      missionFormMessage.textContent =
        "Escriba el nombre de la misión.";

      missionTitleInput.focus();

      return;
    }

    saveMissionButton.disabled = true;

    saveMissionButton.textContent =
      "Guardando...";

    missionFormMessage.textContent =
      "";

    try {

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

          id: missionId,

          campaignId:
            currentUserProfile.campaignId ||
            "CAM-001",

          title,

          description,

          missionDate,

          locality,

          active: true,

          createdBy:
            currentUser.uid,

          createdByName:
            currentUserProfile.name ||
            currentUser.email ||
            "Sin identificar",

          createdByRole:
            currentUserProfile.role,

          brigadeId:
            currentUserProfile.brigadeId ||
            currentUserProfile.brigadeIds?.[0] ||
            null,

          createdAt:
            serverTimestamp(),

          updatedAt:
            serverTimestamp(),

          version: 1
        }
      );

      missionFormMessage.textContent =
        "✅ Misión creada correctamente.";

      await loadMissions();

      setTimeout(
        () => {
          closeMissionModal();
        },
        700
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
// ======================================================

async function loadMissions() {

  if (!currentUserProfile) {
    return;
  }

  missionsMessage.textContent =
    "Cargando misiones...";

  let missionsQuery;

  if (
    currentUserProfile.role ===
    "admin"
  ) {

    missionsQuery = query(
      collection(
        db,
        "misiones"
      ),

      where(
        "campaignId",
        "==",
        currentUserProfile.campaignId
      ),

      orderBy(
        "createdAt",
        "desc"
      )
    );

  } else {

    missionsQuery = query(
      collection(
        db,
        "misiones"
      ),

      where(
        "campaignId",
        "==",
        currentUserProfile.campaignId
      ),

      where(
        "brigadeId",
        "in",
        currentUserProfile.brigadeIds || []
      ),

      orderBy(
        "createdAt",
        "desc"
      )
    );
  }

  try {

    const snapshot =
      await getDocs(
        missionsQuery
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

    alert(
      `Misión seleccionada:\n${missionId}`
    );
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
