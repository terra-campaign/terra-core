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
  normalizePhone(
    data.phone || ""
  );

const locality =
  cleanText(
    data.locality || ""
  );

const password =
  String(
    data.password || ""
  );

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

if (
  locality.length < 2 ||
  locality.length > 120
) {
  throw new HttpsError(
    "invalid-argument",
    "Ingrese una localidad válida."
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




// ======================================================
// CREATE MUNICIPAL COORDINATOR
// ======================================================

exports.createMunicipalCoordinator = onCall(
  {
    region: "us-central1"
  },

  async (request) => {

    // ==================================================
    // AUTH
    // ==================================================

    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Debe iniciar sesión."
      );
    }

    const adminUid =
      request.auth.uid;

    const db =
      getFirestore();

    const auth =
      getAuth();


    // ==================================================
    // ADMIN PROFILE
    // ==================================================

    const adminRef =
      db.collection("usuarios").doc(adminUid);

    const adminSnapshot =
      await adminRef.get();

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
        "El administrador está desactivado."
      );
    }


    if (adminProfile.role !== "admin") {
      throw new HttpsError(
        "permission-denied",
        "Solo el administrador puede crear coordinadores municipales."
      );
    }


    const campaignId =
      adminProfile.campaignId;


    if (!campaignId) {
      throw new HttpsError(
        "failed-precondition",
        "El administrador no tiene campaña asignada."
      );
    }


    // ==================================================
    // INPUT
    // ==================================================

    const data =
      request.data || {};


    const name =
      cleanText(
        data.name || ""
      );


    const email =
      normalizeEmail(
        data.email || ""
      );


    const phone =
      normalizePhone(
        data.phone || ""
      );


    const password =
      String(
        data.password || ""
      );


    const municipalityId =
      cleanText(
        data.municipalityId || ""
      );


    // ==================================================
    // VALIDACIONES
    // ==================================================

    if (
      name.length < 2 ||
      name.length > 120
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Ingrese un nombre válido."
      );
    }


    if (!isValidEmail(email)) {
      throw new HttpsError(
        "invalid-argument",
        "Ingrese un correo electrónico válido."
      );
    }


    if (password.length < 6) {
      throw new HttpsError(
        "invalid-argument",
        "La contraseña temporal debe tener al menos 6 caracteres."
      );
    }


    if (!municipalityId) {
      throw new HttpsError(
        "invalid-argument",
        "Debe seleccionar un municipio."
      );
    }


    // ==================================================
    // VALIDAR MUNICIPIO
    // ==================================================

    const municipalityRef =
      db
        .collection("municipios")
        .doc(municipalityId);


    const municipalitySnapshot =
      await municipalityRef.get();


    if (!municipalitySnapshot.exists) {
      throw new HttpsError(
        "not-found",
        "El municipio seleccionado no existe."
      );
    }


    const municipality =
      municipalitySnapshot.data();


    if (
      municipality.campaignId !== campaignId
    ) {
      throw new HttpsError(
        "permission-denied",
        "El municipio no pertenece a esta campaña."
      );
    }


    if (
      municipality.active !== true
    ) {
      throw new HttpsError(
        "failed-precondition",
        "El municipio está desactivado."
      );
    }


    // ==================================================
    // CREAR USUARIO AUTH
    // ==================================================

    let authUser = null;


    try {

      authUser =
        await auth.createUser({
          email,
          password,
          displayName: name,
          disabled: false
        });


      // ================================================
      // PERFIL FIRESTORE
      // ================================================

      const userProfile = {

        uid:
          authUser.uid,

        name,

        email,

        phone,

        role:
          "coordinador_municipal",

        active:
          true,

        campaignId,

        municipalityId,

        municipalityName:
          municipality.name || "",

        parentUserId:
          adminUid,

        createdBy:
          adminUid,

        mustChangePassword:
          true,

        createdAt:
          FieldValue.serverTimestamp(),

        updatedAt:
          FieldValue.serverTimestamp(),

        version:
          1
      };


      await db
        .collection("usuarios")
        .doc(authUser.uid)
        .set(userProfile);


      // ================================================
      // LOG
      // ================================================

      await db
        .collection("logs")
        .add({

          action:
            "CREATE_MUNICIPAL_COORDINATOR",

          campaignId,

          municipalityId,

          municipalityName:
            municipality.name || "",

          targetUserId:
            authUser.uid,

          targetUserName:
            name,

          targetUserEmail:
            email,

          createdBy:
            adminUid,

          createdAt:
            FieldValue.serverTimestamp()
        });


      // ================================================
      // RESPONSE
      // ================================================

      return {

        success:
          true,

        user: {

          uid:
            authUser.uid,

          name,

          email,

          phone,

          role:
            "coordinador_municipal",

          campaignId,

          municipalityId,

          municipalityName:
            municipality.name || "",

          active:
            true,

          mustChangePassword:
            true
        }
      };


    } catch (error) {

      // ================================================
      // ROLLBACK
      // ================================================

      if (authUser?.uid) {

        try {

          await auth.deleteUser(
            authUser.uid
          );

        } catch (
          rollbackError
        ) {

          console.error(
            "Error al revertir usuario Auth:",
            rollbackError
          );
        }
      }


      console.error(
        "Error al crear coordinador municipal:",
        error
      );


      if (
        error instanceof HttpsError
      ) {
        throw error;
      }


      if (
        error?.code ===
        "auth/email-already-exists"
      ) {
        throw new HttpsError(
          "already-exists",
          "Ya existe un usuario registrado con ese correo."
        );
      }


      if (
        error?.code ===
        "auth/invalid-password"
      ) {
        throw new HttpsError(
          "invalid-argument",
          "La contraseña temporal no es válida."
        );
      }


      throw new HttpsError(
        "internal",
        "No fue posible crear el coordinador municipal."
      );
    }
  }
);



