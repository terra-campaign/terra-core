// ======================================================
// TERRA CAMPAIGN
// BUILD-108 — ALTA AUTOMÁTICA DE BRIGADISTAS
// Cloud Functions Gen 2
// ======================================================

const {
  onCall,
  HttpsError
} = require("firebase-functions/v2/https");

const {
  initializeApp
} = require("firebase-admin/app");

const {
  getAuth
} = require("firebase-admin/auth");

const {
  getFirestore,
  FieldValue
} = require("firebase-admin/firestore");


// ======================================================
// INICIALIZACIÓN
// ======================================================

initializeApp();

const db = getFirestore();
const auth = getAuth();


// ======================================================
// CONFIGURACIÓN OPERATIVA ACTUAL
// ======================================================

const DEFAULT_BRIGADE_ID = "BRIG-001";


// ======================================================
// UTILIDADES
// ======================================================

function cleanText(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizePhone(value) {
  return String(value || "")
    .trim()
    .replace(/[^\d+]/g, "");
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}


// ======================================================
// CREAR BRIGADISTA
// ======================================================

exports.createBrigadista = onCall(
  {
    region: "us-central1"
  },

  async (request) => {

    // --------------------------------------------------
    // 1. VALIDAR AUTENTICACIÓN
    // --------------------------------------------------

    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Debe iniciar sesión para realizar esta operación."
      );
    }

    const adminUid = request.auth.uid;

    // --------------------------------------------------
    // 2. CONSULTAR PERFIL DEL ADMINISTRADOR
    // --------------------------------------------------

    const adminReference =
      db.collection("usuarios").doc(adminUid);

    const adminSnapshot =
      await adminReference.get();

    if (!adminSnapshot.exists) {
      throw new HttpsError(
        "permission-denied",
        "El usuario no tiene un perfil autorizado."
      );
    }

    const adminProfile =
      adminSnapshot.data();

    if (adminProfile.active !== true) {
      throw new HttpsError(
        "permission-denied",
        "La cuenta del administrador está desactivada."
      );
    }

    const allowedCreatorRoles = [
  "admin",
  "coordinador"
];

if (
  !allowedCreatorRoles.includes(
    adminProfile.role
  )
) {
  throw new HttpsError(
    "permission-denied",
    "Esta operación es exclusiva para administradores y coordinadores."
  );
}



    if (!adminProfile.campaignId) {
      throw new HttpsError(
        "failed-precondition",
        "El administrador no tiene una campaña asignada."
      );
    }

// --------------------------------------------------
// DETERMINAR BRIGADA DEL NUEVO BRIGADISTA
// --------------------------------------------------

let targetBrigadeId =
  DEFAULT_BRIGADE_ID;

if (
  adminProfile.role === "coordinador"
) {

  const assignedBrigades =
    Array.isArray(adminProfile.brigadeIds)
      ? adminProfile.brigadeIds
      : [];

  if (!assignedBrigades.length) {
    throw new HttpsError(
      "failed-precondition",
      "El coordinador no tiene brigadas asignadas."
    );
  }

  // Mientras exista una sola brigada operativa,
  // se utiliza automáticamente la primera asignada.
  targetBrigadeId =
    assignedBrigades[0];
}


    // --------------------------------------------------
    // 3. RECIBIR Y NORMALIZAR DATOS
    // --------------------------------------------------

    const data = request.data || {};

    const name =
      cleanText(data.name);

    const email =
      normalizeEmail(data.email);

    const phone =
      normalizePhone(data.phone);

    const temporaryPassword =
      String(data.temporaryPassword || "");

    // --------------------------------------------------
    // 4. VALIDACIONES
    // --------------------------------------------------

    if (name.length < 3) {
      throw new HttpsError(
        "invalid-argument",
        "Ingrese el nombre completo del brigadista."
      );
    }

    if (name.length > 120) {
      throw new HttpsError(
        "invalid-argument",
        "El nombre no puede superar 120 caracteres."
      );
    }

    if (!isValidEmail(email)) {
      throw new HttpsError(
        "invalid-argument",
        "Ingrese un correo electrónico válido."
      );
    }

    if (phone.length < 10 || phone.length > 15) {
      throw new HttpsError(
        "invalid-argument",
        "Ingrese un teléfono válido de entre 10 y 15 dígitos."
      );
    }

    if (temporaryPassword.length < 8) {
      throw new HttpsError(
        "invalid-argument",
        "La contraseña temporal debe contener al menos 8 caracteres."
      );
    }

    // --------------------------------------------------
    // 5. CREAR CUENTA EN FIREBASE AUTHENTICATION
    // --------------------------------------------------

    let createdUser = null;

    try {

      createdUser =
        await auth.createUser({
          email,
          password: temporaryPassword,
          displayName: name,
          disabled: false
        });

    } catch (error) {

      console.error(
        "Error al crear usuario en Authentication:",
        error
      );

      if (
        error.code ===
        "auth/email-already-exists"
      ) {
        throw new HttpsError(
          "already-exists",
          "Ya existe un usuario registrado con ese correo."
        );
      }

      if (
        error.code ===
        "auth/invalid-password"
      ) {
        throw new HttpsError(
          "invalid-argument",
          "La contraseña temporal no cumple los requisitos."
        );
      }

      if (
        error.code ===
        "auth/invalid-email"
      ) {
        throw new HttpsError(
          "invalid-argument",
          "El correo electrónico no es válido."
        );
      }

      throw new HttpsError(
        "internal",
        "No fue posible crear la cuenta de acceso."
      );
    }

    // --------------------------------------------------
    // 6. CREAR PERFIL EN FIRESTORE
    // --------------------------------------------------

    const brigadistaReference =
      db.collection("usuarios")
        .doc(createdUser.uid);

    try {

      await brigadistaReference.set({
        uid: createdUser.uid,

        name,
        email,
        phone,

        role: "brigadista",

        campaignId:
          adminProfile.campaignId,

        brigadeId:
        targetBrigadeId,

        active: true,

        createdAt:
          FieldValue.serverTimestamp(),

        updatedAt:
          FieldValue.serverTimestamp(),

        createdBy:
          adminUid,

        version: 1
      });

    } catch (error) {

      console.error(
        "Error al crear perfil en Firestore:",
        error
      );

      // Evitar una cuenta huérfana en Authentication.
      try {
        await auth.deleteUser(
          createdUser.uid
        );
      } catch (rollbackError) {
        console.error(
          "No fue posible revertir la cuenta:",
          rollbackError
        );
      }

      throw new HttpsError(
        "internal",
        "No fue posible crear el perfil del brigadista."
      );
    }

    // --------------------------------------------------
    // 7. RESPUESTA
    // --------------------------------------------------

    return {
      success: true,

      brigadista: {
  uid: createdUser.uid,
  name,
  email,
  phone,
  role: "brigadista",

  campaignId:
    adminProfile.campaignId,

  brigadeId:
    targetBrigadeId,

  active: true
},

      message:
        "Brigadista creado correctamente."
    };
  }
);



