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
// COLECCIONES QUE NO DEBEN CONTENER DATOS PREVIOS
// PARA UNA CAMPAÑA NUEVA.
// ======================================================

const OCCUPANCY_COLLECTIONS = [
  'usuarios',
  'persons',
  'territorialMemberships',
  'municipios',
  'estructuras',
  'misiones',
  'eventos',
  'missionEvidence'
];


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
// ID OFICIAL DE NUEVA CAMPAÑA
//
// Primera convención multi-campaña:
//
// CAM-001
// CAM-002
// CAM-003
//
// Se admiten de 3 a 6 dígitos.
// ======================================================

function normalizeNewCampaignId(
  value
) {

  if (
    typeof value !== 'string'
  ) {
    fail(
      'invalid-argument',
      'campaignId inválido.'
    );
  }

  const campaignId =
    value
      .trim()
      .toUpperCase();

  if (
    !/^CAM-[0-9]{3,6}$/.test(
      campaignId
    )
  ) {
    fail(
      'invalid-argument',
      'campaignId debe usar el formato CAM-001.'
    );
  }

  return campaignId;
}


// ======================================================
// CONSTRUIR REGISTRO DE NUEVA CAMPAÑA
//
// IMPORTANTE:
// No depende de profile.campaignId.
//
// El Admin técnico puede administrar varias campañas
// independientes.
// ======================================================

function buildNewCampaignRegistration(
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

  const campaignId =
    normalizeNewCampaignId(
      data.campaignId
    );

  try {

    return buildCampaignRegistration({
      campaignId,

      name:
        data.name,

      adminUid
    });

  } catch (
    error
  ) {

    if (
      error instanceof TypeError
    ) {
      fail(
        'invalid-argument',
        'Datos de campaña inválidos.'
      );
    }

    throw error;
  }
}


// ======================================================
// VALIDAR DISPONIBILIDAD
// ======================================================

function validateCampaignAvailability({
  campaignExists,
  accessExists,
  leaderExists,
  occupiedCollections = []
}) {

  if (
    campaignExists
  ) {
    fail(
      'already-exists',
      'La campaña ya existe.'
    );
  }

  if (
    accessExists
  ) {
    fail(
      'failed-precondition',
      'Existe un acceso administrativo sin campaña formal.'
    );
  }

  if (
    leaderExists
  ) {
    fail(
      'failed-precondition',
      'Existe un Líder Principal asociado al campaignId solicitado.'
    );
  }

  if (
    !Array.isArray(
      occupiedCollections
    )
  ) {
    fail(
      'internal',
      'Estado de ocupación inválido.'
    );
  }

  if (
    occupiedCollections.length > 0
  ) {
    fail(
      'failed-precondition',
      `El campaignId ya tiene datos operacionales: ${occupiedCollections.join(', ')}.`
    );
  }

  return true;
}


// ======================================================
// CREAR CAMPAÑA INDEPENDIENTE
//
// Crea atómicamente:
//
// campaigns/{campaignId}
//
// adminCampaignAccess/{adminUid}/campaigns/{campaignId}
//
// NO crea Líder Principal.
// NO modifica profile.campaignId del Admin.
// NO crea estructura territorial.
// ======================================================

exports.createCampaign =
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

          // --------------------------------------------------
          // AUTORIZACION DENTRO DE LA MISMA TRANSACCION.
          //
          // Evita crear una campaña usando un perfil Admin
          // que haya cambiado entre autorización y escritura.
          // --------------------------------------------------

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
            buildNewCampaignRegistration(
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

          const leaderRef =
            db.doc(
              `principalLeaders/${registration.campaign.campaignId}`
            );

          // --------------------------------------------------
          // TODAS LAS LECTURAS ANTES DE ESCRIBIR.
          // --------------------------------------------------

          const campaignSnapshot =
            await tx.get(
              campaignRef
            );

          const accessSnapshot =
            await tx.get(
              accessRef
            );

          const leaderSnapshot =
            await tx.get(
              leaderRef
            );

          const occupiedCollections =
            [];

          for (
            const collectionName
            of OCCUPANCY_COLLECTIONS
          ) {

            const query =
              db
                .collection(
                  collectionName
                )
                .where(
                  'campaignId',
                  '==',
                  registration
                    .campaign
                    .campaignId
                )
                .limit(
                  1
                );

            const snapshot =
              await tx.get(
                query
              );

            if (
              !snapshot.empty
            ) {
              occupiedCollections.push(
                collectionName
              );
            }
          }

          validateCampaignAvailability({
            campaignExists:
              campaignSnapshot.exists,

            accessExists:
              accessSnapshot.exists,

            leaderExists:
              leaderSnapshot.exists,

            occupiedCollections
          });

          // --------------------------------------------------
          // ESCRITURAS ATOMICAS.
          // --------------------------------------------------

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
                .accessPath
          };
        }
      );
    }
  );


exports._test = {
  OCCUPANCY_COLLECTIONS,
  normalizeNewCampaignId,
  buildNewCampaignRegistration,
  validateCampaignAvailability
};
