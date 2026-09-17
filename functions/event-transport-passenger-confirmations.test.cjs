'use strict';

const assert =
  require(
    'node:assert/strict'
  );


const {
  assignmentCanConfirm,
  confirmationModeFor,
  confirmationIdFor
} =
  require(
    './event-transport-passenger-assignments.cjs'
  )._test;


// ======================================================
// ASSIGNMENT CONFIRMABLE
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
    'pending',

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
  assignmentCanConfirm(
    assignment
  ),
  true
);


assert.equal(
  assignmentCanConfirm({
    ...assignment,

    confirmationStatus:
      'confirmed'
  }),
  false
);


assert.equal(
  assignmentCanConfirm({
    ...assignment,

    boardingStatus:
      'boarded'
  }),
  false
);


assert.equal(
  assignmentCanConfirm({
    ...assignment,

    active:
      false
  }),
  false
);


// ======================================================
// CONTEXTO
// ======================================================

const event = {

  id:
    'EVENT-001',

  campaignId:
    'CAM-001',

  createdByUserId:
    'OTHER-USER',

  transportManagerIds:
    []
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


// ======================================================
// SELF — PASAJERO DIGITAL
// ======================================================

const passengerProfile = {

  uid:
    'PASSENGER-UID',

  role:
    'colaborador_base',

  campaignId:
    'CAM-001',

  active:
    true
};


assert.equal(
  confirmationModeFor({

    profile:
      passengerProfile,

    event,

    allocation,

    assignment
  }),

  'self'
);


// ======================================================
// ASSISTED — RESPONSABLE DEL CUPO
// ======================================================

const responsibleProfile = {

  uid:
    'RESPONSIBLE-UID',

  role:
    'participante',

  campaignId:
    'CAM-001',

  active:
    true
};


assert.equal(
  confirmationModeFor({

    profile:
      responsibleProfile,

    event,

    allocation,

    assignment
  }),

  'assisted'
);


// ======================================================
// ACCOUNTLESS — SOLO CONFIRMACION ASISTIDA
// ======================================================

const accountlessAssignment = {

  ...assignment,

  accountUid:
    null
};


assert.equal(
  confirmationModeFor({

    profile:
      responsibleProfile,

    event,

    allocation,

    assignment:
      accountlessAssignment
  }),

  'assisted'
);


// ======================================================
// USUARIO SIN AUTORIDAD
// ======================================================

const unrelatedProfile = {

  uid:
    'UNRELATED-UID',

  role:
    'participante',

  campaignId:
    'CAM-001',

  active:
    true
};


assert.equal(
  confirmationModeFor({

    profile:
      unrelatedProfile,

    event,

    allocation,

    assignment
  }),

  null
);


// ======================================================
// IDEMPOTENCIA / CICLO
// ======================================================

const id1 =
  confirmationIdFor(
    'ASSIGN-001',
    2,
    'confirm-request-001'
  );


const id2 =
  confirmationIdFor(
    'ASSIGN-001',
    2,
    'confirm-request-001'
  );


const idDifferentCycle =
  confirmationIdFor(
    'ASSIGN-001',
    3,
    'confirm-request-001'
  );


assert.equal(
  id1,
  id2
);


assert.notEqual(
  id1,
  idDifferentCycle
);


console.log(
  'OK: BUILD-118C-3B3E-3G-B3C1 passenger confirmation domain tests passed.'
);
