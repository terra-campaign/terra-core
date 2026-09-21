'use strict';

const assert =
  require(
    'node:assert/strict'
  );

const {
  _test: {
    OCCUPANCY_COLLECTIONS,
    normalizeNewCampaignId,
    buildNewCampaignRegistration,
    validateCampaignAvailability
  }
} = require(
  './campaign-create-admin.cjs'
);


function expectHttpsError(
  fn,
  code
) {

  let error =
    null;

  try {

    fn();

  } catch (
    caught
  ) {

    error =
      caught;
  }

  assert.ok(
    error,
    `Se esperaba error ${code}.`
  );

  assert.equal(
    error.code,
    code
  );
}


// ======================================================
// ID CAMPAÑA
// ======================================================

assert.equal(
  normalizeNewCampaignId(
    ' cam-002 '
  ),
  'CAM-002'
);

assert.equal(
  normalizeNewCampaignId(
    'CAM-123456'
  ),
  'CAM-123456'
);

expectHttpsError(
  () =>
    normalizeNewCampaignId(
      'CAM-2'
    ),
  'invalid-argument'
);

expectHttpsError(
  () =>
    normalizeNewCampaignId(
      'OTRA-002'
    ),
  'invalid-argument'
);

expectHttpsError(
  () =>
    normalizeNewCampaignId(
      'CAM/002'
    ),
  'invalid-argument'
);


// ======================================================
// ADMIN GLOBAL
//
// No necesita campaignId legacy para crear una nueva
// campaña independiente.
// ======================================================

const registration =
  buildNewCampaignRegistration(
    {
      role:
        'admin',

      active:
        true
    },

    'ADMIN-1',

    {
      campaignId:
        'CAM-002',

      name:
        'Segunda Campaña'
    }
  );

assert.equal(
  registration.campaignPath,
  'campaigns/CAM-002'
);

assert.equal(
  registration.accessPath,
  'adminCampaignAccess/ADMIN-1/campaigns/CAM-002'
);

assert.deepEqual(
  registration.campaign,
  {
    campaignId:
      'CAM-002',

    name:
      'Segunda Campaña',

    active:
      true,

    createdBy:
      'ADMIN-1',

    version:
      1
  }
);


// ======================================================
// ADMIN CON CAMPAÑA LEGACY TAMBIEN PUEDE CREAR OTRA
// ======================================================

const legacyAdminRegistration =
  buildNewCampaignRegistration(
    {
      role:
        'admin',

      active:
        true,

      campaignId:
        'CAM-001'
    },

    'ADMIN-1',

    {
      campaignId:
        'CAM-002',

      name:
        'Campaña Independiente'
    }
  );

assert.equal(
  legacyAdminRegistration
    .campaign
    .campaignId,
  'CAM-002'
);


// ======================================================
// NO ADMIN
// ======================================================

expectHttpsError(
  () =>
    buildNewCampaignRegistration(
      {
        role:
          'lider_principal',

        active:
          true,

        campaignId:
          'CAM-001'
      },

      'LEADER-1',

      {
        campaignId:
          'CAM-002',

        name:
          'Campaña Dos'
      }
    ),
  'permission-denied'
);


// ======================================================
// ADMIN INACTIVO
// ======================================================

expectHttpsError(
  () =>
    buildNewCampaignRegistration(
      {
        role:
          'admin',

        active:
          false
      },

      'ADMIN-1',

      {
        campaignId:
          'CAM-002',

        name:
          'Campaña Dos'
      }
    ),
  'permission-denied'
);


// ======================================================
// NOMBRE INVALIDO
// ======================================================

expectHttpsError(
  () =>
    buildNewCampaignRegistration(
      {
        role:
          'admin',

        active:
          true
      },

      'ADMIN-1',

      {
        campaignId:
          'CAM-002',

        name:
          ''
      }
    ),
  'invalid-argument'
);


// ======================================================
// DISPONIBILIDAD LIMPIA
// ======================================================

assert.equal(
  validateCampaignAvailability({
    campaignExists:
      false,

    accessExists:
      false,

    leaderExists:
      false,

    occupiedCollections:
      []
  }),
  true
);


// ======================================================
// COLISION DE CAMPAÑA
// ======================================================

expectHttpsError(
  () =>
    validateCampaignAvailability({
      campaignExists:
        true,

      accessExists:
        false,

      leaderExists:
        false,

      occupiedCollections:
        []
    }),
  'already-exists'
);


// ======================================================
// ACCESO HUERFANO
// ======================================================

expectHttpsError(
  () =>
    validateCampaignAvailability({
      campaignExists:
        false,

      accessExists:
        true,

      leaderExists:
        false,

      occupiedCollections:
        []
    }),
  'failed-precondition'
);


// ======================================================
// LIDER PREEXISTENTE
// ======================================================

expectHttpsError(
  () =>
    validateCampaignAvailability({
      campaignExists:
        false,

      accessExists:
        false,

      leaderExists:
        true,

      occupiedCollections:
        []
    }),
  'failed-precondition'
);


// ======================================================
// DATOS OPERACIONALES PREEXISTENTES
// ======================================================

expectHttpsError(
  () =>
    validateCampaignAvailability({
      campaignExists:
        false,

      accessExists:
        false,

      leaderExists:
        false,

      occupiedCollections: [
        'usuarios',
        'misiones'
      ]
    }),
  'failed-precondition'
);


// ======================================================
// COBERTURA DE OCUPACION
// ======================================================

assert.deepEqual(
  OCCUPANCY_COLLECTIONS,
  [
    'usuarios',
    'persons',
    'territorialMemberships',
    'municipios',
    'estructuras',
    'misiones',
    'eventos',
    'missionEvidence'
  ]
);


console.log(
  'OK: BUILD-123D4F independent campaign creation contract passed.'
);
