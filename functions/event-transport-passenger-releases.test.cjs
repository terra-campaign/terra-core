'use strict';

const assert =
  require(
    'node:assert/strict'
  );


const {
  assignmentCanRelease,
  assignmentCanReactivate,
  releaseIdFor
} =
  require(
    './event-transport-passenger-assignments.cjs'
  )._test;


// ======================================================
// ESTADO ASIGNADO
// ======================================================

const assigned = {

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

  seatId:
    'SEAT-002',

  seatNumber:
    2
};


assert.equal(
  assignmentCanRelease(
    assigned
  ),
  true
);


// Confirmado no se libera mediante B3B3.
assert.equal(
  assignmentCanRelease({
    ...assigned,

    confirmationStatus:
      'confirmed'
  }),
  false
);


// Abordado no se libera mediante B3B3.
assert.equal(
  assignmentCanRelease({
    ...assigned,

    boardingStatus:
      'boarded'
  }),
  false
);


assert.equal(
  assignmentCanRelease({
    ...assigned,

    active:
      false
  }),
  false
);


// ======================================================
// ESTADO RESULTANTE DE RELEASE
// DEBE SER REACTIVABLE
// ======================================================

const released = {

  active:
    false,

  status:
    'released',

  seatId:
    null,

  seatNumber:
    null,

  confirmationStatus:
    'pending',

  boardingStatus:
    'pending'
};


assert.equal(
  assignmentCanReactivate(
    released
  ),
  true
);


// ======================================================
// IDEMPOTENCIA RELEASE
// ======================================================

const id1 =
  releaseIdFor(
    'ASSIGN-001',
    'release-request-001'
  );


const id2 =
  releaseIdFor(
    'ASSIGN-001',
    'release-request-001'
  );


const id3 =
  releaseIdFor(
    'ASSIGN-001',
    'release-request-002'
  );


assert.equal(
  id1,
  id2
);


assert.notEqual(
  id1,
  id3
);


console.log(
  'OK: BUILD-118C-3B3E-3G-B3B3 release/reactivation domain tests passed.'
);