// ======================================================
// CREATE STRUCTURE
// ======================================================

exports.createStructure = onCall(
  {
    region: "us-central1"
  },

  async (request) => {

    // ==================================================
    // AUTH
    // ==================================================

    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Debe iniciar sesión."
      );
    }

    const creatorUid =
      request.auth.uid;

    const db =
      getFirestore();


    // ==================================================
    // PERFIL DEL CREADOR
    // ==================================================

    const creatorRef =
      db.collection("usuarios").doc(creatorUid);

    const creatorSnapshot =
      await creatorRef.get();

    if (!creatorSnapshot.exists) {
      throw new HttpsError(
        "permission-denied",
        "El usuario no tiene un perfil autorizado."
      );
    }

    const creatorProfile =
      creatorSnapshot.data();


    if (creatorProfile.active !== true) {
      throw new HttpsError(
        "permission-denied",
        "El usuario está desactivado."
      );
    }


    const allowedRoles = [
      "admin",
      "coordinador_municipal"
    ];


    if (
      !allowedRoles.includes(
        creatorProfile.role
      )
    ) {
      throw new HttpsError(
        "permission-denied",
        "No tiene permisos para crear estructuras."
      );
    }


    const campaignId =
      creatorProfile.campaignId;


    if (!campaignId) {
      throw new HttpsError(
        "failed-precondition",
        "El usuario no tiene campaña asignada."
      );
    }


    // ==================================================
    // INPUT
    // ==================================================

    const data =
      request.data || {};


    const name =
      cleanText(
        data.name || ""
      );


    const municipalityId =
      cleanText(
        data.municipalityId || ""
      );


    const coordinatorId =
      cleanText(
        data.coordinatorId || ""
      );


    if (
      name.length < 2 ||
      name.length > 120
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Ingrese un nombre válido para la estructura."
      );
    }


    if (!municipalityId) {
      throw new HttpsError(
        "invalid-argument",
        "Debe seleccionar un municipio."
      );
    }


    if (!coordinatorId) {
      throw new HttpsError(
        "invalid-argument",
        "Debe seleccionar un coordinador municipal."
      );
    }


    // ==================================================
    // VALIDAR MUNICIPIO
    // ==================================================

    const municipalityRef =
      db
        .collection("municipios")
        .doc(municipalityId);


    const municipalitySnapshot =
      await municipalityRef.get();


    if (!municipalitySnapshot.exists) {
      throw new HttpsError(
        "not-found",
        "El municipio no existe."
      );
    }


    const municipality =
      municipalitySnapshot.data();


    if (
      municipality.campaignId !== campaignId
    ) {
      throw new HttpsError(
        "permission-denied",
        "El municipio no pertenece a esta campaña."
      );
    }


    if (
      municipality.active !== true
    ) {
      throw new HttpsError(
        "failed-precondition",
        "El municipio está desactivado."
      );
    }


    // ==================================================
    // VALIDAR COORDINADOR
    // ==================================================

    const coordinatorRef =
      db
        .collection("usuarios")
        .doc(coordinatorId);


    const coordinatorSnapshot =
      await coordinatorRef.get();


    if (!coordinatorSnapshot.exists) {
      throw new HttpsError(
        "not-found",
        "El coordinador municipal no existe."
      );
    }


    const coordinator =
      coordinatorSnapshot.data();


    if (
      coordinator.role !==
      "coordinador_municipal"
    ) {
      throw new HttpsError(
        "failed-precondition",
        "El usuario seleccionado no es coordinador municipal."
      );
    }


    if (
      coordinator.active !== true
    ) {
      throw new HttpsError(
        "failed-precondition",
        "El coordinador municipal está desactivado."
      );
    }


    if (
      coordinator.campaignId !== campaignId
    ) {
      throw new HttpsError(
        "permission-denied",
        "El coordinador no pertenece a esta campaña."
      );
    }


    if (
      coordinator.municipalityId !==
      municipalityId
    ) {
      throw new HttpsError(
        "permission-denied",
        "El coordinador no pertenece al municipio seleccionado."
      );
    }


    // ==================================================
    // RESTRICCIÓN PARA COORDINADOR MUNICIPAL
    // ==================================================

    if (
      creatorProfile.role ===
      "coordinador_municipal"
    ) {

      if (
        creatorUid !==
        coordinatorId
      ) {
        throw new HttpsError(
          "permission-denied",
          "El coordinador municipal solo puede crear estructuras bajo su propia coordinación."
        );
      }


      if (
        creatorProfile.municipalityId !==
        municipalityId
      ) {
        throw new HttpsError(
          "permission-denied",
          "El coordinador no puede crear estructuras fuera de su municipio."
        );
      }
    }


    // ==================================================
    // NORMALIZAR NOMBRE
    // ==================================================

    const normalizedName =
      normalizeName(
        name
      );


    // ==================================================
    // VALIDAR DUPLICADO
    // ==================================================

    const duplicateSnapshot =
      await db
        .collection("estructuras")
        .where(
          "campaignId",
          "==",
          campaignId
        )
        .where(
          "coordinatorId",
          "==",
          coordinatorId
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
        "Ya existe una estructura con ese nombre bajo este coordinador."
      );
    }


    // ==================================================
    // SECUENCIA
    // ==================================================

    const sequenceRef =
      db
        .collection("secuencias")
        .doc(
          `${campaignId}_ESTRUCTURAS`
        );


    const structureRef =
      db
        .collection("estructuras")
        .doc();


    let structureId = "";


    await db.runTransaction(
      async (transaction) => {

        const sequenceSnapshot =
          await transaction.get(
            sequenceRef
          );


        let nextNumber = 1;


        if (sequenceSnapshot.exists) {

          const current =
            Number(
              sequenceSnapshot.data()?.lastNumber ||
              0
            );

          nextNumber =
            current + 1;
        }


        structureId =
          `EST-${String(
            nextNumber
          ).padStart(
            3,
            "0"
          )}`;


        transaction.set(
          structureRef,
          {

            id:
              structureId,

            campaignId,

            municipalityId,

            municipalityName:
              municipality.name || "",

            coordinatorId,

            coordinatorName:
              coordinator.name || "",

            name,

            normalizedName,

            active:
              true,

            createdBy:
              creatorUid,

            createdByRole:
              creatorProfile.role,

            createdAt:
              FieldValue.serverTimestamp(),

            updatedAt:
              FieldValue.serverTimestamp(),

            version:
              1
          }
        );


        transaction.set(
          sequenceRef,
          {

            lastNumber:
              nextNumber,

            updatedAt:
              FieldValue.serverTimestamp()
          },

          {
            merge:
              true
          }
        );
      }
    );


    // ==================================================
    // LOG
    // ==================================================

    await db
      .collection("logs")
      .add({

        action:
          "CREATE_STRUCTURE",

        campaignId,

        municipalityId,

        municipalityName:
          municipality.name || "",

        coordinatorId,

        coordinatorName:
          coordinator.name || "",

        structureId,

        structureName:
          name,

        createdBy:
          creatorUid,

        createdByRole:
          creatorProfile.role,

        createdAt:
          FieldValue.serverTimestamp()
      });


    // ==================================================
    // RESPONSE
    // ==================================================

    return {

      success:
        true,

      structure: {

        id:
          structureId,

        campaignId,

        municipalityId,

        municipalityName:
          municipality.name || "",

        coordinatorId,

        coordinatorName:
          coordinator.name || "",

        name,

        active:
          true
      }
    };
  }
);



