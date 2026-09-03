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
// NORMALIZAR NOMBRE
// ======================================================

function normalizeName(value) {

  return cleanText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

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
// BUILD-109 / BUILD-111
// ACTIVAR O DESACTIVAR BRIGADISTA
// ======================================================

exports.updateBrigadistaStatus = onCall(
  {
    region: "us-central1"
  },

  async (request) => {

    // --------------------------------------------------
    // 1. VALIDAR USUARIO AUTENTICADO
    // --------------------------------------------------

    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Debe iniciar sesión para realizar esta operación."
      );
    }

    const managerUid =
      request.auth.uid;

    const managerSnapshot =
      await db
        .collection("usuarios")
        .doc(managerUid)
        .get();

    if (!managerSnapshot.exists) {
      throw new HttpsError(
        "permission-denied",
        "El usuario no tiene un perfil autorizado."
      );
    }

    const managerProfile =
      managerSnapshot.data();

    const allowedManagerRoles = [
      "admin",
      "coordinador"
    ];

    if (
      managerProfile.active !== true ||
      !allowedManagerRoles.includes(
        managerProfile.role
      )
    ) {
      throw new HttpsError(
        "permission-denied",
        "Esta operación es exclusiva para administradores y coordinadores activos."
      );
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

    if (
      typeof newActiveStatus !==
      "boolean"
    ) {
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

    if (
      brigadistaProfile.role !==
      "brigadista"
    ) {
      throw new HttpsError(
        "failed-precondition",
        "El usuario seleccionado no es brigadista."
      );
    }

    if (
      brigadistaProfile.campaignId !==
      managerProfile.campaignId
    ) {
      throw new HttpsError(
        "permission-denied",
        "El brigadista pertenece a otra campaña."
      );
    }

    // --------------------------------------------------
    // 4. LIMITAR AL COORDINADOR A SUS BRIGADAS
    // --------------------------------------------------

    if (
      managerProfile.role ===
      "coordinador"
    ) {

      const assignedBrigades =
        Array.isArray(
          managerProfile.brigadeIds
        )
          ? managerProfile.brigadeIds
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
    // 5. CAMBIAR ESTADO EN AUTHENTICATION
    // --------------------------------------------------

    try {

      await auth.updateUser(
        targetUid,
        {
          disabled:
            !newActiveStatus
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
    // 6. CAMBIAR ESTADO EN FIRESTORE
    // --------------------------------------------------

    try {

      await brigadistaReference.update({
        active:
          newActiveStatus,

        updatedAt:
          FieldValue.serverTimestamp(),

        updatedBy:
          managerUid
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
            disabled:
              newActiveStatus
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
    // 7. RESPUESTA
    // --------------------------------------------------

    return {
      success: true,

      uid:
        targetUid,

      active:
        newActiveStatus,

      message:
        newActiveStatus
          ? "Brigadista activado correctamente."
          : "Brigadista desactivado correctamente."
    };
  }
);


// ======================================================
// BUILD-112B — CREAR BRIGADA
// ======================================================

exports.createBrigada = onCall(
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

    const adminUid =
      request.auth.uid;

    const adminReference =
      db
        .collection("usuarios")
        .doc(adminUid);

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

    if (
      adminProfile.active !== true ||
      adminProfile.role !== "admin"
    ) {
      throw new HttpsError(
        "permission-denied",
        "Esta operación es exclusiva para administradores activos."
      );
    }

    if (!adminProfile.campaignId) {
      throw new HttpsError(
        "failed-precondition",
        "El administrador no tiene una campaña asignada."
      );
    }

    // --------------------------------------------------
    // 2. NORMALIZAR DATOS
    // --------------------------------------------------

    const data =
      request.data || {};

    const name =
      cleanText(data.name);

    const municipality =
      cleanText(data.municipality);

    const coordinatorId =
      cleanText(data.coordinatorId);

    if (name.length < 3) {
      throw new HttpsError(
        "invalid-argument",
        "Ingrese un nombre válido para la brigada."
      );
    }

    if (name.length > 120) {
      throw new HttpsError(
        "invalid-argument",
        "El nombre de la brigada no puede superar 120 caracteres."
      );
    }

    if (municipality.length < 2) {
      throw new HttpsError(
        "invalid-argument",
        "Ingrese un municipio válido."
      );
    }

    if (municipality.length > 120) {
      throw new HttpsError(
        "invalid-argument",
        "El municipio no puede superar 120 caracteres."
      );
    }

    const campaignId =
      adminProfile.campaignId;

    const normalizedName =
      name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim();

    // --------------------------------------------------
    // 3. EVITAR NOMBRE DUPLICADO
    // --------------------------------------------------

    const duplicateSnapshot =
      await db
        .collection("brigadas")
        .where(
          "campaignId",
          "==",
          campaignId
        )
        .where(
          "normalizedName",
          "==",
          normalizedName
        )
        .limit(1)
        .get();

    if (!duplicateSnapshot.empty) {
      throw new HttpsError(
        "already-exists",
        "Ya existe una brigada con ese nombre dentro de la campaña."
      );
    }

    // --------------------------------------------------
    // 4. VALIDAR COORDINADOR OPCIONAL
    // --------------------------------------------------

    let coordinatorReference = null;
    let coordinatorName = "";

    if (coordinatorId) {

      coordinatorReference =
        db
          .collection("usuarios")
          .doc(coordinatorId);

      const coordinatorSnapshot =
        await coordinatorReference.get();

      if (!coordinatorSnapshot.exists) {
        throw new HttpsError(
          "not-found",
          "El coordinador seleccionado no existe."
        );
      }

      const coordinatorProfile =
        coordinatorSnapshot.data();

      if (
        coordinatorProfile.active !== true ||
        coordinatorProfile.role !== "coordinador"
      ) {
        throw new HttpsError(
          "failed-precondition",
          "El usuario seleccionado no es un coordinador activo."
        );
      }

      if (
        coordinatorProfile.campaignId !==
        campaignId
      ) {
        throw new HttpsError(
          "permission-denied",
          "El coordinador pertenece a otra campaña."
        );
      }

      coordinatorName =
        cleanText(
          coordinatorProfile.name ||
          coordinatorProfile.email ||
          "Coordinador"
        );
    }

    // --------------------------------------------------
    // 5. GENERAR ID Y CREAR BRIGADA
    // --------------------------------------------------

    const sequenceReference =
      db
        .collection("secuencias")
        .doc(`${campaignId}_BRIGADAS`);

    let createdBrigade = null;

    await db.runTransaction(
      async (transaction) => {

        const sequenceSnapshot =
          await transaction.get(
            sequenceReference
          );

        /*
         * BRIG-001 ya existe manualmente.
         * Si la secuencia todavía no existe,
         * comenzamos desde 1 para generar BRIG-002.
         */
        const currentNumber =
          sequenceSnapshot.exists
            ? Number(
                sequenceSnapshot.data()
                  .lastNumber || 1
              )
            : 1;

        const nextNumber =
          currentNumber + 1;

        const brigadeId =
          `BRIG-${String(nextNumber).padStart(3, "0")}`;

        const brigadeReference =
          db
            .collection("brigadas")
            .doc(brigadeId);

        const now =
          FieldValue.serverTimestamp();

        const brigadeData = {
          id: brigadeId,

          campaignId,

          name,
          normalizedName,

          municipality,

          coordinatorId:
            coordinatorId || null,

          coordinatorName:
            coordinatorName || "",

          active: true,

          createdAt: now,
          updatedAt: now,

          createdBy:
            adminUid,

          version: 1
        };

        transaction.set(
          brigadeReference,
          brigadeData
        );

        transaction.set(
          sequenceReference,
          {
            campaignId,
            type: "brigadas",
            lastNumber:
              nextNumber,
            updatedAt:
              FieldValue.serverTimestamp()
          },
          {
            merge: true
          }
        );

        if (
          coordinatorReference &&
          coordinatorId
        ) {
          transaction.update(
            coordinatorReference,
            {
              brigadeIds:
                FieldValue.arrayUnion(
                  brigadeId
                ),

              updatedAt:
                FieldValue.serverTimestamp(),

              updatedBy:
                adminUid
            }
          );
        }

        createdBrigade = {
          ...brigadeData,
          createdAt: null,
          updatedAt: null
        };
      }
    );

    // --------------------------------------------------
    // 6. RESPUESTA
    // --------------------------------------------------

    return {
      success: true,

      brigade:
        createdBrigade,

      message:
        `${createdBrigade.id} creada correctamente.`
    };
  }
);


// ======================================================
// BUILD-114A
// EDITAR BRIGADA
// ======================================================

exports.updateBrigada = onCall(
{
  region: "us-central1"
},

async (request) => {

  //----------------------------------------------------
  // 1. VALIDAR AUTENTICACIÓN
  //----------------------------------------------------

  if (!request.auth) {

    throw new HttpsError(
      "unauthenticated",
      "Debe iniciar sesión."
    );

  }

  const adminUid =
    request.auth.uid;

  //----------------------------------------------------
  // 2. CONSULTAR ADMINISTRADOR
  //----------------------------------------------------

  const adminReference =
    db.collection("usuarios")
      .doc(adminUid);

  const adminSnapshot =
    await adminReference.get();

  if (!adminSnapshot.exists) {

    throw new HttpsError(
      "permission-denied",
      "Usuario no autorizado."
    );

  }

  const adminProfile =
    adminSnapshot.data();

  if (
    adminProfile.active !== true ||
    adminProfile.role !== "admin"
  ) {

    throw new HttpsError(
      "permission-denied",
      "Operación exclusiva para administradores."
    );

  }

  //----------------------------------------------------
  // 3. RECIBIR DATOS
  //----------------------------------------------------

  const data =
    request.data || {};

  const brigadeId =
    cleanText(data.brigadeId);

  const name =
    cleanText(data.name);

  const municipality =
    cleanText(data.municipality);

  if (!brigadeId) {

    throw new HttpsError(
      "invalid-argument",
      "No se recibió la brigada."
    );

  }

  if (name.length < 3) {

    throw new HttpsError(
      "invalid-argument",
      "Nombre inválido."
    );

  }

  if (municipality.length < 2) {

    throw new HttpsError(
      "invalid-argument",
      "Municipio inválido."
    );

  }

  //----------------------------------------------------
  // 4. CONSULTAR BRIGADA
  //----------------------------------------------------

  const brigadeReference =
    db.collection("brigadas")
      .doc(brigadeId);

  const brigadeSnapshot =
    await brigadeReference.get();

  if (!brigadeSnapshot.exists) {

    throw new HttpsError(
      "not-found",
      "La brigada no existe."
    );

  }

  const brigade =
    brigadeSnapshot.data();

  //----------------------------------------------------
  // VALIDAR CAMPAÑA
  //----------------------------------------------------

  if (
    brigade.campaignId !==
    adminProfile.campaignId
  ) {

    throw new HttpsError(
      "permission-denied",
      "La brigada pertenece a otra campaña."
    );

  }

  //----------------------------------------------------
  // NORMALIZAR
  //----------------------------------------------------

  const normalizedName =
    normalizeName(name);

  //----------------------------------------------------
  // EVITAR DUPLICADOS
  //----------------------------------------------------

  const duplicateSnapshot =
    await db
      .collection("brigadas")
      .where(
        "campaignId",
        "==",
        adminProfile.campaignId
      )
      .where(
        "normalizedName",
        "==",
        normalizedName
      )
      .get();

  for (const document of duplicateSnapshot.docs) {

    if (document.id !== brigadeId) {

      throw new HttpsError(
        "already-exists",
        "Ya existe otra brigada con ese nombre."
      );

    }

  }

  //----------------------------------------------------
  // GUARDAR
  //----------------------------------------------------

  await brigadeReference.update({

    name,

    normalizedName,

    municipality,

    updatedAt:
      FieldValue.serverTimestamp(),

    updatedBy:
      adminUid,

    version:
      FieldValue.increment(1)

  });

  //----------------------------------------------------
  // AUDITORÍA
  //----------------------------------------------------

  await db
    .collection("logs")
    .add({

      action:
        "UPDATE_BRIGADA",

      brigadeId,

      campaignId:
        adminProfile.campaignId,

      userUid:
        adminUid,

      createdAt:
        FieldValue.serverTimestamp(),

      before: {

        name:
          brigade.name,

        municipality:
          brigade.municipality

      },

      after: {

        name,

        municipality

      }

    });

  //----------------------------------------------------
  // RESPUESTA
  //----------------------------------------------------

  return {

    success: true,

    brigadeId,

    message:
      "Brigada actualizada correctamente."

  };

});



// ======================================================
// TERRA CAMPAIGN
// CREAR MUNICIPIO
// Alta territorial base para estructura jerárquica
// ======================================================

exports.createMunicipality = onCall(
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

    const adminUid =
      request.auth.uid;

    // --------------------------------------------------
    // 2. CONSULTAR PERFIL DEL USUARIO
    // --------------------------------------------------

    const adminReference =
      db
        .collection("usuarios")
        .doc(adminUid);

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

    if (
      adminProfile.active !== true ||
      adminProfile.role !== "admin"
    ) {
      throw new HttpsError(
        "permission-denied",
        "Esta operación es exclusiva para administradores activos."
      );
    }

    if (!adminProfile.campaignId) {
      throw new HttpsError(
        "failed-precondition",
        "El administrador no tiene una campaña asignada."
      );
    }


    // --------------------------------------------------
    // 3. RECIBIR DATOS
    // --------------------------------------------------

    const data =
      request.data || {};

    const name =
      cleanText(
        data.name
      );

    if (name.length < 2) {
      throw new HttpsError(
        "invalid-argument",
        "Ingrese un nombre válido para el municipio."
      );
    }

    if (name.length > 120) {
      throw new HttpsError(
        "invalid-argument",
        "El nombre del municipio no puede superar 120 caracteres."
      );
    }


    // --------------------------------------------------
    // 4. NORMALIZAR
    // --------------------------------------------------

    const normalizedName =
      normalizeName(
        name
      );

    const campaignId =
      adminProfile.campaignId;


    // --------------------------------------------------
    // 5. EVITAR MUNICIPIO DUPLICADO
    // --------------------------------------------------

    const duplicateSnapshot =
      await db
        .collection("municipios")
        .where(
          "campaignId",
          "==",
          campaignId
        )
        .where(
          "normalizedName",
          "==",
          normalizedName
        )
        .limit(1)
        .get();

    if (!duplicateSnapshot.empty) {
      throw new HttpsError(
        "already-exists",
        "Ese municipio ya está registrado en la campaña."
      );
    }


    // --------------------------------------------------
    // 6. GENERAR ID CONSECUTIVO
    // --------------------------------------------------

    const sequenceReference =
      db
        .collection("secuencias")
        .doc(
          `${campaignId}_MUNICIPIOS`
        );

    let createdMunicipality =
      null;

    await db.runTransaction(
      async (transaction) => {

        const sequenceSnapshot =
          await transaction.get(
            sequenceReference
          );

        const currentNumber =
          sequenceSnapshot.exists
            ? Number(
                sequenceSnapshot
                  .data()
                  .lastNumber || 0
              )
            : 0;

        const nextNumber =
          currentNumber + 1;

        const municipalityId =
          `MUN-${String(nextNumber).padStart(3, "0")}`;

        const municipalityReference =
          db
            .collection("municipios")
            .doc(municipalityId);

        const now =
          FieldValue.serverTimestamp();

        const municipalityData = {

          id:
            municipalityId,

          campaignId,

          name,

          normalizedName,

          active:
            true,

          createdBy:
            adminUid,

          createdAt:
            now,

          updatedAt:
            now,

          version:
            1
        };

        transaction.set(
          municipalityReference,
          municipalityData
        );

        transaction.set(
          sequenceReference,
          {
            campaignId,

            type:
              "municipios",

            lastNumber:
              nextNumber,

            updatedAt:
              FieldValue.serverTimestamp()
          },
          {
            merge: true
          }
        );

        createdMunicipality = {
          ...municipalityData,

          createdAt:
            null,

          updatedAt:
            null
        };
      }
    );


    // --------------------------------------------------
    // 7. AUDITORÍA
    // --------------------------------------------------

    await db
      .collection("logs")
      .add({

        action:
          "CREATE_MUNICIPALITY",

        municipalityId:
          createdMunicipality.id,

        campaignId,

        userUid:
          adminUid,

        createdAt:
          FieldValue.serverTimestamp(),

        data: {
          name:
            createdMunicipality.name
        }
      });


    // --------------------------------------------------
    // 8. RESPUESTA
    // --------------------------------------------------

    return {

      success:
        true,

      municipality:
        createdMunicipality,

      message:
        `${createdMunicipality.name} registrado correctamente.`
    };
  }
);