// ======================================================
// BUILD-109 — ACTIVAR / DESACTIVAR BRIGADISTA
// ======================================================

exports.updateBrigadistaStatus = onCall(
  {
    region: "us-central1"
  },

  async (request) => {

    // --------------------------------------------------
    // 1. VALIDAR ADMINISTRADOR
    // --------------------------------------------------

    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Debe iniciar sesión para realizar esta operación."
      );
    }

    const adminUid = request.auth.uid;

    const adminSnapshot =
      await db
        .collection("usuarios")
        .doc(adminUid)
        .get();

    if (!adminSnapshot.exists) {
      throw new HttpsError(
        "permission-denied",
        "El administrador no tiene un perfil autorizado."
      );
    }

    const adminProfile =
      adminSnapshot.data();

    const allowedManagerRoles = [
  "admin",
  "coordinador"
];

if (
  adminProfile.active !== true ||
  !allowedManagerRoles.includes(
    adminProfile.role
  )
) {
  throw new HttpsError(
    "permission-denied",
    "Esta operación es exclusiva para administradores y coordinadores activos."
  );
}


// El coordinador únicamente puede administrar
// brigadistas pertenecientes a sus brigadas.

if (
  adminProfile.role === "coordinador"
) {

  const assignedBrigades =
    Array.isArray(adminProfile.brigadeIds)
      ? adminProfile.brigadeIds
      : [];

  if (
    !assignedBrigades.includes(
      brigadistaProfile.brigadeId
    )
  ) {
    throw new HttpsError(
      "permission-denied",
      "El brigadista no pertenece a una brigada asignada al coordinador."
    );
  }
}



    // --------------------------------------------------
    // 2. VALIDAR DATOS RECIBIDOS
    // --------------------------------------------------

    const targetUid =
      cleanText(request.data?.uid);

    const newActiveStatus =
      request.data?.active;

    if (!targetUid) {
      throw new HttpsError(
        "invalid-argument",
        "No se recibió el UID del brigadista."
      );
    }

    if (typeof newActiveStatus !== "boolean") {
      throw new HttpsError(
        "invalid-argument",
        "El estado solicitado no es válido."
      );
    }

    // --------------------------------------------------
    // 3. CONSULTAR BRIGADISTA
    // --------------------------------------------------

    const brigadistaReference =
      db
        .collection("usuarios")
        .doc(targetUid);

    const brigadistaSnapshot =
      await brigadistaReference.get();

    if (!brigadistaSnapshot.exists) {
      throw new HttpsError(
        "not-found",
        "El brigadista no existe."
      );
    }

    const brigadistaProfile =
      brigadistaSnapshot.data();

    if (brigadistaProfile.role !== "brigadista") {
      throw new HttpsError(
        "failed-precondition",
        "El usuario seleccionado no es brigadista."
      );
    }

    if (
      brigadistaProfile.campaignId !==
      adminProfile.campaignId
    ) {
      throw new HttpsError(
        "permission-denied",
        "El brigadista pertenece a otra campaña."
      );
    }

    // --------------------------------------------------
    // 4. CAMBIAR ESTADO EN AUTHENTICATION
    // --------------------------------------------------

    try {

      await auth.updateUser(
        targetUid,
        {
          disabled: !newActiveStatus
        }
      );

    } catch (error) {

      console.error(
        "Error al actualizar Authentication:",
        error
      );

      throw new HttpsError(
        "internal",
        "No fue posible actualizar el acceso del brigadista."
      );
    }

    // --------------------------------------------------
    // 5. CAMBIAR ESTADO EN FIRESTORE
    // --------------------------------------------------

    try {

      await brigadistaReference.update({
        active: newActiveStatus,

        updatedAt:
          FieldValue.serverTimestamp(),

        updatedBy:
          adminUid
      });

    } catch (error) {

      console.error(
        "Error al actualizar Firestore:",
        error
      );

      // Revertir Authentication si Firestore falla.
      try {
        await auth.updateUser(
          targetUid,
          {
            disabled: newActiveStatus
          }
        );
      } catch (rollbackError) {
        console.error(
          "No fue posible revertir Authentication:",
          rollbackError
        );
      }

      throw new HttpsError(
        "internal",
        "No fue posible guardar el nuevo estado del brigadista."
      );
    }

    // --------------------------------------------------
    // 6. RESPUESTA
    // --------------------------------------------------

    return {
      success: true,

      uid: targetUid,

      active: newActiveStatus,

      message: newActiveStatus
        ? "Brigadista activado correctamente."
        : "Brigadista desactivado correctamente."
    };
  }
);