// ======================================================
// CREATE STRUCTURE CHIEF
// JEFE DE ESTRUCTURA
// ======================================================

exports.createStructureChief = onCall(
  {
    region: "us-central1"
  },

  async (request) => {

    // ==================================================
    // 1. AUTENTICACIÓN
    // ==================================================

    if (!request.auth) {

      throw new HttpsError(
        "unauthenticated",
        "Debe iniciar sesión."
      );
    }


    const creatorUid =
      request.auth.uid;


    // ==================================================
    // 2. PERFIL DEL CREADOR
    // ==================================================

    const creatorRef =
      db
        .collection("usuarios")
        .doc(creatorUid);


    const creatorSnapshot =
      await creatorRef.get();


    if (!creatorSnapshot.exists) {

      throw new HttpsError(
        "permission-denied",
        "El usuario no tiene un perfil autorizado."
      );
    }


    const creatorProfile =
      creatorSnapshot.data();


    if (
      creatorProfile.active !== true
    ) {

      throw new HttpsError(
        "permission-denied",
        "El usuario está desactivado."
      );
    }


    const allowedRoles = [
      "admin",
      "coordinador_municipal"
    ];


    if (
      !allowedRoles.includes(
        creatorProfile.role
      )
    ) {

      throw new HttpsError(
        "permission-denied",
        "No tiene permisos para crear jefes de estructura."
      );
    }


    const campaignId =
      creatorProfile.campaignId;


    if (!campaignId) {

      throw new HttpsError(
        "failed-precondition",
        "El usuario no tiene campaña asignada."
      );
    }


    // ==================================================
    // 3. DATOS RECIBIDOS
    // ==================================================

    const data =
      request.data || {};


    const name =
      cleanText(
        data.name || ""
      );


    const email =
      normalizeEmail(
        data.email || ""
      );


 const phone =
  normalizePhone(
    data.phone || ""
  );

const password =
  String(
    data.password || ""
  );

const structureDocumentId =
  cleanText(
    data.structureDocumentId || ""
  );


    // ==================================================
    // 4. VALIDACIONES
    // ==================================================

    if (
      name.length < 2 ||
      name.length > 120
    ) {

      throw new HttpsError(
        "invalid-argument",
        "Ingrese un nombre válido."
      );
    }


    if (!isValidEmail(email)) {

      throw new HttpsError(
        "invalid-argument",
        "Ingrese un correo electrónico válido."
      );
    }


    if (
      phone &&
      (
        phone.length < 10 ||
        phone.length > 15
      )
    ) {

      throw new HttpsError(
        "invalid-argument",
        "Ingrese un teléfono válido de entre 10 y 15 dígitos."
      );
    }


    if (
      password.length < 6
    ) {

      throw new HttpsError(
        "invalid-argument",
        "La contraseña temporal debe tener al menos 6 caracteres."
      );
    }


    if (!structureDocumentId) {

      throw new HttpsError(
        "invalid-argument",
        "No se recibió la estructura."
      );
    }


    // ==================================================
    // 5. VALIDAR ESTRUCTURA
    // ==================================================

    const structureRef =
      db
        .collection("estructuras")
        .doc(structureDocumentId);


    const structureSnapshot =
      await structureRef.get();


    if (!structureSnapshot.exists) {

      throw new HttpsError(
        "not-found",
        "La estructura seleccionada no existe."
      );
    }


    const structure =
      structureSnapshot.data();


    if (
      structure.active !== true
    ) {

      throw new HttpsError(
        "failed-precondition",
        "La estructura está desactivada."
      );
    }


    if (
      structure.campaignId !==
      campaignId
    ) {

      throw new HttpsError(
        "permission-denied",
        "La estructura pertenece a otra campaña."
      );
    }


    // ==================================================
    // 6. RESTRICCIÓN DEL COORDINADOR MUNICIPAL
    // ==================================================

    if (
      creatorProfile.role ===
      "coordinador_municipal"
    ) {

      if (
        structure.coordinatorId !==
        creatorUid
      ) {

        throw new HttpsError(
          "permission-denied",
          "El coordinador municipal solo puede administrar sus propias estructuras."
        );
      }


      if (
        structure.municipalityId !==
        creatorProfile.municipalityId
      ) {

        throw new HttpsError(
          "permission-denied",
          "La estructura no pertenece al municipio del coordinador."
        );
      }
    }


    // ==================================================
    // 7. SOLO UN JEFE ACTIVO POR ESTRUCTURA
    // ==================================================

    const existingChiefSnapshot =
      await db
        .collection("usuarios")
        .where(
          "campaignId",
          "==",
          campaignId
        )
        .where(
          "structureId",
          "==",
          structure.id
        )
        .where(
          "role",
          "==",
          "jefe_estructura"
        )
        .limit(1)
        .get();


    if (
      !existingChiefSnapshot.empty
    ) {

      throw new HttpsError(
        "already-exists",
        "Esta estructura ya tiene un jefe asignado."
      );
    }


    // ==================================================
    // 8. CREAR CUENTA EN FIREBASE AUTH
    // ==================================================

    let authUser =
      null;


    try {

      authUser =
        await auth.createUser({

          email,

          password,

          displayName:
            name,

          disabled:
            false
        });


    } catch (error) {

      console.error(
        "Error al crear jefe de estructura en Authentication:",
        error
      );


      if (
        error?.code ===
        "auth/email-already-exists"
      ) {

        throw new HttpsError(
          "already-exists",
          "Ya existe un usuario registrado con ese correo."
        );
      }


      if (
        error?.code ===
        "auth/invalid-email"
      ) {

        throw new HttpsError(
          "invalid-argument",
          "El correo electrónico no es válido."
        );
      }


      if (
        error?.code ===
        "auth/invalid-password"
      ) {

        throw new HttpsError(
          "invalid-argument",
          "La contraseña temporal no cumple los requisitos."
        );
      }


      throw new HttpsError(
        "internal",
        "No fue posible crear la cuenta del jefe de estructura."
      );
    }


    // ==================================================
    // 9. CREAR PERFIL EN FIRESTORE
    // ==================================================

    const chiefRef =
      db
        .collection("usuarios")
        .doc(authUser.uid);


    try {

      const chiefProfile = {

        uid:
          authUser.uid,

        name,

        email,

        phone,

        role:
          "jefe_estructura",

        active:
          true,

        campaignId,

        municipalityId:
          structure.municipalityId,

        municipalityName:
          structure.municipalityName || "",

        coordinatorId:
          structure.coordinatorId,

        coordinatorName:
          structure.coordinatorName || "",

        structureId:
          structure.id,

        structureDocumentId:
          structureSnapshot.id,

        structureName:
          structure.name || "",

        parentUserId:
          structure.coordinatorId,

        createdBy:
          creatorUid,

        createdByRole:
          creatorProfile.role,

        mustChangePassword:
          true,

        createdAt:
          FieldValue.serverTimestamp(),

        updatedAt:
          FieldValue.serverTimestamp(),

        version:
          1
      };


      await chiefRef.set(
        chiefProfile
      );


      // ==================================================
      // 10. ACTUALIZAR ESTRUCTURA
      // ==================================================

      await structureRef.update({

        chiefId:
          authUser.uid,

        chiefName:
          name,

        updatedAt:
          FieldValue.serverTimestamp(),

        updatedBy:
          creatorUid,

        version:
          FieldValue.increment(1)
      });


      // ==================================================
      // 11. AUDITORÍA
      // ==================================================

      await db
        .collection("logs")
        .add({

          action:
            "CREATE_STRUCTURE_CHIEF",

          campaignId,

          municipalityId:
            structure.municipalityId,

          municipalityName:
            structure.municipalityName || "",

          coordinatorId:
            structure.coordinatorId,

          coordinatorName:
            structure.coordinatorName || "",

          structureId:
            structure.id,

          structureDocumentId:
            structureSnapshot.id,

          structureName:
            structure.name || "",

          targetUserId:
            authUser.uid,

          targetUserName:
            name,

          targetUserEmail:
            email,

          createdBy:
            creatorUid,

          createdByRole:
            creatorProfile.role,

          createdAt:
            FieldValue.serverTimestamp()
        });


      // ==================================================
      // 12. RESPUESTA
      // ==================================================

      return {

        success:
          true,

        user: {

          uid:
            authUser.uid,

          name,

          email,

          phone,

          role:
            "jefe_estructura",

          active:
            true,

          campaignId,

          municipalityId:
            structure.municipalityId,

          municipalityName:
            structure.municipalityName || "",

          coordinatorId:
            structure.coordinatorId,

          coordinatorName:
            structure.coordinatorName || "",

          structureId:
            structure.id,

          structureDocumentId:
            structureSnapshot.id,

          structureName:
            structure.name || "",

          mustChangePassword:
            true
        },

        message:
          `${name} fue asignado como jefe de ${structure.name}.`
      };


    } catch (error) {

      console.error(
        "Error al crear perfil del jefe de estructura:",
        error
      );


      // ==================================================
      // ROLLBACK AUTH
      // ==================================================

      try {

        await auth.deleteUser(
          authUser.uid
        );

      } catch (
        rollbackError
      ) {

        console.error(
          "No fue posible revertir Authentication:",
          rollbackError
        );
      }


      if (
        error instanceof HttpsError
      ) {

        throw error;
      }


      throw new HttpsError(
        "internal",
        "No fue posible guardar el jefe de estructura."
      );
    }
  }
);



