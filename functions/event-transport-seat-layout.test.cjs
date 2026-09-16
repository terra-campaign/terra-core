'use strict';

const assert =
  require(
    'node:assert/strict'
  );


const {
  SEAT_SIDE_REFERENCE,
  LEFT_SIDE_MEANING,
  RIGHT_SIDE_MEANING,
  SEAT_LAYOUT_TEMPLATES,
  standard2x2SeatLayout,
  resolveSeatLayout,
  validateSeatSideLayout,
  canConfigureSeatLayout
} =
  require(
    './event-transport-seat-layout.cjs'
  )._test;


// ======================================================
// REFERENCIA FISICA
// ======================================================

assert.equal(
  SEAT_SIDE_REFERENCE,
  'forward_facing_from_inside'
);


assert.equal(
  LEFT_SIDE_MEANING,
  'driver_side'
);


assert.equal(
  RIGHT_SIDE_MEANING,
  'passenger_side'
);


assert.equal(
  SEAT_LAYOUT_TEMPLATES.has(
    'standard_2x2'
  ),
  true
);


// ======================================================
// COMBI 12 — PLANTILLA 2+2
//
// CHOFER          COPILOTO
// 1  2             3  4
// 5  6             7  8
// 9 10            11 12
// ======================================================

const combi12 =
  standard2x2SeatLayout(
    12
  );


assert.deepEqual(
  combi12.left,
  [
    1, 2,
    5, 6,
    9, 10
  ]
);


assert.deepEqual(
  combi12.right,
  [
    3, 4,
    7, 8,
    11, 12
  ]
);


assert.deepEqual(
  combi12.center,
  []
);


// ======================================================
// CAMION 40 — PLANTILLA 2+2
// ======================================================

const bus40 =
  standard2x2SeatLayout(
    40
  );


assert.deepEqual(
  bus40.left,
  [
    1, 2,
    5, 6,
    9, 10,
    13, 14,
    17, 18,
    21, 22,
    25, 26,
    29, 30,
    33, 34,
    37, 38
  ]
);


assert.deepEqual(
  bus40.right,
  [
    3, 4,
    7, 8,
    11, 12,
    15, 16,
    19, 20,
    23, 24,
    27, 28,
    31, 32,
    35, 36,
    39, 40
  ]
);


assert.equal(
  bus40.left.length,
  20
);


assert.equal(
  bus40.right.length,
  20
);


// ======================================================
// RESOLVER AUTOMATICO
// ======================================================

const resolved12 =
  resolveSeatLayout({
    layoutTemplate:
      'standard_2x2',

    capacity:
      12
  });


assert.equal(
  resolved12.templateId,
  'standard_2x2'
);


assert.deepEqual(
  resolved12.left,
  [
    1,2,5,6,9,10
  ]
);


assert.deepEqual(
  resolved12.right,
  [
    3,4,7,8,11,12
  ]
);


assert.equal(
  resolved12.sideBySeat.get(1),
  'left'
);


assert.equal(
  resolved12.sideBySeat.get(2),
  'left'
);


assert.equal(
  resolved12.sideBySeat.get(3),
  'right'
);


assert.equal(
  resolved12.sideBySeat.get(4),
  'right'
);


// ======================================================
// MODO PERSONALIZADO SIGUE DISPONIBLE
// ======================================================

const custom =
  resolveSeatLayout({
    layoutTemplate:
      'custom',

    capacity:
      12,

    leftSeatNumbers:
      [1,2,3,4,5,6],

    rightSeatNumbers:
      [7,8,9,10,11,12],

    centerSeatNumbers:
      []
  });


assert.equal(
  custom.templateId,
  'custom'
);


assert.deepEqual(
  custom.left,
  [1,2,3,4,5,6]
);


// ======================================================
// VALIDACION BASE
// ======================================================

const validated =
  validateSeatSideLayout({
    capacity:
      12,

    leftSeatNumbers:
      [1,2,5,6,9,10],

    rightSeatNumbers:
      [3,4,7,8,11,12],

    centerSeatNumbers:
      []
  });


assert.equal(
  validated.sideBySeat.get(9),
  'left'
);


assert.equal(
  validated.sideBySeat.get(11),
  'right'
);


// ======================================================
// AUTORIDAD
// ======================================================

const event = {
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


assert.equal(
  canConfigureSeatLayout(
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
  canConfigureSeatLayout(
    {
      uid:
        'LOG-001',

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
  canConfigureSeatLayout(
    {
      uid:
        'OTHER-001',

      active:
        true,

      campaignId:
        'CAM-001'
    },
    event
  ),
  false
);


console.log(
  'OK: BUILD-118C-3B3E-3G-B2B1A standard 2x2 seat layout tests passed.'
);
