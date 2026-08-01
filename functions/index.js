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

    if (adminProfile.role !== "admin") {
      throw new HttpsError(
        "permission-denied",
        "Esta operación es exclusiva para administradores."
      );
    }

    if (!adminProfile.campaignId) {
      throw new HttpsError(
        "failed-precondition",
        "El administrador no tiene una campaña asignada."
      );
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
          DEFAULT_BRIGADE_ID,

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
          DEFAULT_BRIGADE_ID,
        active: true
      },

      message:
        "Brigadista creado correctamente."
    };
  }
);