// ======================================================
// CREATE STRUCTURE MEMBER
// INTEGRANTE DE ESTRUCTURA
// ======================================================

exports.createStructureMember = onCall(
  {
    region: "us-central1"
  },

  async (request) => {

    // ==================================================
    // 1. AUTENTICACIÓN
    // ==================================================

    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Debe iniciar sesión."
      );
    }

    const creatorUid =
      request.auth.uid;


    // ==================================================
    // 2. PERFIL DEL CREADOR
    // ==================================================

    const creatorRef =
      db
        .collection("usuarios")
        .doc(creatorUid);

    const creatorSnapshot =
      await creatorRef.get();

    if (!creatorSnapshot.exists) {
      throw new HttpsError(
        "permission-denied",
        "El usuario no tiene un perfil autorizado."
      );
    }

    const creatorProfile =
      creatorSnapshot.data();

    if (
      creatorProfile.active !== true
    ) {
      throw new HttpsError(
        "permission-denied",
        "El usuario está desactivado."
      );
    }

    const allowedRoles = [
      "admin",
      "coordinador_municipal",
      "jefe_estructura"
    ];

    if (
      !allowedRoles.includes(
        creatorProfile.role
      )
    ) {
      throw new HttpsError(
        "permission-denied",
        "No tiene permisos para crear integrantes."
      );
    }

    const campaignId =
      creatorProfile.campaignId;

    if (!campaignId) {
      throw new HttpsError(
        "failed-precondition",
        "El usuario no tiene campaña asignada."
      );
    }


    // ==================================================
    // 3. DATOS RECIBIDOS
    // ==================================================

    const data =
      request.data || {};

    const name =
      cleanText(
        data.name || ""
      );

    const email =
      normalizeEmail(
        data.email || ""
      );

   const phone =
  normalizePhone(
    data.phone || ""
  );

