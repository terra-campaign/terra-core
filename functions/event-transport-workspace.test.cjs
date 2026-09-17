'use strict';

const assert =
  require('node:assert/strict');

const fs =
  require('node:fs');

const path =
  require('node:path');

const moduleUnderTest =
  require(
    './event-transport-passenger-assignments.cjs'
  );

const {
  buildEventTransportWorkspace
} =
  moduleUnderTest._test;


const workspace =
  buildEventTransportWorkspace({

    event: {
      id:
        'EVENT-001',
      title:
        'Evento prueba',
      venue:
        'Lugar prueba',
      locality:
        'Compostela',
      startsAt:
        '2026-09-17T20:00:00.000Z'
    },

    vehicles: [
      {
        id:
          'VEH-001',
        eventId:
          'EVENT-001',
        name:
          'Camión 1',
        vehicleType:
          'bus',
        capacity:
          40,
        seatCount:
          40,
        allocatedSeatCount:
          10,
        availableSeatCount:
          30,
        assignedSeatCount:
          2,
        occupiedCount:
          1,

        seatLayoutConfigured:
          true,

        seatLayoutType:
          'side_map',

        seatLayoutTemplate:
          'standard_2x2',

        seatSideReference:
          'forward_facing_from_inside',

        leftSideMeaning:
          'driver_side',

        rightSideMeaning:
          'passenger_side',

        leftSeatCount:
          6,

        rightSeatCount:
          6,

        centerSeatCount:
          0,

        active:
          true
      }
    ],

    allocations: [
      {
        id:
          'ALLOC-001',
        eventId:
          'EVENT-001',
        vehicleId:
          'VEH-001',
        allocationType:
          'seat_selection',
        allocatedCapacity:
          10,
        seatNumbers:
          [1,2,3,4,5,6,7,8,9,10],
        zone:
          'left',
        allocatedToUserId:
          'RESP-001',
        active:
          true
      }
    ],

    requests: [
      {
        id:
          'REQ-001',
        eventId:
          'EVENT-001',
        personId:
          'PERSON-001',
        accountUid:
          'UID-001',
        needsTransport:
          true
      },
      {
        id:
          'REQ-002',
        eventId:
          'EVENT-001',
        personId:
          'PERSON-002',
        accountUid:
          'UID-002',
        needsTransport:
          false
      }
    ],

    assignments: [
      {
        id:
          'ASSIGN-001',
        eventId:
          'EVENT-001',
        allocationId:
          'ALLOC-001',
        vehicleId:
          'VEH-001',
        personId:
          'PERSON-001',
        personName:
          'Persona uno',
        boardingPoint:
          'Plaza principal',
        scheduledBoardingAt:
          '2026-09-17T17:30:00.000Z',
        scheduledBoardingAtMillis:
          1789666200000,
        seatNumber:
          5,
        status:
          'assigned',
        confirmationStatus:
          'confirmed',
        boardingStatus:
          'boarded',
        active:
          true
      },
      {
        id:
          'ASSIGN-002',
        eventId:
          'EVENT-001',
        allocationId:
          'ALLOC-001',
        vehicleId:
          'VEH-001',
        personId:
          'PERSON-003',
        seatNumber:
          6,
        status:
          'assigned',
        confirmationStatus:
          'pending',
        boardingStatus:
          'pending',
        active:
          true
      }
    ]
  });


assert.equal(
  workspace.summary.vehicleCount,
  1
);

assert.equal(
  workspace.summary.allocationCount,
  1
);

assert.equal(
  workspace.summary.transportResponseCount,
  2
);

assert.equal(
  workspace.summary.transportRequestedCount,
  1
);

assert.equal(
  workspace.summary.transportNotRequestedCount,
  1
);

assert.equal(
  workspace.summary.assignedPassengerCount,
  2
);

assert.equal(
  workspace.summary.confirmedPassengerCount,
  1
);

assert.equal(
  workspace.summary.boardedCount,
  1
);

assert.equal(
  workspace.vehicles[0]
    .occupiedCount,
  1
);

assert.equal(
  workspace.allocations[0]
    .allocatedToUserId,
  'RESP-001'
);

assert.equal(
  workspace.transportRequests[0]
    .personId,
  'PERSON-001'
);

assert.equal(
  workspace.assignments[0]
    .boardingStatus,
  'boarded'
);



assert.equal(
  workspace.assignments[0]
    .boardingPoint,
  'Plaza principal'
);


assert.equal(
  workspace.assignments[0]
    .scheduledBoardingAt,
  '2026-09-17T17:30:00.000Z'
);


const source =
  fs.readFileSync(
    path.join(
      __dirname,
      'event-transport-passenger-assignments.cjs'
    ),
    'utf8'
  );


assert.match(
  source,
  /exports\.getEventTransportWorkspace\s*=/
);

assert.match(
  source,
  /eventTransportVehicles/
);

assert.match(
  source,
  /eventTransportAllocations/
);

assert.match(
  source,
  /eventTransportRequests/
);

assert.match(
  source,
  /eventTransportAssignments/
);

assert.match(
  source,
  /canManageEventTransport\(\s*profile,\s*event/
);




// ======================================================
// BUILD-118C-3B3E-3G-B4D2A
// ESTADO DEL MAPA FÍSICO EN WORKSPACE
// ======================================================

assert.equal(
  workspace.vehicles[0]
    .seatLayoutConfigured,
  true
);


assert.equal(
  workspace.vehicles[0]
    .seatLayoutTemplate,
  'standard_2x2'
);


assert.equal(
  workspace.vehicles[0]
    .leftSeatCount,
  6
);


assert.equal(
  workspace.vehicles[0]
    .rightSeatCount,
  6
);


assert.equal(
  workspace.vehicles[0]
    .centerSeatCount,
  0
);


console.log(
  'OK: BUILD-118C-3B3E-3G-B4A transport workspace passed.'
);
