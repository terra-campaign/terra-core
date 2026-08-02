// ======================================================
// TERRA CAMPAIGN
// BUILD-112A — ADMINISTRACIÓN DE BRIGADAS
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
  orderBy,
  query,
  where
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


// ======================================================
// ELEMENTOS DE PANTALLA
// ======================================================

const logoutButton =
  document.querySelector("#logoutButton");

const newBrigadeButton =
  document.querySelector("#newBrigadeButton");

const brigadesList =
  document.querySelector("#brigadesList");

const brigadesMessage =
  document.querySelector("#brigadesMessage");

const totalBrigadesElement =
  document.querySelector("#totalBrigades");

const activeBrigadesElement =
  document.querySelector("#activeBrigades");

const assignedCoordinatorsElement =
  document.querySelector("#assignedCoordinators");

const newBrigadeModal =
  document.querySelector("#newBrigadeModal");

const closeBrigadeModalButton =
  document.querySelector(
    "#closeBrigadeModalButton"
  );

const cancelBrigadeButton =
  document.querySelector(
    "#cancelBrigadeButton"
  );

const newBrigadeForm =
  document.querySelector(
    "#newBrigadeForm"
  );

const brigadeNameInput =
  document.querySelector(
    "#brigadeName"
  );

const brigadeMunicipalityInput =
  document.querySelector(
    "#brigadeMunicipality"
  );

const brigadeCoordinatorInput =
  document.querySelector(
    "#brigadeCoordinator"
  );

const newBrigadeMessage =
  document.querySelector(
    "#newBrigadeMessage"
  );


// ======================================================
// ESTADO
// ======================================================

let currentUser = null;
let currentUserProfile = null;
let stopBrigadesListener = null;


// ======================================================
// CARGAR PERFIL
// ======================================================

async function loadCurrentUserProfile(user) {

  const userReference =
    doc(db, "usuarios", user.uid);

  const userSnapshot =
    await getDoc(userReference);

  if (!userSnapshot.exists()) {
    throw new Error(
      "El usuario no tiene un perfil autorizado."
    );
  }

  const profile = {
    uid: userSnapshot.id,
    ...userSnapshot.data()
  };

  if (profile.active !== true) {
    throw new Error(
      "El usuario está desactivado."
    );
  }

  if (profile.role !== "admin") {
    throw new Error(
      "Esta sección es exclusiva para administradores."
    );
  }

  return profile;
}


// ======================================================
// CONSULTAR BRIGADAS
// ======================================================

function listenBrigades() {

  if (stopBrigadesListener) {
    stopBrigadesListener();
  }

  const brigadesQuery = query(
    collection(db, "brigadas"),

    where(
      "campaignId",
      "==",
      currentUserProfile.campaignId
    ),

    orderBy(
      "name",
      "asc"
    )
  );

  stopBrigadesListener =
    onSnapshot(

      brigadesQuery,

      (snapshot) => {

        const brigades = [];

        snapshot.forEach(
          (documentSnapshot) => {

            brigades.push({
              id: documentSnapshot.id,
              ...documentSnapshot.data()
            });

          }
        );

        updateBrigadesMetrics(
          brigades
        );

        renderBrigades(
          brigades
        );

      },

      (error) => {

        console.error(
          "Error al consultar brigadas:",
          error
        );

        brigadesMessage.textContent =
          "No fue posible consultar las brigadas.";

        brigadesList.innerHTML = `
          <p>
            Firestore rechazó la consulta o falta un índice.
          </p>
        `;

      }
    );
}


// ======================================================
// CONTADORES
// ======================================================

function updateBrigadesMetrics(brigades) {

  const total =
    brigades.length;

  const active =
    brigades.filter(
      (brigade) =>
        brigade.active === true
    ).length;

  const coordinators =
    new Set(
      brigades
        .map(
          (brigade) =>
            brigade.coordinatorId
        )
        .filter(Boolean)
    ).size;

  totalBrigadesElement.textContent =
    total;

  activeBrigadesElement.textContent =
    active;

  assignedCoordinatorsElement.textContent =
    coordinators;
}


// ======================================================
// MOSTRAR BRIGADAS
// ======================================================

function renderBrigades(brigades) {

  if (!brigades.length) {

    brigadesList.innerHTML = `
      <p>
        Todavía no existen brigadas registradas.
      </p>
    `;

    return;
  }

  brigadesList.innerHTML = `

    <table class="brigadistas-table">

      <thead>

        <tr>
          <th>Brigada</th>
          <th>Municipio</th>
          <th>Coordinador</th>
          <th>Estado</th>
        </tr>

      </thead>

      <tbody>

        ${brigades
          .map((brigade) => {

            const statusText =
              brigade.active === true
                ? "Activa"
                : "Inactiva";

            const coordinatorText =
              brigade.coordinatorId
                ? brigade.coordinatorId
                : "Sin coordinador";

            return `

              <tr>

                <td>
                  ${escapeHtml(
                    brigade.name ||
                    brigade.id
                  )}
                </td>

                <td>
                  ${escapeHtml(
                    brigade.municipality ||
                    "Sin municipio"
                  )}
                </td>

                <td>
                  ${escapeHtml(
                    coordinatorText
                  )}
                </td>

                <td>
                  ${statusText}
                </td>

              </tr>

            `;

          })
          .join("")}

      </tbody>

    </table>

  `;
}


// ======================================================
// MODAL
// ======================================================

function openNewBrigadeModal() {

  newBrigadeForm.reset();

  newBrigadeMessage.textContent =
    "";

  newBrigadeModal.hidden =
    false;

  document.body.classList.add(
    "modal-open"
  );

  setTimeout(() => {
    brigadeNameInput.focus();
  }, 50);
}

function closeNewBrigadeModal() {

  newBrigadeModal.hidden =
    true;

  document.body.classList.remove(
    "modal-open"
  );

  newBrigadeMessage.textContent =
    "";
}

newBrigadeButton.addEventListener(
  "click",
  openNewBrigadeModal
);

closeBrigadeModalButton.addEventListener(
  "click",
  closeNewBrigadeModal
);

cancelBrigadeButton.addEventListener(
  "click",
  closeNewBrigadeModal
);

document
  .querySelectorAll(
    "[data-close-brigade-modal]"
  )
  .forEach((element) => {

    element.addEventListener(
      "click",
      closeNewBrigadeModal
    );

  });


// ======================================================
// FORMULARIO PROVISIONAL
// ======================================================

newBrigadeForm.addEventListener(
  "submit",
  (event) => {

    event.preventDefault();

    newBrigadeMessage.textContent =
      "La creación automática de brigadas se conectará en el siguiente paso.";

  }
);


// ======================================================
// CERRAR SESIÓN
// ======================================================

logoutButton.addEventListener(
  "click",
  async () => {

    try {

      if (stopBrigadesListener) {
        stopBrigadesListener();
      }

      await signOut(auth);

      window.location.href =
        "./login.html";

    } catch (error) {

      console.error(
        "No fue posible cerrar sesión:",
        error
      );

    }

  }
);


// ======================================================
// SEGURIDAD DE TEXTO
// ======================================================

function escapeHtml(value) {

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


// ======================================================
// INICIO
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

      listenBrigades();

    } catch (error) {

      console.error(
        "Acceso rechazado:",
        error
      );

      brigadesMessage.textContent =
        error.message ||
        "Acceso no autorizado.";

      brigadesList.innerHTML = `
        <p>
          No tiene autorización para consultar esta sección.
        </p>
      `;

      setTimeout(
        () => {

          window.location.href =
            "./admin.html";

        },
        2000
      );

    }

  }
);