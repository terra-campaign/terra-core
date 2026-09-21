'use strict';

const assert =
  require(
    'node:assert/strict'
  );

const {
  validId,
  adminCampaignAccessDocumentPath,
  isActiveTechnicalAdmin,
  accessRecordAllows,
  adminCanAccessCampaign
} =
  require(
    './admin-campaign-access.cjs'
  );

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

assert.equal(
  adminCampaignAccessDocumentPath(
    ' ADMIN-1 ',
    ' CAM-001 '
  ),
  'adminCampaignAccess/ADMIN-1/campaigns/CAM-001'
);

const adminProfile = {
  role:
    'admin',

  active:
    true,

  // Dato legacy permitido temporalmente.
  // NO debe conceder autorización.
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

const accessCAM001 = {
  adminUid:
    'ADMIN-1',

  campaignId:
    'CAM-001',

  active:
    true
};

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
    accessCAM001,
    'ADMIN-1',
    'CAM-001'
  ),
  true
);

assert.equal(
  accessRecordAllows(
    accessCAM001,
    'OTRO-ADMIN',
    'CAM-001'
  ),
  false
);

assert.equal(
  accessRecordAllows(
    accessCAM001,
    'ADMIN-1',
    'CAM-002'
  ),
  false
);

// El campaignId del perfil NO concede acceso.
assert.equal(
  adminCanAccessCampaign({
    profile:
      adminProfile,

    adminUid:
      'ADMIN-1',

    campaignId:
      'CAM-001',

    accessRecord:
      null
  }),
  false
);

// CAM-001 funciona únicamente con acceso explícito.
assert.equal(
  adminCanAccessCampaign({
    profile:
      adminProfile,

    adminUid:
      'ADMIN-1',

    campaignId:
      'CAM-001',

    accessRecord:
      accessCAM001
  }),
  true
);

// También cualquier otra campaña autorizada explícitamente.
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

// Un registro ajeno no concede acceso.
assert.equal(
  adminCanAccessCampaign({
    profile:
      adminProfile,

    adminUid:
      'ADMIN-1',

    campaignId:
      'CAM-002',

    accessRecord: {
      adminUid:
        'OTRO-ADMIN',

      campaignId:
        'CAM-002',

      active:
        true
    }
  }),
  false
);

// Un Líder Principal no se convierte en Admin.
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
  'OK: BUILD-123D4H-B1 explicit admin campaign access contract passed.'
);