const locality =
  cleanText(
    data.locality || ""
  );

const password =
  String(
    data.password || ""
  );



    const structureDocumentId =
      cleanText(
        data.structureDocumentId || ""
      );


    // ==================================================
    // 4. VALIDACIONES
    // ==================================================

    if (
      name.length < 2 ||
      name.length > 120
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Ingrese un nombre válido."
      );
    }

    if (!isValidEmail(email)) {
      throw new HttpsError(
        "invalid-argument",
        "Ingrese un correo electrónico válido."
      );
    }

    if (
      phone &&
      (
        phone.length < 10 ||
        phone.length > 15
      )
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Ingrese un teléfono válido de entre 10 y 15 dígitos."
      );
    }

    if (
      password.length < 6
    ) {
      throw new HttpsError(
        "invalid-argument",
        "La contraseña temporal debe tener al menos 6 caracteres."
      );
    }

    if (!structureDocumentId) {
      throw new HttpsError(
        "invalid-argument",
        "No se recibió la estructura."
      );
    }


    // ==================================================
    // 5. VALIDAR ESTRUCTURA
    // ==================================================

    const structureRef =
      db
        .collection("estructuras")
        .doc(structureDocumentId);

    const structureSnapshot =
      await structureRef.get();

    if (!structureSnapshot.exists) {
      throw new HttpsError(
        "not-found",
        "La estructura seleccionada no existe."
      );
    }

    const structure =
      structureSnapshot.data();

    if (
      structure.active !== true
    ) {
      throw new HttpsError(
        "failed-precondition",
        "La estructura está desactivada."
      );
    }

    if (
      structure.campaignId !==
      campaignId
    ) {
      throw new HttpsError(
        "permission-denied",
        "La estructura pertenece a otra campaña."
      );
    }


    // ==================================================
    // 6. RESTRICCIONES POR ROL
    // ==================================================

    if (
      creatorProfile.role ===
      "coordinador_municipal"
    ) {

      if (
        structure.coordinatorId !==
        creatorUid
      ) {
        throw new HttpsError(
          "permission-denied",
          "El coordinador municipal solo puede administrar sus propias estructuras."
        );
      }

      if (
        structure.municipalityId !==
        creatorProfile.municipalityId
      ) {
        throw new HttpsError(
          "permission-denied",
          "La estructura no pertenece al municipio del coordinador."
        );
      }
    }


    if (
      creatorProfile.role ===
      "jefe_estructura"
    ) {

      if (
        creatorProfile.structureId !==
        structure.id
      ) {
        throw new HttpsError(
          "permission-denied",
          "El jefe de estructura solo puede registrar integrantes dentro de su propia estructura."
        );
      }

      if (
        creatorProfile.structureDocumentId !==
        structureSnapshot.id
      ) {
        throw new HttpsError(
          "permission-denied",
          "La estructura no coincide con la asignada al jefe."
        );
      }
    }


    // ==================================================
    // 7. CREAR USUARIO EN FIREBASE AUTH
    // ==================================================

    let authUser =
      null;

    try {

      authUser =
        await auth.createUser({

          email,

          password,

          displayName:
            name,

          disabled:
            false
        });

    } catch (error) {

      console.error(
        "Error al crear integrante en Authentication:",
        error
      );

      if (
        error?.code ===
        "auth/email-already-exists"
      ) {
        throw new HttpsError(
          "already-exists",
          "Ya existe un usuario registrado con ese correo."
        );
      }

      if (
        error?.code ===
        "auth/invalid-email"
      ) {
        throw new HttpsError(
          "invalid-argument",
          "El correo electrónico no es válido."
        );
      }

      if (
        error?.code ===
        "auth/invalid-password"
      ) {
        throw new HttpsError(
          "invalid-argument",
          "La contraseña temporal no cumple los requisitos."
        );
      }

      throw new HttpsError(
        "internal",
        "No fue posible crear la cuenta del integrante."
      );
    }


    // ==================================================
    // 8. DEFINIR PADRE JERÁRQUICO
    // ==================================================

    let parentUserId =
      creatorUid;

    if (
      creatorProfile.role ===
      "admin"
    ) {
      parentUserId =
        structure.chiefId ||
        structure.coordinatorId ||
        creatorUid;
    }

    if (
      creatorProfile.role ===
      "coordinador_municipal"
    ) {
      parentUserId =
        structure.chiefId ||
        creatorUid;
    }


    // ==================================================
    // 9. CREAR PERFIL EN FIRESTORE
    // ==================================================

    const memberRef =
      db
        .collection("usuarios")
        .doc(authUser.uid);

    try {

      const memberProfile = {

        uid:
          authUser.uid,

        name,

        email,

        phone,

        role:
          "integrante",

        active:
          true,

        campaignId,

        municipalityId:
          structure.municipalityId,

        municipalityName:
          structure.municipalityName || "",

        coordinatorId:
          structure.coordinatorId,

        coordinatorName:
          structure.coordinatorName || "",

        structureId:
          structure.id,

        structureDocumentId:
          structureSnapshot.id,

        structureName:
          structure.name || "",

        structureChiefId:
          structure.chiefId || null,

        structureChiefName:
          structure.chiefName || "",

        parentUserId,

        createdBy:
          creatorUid,

        createdByRole:
          creatorProfile.role,

        mustChangePassword:
          true,

        createdAt:
          FieldValue.serverTimestamp(),

        updatedAt:
          FieldValue.serverTimestamp(),

        version:
          1
      };

      await memberRef.set(
        memberProfile
      );


      // ==================================================
      // 10. AUDITORÍA
      // ==================================================

      await db
        .collection("logs")
        .add({

          action:
            "CREATE_STRUCTURE_MEMBER",

          campaignId,

          municipalityId:
            structure.municipalityId,

          municipalityName:
            structure.municipalityName || "",

          coordinatorId:
            structure.coordinatorId,

          coordinatorName:
            structure.coordinatorName || "",

          structureId:
            structure.id,

          structureDocumentId:
            structureSnapshot.id,

          structureName:
            structure.name || "",

          structureChiefId:
            structure.chiefId || null,

          structureChiefName:
            structure.chiefName || "",

          targetUserId:
            authUser.uid,

          targetUserName:
            name,

          targetUserEmail:
            email,

          parentUserId,

          createdBy:
            creatorUid,

          createdByRole:
            creatorProfile.role,

          createdAt:
            FieldValue.serverTimestamp()
        });


      // ==================================================
      // 11. RESPUESTA
      // ==================================================

      return {

        success:
          true,

        user: {

          uid:
            authUser.uid,

          name,

          email,

          phone,

          role:
            "integrante",

          active:
            true,

          campaignId,

          municipalityId:
            structure.municipalityId,

          municipalityName:
            structure.municipalityName || "",

          coordinatorId:
            structure.coordinatorId,

          coordinatorName:
            structure.coordinatorName || "",

          structureId:
            structure.id,

          structureDocumentId:
            structureSnapshot.id,

          structureName:
            structure.name || "",

          structureChiefId:
            structure.chiefId || null,

          structureChiefName:
            structure.chiefName || "",

          parentUserId,

          mustChangePassword:
            true
        },

        message:
          `${name} fue registrado como integrante de ${structure.name}.`
      };

    } catch (error) {

      console.error(
        "Error al crear perfil del integrante:",
        error
      );


      // ==================================================
      // ROLLBACK AUTH
      // ==================================================

      try {

        await auth.deleteUser(
          authUser.uid
        );

      } catch (
        rollbackError
      ) {

        console.error(
          "No fue posible revertir Authentication:",
          rollbackError
        );
      }


      if (
        error instanceof HttpsError
      ) {
        throw error;
      }


      throw new HttpsError(
        "internal",
        "No fue posible guardar el integrante."
      );
    }
  }
);


