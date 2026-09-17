'use strict';

const assert =
  require('node:assert/strict');


const {
  _test
} =
  require(
    './event-transport-allocations.cjs'
  );


const {
  buildEventTransportAllocationTargets
} =
  _test;


const event = {
  id:
    'EVT-001',

  campaignId:
    'CAM-001',

  active:
    true,

  createdBy:
    'USER-CREATOR'
};


const invitations = [
  {
    id:
      'INV-001',

    active:
      true,

    campaignId:
      'CAM-001',

    eventId:
      'EVT-001',

    assignedTo:
      'USER-CRISTIAN'
  },

  {
    id:
      'INV-OTHER-EVENT',

    active:
      true,

    campaignId:
      'CAM-001',

    eventId:
      'EVT-999',

    assignedTo:
      'USER-OTHER'
  }
];


const profiles = [
  {
    uid:
      'USER-CREATOR',

    active:
      true,

    campaignId:
      'CAM-001',

    role:
      'lider_principal',

    name:
      'Lalo'
  },

  {
    uid:
      'USER-CRISTIAN',

    active:
      true,

    campaignId:
      'CAM-001',

    role:
      'coordinador_municipal',

    name:
      'Cristian Gpe',

    structureId:
      'EST-001',

    structureName:
      'Estructura Compostela'
  },

  {
    uid:
      'USER-NO-INVITE',

    active:
      true,

    campaignId:
      'CAM-001',

    role:
      'integrante',

    name:
      'Sin invitación'
  },

  {
    uid:
      'USER-WRONG-CAMPAIGN',

    active:
      true,

    campaignId:
      'CAM-999',

    role:
      'integrante',

    name:
      'Otra campaña'
  }
];


const targets =
  buildEventTransportAllocationTargets({
    event,
    invitations,
    profiles
  });


assert.equal(
  targets.length,
  2
);


assert.deepEqual(
  new Set(
    targets.map(
      item =>
        item.uid
    )
  ),
  new Set([
    'USER-CREATOR',
    'USER-CRISTIAN'
  ])
);


const cristian =
  targets.find(
    item =>
      item.uid ===
        'USER-CRISTIAN'
  );


assert.ok(
  cristian
);


assert.equal(
  cristian.invitationId,
  'INV-001'
);


assert.equal(
  cristian.structureId,
  'EST-001'
);


// ======================================================
// MULTIPLES INVITACIONES ACTIVAS:
// NO DEBE OFRECER EL DESTINATARIO
// ======================================================

const duplicated =
  buildEventTransportAllocationTargets({
    event,

    invitations: [
      ...invitations,

      {
        id:
          'INV-002',

        active:
          true,

        campaignId:
          'CAM-001',

        eventId:
          'EVT-001',

        assignedTo:
          'USER-CRISTIAN'
      }
    ],

    profiles
  });


assert.equal(
  duplicated.some(
    item =>
      item.uid ===
        'USER-CRISTIAN'
  ),
  false
);


console.log(
  'OK: BUILD-118C-3B3E-3G-B4D2B allocation targets passed.'
);
