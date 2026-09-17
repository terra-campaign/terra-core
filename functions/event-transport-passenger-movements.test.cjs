'use strict';

const assert =
  require(
    'node:assert/strict'
  );


const {
  assignmentCanMove,
  movementIdFor,
  seatCanReceivePassenger
} =
  require(
    './event-transport-passenger-assignments.cjs'
  )._test;


// ======================================================
// ASIGNACION MOVIBLE
// ======================================================

const assignment = {

  id:
    'ASSIGN-001',

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
    'SEAT-1',

  seatNumber:
    1
};


assert.equal(
  assignmentCanMove(
    assignment
  ),
  true
);


// Confirmado: todavía NO permitimos moverlo en B3B2.
assert.equal(
  assignmentCanMove({
    ...assignment,

    confirmationStatus:
      'confirmed'
  }),
  false
);


// Ya abordó: jamás debe moverse mediante B3B2.
assert.equal(
  assignmentCanMove({
    ...assignment,

    boardingStatus:
      'boarded'
  }),
  false
);


// Inactivo: no.
assert.equal(
  assignmentCanMove({
    ...assignment,

    active:
      false
  }),
  false
);


// ======================================================
// IDEMPOTENCIA
// ======================================================

assert.equal(
  movementIdFor(
    'ASSIGN-001',
    'move-seat-001'
  ),

  movementIdFor(
    'ASSIGN-001',
    'move-seat-001'
  )
);


assert.notEqual(
  movementIdFor(
    'ASSIGN-001',
    'move-seat-001'
  ),

  movementIdFor(
    'ASSIGN-001',
    'move-seat-002'
  )
);


// ======================================================
// ASIENTO DESTINO DEBE CONTINUAR PERTENECIENDO AL CUPO
// ======================================================

const allocation = {

  id:
    'ALLOC-001'
};


const freeAllocatedSeat = {

  active:
    true,

  seatNumber:
    2,

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

    seat:
      freeAllocatedSeat,

    allocation,

    seatNumber:
      2

  }),
  true
);


// Asiento ya utilizado: no.
assert.equal(
  seatCanReceivePassenger({

    seat: {
      ...freeAllocatedSeat,

      status:
        'assigned',

      assignmentId:
        'ASSIGN-002',

      personId:
        'PERSON-002'
    },

    allocation,

    seatNumber:
      2

  }),
  false
);


// Otro allocation: no.
assert.equal(
  seatCanReceivePassenger({

    seat: {
      ...freeAllocatedSeat,

      allocationId:
        'ALLOC-OTHER'
    },

    allocation,

    seatNumber:
      2

  }),
  false
);


console.log(
  'OK: BUILD-118C-3B3E-3G-B3B2 passenger seat movement tests passed.'
);
