'use strict';

const assert =
  require(
    'node:assert/strict'
  );

const {
  _test: {
    MAX_CAMPAIGNS_PER_ADMIN,
    collectAccessibleCampaignIds,
    buildAccessibleCampaignList
  }
} = require(
  './admin-campaign-list.cjs'
);

assert.equal(
  MAX_CAMPAIGNS_PER_ADMIN,
  500
);

// Admin inactivo.
assert.deepEqual(
  collectAccessibleCampaignIds({
    profile: {
      role:
        'admin',

      active:
        false,

      campaignId:
        'CAM-001'
    },

    adminUid:
      'ADMIN-1',

    accessRecords: [
      {
        adminUid:
          'ADMIN-1',

        campaignId:
          'CAM-002',

        active:
          true
      }
    ]
  }),
  []
);

// No Admin.
assert.deepEqual(
  collectAccessibleCampaignIds({
    profile: {
      role:
        'lider_principal',

      active:
        true,

      campaignId:
        'CAM-001'
    },

    adminUid:
      'ADMIN-1',

    accessRecords:
      []
  }),
  []
);

// campaignId legacy NO entra solo.
assert.deepEqual(
  collectAccessibleCampaignIds({
    profile: {
      role:
        'admin',

      active:
        true,

      campaignId:
        'CAM-001'
    },

    adminUid:
      'ADMIN-1',

    accessRecords:
      []
  }),
  []
);

// Solo accesos explícitos válidos y activos.
assert.deepEqual(
  collectAccessibleCampaignIds({
    profile: {
      role:
        'admin',

      active:
        true,

      campaignId:
        'CAM-001'
    },

    adminUid:
      'ADMIN-1',

    accessRecords: [
      {
        adminUid:
          'ADMIN-1',

        campaignId:
          'CAM-002',

        active:
          true
      },
      {
        adminUid:
          'ADMIN-1',

        campaignId:
          'CAM-001',

        active:
          true
      },
      {
        adminUid:
          'ADMIN-1',

        campaignId:
          'CAM-003',

        active:
          false
      },
      {
        adminUid:
          'OTRO-ADMIN',

        campaignId:
          'CAM-004',

        active:
          true
      }
    ]
  }),
  [
    'CAM-001',
    'CAM-002'
  ]
);

// Filtrar campañas formales activas.
assert.deepEqual(
  buildAccessibleCampaignList({
    campaignIds: [
      'CAM-001',
      'CAM-002',
      'CAM-003',
      'CAM-004'
    ],

    campaignRecords: {
      'CAM-001': {
        campaignId:
          'CAM-001',

        name:
          'Campaña Uno',

        active:
          true
      },

      'CAM-002': {
        campaignId:
          'CAM-002',

        name:
          'Campaña Dos',

        active:
          true
      },

      'CAM-003': {
        campaignId:
          'CAM-003',

        name:
          'Campaña Tres',

        active:
          false
      },

      'CAM-004': {
        campaignId:
          'CAM-999',

        name:
          'Registro incompatible',

        active:
          true
      }
    }
  }),
  [
    {
      campaignId:
        'CAM-002',

      name:
        'Campaña Dos',

      active:
        true
    },
    {
      campaignId:
        'CAM-001',

      name:
        'Campaña Uno',

      active:
        true
    }
  ]
);

// Nombre vacío no se expone.
assert.deepEqual(
  buildAccessibleCampaignList({
    campaignIds: [
      'CAM-001'
    ],

    campaignRecords: {
      'CAM-001': {
        campaignId:
          'CAM-001',

        name:
          '   ',

        active:
          true
      }
    }
  }),
  []
);

console.log(
  'OK: BUILD-123D4H-B1 explicit admin campaign listing contract passed.'
);
