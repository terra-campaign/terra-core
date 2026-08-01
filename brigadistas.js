// ======================================================
// TERRA CAMPAIGN
// BUILD-107 — ADMINISTRACIÓN DE BRIGADISTAS
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

import {
  getFunctions,
  httpsCallable
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js";



// ======================================================
// ELEMENTOS DE PANTALLA
// ======================================================

const logoutButton =
  document.querySelector("#logoutButton");

const newBrigadistaButton =
  document.querySelector("#newBrigadistaButton");

const brigadistasList =
  document.querySelector("#brigadistasList");

const brigadistasMessage =
  document.querySelector("#brigadistasMessage");

const totalBrigadistasElement =
  document.querySelector("#totalBrigadistas");

const activeBrigadistasElement =
  document.querySelector("#activeBrigadistas");

const newBrigadistaModal =
  document.querySelector("#newBrigadistaModal");

const closeBrigadistaModalButton =
  document.querySelector(
    "#closeBrigadistaModalButton"
  );

const cancelBrigadistaButton =
  document.querySelector(
    "#cancelBrigadistaButton"
  );

const newBrigadistaForm =
  document.querySelector(
    "#newBrigadistaForm"
  );

const brigadistaNameInput =
  document.querySelector(
    "#brigadistaName"
  );

const brigadistaEmailInput =
  document.querySelector(
    "#brigadistaEmail"
  );

const brigadistaPhoneInput =
  document.querySelector(
    "#brigadistaPhone"
  );

const brigadistaTemporaryPasswordInput =
  document.querySelector(
    "#brigadistaTemporaryPassword"
  );

const newBrigadistaMessage =
  document.querySelector(
    "#newBrigadistaMessage"
  );

const saveBrigadistaButton =
  document.querySelector(
    "#saveBrigadistaButton"
  );



// ======================================================
// ESTADO
// ======================================================

let currentUser = null;
let currentUserProfile = null;
let stopBrigadistasListener = null;

const functions =
  getFunctions(undefined, "us-central1");

const createBrigadistaFunction =
  httpsCallable(
    functions,
    "createBrigadista"
  );


// ======================================================
// CARGAR PERFIL DEL USUARIO
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
// CONSULTAR BRIGADISTAS
// ======================================================

function listenBrigadistas() {

  if (stopBrigadistasListener) {
    stopBrigadistasListener();
  }

  const brigadistasQuery = query(
    collection(db, "usuarios"),

    where(
      "campaignId",
      "==",
      currentUserProfile.campaignId
    ),

    where(
      "role",
      "==",
      "brigadista"
    ),

    orderBy(
      "name",
      "asc"
    )
  );

  stopBrigadistasListener =
    onSnapshot(
      brigadistasQuery,

      (snapshot) => {

        const brigadistas = [];

        snapshot.forEach(
          (documentSnapshot) => {

            brigadistas.push({
              uid: documentSnapshot.id,
              ...documentSnapshot.data()
            });

          }
        );

        updateBrigadistasMetrics(
          brigadistas
        );

        renderBrigadistas(
          brigadistas
        );

      },

      (error) => {

        console.error(
          "Error al consultar brigadistas:",
          error
        );

        brigadistasMessage.textContent =
          "No fue posible consultar los brigadistas.";

        brigadistasList.innerHTML = `
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

function updateBrigadistasMetrics(
  brigadistas
) {

  const total =
    brigadistas.length;

  const active =
    brigadistas.filter(
      (brigadista) =>
        brigadista.active === true
    ).length;

  totalBrigadistasElement.textContent =
    total;

  activeBrigadistasElement.textContent =
    active;
}


// ======================================================
// MOSTRAR TABLA
// ======================================================

function renderBrigadistas(
  brigadistas
) {

  if (!brigadistas.length) {

    brigadistasList.innerHTML = `
      <p>
        Todavía no existen brigadistas registrados.
      </p>
    `;

    return;
  }

  brigadistasList.innerHTML = `

    <table class="brigadistas-table">

      <thead>

        <tr>
          <th>Nombre</th>
          <th>Correo</th>
          <th>Teléfono</th>
          <th>Brigada</th>
          <th>Estado</th>
        </tr>

      </thead>

      <tbody>

        ${brigadistas
          .map((brigadista) => {

            const statusText =
              brigadista.active === true
                ? "Activo"
                : "Inactivo";

            const statusClass =
              brigadista.active === true
                ? "user-status user-status--active"
                : "user-status user-status--inactive";

            return `

              <tr>

                <td>
                  ${escapeHtml(
                    brigadista.name ||
                    "Sin nombre"
                  )}
                </td>

                <td>
                  ${escapeHtml(
                    brigadista.email ||
                    "Sin correo"
                  )}
                </td>

                <td>
                  ${escapeHtml(
                    brigadista.phone ||
                    "Sin teléfono"
                  )}
                </td>

                <td>
                  ${escapeHtml(
                    brigadista.brigadeId ||
                    "BRIG-001"
                  )}
                </td>

                <td>
                  <span class="${statusClass}">
                    ${statusText}
                  </span>
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
// NUEVO BRIGADISTA
// Próxima etapa: formulario y Cloud Function
// ======================================================

function openNewBrigadistaModal() {
  newBrigadistaForm.reset();

  newBrigadistaMessage.textContent = "";

  newBrigadistaModal.hidden = false;

  document.body.classList.add(
    "modal-open"
  );

  setTimeout(() => {
    brigadistaNameInput.focus();
  }, 50);
}

function closeNewBrigadistaModal() {
  newBrigadistaModal.hidden = true;

  document.body.classList.remove(
    "modal-open"
  );

  newBrigadistaMessage.textContent = "";
}

newBrigadistaButton.addEventListener(
  "click",
  openNewBrigadistaModal
);

closeBrigadistaModalButton.addEventListener(
  "click",
  closeNewBrigadistaModal
);

cancelBrigadistaButton.addEventListener(
  "click",
  closeNewBrigadistaModal
);

document
  .querySelectorAll(
    "[data-close-brigadista-modal]"
  )
  .forEach((element) => {
    element.addEventListener(
      "click",
      closeNewBrigadistaModal
    );
  });


// ======================================================
// CERRAR SESIÓN
// ======================================================

logoutButton.addEventListener(
  "click",
  async () => {

    try {

      if (stopBrigadistasListener) {
        stopBrigadistasListener();
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

      listenBrigadistas();

    } catch (error) {

      console.error(
        "Acceso rechazado:",
        error
      );

      brigadistasMessage.textContent =
        error.message ||
        "Acceso no autorizado.";

      brigadistasList.innerHTML = `
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