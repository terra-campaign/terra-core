'use strict';

const assert =
  require(
    'node:assert/strict'
  );


const {
  buildAllocationManifest
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

  allocationType:
    'seat_selection',

  zone:
    'left',

  allocatedCapacity:
    6,

  assignedSeatCount:
    1,

  remainingAssignableSeatCount:
    5,

  seatNumbers: [
    1, 2,
    5, 6,
    9, 10
  ],

  allocatedToUserId:
    'PART-001',

  allocatedToName:
    'Participante Prueba',

  allocatedToRole:
    'participante',

  allocatedToStructureId:
    'EST-002'
};


// Firestore puede devolverlos desordenados.
const seats = [

  {
    id:
      'SEAT-10',
    active:
      true,
    vehicleId:
      'VEH-001',
    allocationId:
      'ALLOC-001',
    seatNumber:
      10,
    physicalSide:
      'left',
    status:
      'allocated',
    assignmentId:
      null,
    personId:
      null
  },

  {
    id:
      'SEAT-1',
    active:
      true,
    vehicleId:
      'VEH-001',
    allocationId:
      'ALLOC-001',
    seatNumber:
      1,
    physicalSide:
      'left',
    status:
      'assigned',
    assignmentId:
      'ASSIGN-001',
    personId:
      'PERSON-001',
    accountUid:
      'ACCOUNT-001'
  },

  {
    id:
      'SEAT-6',
    active:
      true,
    vehicleId:
      'VEH-001',
    allocationId:
      'ALLOC-001',
    seatNumber:
      6,
    physicalSide:
      'left',
    status:
      'allocated',
    assignmentId:
      null,
    personId:
      null
  },

  {
    id:
      'SEAT-2',
    active:
      true,
    vehicleId:
      'VEH-001',
    allocationId:
      'ALLOC-001',
    seatNumber:
      2,
    physicalSide:
      'left',
    status:
      'allocated',
    assignmentId:
      null,
    personId:
      null
  },

  {
    id:
      'SEAT-9',
    active:
      true,
    vehicleId:
      'VEH-001',
    allocationId:
      'ALLOC-001',
    seatNumber:
      9,
    physicalSide:
      'left',
    status:
      'allocated',
    assignmentId:
      null,
    personId:
      null
  },

  {
    id:
      'SEAT-5',
    active:
      true,
    vehicleId:
      'VEH-001',
    allocationId:
      'ALLOC-001',
    seatNumber:
      5,
    physicalSide:
      'left',
    status:
      'allocated',
    assignmentId:
      null,
    personId:
      null
  },

  // Otro allocation: debe ignorarse.
  {
    id:
      'SEAT-3',
    active:
      true,
    vehicleId:
      'VEH-001',
    allocationId:
      'ALLOC-OTHER',
    seatNumber:
      3,
    physicalSide:
      'right',
    status:
      'assigned',
    assignmentId:
      'ASSIGN-OTHER',
    personId:
      'PERSON-OTHER'
  }
];


const assignments = [

  {
    id:
      'ASSIGN-001',

    active:
      true,

    allocationId:
      'ALLOC-001',

    eventId:
      'EVENT-001',

    vehicleId:
      'VEH-001',

    seatId:
      'SEAT-1',

    seatNumber:
      1,

    personId:
      'PERSON-001',

    accountUid:
      'ACCOUNT-001',

    personName:
      'Colaborador Prueba',

    membershipRole:
      'colaborador_base',

    status:
      'assigned',

    confirmationStatus:
      'pending',

    boardingStatus:
      'pending'
  }
];


const manifest =
  buildAllocationManifest({
    allocation,
    seats,
    assignments
  });


assert.equal(
  manifest.summary
    .integrityOk,
  true
);


assert.equal(
  manifest.summary
    .allocatedCapacity,
  6
);


assert.equal(
  manifest.summary
    .assignedSeatCount,
  1
);


assert.equal(
  manifest.summary
    .observedAssignedSeatCount,
  1
);


assert.equal(
  manifest.summary
    .remainingAssignableSeatCount,
  5
);


assert.deepEqual(
  manifest.seats.map(
    seat =>
      seat.seatNumber
  ),
  [
    1, 2,
    5, 6,
    9, 10
  ]
);


assert.equal(
  manifest.seats[0]
    .passenger
    .personName,
  'Colaborador Prueba'
);


assert.equal(
  manifest.seats[0]
    .passenger
    .confirmationStatus,
  'pending'
);


assert.equal(
  manifest.seats[0]
    .passenger
    .boardingStatus,
  'pending'
);


assert.equal(
  manifest.seats[1]
    .passenger,
  null
);


assert.equal(
  manifest.issues.length,
  0
);


// ======================================================
// INCONSISTENCIA DETECTABLE
// ======================================================

const broken =
  buildAllocationManifest({

    allocation,

    seats:
      seats.map(
        seat =>
          seat.id ===
          'SEAT-1'
            ? {
                ...seat,
                assignmentId:
                  'ASSIGN-NO-EXISTE'
              }
            : seat
      ),

    assignments
  });


assert.equal(
  broken.summary
    .integrityOk,
  false
);


assert.ok(
  broken.issues.length >
    0
);


console.log(
  'OK: BUILD-118C-3B3E-3G-B3B1 allocation manifest tests passed.'
);
