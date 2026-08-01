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


// ======================================================
// ESTADO
// ======================================================

let currentUser = null;
let currentUserProfile = null;
let stopBrigadistasListener = null;


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

newBrigadistaButton.addEventListener(
  "click",
  () => {

    brigadistasMessage.textContent =
      "El alta automática se conectará en el siguiente paso.";

  }
);


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