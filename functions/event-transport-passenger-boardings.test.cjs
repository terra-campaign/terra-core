'use strict';

const assert =
  require(
    'node:assert/strict'
  );


const {
  assignmentCanBoard,
  canRecordBoarding,
  boardingIdFor,
  vehicleBoardingCounters
} =
  require(
    './event-transport-passenger-assignments.cjs'
  )._test;


// ======================================================
// ASSIGNMENT ELEGIBLE
// ======================================================

const assignment = {

  campaignId:
    'CAM-001',

  eventId:
    'EVENT-001',

  allocationId:
    'ALLOC-001',

  vehicleId:
    'VEHICLE-001',

  active:
    true,

  status:
    'assigned',

  confirmationStatus:
    'confirmed',

  confirmationId:
    'CONFIRM-001',

  boardingStatus:
    'pending',

  personId:
    'PERSON-001',

  accountUid:
    'PASSENGER-UID',

  seatId:
    'SEAT-005',

  seatNumber:
    5
};


assert.equal(
  assignmentCanBoard(
    assignment
  ),
  true
);


assert.equal(
  assignmentCanBoard({
    ...assignment,

    confirmationStatus:
      'pending'
  }),
  false
);


assert.equal(
  assignmentCanBoard({
    ...assignment,

    confirmationId:
      null
  }),
  false
);


assert.equal(
  assignmentCanBoard({
    ...assignment,

    boardingStatus:
      'boarded'
  }),
  false
);


assert.equal(
  assignmentCanBoard({
    ...assignment,

    active:
      false
  }),
  false
);


// ======================================================
// AUTORIDAD
// ======================================================

const event = {

  id:
    'EVENT-001',

  campaignId:
    'CAM-001',

  active:
    true,

  createdBy:
    'CREATOR-UID',

  transportManagerIds: [
    'MANAGER-UID'
  ]
};


const allocation = {

  id:
    'ALLOC-001',

  campaignId:
    'CAM-001',

  eventId:
    'EVENT-001',

  active:
    true,

  allocatedToUserId:
    'RESPONSIBLE-UID'
};


const responsible = {

  uid:
    'RESPONSIBLE-UID',

  campaignId:
    'CAM-001',

  role:
    'participante',

  active:
    true
};


const manager = {

  uid:
    'MANAGER-UID',

  campaignId:
    'CAM-001',

  role:
    'integrante',

  active:
    true
};


const creator = {

  uid:
    'CREATOR-UID',

  campaignId:
    'CAM-001',

  role:
    'participante',

  active:
    true
};


const passenger = {

  uid:
    'PASSENGER-UID',

  campaignId:
    'CAM-001',

  role:
    'colaborador_base',

  active:
    true
};


assert.equal(
  canRecordBoarding(
    responsible,
    event,
    allocation
  ),
  true
);


assert.equal(
  canRecordBoarding(
    manager,
    event,
    allocation
  ),
  true
);


assert.equal(
  canRecordBoarding(
    creator,
    event,
    allocation
  ),
  true
);


// El pasajero NO se auto-registra como abordado.
assert.equal(
  canRecordBoarding(
    passenger,
    event,
    allocation
  ),
  false
);


// ======================================================
// CONTADORES
// ======================================================

assert.deepEqual(
  vehicleBoardingCounters({

    capacity:
      12,

    assignedSeatCount:
      1,

    occupiedCount:
      0
  }),

  {
    capacity:
      12,

    assignedSeatCount:
      1,

    occupiedBefore:
      0,

    occupiedAfter:
      1
  }
);


// No puede abordar por encima de asignados.
assert.equal(
  vehicleBoardingCounters({

    capacity:
      12,

    assignedSeatCount:
      1,

    occupiedCount:
      1
  }),

  null
);


// No puede superar capacidad física.
assert.equal(
  vehicleBoardingCounters({

    capacity:
      1,

    assignedSeatCount:
      2,

    occupiedCount:
      0
  }),

  null
);


// Datos inconsistentes.
assert.equal(
  vehicleBoardingCounters({

    capacity:
      12,

    assignedSeatCount:
      0,

    occupiedCount:
      0
  }),

  null
);


// ======================================================
// IDEMPOTENCIA
// ======================================================

const id1 =
  boardingIdFor(
    'ASSIGN-001',
    2,
    'boarding-request-001'
  );


const id2 =
  boardingIdFor(
    'ASSIGN-001',
    2,
    'boarding-request-001'
  );


const differentCycle =
  boardingIdFor(
    'ASSIGN-001',
    3,
    'boarding-request-001'
  );


assert.equal(
  id1,
  id2
);


assert.notEqual(
  id1,
  differentCycle
);


console.log(
  'OK: BUILD-118C-3B3E-3G-B3C2 passenger boarding domain tests passed.'
);
