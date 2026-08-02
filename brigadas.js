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
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


import {
  getFunctions,
  httpsCallable
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js";


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


const saveBrigadeButton =
  document.querySelector(
    "#saveBrigadeButton"
  );



// ======================================================
// ESTADO
// ======================================================

let currentUser = null;
let currentUserProfile = null;
let stopBrigadesListener = null;


const functions =
  getFunctions(
    undefined,
    "us-central1"
  );

const createBrigadaFunction =
  httpsCallable(
    functions,
    "createBrigada"
  );


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
// CARGAR COORDINADORES DE LA CAMPAÑA
// ======================================================

async function loadCoordinators() {

 const coordinatorsQuery = query(
  collection(db, "usuarios"),

  where(
    "campaignId",
    "==",
    currentUserProfile.campaignId
  ),

  where(
    "role",
    "==",
    "coordinador"
  ),

  where(
    "active",
    "==",
    true
  )
);


  const snapshot =
    await getDocs(coordinatorsQuery);

  const coordinators = [];

  snapshot.forEach(
    (documentSnapshot) => {

      coordinators.push({
        uid: documentSnapshot.id,
        ...documentSnapshot.data()
      });

    }
  );


coordinators.sort(
  (a, b) =>
    String(a.name || a.email || "")
      .localeCompare(
        String(b.name || b.email || ""),
        "es",
        {
          sensitivity: "base"
        }
      )
);



  brigadeCoordinatorInput.innerHTML = `
    <option value="">
      Sin coordinador asignado
    </option>

    ${coordinators
      .map((coordinator) => `
        <option value="${escapeHtml(coordinator.uid)}">
          ${escapeHtml(
            coordinator.name ||
            coordinator.email ||
            "Coordinador"
          )}
        </option>
      `)
      .join("")}
  `;
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
// BUILD-112B — CREAR BRIGADA
// ======================================================

newBrigadeForm.addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();

    const name =
      brigadeNameInput.value.trim();

    const municipality =
      brigadeMunicipalityInput.value.trim();

    const coordinatorId =
      brigadeCoordinatorInput.value.trim();

    if (!name) {
      newBrigadeMessage.textContent =
        "Ingrese el nombre de la brigada.";

      brigadeNameInput.focus();

      return;
    }

    if (!municipality) {
      newBrigadeMessage.textContent =
        "Ingrese el municipio.";

      brigadeMunicipalityInput.focus();

      return;
    }

    saveBrigadeButton.disabled =
      true;

    saveBrigadeButton.textContent =
      "Creando brigada...";

    newBrigadeMessage.textContent =
      "Procesando registro...";

    try {

      const response =
        await createBrigadaFunction({
          name,
          municipality,
          coordinatorId
        });

      const result =
        response.data;

      newBrigadeMessage.textContent =
        result.message ||
        "Brigada creada correctamente.";

      newBrigadeForm.reset();

      await loadCoordinators();

      setTimeout(
        () => {

          closeNewBrigadeModal();

        },
        1200
      );

    } catch (error) {

      console.error(
        "Error al crear brigada:",
        error
      );

      newBrigadeMessage.textContent =
        getCreateBrigadeErrorMessage(
          error
        );

    } finally {

      saveBrigadeButton.disabled =
        false;

      saveBrigadeButton.textContent =
        "Crear brigada";

    }

  }
);


function getCreateBrigadeErrorMessage(
  error
) {

  const code =
    String(error?.code || "");

  if (
    code.includes(
      "already-exists"
    )
  ) {
    return "Ya existe una brigada con ese nombre.";
  }

  if (
    code.includes(
      "permission-denied"
    )
  ) {
    return "No tiene autorización para crear brigadas.";
  }

  if (
    code.includes(
      "invalid-argument"
    )
  ) {
    return error.message ||
      "Revise los datos capturados.";
  }

  if (
    code.includes(
      "not-found"
    )
  ) {
    return "El coordinador seleccionado no existe.";
  }

  if (
    code.includes(
      "failed-precondition"
    )
  ) {
    return error.message ||
      "El coordinador seleccionado no es válido.";
  }

  return error.message ||
    "No fue posible crear la brigada.";
}




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

await loadCoordinators();

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