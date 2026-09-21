'use strict';

const assert =
  require(
    'node:assert/strict'
  );

const {
  validId,
  adminCampaignAccessDocumentId,
  isActiveTechnicalAdmin,
  legacyAdminHasCampaignAccess,
  accessRecordAllows,
  adminCanAccessCampaign
} =
  require(
    './admin-campaign-access.cjs'
  );


// ======================================================
// IDS
// ======================================================

assert.equal(
  validId(
    ' CAM-001 ',
    'campaignId'
  ),
  'CAM-001'
);

assert.throws(
  () =>
    validId(
      '',
      'campaignId'
    ),
  TypeError
);

assert.throws(
  () =>
    validId(
      'CAM/001',
      'campaignId'
    ),
  TypeError
);


// ======================================================
// ID DETERMINISTICO
// ======================================================

const accessId =
  adminCampaignAccessDocumentId(
    'ADMIN-1',
    'CAM-001'
  );

assert.match(
  accessId,
  /^[a-f0-9]{64}$/
);

assert.equal(
  adminCampaignAccessDocumentId(
    ' ADMIN-1 ',
    ' CAM-001 '
  ),
  accessId
);

assert.notEqual(
  adminCampaignAccessDocumentId(
    'ADMIN-1',
    'CAM-002'
  ),
  accessId
);

// Evitar ambigüedad por separadores dentro de los IDs.
assert.notEqual(
  adminCampaignAccessDocumentId(
    'ADMIN__1',
    'CAM-001'
  ),
  adminCampaignAccessDocumentId(
    'ADMIN',
    '1__CAM-001'
  )
);


// ======================================================
// ADMIN TECNICO
// ======================================================

const adminProfile = {
  role:
    'admin',

  active:
    true,

  campaignId:
    'CAM-001'
};

assert.equal(
  isActiveTechnicalAdmin(
    adminProfile
  ),
  true
);

assert.equal(
  isActiveTechnicalAdmin({
    role:
      'lider_principal',

    active:
      true
  }),
  false
);


// ======================================================
// COMPATIBILIDAD LEGACY
// ======================================================

assert.equal(
  legacyAdminHasCampaignAccess(
    adminProfile,
    'CAM-001'
  ),
  true
);

assert.equal(
  legacyAdminHasCampaignAccess(
    adminProfile,
    'CAM-002'
  ),
  false
);


// ======================================================
// ACCESO EXPLICITO NUEVO
// ======================================================

const accessCAM002 = {
  adminUid:
    'ADMIN-1',

  campaignId:
    'CAM-002',

  active:
    true
};

assert.equal(
  accessRecordAllows(
    accessCAM002,
    'ADMIN-1',
    'CAM-002'
  ),
  true
);

assert.equal(
  accessRecordAllows(
    accessCAM002,
    'ADMIN-OTHER',
    'CAM-002'
  ),
  false
);


// ======================================================
// DECISION CENTRAL
// ======================================================

// CAM-001 sigue funcionando por compatibilidad legacy.
assert.equal(
  adminCanAccessCampaign({
    profile:
      adminProfile,

    adminUid:
      'ADMIN-1',

    campaignId:
      'CAM-001'
  }),
  true
);


// CAM-002 no funciona sin autorización explícita.
assert.equal(
  adminCanAccessCampaign({
    profile:
      adminProfile,

    adminUid:
      'ADMIN-1',

    campaignId:
      'CAM-002'
  }),
  false
);


// CAM-002 sí funciona con registro explícito.
assert.equal(
  adminCanAccessCampaign({
    profile:
      adminProfile,

    adminUid:
      'ADMIN-1',

    campaignId:
      'CAM-002',

    accessRecord:
      accessCAM002
  }),
  true
);


// Un Líder Principal no se convierte en Admin
// por tener un registro parecido.
assert.equal(
  adminCanAccessCampaign({
    profile: {
      role:
        'lider_principal',

      active:
        true,

      campaignId:
        'CAM-002'
    },

    adminUid:
      'LEADER-1',

    campaignId:
      'CAM-002',

    accessRecord: {
      adminUid:
        'LEADER-1',

      campaignId:
        'CAM-002',

      active:
        true
    }
  }),
  false
);


console.log(
  'OK: BUILD-123D3 admin multi-campaign access contract passed.'
);
