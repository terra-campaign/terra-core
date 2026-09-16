'use strict';

const assert =
  require(
    'node:assert/strict'
  );


const {
  ALLOCATION_TYPES,
  ALLOCATION_ZONES,
  canManageEventTransport,
  canReceiveAllocation,
  chooseSeatNumbers,
  allocationIdFor
} =
  require(
    './event-transport-allocations.cjs'
  )._test;


assert.equal(
  ALLOCATION_TYPES.has(
    'full_vehicle'
  ),
  true
);


assert.equal(
  ALLOCATION_TYPES.has(
    'capacity_block'
  ),
  true
);


assert.equal(
  ALLOCATION_TYPES.has(
    'seat_selection'
  ),
  true
);


assert.equal(
  ALLOCATION_ZONES.has(
    'left'
  ),
  true
);


const event = {
  id:
    'EV-001',

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


const owner = {
  uid:
    'OWNER-001',

  active:
    true,

  campaignId:
    'CAM-001'
};


const manager = {
  uid:
    'LOG-001',

  active:
    true,

  campaignId:
    'CAM-001'
};


const outsider = {
  uid:
    'OUT-001',

  active:
    true,

  campaignId:
    'CAM-001'
};


assert.equal(
  canManageEventTransport(
    owner,
    event
  ),
  true
);


assert.equal(
  canManageEventTransport(
    manager,
    event
  ),
  true
);


assert.equal(
  canManageEventTransport(
    outsider,
    event
  ),
  false
);


const target = {
  uid:
    'INT-001',

  name:
    'Integrante Uno',

  role:
    'integrante',

  active:
    true,

  campaignId:
    'CAM-001'
};


const invitation = {
  id:
    'INV-001',

  active:
    true,

  campaignId:
    'CAM-001',

  eventId:
    'EV-001',

  assignedTo:
    'INT-001'
};


assert.equal(
  canReceiveAllocation(
    target,
    event,
    invitation
  ),
  true
);


assert.equal(
  canReceiveAllocation(
    {
      ...target,
      role:
        'colaborador_base'
    },
    event,
    invitation
  ),
  false
);


const seats =
  Array.from(
    {
      length:
        12
    },
    (
      _,
      index
    ) => ({
      id:
        `SEAT-${index + 1}`,

      active:
        true,

      seatNumber:
        index + 1,

      status:
        'free',

      allocationId:
        null,

      assignmentId:
        null,

      personId:
        null,

      physicalSide:
        [
          1, 2,
          5, 6,
          9, 10
        ].includes(
          index + 1
        )
          ? 'left'
          : 'right'
    })
  );


assert.deepEqual(
  chooseSeatNumbers({
    type:
      'capacity_block',

    capacity:
      12,

    requested:
      6,

    selectedSeatNumbers:
      [],

    seats
  }),
  [
    1, 2, 3,
    4, 5, 6
  ]
);


assert.deepEqual(
  chooseSeatNumbers({
    type:
      'seat_selection',

    capacity:
      12,

    requested:
      null,

    selectedSeatNumbers:
      [
        2, 4, 6,
        8, 10, 12
      ],

    seats
  }),
  [
    2, 4, 6,
    8, 10, 12
  ]
);


assert.deepEqual(
  chooseSeatNumbers({
    type:
      'full_vehicle',

    capacity:
      12,

    requested:
      null,

    selectedSeatNumbers:
      [],

    seats
  }),
  [
    1, 2, 3, 4,
    5, 6, 7, 8,
    9, 10, 11, 12
  ]
);


// ======================================================
// BUILD-118C-3B3E-3G-B2B2
// SELECCION AUTOMATICA POR LADO FISICO
// ======================================================

assert.deepEqual(
  chooseSeatNumbers({
    type:
      'seat_selection',

    capacity:
      12,

    requested:
      null,

    selectedSeatNumbers:
      [],

    zone:
      'left',

    seats
  }),
  [
    1, 2,
    5, 6,
    9, 10
  ]
);


assert.deepEqual(
  chooseSeatNumbers({
    type:
      'seat_selection',

    capacity:
      12,

    requested:
      null,

    selectedSeatNumbers:
      [],

    zone:
      'right',

    seats
  }),
  [
    3, 4,
    7, 8,
    11, 12
  ]
);


// Selección manual correcta del lado chofer.
assert.deepEqual(
  chooseSeatNumbers({
    type:
      'seat_selection',

    capacity:
      12,

    requested:
      null,

    selectedSeatNumbers:
      [1, 5, 9],

    zone:
      'left',

    seats
  }),
  [1, 5, 9]
);


// Un asiento del copiloto no puede declararse
// como lado del chofer.
assert.throws(
  () =>
    chooseSeatNumbers({
      type:
        'seat_selection',

      capacity:
        12,

      requested:
        null,

      selectedSeatNumbers:
        [1, 3],

      zone:
        'left',

      seats
    }),
  error =>
    error &&
    error.code ===
      'invalid-argument' &&
    /lado del chofer/.test(
      error.message
    )
);


const alreadyAllocated =
  seats.map(
    seat =>
      seat.seatNumber <= 6
        ? {
            ...seat,
            status:
              'allocated',
            allocationId:
              'ALLOC-A'
          }
        : seat
  );


assert.deepEqual(
  chooseSeatNumbers({
    type:
      'capacity_block',

    capacity:
      12,

    requested:
      6,

    selectedSeatNumbers:
      [],

    seats:
      alreadyAllocated
  }),
  [
    7, 8, 9,
    10, 11, 12
  ]
);


assert.equal(
  allocationIdFor(
    'OWNER-001',
    'VEH-001',
    'request-001'
  ),
  allocationIdFor(
    'OWNER-001',
    'VEH-001',
    'request-001'
  )
);


assert.notEqual(
  allocationIdFor(
    'OWNER-001',
    'VEH-001',
    'request-001'
  ),
  allocationIdFor(
    'OWNER-001',
    'VEH-001',
    'request-002'
  )
);


console.log(
  'OK: BUILD-118C-3B3E-3G-B2A transport allocation domain tests passed.'
);
