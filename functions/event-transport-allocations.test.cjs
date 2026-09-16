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
        null
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
