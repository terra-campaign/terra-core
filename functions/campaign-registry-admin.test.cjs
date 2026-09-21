'use strict';

const assert =
  require(
    'node:assert/strict'
  );

const {
  _test: {
    buildLegacyCampaignRegistration,
    validateExistingCampaign,
    validateExistingAccess
  }
} = require(
  './campaign-registry-admin.cjs'
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
// ADMIN LEGACY VALIDO
// ======================================================

const registration =
  buildLegacyCampaignRegistration(
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
      name:
        'Campaña Principal'
    }
  );

assert.equal(
  registration.campaignPath,
  'campaigns/CAM-001'
);

assert.equal(
  registration.accessPath,
  'adminCampaignAccess/ADMIN-1/campaigns/CAM-001'
);

assert.equal(
  registration.campaign.campaignId,
  'CAM-001'
);

assert.equal(
  registration.access.adminUid,
  'ADMIN-1'
);


// ======================================================
// NO ADMIN
// ======================================================

expectHttpsError(
  () =>
    buildLegacyCampaignRegistration(
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
        name:
          'Campaña Principal'
      }
    ),
  'permission-denied'
);


// ======================================================
// ADMIN INACTIVO
// ======================================================

expectHttpsError(
  () =>
    buildLegacyCampaignRegistration(
      {
        role:
          'admin',

        active:
          false,

        campaignId:
          'CAM-001'
      },

      'ADMIN-1',

      {
        name:
          'Campaña Principal'
      }
    ),
  'permission-denied'
);


// ======================================================
// ADMIN SIN CAMPAÑA LEGACY
// ======================================================

expectHttpsError(
  () =>
    buildLegacyCampaignRegistration(
      {
        role:
          'admin',

        active:
          true
      },

      'ADMIN-1',

      {
        name:
          'Campaña Principal'
      }
    ),
  'failed-precondition'
);


// ======================================================
// NOMBRE INVALIDO
// ======================================================

expectHttpsError(
  () =>
    buildLegacyCampaignRegistration(
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
        name:
          ''
      }
    ),
  'invalid-argument'
);


// ======================================================
// CAMPAÑA NO EXISTENTE
// ======================================================

assert.equal(
  validateExistingCampaign(
    null,
    registration
  ),
  false
);


// ======================================================
// CAMPAÑA EXISTENTE COMPATIBLE
// ======================================================

assert.equal(
  validateExistingCampaign(
    {
      campaignId:
        'CAM-001',

      active:
        true,

      name:
        'Nombre existente'
    },

    registration
  ),
  true
);


// ======================================================
// CAMPAÑA EXISTENTE INCOMPATIBLE
// ======================================================

expectHttpsError(
  () =>
    validateExistingCampaign(
      {
        campaignId:
          'CAM-999',

        active:
          true
      },

      registration
    ),
  'failed-precondition'
);

expectHttpsError(
  () =>
    validateExistingCampaign(
      {
        campaignId:
          'CAM-001',

        active:
          false
      },

      registration
    ),
  'failed-precondition'
);


// ======================================================
// ACCESO NO EXISTENTE
// ======================================================

assert.equal(
  validateExistingAccess(
    null,
    registration
  ),
  false
);


// ======================================================
// ACCESO EXISTENTE COMPATIBLE
// ======================================================

assert.equal(
  validateExistingAccess(
    {
      adminUid:
        'ADMIN-1',

      campaignId:
        'CAM-001',

      active:
        true
    },

    registration
  ),
  true
);


// ======================================================
// ACCESO INCOMPATIBLE
// ======================================================

expectHttpsError(
  () =>
    validateExistingAccess(
      {
        adminUid:
          'ADMIN-OTRO',

        campaignId:
          'CAM-001',

        active:
          true
      },

      registration
    ),
  'failed-precondition'
);

expectHttpsError(
  () =>
    validateExistingAccess(
      {
        adminUid:
          'ADMIN-1',

        campaignId:
          'CAM-002',

        active:
          true
      },

      registration
    ),
  'failed-precondition'
);

expectHttpsError(
  () =>
    validateExistingAccess(
      {
        adminUid:
          'ADMIN-1',

        campaignId:
          'CAM-001',

        active:
          false
      },

      registration
    ),
  'failed-precondition'
);


console.log(
  'OK: BUILD-123D4D legacy campaign registration contract passed.'
);
