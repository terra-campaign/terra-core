'use strict';

const assert =
  require(
    'node:assert/strict'
  );

const {
  validId,
  adminCampaignAccessDocumentPath,
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
// RUTA DETERMINISTICA DE ACCESO
// ======================================================

const accessPath =
  adminCampaignAccessDocumentPath(
    'ADMIN-1',
    'CAM-001'
  );

assert.equal(
  accessPath,
  'adminCampaignAccess/ADMIN-1/campaigns/CAM-001'
);

assert.equal(
  adminCampaignAccessDocumentPath(
    ' ADMIN-1 ',
    ' CAM-001 '
  ),
  accessPath
);

assert.notEqual(
  adminCampaignAccessDocumentPath(
    'ADMIN-1',
    'CAM-002'
  ),
  accessPath
);

// La jerarquia evita colisiones por separadores
// usados dentro de los identificadores.
assert.notEqual(
  adminCampaignAccessDocumentPath(
    'ADMIN__1',
    'CAM-001'
  ),
  adminCampaignAccessDocumentPath(
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
  'OK: BUILD-123D4B hierarchical admin multi-campaign access contract passed.'
);
