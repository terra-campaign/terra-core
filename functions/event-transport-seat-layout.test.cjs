'use strict';

const assert =
  require(
    'node:assert/strict'
  );


const {
  SEAT_SIDE_REFERENCE,
  LEFT_SIDE_MEANING,
  RIGHT_SIDE_MEANING,
  validateSeatSideLayout,
  canConfigureSeatLayout
} =
  require(
    './event-transport-seat-layout.cjs'
  )._test;


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


const layout =
  validateSeatSideLayout({
    capacity:
      12,

    leftSeatNumbers:
      [1,3,5,7,9,11],

    rightSeatNumbers:
      [2,4,6,8,10,12],

    centerSeatNumbers:
      []
  });


assert.deepEqual(
  layout.left,
  [1,3,5,7,9,11]
);


assert.deepEqual(
  layout.right,
  [2,4,6,8,10,12]
);


assert.equal(
  layout.sideBySeat.get(1),
  'left'
);


assert.equal(
  layout.sideBySeat.get(2),
  'right'
);


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
  'OK: BUILD-118C-3B3E-3G-B2B1 seat layout domain tests passed.'
);
