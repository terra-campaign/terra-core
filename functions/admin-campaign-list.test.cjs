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


// ======================================================
// LIMITE
// ======================================================

assert.equal(
  MAX_CAMPAIGNS_PER_ADMIN,
  500
);


// ======================================================
// ADMIN INACTIVO / NO ADMIN
// ======================================================

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


// ======================================================
// LEGACY + EXPLICITOS
// ======================================================

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


// ======================================================
// NO DUPLICAR LEGACY + EXPLICITO
// ======================================================

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
          'CAM-001',

        active:
          true
      }
    ]
  }),
  [
    'CAM-001'
  ]
);


// ======================================================
// FILTRAR CAMPAÑAS FORMALES
// ======================================================

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


// ======================================================
// NOMBRE VACIO NO SE EXPONE
// ======================================================

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
  'OK: BUILD-123D4G-D1 admin campaign listing contract passed.'
);
