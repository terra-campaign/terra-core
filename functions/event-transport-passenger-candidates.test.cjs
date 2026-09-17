'use strict';

const assert =
  require('node:assert/strict');


const {
  buildTransportPassengerCandidates
} =
  require(
    './event-transport-passenger-assignments.cjs'
  )._test;


const allocation = {
  id:
    'ALLOC-001',

  active:
    true,

  campaignId:
    'CAM-001',

  eventId:
    'EVENT-001',

  vehicleId:
    'VEH-001',

  allocatedToUserId:
    'PART-001',

  allocatedToRole:
    'participante',

  allocatedToStructureId:
    'EST-002',

  allocatedToMunicipalityId:
    'MUN-001'
};


const persons = [
  {
    personId:
      'PERSON-RESP',

    active:
      true,

    campaignId:
      'CAM-001',

    accountUid:
      'PART-001',

    name:
      'Responsable'
  },

  {
    personId:
      'PERSON-DIRECT',

    active:
      true,

    campaignId:
      'CAM-001',

    accountUid:
      null,

    name:
      'Colaborador directo'
  },

  {
    personId:
      'PERSON-DESC',

    active:
      true,

    campaignId:
      'CAM-001',

    accountUid:
      null,

    name:
      'Descendiente'
  },

  {
    personId:
      'PERSON-OTHER',

    active:
      true,

    campaignId:
      'CAM-001',

    accountUid:
      null,

    name:
      'Otra estructura'
  }
];


const memberships = [
  {
    membershipId:
      'MEM-RESP',

    personId:
      'PERSON-RESP',

    active:
      true,

    campaignId:
      'CAM-001',

    municipalityId:
      'MUN-001',

    structureId:
      'EST-002',

    parentUserId:
      'INTEGRANTE-001',

    ancestorUserIds:
      [],

    role:
      'participante'
  },

  {
    membershipId:
      'MEM-DIRECT',

    personId:
      'PERSON-DIRECT',

    active:
      true,

    campaignId:
      'CAM-001',

    municipalityId:
      'MUN-001',

    structureId:
      'EST-002',

    parentUserId:
      'PART-001',

    ancestorUserIds: [
      'PART-001'
    ],

    role:
      'colaborador_base'
  },

  {
    membershipId:
      'MEM-DESC',

    personId:
      'PERSON-DESC',

    active:
      true,

    campaignId:
      'CAM-001',

    municipalityId:
      'MUN-001',

    structureId:
      'EST-002',

    parentUserId:
      'OTHER-001',

    ancestorUserIds: [
      'PART-001',
      'OTHER-001'
    ],

    role:
      'colaborador_base'
  },

  {
    membershipId:
      'MEM-OTHER',

    personId:
      'PERSON-OTHER',

    active:
      true,

    campaignId:
      'CAM-001',

    municipalityId:
      'MUN-001',

    structureId:
      'EST-999',

    parentUserId:
      'PART-001',

    ancestorUserIds: [
      'PART-001'
    ],

    role:
      'colaborador_base'
  }
];


const candidates =
  buildTransportPassengerCandidates({
    allocation,
    memberships,
    persons,
    assignments: []
  });


assert.deepEqual(
  new Set(
    candidates.map(
      item =>
        item.personId
    )
  ),
  new Set([
    'PERSON-RESP',
    'PERSON-DIRECT',
    'PERSON-DESC'
  ])
);


assert.equal(
  candidates.some(
    item =>
      item.personId ===
        'PERSON-OTHER'
  ),
  false
);


// ======================================================
// YA ASIGNADO AL EVENTO NO DEBE VOLVER A OFRECERSE
// ======================================================

const filtered =
  buildTransportPassengerCandidates({
    allocation,
    memberships,
    persons,

    assignments: [
      {
        id:
          'ASSIGN-001',

        active:
          true,

        eventId:
          'EVENT-001',

        personId:
          'PERSON-DIRECT'
      }
    ]
  });


assert.equal(
  filtered.some(
    item =>
      item.personId ===
        'PERSON-DIRECT'
  ),
  false
);


assert.equal(
  filtered.some(
    item =>
      item.personId ===
        'PERSON-DESC'
  ),
  true
);


// ======================================================
// DOBLE MEMBRESIA ACTIVA
//
// Debe comportarse igual que createPassengerAssignment:
// la persona NO se ofrece.
// ======================================================

const duplicateMembershipCandidates =
  buildTransportPassengerCandidates({
    allocation,

    memberships: [
      ...memberships,

      {
        membershipId:
          'MEM-DIRECT-SECOND',

        personId:
          'PERSON-DIRECT',

        active:
          true,

        campaignId:
          'CAM-001',

        municipalityId:
          'MUN-999',

        structureId:
          'EST-999',

        parentUserId:
          'OTHER-USER',

        ancestorUserIds: [
          'OTHER-USER'
        ],

        role:
          'colaborador_base'
      }
    ],

    persons,

    assignments: []
  });


assert.equal(
  duplicateMembershipCandidates.some(
    item =>
      item.personId ===
        'PERSON-DIRECT'
  ),
  false
);


assert.equal(
  duplicateMembershipCandidates.some(
    item =>
      item.personId ===
        'PERSON-DESC'
  ),
  true
);


console.log(
  'OK: BUILD-118C-3B3E-3G-B4D3B passenger candidates passed.'
);
