'use strict';

const assert =
  require(
    'node:assert/strict'
  );

const {
  normalizeCampaignName,
  campaignDocumentPath,
  buildCampaignRecord,
  buildAdminCampaignAccessRecord,
  buildCampaignRegistration
} = require(
  './campaign-registry.cjs'
);


// ======================================================
// NOMBRE
// ======================================================

assert.equal(
  normalizeCampaignName(
    '  Campaña   Territorial   Uno  '
  ),
  'Campaña Territorial Uno'
);

assert.throws(
  () =>
    normalizeCampaignName(
      ''
    ),
  TypeError
);

assert.throws(
  () =>
    normalizeCampaignName(
      'A'
    ),
  TypeError
);


// ======================================================
// RUTA CAMPAÑA
// ======================================================

assert.equal(
  campaignDocumentPath(
    ' CAM-001 '
  ),
  'campaigns/CAM-001'
);

assert.throws(
  () =>
    campaignDocumentPath(
      'CAM/001'
    ),
  TypeError
);


// ======================================================
// DOCUMENTO CAMPAÑA
// ======================================================

assert.deepEqual(
  buildCampaignRecord({
    campaignId:
      ' CAM-001 ',

    name:
      ' Campaña   Principal ',

    createdBy:
      ' ADMIN-1 '
  }),
  {
    campaignId:
      'CAM-001',

    name:
      'Campaña Principal',

    active:
      true,

    createdBy:
      'ADMIN-1',

    version:
      1
  }
);


// ======================================================
// ACCESO ADMIN
// ======================================================

assert.deepEqual(
  buildAdminCampaignAccessRecord({
    adminUid:
      ' ADMIN-1 ',

    campaignId:
      ' CAM-001 ',

    createdBy:
      ' ADMIN-1 '
  }),
  {
    adminUid:
      'ADMIN-1',

    campaignId:
      'CAM-001',

    active:
      true,

    createdBy:
      'ADMIN-1',

    version:
      1
  }
);


// ======================================================
// REGISTRO COMPLETO
// ======================================================

const registration =
  buildCampaignRegistration({
    campaignId:
      ' CAM-002 ',

    name:
      ' Segunda   Campaña ',

    adminUid:
      ' ADMIN-1 '
  });

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

assert.deepEqual(
  registration.access,
  {
    adminUid:
      'ADMIN-1',

    campaignId:
      'CAM-002',

    active:
      true,

    createdBy:
      'ADMIN-1',

    version:
      1
  }
);


// ======================================================
// CAMPANAS DISTINTAS = RUTAS DISTINTAS
// ======================================================

const first =
  buildCampaignRegistration({
    campaignId:
      'CAM-001',

    name:
      'Campaña Uno',

    adminUid:
      'ADMIN-1'
  });

const second =
  buildCampaignRegistration({
    campaignId:
      'CAM-002',

    name:
      'Campaña Dos',

    adminUid:
      'ADMIN-1'
  });

assert.notEqual(
  first.campaignPath,
  second.campaignPath
);

assert.notEqual(
  first.accessPath,
  second.accessPath
);


// ======================================================
// EL CONTRATO NO DUPLICA EL LIDER PRINCIPAL
// ======================================================

assert.equal(
  Object.hasOwn(
    registration.campaign,
    'principalLeaderUid'
  ),
  false
);


console.log(
  'OK: BUILD-123D4C canonical campaign registry contract passed.'
);