// ======================================================
// CREATE PARTICIPANT
// ÚLTIMO NIVEL DE LA JERARQUÍA
// ======================================================

exports.createParticipant = onCall(
  {
    region: "us-central1"
  },

  async (request) => {

    // ==================================================
    // 1. AUTENTICACIÓN
    // ==================================================

    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Debe iniciar sesión."
      );
    }

    const creatorUid =
      request.auth.uid;


    // ==================================================
    // 2. PERFIL DEL CREADOR
    // ==================================================

    const creatorRef =
      db
        .collection("usuarios")
        .doc(creatorUid);

    const creatorSnapshot =
      await creatorRef.get();

    if (!creatorSnapshot.exists) {
      throw new HttpsError(
        "permission-denied",
        "El usuario no tiene un perfil autorizado."
      );
    }

    const creatorProfile =
      creatorSnapshot.data();

    if (
      creatorProfile.active !== true
    ) {
      throw new HttpsError(
        "permission-denied",
        "El usuario está desactivado."
      );
    }

    const allowedRoles = [
      "admin",
      "coordinador_municipal",
      "jefe_estructura",
      "integrante"
    ];

    if (
      !allowedRoles.includes(
        creatorProfile.role
      )
    ) {
      throw new HttpsError(
        "permission-denied",
        "No tiene permisos para crear participantes."
      );
    }

    const campaignId =
      creatorProfile.campaignId;

    if (!campaignId) {
      throw new HttpsError(
        "failed-precondition",
        "El usuario no tiene campaña asignada."
      );
    }


    // ==================================================
    // 3. DATOS RECIBIDOS
    // ==================================================

    const data =
      request.data || {};

    const name =
      cleanText(
        data.name || ""
      );

    const email =
      normalizeEmail(
        data.email || ""
      );

   const phone =
  normalizePhone(
    data.phone || ""
  );

