'use strict';

const assert =
  require(
    'node:assert/strict'
  );


const {
  canManageEventTransport,
  canAssignPassengers,
  personBelongsToAllocationBranch,
  seatCanReceivePassenger,
  assignmentIdFor
} =
  require(
    './event-transport-passenger-assignments.cjs'
  )._test;


// ======================================================
// EVENTO
// ======================================================

const event = {

  id:
    'EVENT-001',

  active:
    true,

  campaignId:
    'CAM-001',

  createdBy:
    'OWNER-001',

  transportManagerIds: [
    'LOG-001'
  ]
};


// ======================================================
// ALLOCATION
// ======================================================

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

  allocatedCapacity:
    6,

  allocatedToUserId:
    'PART-001',

  allocatedToRole:
    'participante',

  allocatedToStructureId:
    'EST-002',

  allocatedToMunicipalityId:
    'MUN-001'
};


// ======================================================
// AUTORIDAD
// ======================================================

assert.equal(
  canManageEventTransport(
    {
      uid:
        'OWNER-001',
      active:
        true,
      campaignId:
        'CAM-001'
    },
    event
  ),
  true
);


assert.equal(
  canAssignPassengers(
    {
      uid:
        'LOG-001',
      active:
        true,
      campaignId:
        'CAM-001'
    },
    event,
    allocation
  ),
  true
);


// El responsable del propio cupo
// puede asignar sus pasajeros.
assert.equal(
  canAssignPassengers(
    {
      uid:
        'PART-001',
      active:
        true,
      campaignId:
        'CAM-001'
    },
    event,
    allocation
  ),
  true
);


// Otro responsable ordinario no puede.
assert.equal(
  canAssignPassengers(
    {
      uid:
        'PART-OTHER',
      active:
        true,
      campaignId:
        'CAM-001'
    },
    event,
    allocation
  ),
  false
);


// ======================================================
// PERSONA DIGITAL: EL PROPIO RESPONSABLE
// ======================================================

assert.equal(
  personBelongsToAllocationBranch({

    person: {
      active:
        true,
      campaignId:
        'CAM-001',
      accountUid:
        'PART-001'
    },

    membership: {
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
        []
    },

    allocation

  }),
  true
);


// ======================================================
// COLABORADOR ACCOUNTLESS DIRECTO
// ======================================================

assert.equal(
  personBelongsToAllocationBranch({

    person: {
      active:
        true,
      campaignId:
        'CAM-001',
      accountUid:
        null
    },

    membership: {
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
        'PART-001',
        'INTEGRANTE-001'
      ]
    },

    allocation

  }),
  true
);


// ======================================================
// DESCENDIENTE DE LA RAMA
// ======================================================

assert.equal(
  personBelongsToAllocationBranch({

    person: {
      active:
        true,
      campaignId:
        'CAM-001',
      accountUid:
        null
    },

    membership: {
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
      ]
    },

    allocation

  }),
  true
);


// ======================================================
// OTRA ESTRUCTURA: NO
// ======================================================

assert.equal(
  personBelongsToAllocationBranch({

    person: {
      active:
        true,
      campaignId:
        'CAM-001',
      accountUid:
        null
    },

    membership: {
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
      ]
    },

    allocation

  }),
  false
);


// ======================================================
// PERSONA AJENA A LA RAMA: NO
// ======================================================

assert.equal(
  personBelongsToAllocationBranch({

    person: {
      active:
        true,
      campaignId:
        'CAM-001',
      accountUid:
        null
    },

    membership: {
      active:
        true,
      campaignId:
        'CAM-001',
      municipalityId:
        'MUN-001',
      structureId:
        'EST-002',
      parentUserId:
        'PART-OTHER',
      ancestorUserIds: [
        'PART-OTHER'
      ]
    },

    allocation

  }),
  false
);


// ======================================================
// ASIENTO DEL CUPO DISPONIBLE
// ======================================================

const seat = {

  active:
    true,

  seatNumber:
    1,

  status:
    'allocated',

  allocationId:
    'ALLOC-001',

  assignmentId:
    null,

  personId:
    null,

  accountUid:
    null
};


assert.equal(
  seatCanReceivePassenger({
    seat,
    allocation,
    seatNumber:
      1
  }),
  true
);


assert.equal(
  seatCanReceivePassenger({
    seat: {
      ...seat,
      status:
        'assigned',
      assignmentId:
        'ASSIGN-001',
      personId:
        'PERSON-001'
    },
    allocation,
    seatNumber:
      1
  }),
  false
);


// No puede usar asiento de otro allocation.
assert.equal(
  seatCanReceivePassenger({
    seat: {
      ...seat,
      allocationId:
        'ALLOC-OTHER'
    },
    allocation,
    seatNumber:
      1
  }),
  false
);


// ======================================================
// UNA PERSONA -> UN ASIENTO POR EVENTO
// ======================================================

assert.equal(
  assignmentIdFor(
    'EVENT-001',
    'PERSON-001'
  ),
  assignmentIdFor(
    'EVENT-001',
    'PERSON-001'
  )
);


assert.notEqual(
  assignmentIdFor(
    'EVENT-001',
    'PERSON-001'
  ),
  assignmentIdFor(
    'EVENT-001',
    'PERSON-002'
  )
);


assert.notEqual(
  assignmentIdFor(
    'EVENT-001',
    'PERSON-001'
  ),
  assignmentIdFor(
    'EVENT-002',
    'PERSON-001'
  )
);


console.log(
  'OK: BUILD-118C-3B3E-3G-B3A passenger assignment domain tests passed.'
);
