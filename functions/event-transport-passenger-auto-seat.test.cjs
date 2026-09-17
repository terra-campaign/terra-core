'use strict';

const assert =
  require('node:assert/strict');


const {
  _test
} =
  require(
    './event-transport-passenger-assignments.cjs'
  );


const {
  optionalSeatNumber,
  resolveAutomaticAllocatedSeat
} =
  _test;


// ======================================================
// OPTIONAL SEAT NUMBER
// ======================================================

assert.equal(
  optionalSeatNumber(
    undefined
  ),
  null
);

assert.equal(
  optionalSeatNumber(
    null
  ),
  null
);

assert.equal(
  optionalSeatNumber(
    ''
  ),
  null
);

assert.equal(
  optionalSeatNumber(
    '   '
  ),
  null
);

assert.equal(
  optionalSeatNumber(
    2
  ),
  2
);


// ======================================================
// AUTO SEAT
// ======================================================

const allocation = {
  id:
    'ALLOC-001',

  allocationType:
    'capacity_block',

  seatNumbers:
    [
      1,
      2,
      3
    ]
};


const seats = [
  {
    id:
      'SEAT-1',

    vehicleId:
      'VEH-001',

    seatNumber:
      1,

    allocationId:
      'ALLOC-001',

    active:
      true,

    status:
      'assigned',

    assignmentId:
      'ASSIGN-1',

    personId:
      'PERSON-1'
  },

  {
    id:
      'SEAT-2',

    vehicleId:
      'VEH-001',

    seatNumber:
      2,

    allocationId:
      'ALLOC-001',

    active:
      true,

    status:
      'allocated',

    assignmentId:
      null,

    personId:
      null,

    accountUid:
      null
  },

  {
    id:
      'SEAT-3',

    vehicleId:
      'VEH-001',

    seatNumber:
      3,

    allocationId:
      'ALLOC-001',

    active:
      true,

    status:
      'allocated',

    assignmentId:
      null,

    personId:
      null,

    accountUid:
      null
  },

  {
    id:
      'SEAT-99',

    vehicleId:
      'VEH-001',

    seatNumber:
      99,

    allocationId:
      'OTHER-ALLOC',

    active:
      true,

    status:
      'allocated'
  }
];


const selected =
  resolveAutomaticAllocatedSeat({
    seats,
    allocation,
    vehicleId:
      'VEH-001'
  });


assert.ok(
  selected
);

assert.equal(
  selected.id,
  'SEAT-2'
);

assert.equal(
  selected.seatNumber,
  2
);


// ======================================================
// SIN LUGARES
// ======================================================

const fullSeats =
  seats.map(
    seat => {

      if (
        seat.allocationId !==
          'ALLOC-001'
      ) {

        return seat;
      }


      return {
        ...seat,

        status:
          'assigned',

        assignmentId:
          `ASSIGN-${seat.seatNumber}`,

        personId:
          `PERSON-${seat.seatNumber}`
      };
    }
  );


assert.equal(
  resolveAutomaticAllocatedSeat({
    seats:
      fullSeats,

    allocation,

    vehicleId:
      'VEH-001'
  }),
  null
);


console.log(
  'OK: BUILD-118C-3B3E-3G-B4D3A automatic passenger seat passed.'
);
