'use strict';

const {
  onCall,
  HttpsError
} = require(
  'firebase-functions/v2/https'
);

const {
  getFirestore,
  FieldValue
} = require(
  'firebase-admin/firestore'
);

const {
  validId,
  isActiveTechnicalAdmin
} = require(
  './admin-campaign-access.cjs'
);

const {
  buildCampaignRegistration
} = require(
  './campaign-registry.cjs'
);


const OPTIONS = {
  region:
    'us-central1',

  timeoutSeconds:
    60
};


// ======================================================
// ERROR
// ======================================================

function fail(
  code,
  message
) {

  throw new HttpsError(
    code,
    message
  );
}


// ======================================================
// PLAN DE REGISTRO LEGACY
//
// Esta operación sirve únicamente para formalizar
// la campaña que actualmente vive en:
//
// usuarios/{adminUid}.campaignId
//
// No permite seleccionar otra campaña.
// La futura creación de CAM-002 será otro flujo.
// ======================================================

function buildLegacyCampaignRegistration(
  profile,
  adminUid,
  data = {}
) {

  if (
    !isActiveTechnicalAdmin(
      profile
    )
  ) {
    fail(
      'permission-denied',
      'Acceso exclusivo del Administrador técnico.'
    );
  }

  let uid;
  let campaignId;

  try {

    uid =
      validId(
        adminUid,
        'adminUid'
      );

    campaignId =
      validId(
        profile.campaignId,
        'campaignId'
      );

  } catch {

    fail(
      'failed-precondition',
      'El Administrador no tiene una campaña legacy válida.'
    );
  }

  try {

    return buildCampaignRegistration({
      campaignId,

      name:
        data.name,

      adminUid:
        uid
    });

  } catch (
    error
  ) {

    if (
      error instanceof TypeError
    ) {
      fail(
        'invalid-argument',
        'Indique un nombre válido para la campaña.'
      );
    }

    throw error;
  }
}


// ======================================================
// VALIDAR CAMPAÑA EXISTENTE
//
// false = todavía no existe.
// true  = ya existe y es compatible.
//
// Nunca sobrescribe silenciosamente un registro
// incompatible.
// ======================================================

function validateExistingCampaign(
  existing,
  registration
) {

  if (!existing) {
    return false;
  }

  if (
    existing.campaignId !==
      registration.campaign.campaignId ||
    existing.active !== true
  ) {
    fail(
      'failed-precondition',
      'El registro existente de la campaña no es compatible.'
    );
  }

  return true;
}


// ======================================================
// VALIDAR ACCESO EXISTENTE
// ======================================================

function validateExistingAccess(
  existing,
  registration
) {

  if (!existing) {
    return false;
  }

  if (
    existing.adminUid !==
      registration.access.adminUid ||
    existing.campaignId !==
      registration.access.campaignId ||
    existing.active !== true
  ) {
    fail(
      'failed-precondition',
      'El acceso administrativo existente no es compatible.'
    );
  }

  return true;
}


// ======================================================
// FORMALIZAR CAMPAÑA LEGACY DEL ADMIN
//
// Es idempotente:
//
// 1. Si campaign + access no existen:
//    crea ambos.
//
// 2. Si uno ya existe correctamente:
//    conserva el existente y crea únicamente el faltante.
//
// 3. Si ambos existen correctamente:
//    no modifica nada.
//
// 4. Si encuentra datos incompatibles:
//    aborta toda la transacción.
// ======================================================

exports.registerCurrentAdminCampaign =
  onCall(
    OPTIONS,
    async request => {

      if (
        !request.auth
      ) {
        fail(
          'unauthenticated',
          'Debe iniciar sesión.'
        );
      }

      const db =
        getFirestore();

      const adminUid =
        request.auth.uid;

      return db.runTransaction(
        async tx => {

          const profileRef =
            db.doc(
              `usuarios/${adminUid}`
            );

          const profileSnapshot =
            await tx.get(
              profileRef
            );

          if (
            !profileSnapshot.exists
          ) {
            fail(
              'permission-denied',
              'El usuario no tiene un perfil autorizado.'
            );
          }

          const profile =
            profileSnapshot.data();

          const registration =
            buildLegacyCampaignRegistration(
              profile,
              adminUid,
              request.data || {}
            );

          const campaignRef =
            db.doc(
              registration.campaignPath
            );

          const accessRef =
            db.doc(
              registration.accessPath
            );

          // Todas las lecturas ocurren antes
          // de cualquier escritura.
          const campaignSnapshot =
            await tx.get(
              campaignRef
            );

          const accessSnapshot =
            await tx.get(
              accessRef
            );

          const campaignExists =
            validateExistingCampaign(
              campaignSnapshot.exists
                ? campaignSnapshot.data()
                : null,
              registration
            );

          const accessExists =
            validateExistingAccess(
              accessSnapshot.exists
                ? accessSnapshot.data()
                : null,
              registration
            );

          if (
            !campaignExists
          ) {

            tx.create(
              campaignRef,
              {
                ...registration.campaign,

                createdAt:
                  FieldValue.serverTimestamp(),

                updatedAt:
                  FieldValue.serverTimestamp()
              }
            );
          }

          if (
            !accessExists
          ) {

            tx.create(
              accessRef,
              {
                ...registration.access,

                createdAt:
                  FieldValue.serverTimestamp(),

                updatedAt:
                  FieldValue.serverTimestamp()
              }
            );
          }

          return {
            ok:
              true,

            campaignId:
              registration
                .campaign
                .campaignId,

            campaignPath:
              registration
                .campaignPath,

            accessPath:
              registration
                .accessPath,

            campaignCreated:
              !campaignExists,

            accessCreated:
              !accessExists
          };
        }
      );
    }
  );


// ======================================================
// TESTS PUROS
// ======================================================

exports._test = {
  buildLegacyCampaignRegistration,
  validateExistingCampaign,
  validateExistingAccess
};