const locality =
  cleanText(
    data.locality || ""
  );

const password =
  String(
    data.password || ""
  );

const parentUserId =
  cleanText(
    data.parentUserId || ""
  );


   // ==================================================
// 4. VALIDACIONES BÁSICAS
// ==================================================

if (
  name.length < 2 ||
  name.length > 120
) {
  throw new HttpsError(
    "invalid-argument",
    "Ingrese un nombre válido."
  );
}

if (!isValidEmail(email)) {
  throw new HttpsError(
    "invalid-argument",
    "Ingrese un correo electrónico válido."
  );
}

if (
  phone &&
  (
    phone.length < 10 ||
    phone.length > 15
  )
) {
  throw new HttpsError(
    "invalid-argument",
    "Ingrese un teléfono válido de entre 10 y 15 dígitos."
  );
}

if (
  locality.length < 2 ||
  locality.length > 120
) {
  throw new HttpsError(
    "invalid-argument",
    "Ingrese una localidad válida."
  );
}

if (
  password.length < 6
) {
  throw new HttpsError(
    "invalid-argument",
    "La contraseña temporal debe tener al menos 6 caracteres."
  );
}

if (!parentUserId) {
  throw new HttpsError(
    "invalid-argument",
    "No se recibió el integrante responsable."
  );
}


    // ==================================================
    // 5. VALIDAR INTEGRANTE PADRE
    // ==================================================

    const parentRef =
      db
        .collection("usuarios")
        .doc(parentUserId);

    const parentSnapshot =
      await parentRef.get();

    if (!parentSnapshot.exists) {
      throw new HttpsError(
        "not-found",
        "El integrante responsable no existe."
      );
    }

    const parentProfile =
      parentSnapshot.data();

    if (
      parentProfile.role !==
      "integrante"
    ) {
      throw new HttpsError(
        "failed-precondition",
        "El usuario responsable no es un integrante."
      );
    }

    if (
      parentProfile.active !== true
    ) {
      throw new HttpsError(
        "failed-precondition",
        "El integrante responsable está desactivado."
      );
    }

    if (
      parentProfile.campaignId !==
      campaignId
    ) {
      throw new HttpsError(
        "permission-denied",
        "El integrante pertenece a otra campaña."
      );
    }


    // ==================================================
    // 6. RESTRICCIONES POR ROL
    // ==================================================

    if (
      creatorProfile.role ===
      "integrante"
    ) {

      if (
        creatorUid !==
        parentUserId
      ) {
        throw new HttpsError(
          "permission-denied",
          "Un integrante solo puede registrar participantes dentro de su propia base."
        );
      }
    }


    if (
      creatorProfile.role ===
      "jefe_estructura"
    ) {

      if (
        creatorProfile.structureId !==
        parentProfile.structureId
      ) {
        throw new HttpsError(
          "permission-denied",
          "Solo puede registrar participantes dentro de su propia estructura."
        );
      }
    }


    if (
      creatorProfile.role ===
      "coordinador_municipal"
    ) {

      if (
        creatorProfile.municipalityId !==
        parentProfile.municipalityId
      ) {
        throw new HttpsError(
          "permission-denied",
          "Solo puede registrar participantes dentro de su propio municipio."
        );
      }
    }


    // ==================================================
    // 7. CREAR USUARIO EN FIREBASE AUTH
    // ==================================================

    let authUser =
      null;

    try {

      authUser =
        await auth.createUser({

          email,

          password,

          displayName:
            name,

          disabled:
            false
        });

    } catch (error) {

      console.error(
        "Error al crear participante en Authentication:",
        error
      );

      if (
        error?.code ===
        "auth/email-already-exists"
      ) {
        throw new HttpsError(
          "already-exists",
          "Ya existe un usuario registrado con ese correo."
        );
      }

      if (
        error?.code ===
        "auth/invalid-email"
      ) {
        throw new HttpsError(
          "invalid-argument",
          "El correo electrónico no es válido."
        );
      }

      if (
        error?.code ===
        "auth/invalid-password"
      ) {
        throw new HttpsError(
          "invalid-argument",
          "La contraseña temporal no cumple los requisitos."
        );
      }

      throw new HttpsError(
        "internal",
        "No fue posible crear la cuenta del participante."
      );
    }


    // ==================================================
    // 8. CREAR PERFIL EN FIRESTORE
    // ==================================================

    const participantRef =
      db
        .collection("usuarios")
        .doc(authUser.uid);

    try {

      const participantProfile = {

        uid:
          authUser.uid,

        name,

        email,

        phone,

        locality,

        role:
          "participante",

        active:
          true,

        campaignId,

        municipalityId:
          parentProfile.municipalityId || "",

        municipalityName:
          parentProfile.municipalityName || "",

        coordinatorId:
          parentProfile.coordinatorId || "",

        coordinatorName:
          parentProfile.coordinatorName || "",

        structureId:
          parentProfile.structureId || "",

        structureDocumentId:
          parentProfile.structureDocumentId || "",

        structureName:
          parentProfile.structureName || "",

        structureChiefId:
          parentProfile.structureChiefId || null,

        structureChiefName:
          parentProfile.structureChiefName || "",

        parentUserId,

        parentUserName:
          parentProfile.name || "",

        createdBy:
          creatorUid,

        createdByRole:
          creatorProfile.role,

        mustChangePassword:
          true,

        createdAt:
          FieldValue.serverTimestamp(),

        updatedAt:
          FieldValue.serverTimestamp(),

        version:
          1
      };

      await participantRef.set(
        participantProfile
      );


      // ==================================================
      // 9. AUDITORÍA
      // ==================================================

      await db
        .collection("logs")
        .add({

          action:
            "CREATE_PARTICIPANT",

          campaignId,

          municipalityId:
            parentProfile.municipalityId || "",

          structureId:
            parentProfile.structureId || "",

          structureDocumentId:
            parentProfile.structureDocumentId || "",

          parentUserId,

          parentUserName:
            parentProfile.name || "",

          targetUserId:
            authUser.uid,

          targetUserName:
            name,

          targetUserEmail:
            email,

          locality,

          createdBy:
            creatorUid,

          createdByRole:
            creatorProfile.role,

          createdAt:
            FieldValue.serverTimestamp()
        });


      // ==================================================
      // 10. RESPUESTA
      // ==================================================

      return {

        success:
          true,

        user: {

          uid:
            authUser.uid,

          name,

          email,

          phone,

          locality,

          role:
            "participante",

          active:
            true,

          campaignId,

          municipalityId:
            parentProfile.municipalityId || "",

          municipalityName:
            parentProfile.municipalityName || "",

          structureId:
            parentProfile.structureId || "",

          structureDocumentId:
            parentProfile.structureDocumentId || "",

          structureName:
            parentProfile.structureName || "",

          parentUserId,

          parentUserName:
            parentProfile.name || "",

          mustChangePassword:
            true
        },

        message:
          `${name} fue registrado como participante de ${parentProfile.name}.`
      };

    } catch (error) {

      console.error(
        "Error al crear perfil del participante:",
        error
      );


      // ==================================================
      // ROLLBACK AUTH
      // ==================================================

      try {

        await auth.deleteUser(
          authUser.uid
        );

      } catch (
        rollbackError
      ) {

        console.error(
          "No fue posible revertir Authentication:",
          rollbackError
        );
      }


      if (
        error instanceof HttpsError
      ) {
        throw error;
      }


      throw new HttpsError(
        "internal",
        "No fue posible guardar el participante."
      );
    }
  }
);


