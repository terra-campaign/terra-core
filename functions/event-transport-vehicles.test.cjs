'use strict';

const assert =
  require(
    'node:assert/strict'
  );


const {
  ALLOWED_ROLES,
  MAX_VEHICLE_CAPACITY,
  transportVehicleCreationScope,
  vehicleIdFor,
  seatIdFor
} =
  require(
    './event-transport-vehicles.cjs'
  )._test;


// ======================================================
// ROLES
// ======================================================

assert.equal(
  ALLOWED_ROLES.has(
    'participante'
  ),
  true
);


assert.equal(
  ALLOWED_ROLES.has(
    'colaborador_base'
  ),
  true
);


assert.equal(
  MAX_VEHICLE_CAPACITY,
  120
);


// ======================================================
// CREADOR DEL EVENTO
// ======================================================

const creator = {
  uid:
    'PART-001',

  role:
    'participante',

  active:
    true,

  campaignId:
    'CAM-001'
};


const event = {
  id:
    'EV-001',

  active:
    true,

  campaignId:
    'CAM-001',

  createdBy:
    'PART-001'
};


assert.deepEqual(
  transportVehicleCreationScope(
    creator,
    event
  ),
  {
    type:
      'event_owner'
  }
);


// ======================================================
// INVITADO / RESPONSABLE DE RAMA
//
// Recibir una invitación NO concede permiso
// para crear el vehículo físico.
// ======================================================

const branchUser = {
  uid:
    'INT-001',

  role:
    'integrante',

  active:
    true,

  campaignId:
    'CAM-001'
};


assert.equal(
  transportVehicleCreationScope(
    branchUser,
    event
  ),
  null
);


// ======================================================
// RESPONSABLE LOGISTICO DESIGNADO
// ======================================================

const eventWithManager = {
  ...event,

  transportManagerIds: [
    'INT-001'
  ]
};


assert.deepEqual(
  transportVehicleCreationScope(
    branchUser,
    eventWithManager
  ),
  {
    type:
      'transport_manager'
  }
);


// ======================================================
// COLABORADOR NO AUTORIZADO
// ======================================================

assert.equal(
  transportVehicleCreationScope(
    {
      uid:
        'BASE-001',

      role:
        'colaborador_base',

      active:
        true,

      campaignId:
        'CAM-001'
    },
    event
  ),
  null
);


// ======================================================
// CAMPAÑA AJENA
// ======================================================

assert.equal(
  transportVehicleCreationScope(
    creator,
    {
      ...event,
      campaignId:
        'OTHER-CAMPAIGN'
    }
  ),
  null
);


// ======================================================
// VEHICULO IDEMPOTENTE
// ======================================================

const vehicleIdA =
  vehicleIdFor(
    'PART-001',
    'EV-001',
    'request-001'
  );


const vehicleIdB =
  vehicleIdFor(
    'PART-001',
    'EV-001',
    'request-001'
  );


assert.equal(
  vehicleIdA,
  vehicleIdB
);


assert.notEqual(
  vehicleIdFor(
    'PART-001',
    'EV-001',
    'request-001'
  ),
  vehicleIdFor(
    'PART-001',
    'EV-001',
    'request-002'
  )
);


// ======================================================
// ASIENTOS UNICOS
// ======================================================

assert.equal(
  seatIdFor(
    vehicleIdA,
    1
  ),
  seatIdFor(
    vehicleIdA,
    1
  )
);


assert.notEqual(
  seatIdFor(
    vehicleIdA,
    1
  ),
  seatIdFor(
    vehicleIdA,
    2
  )
);


// ======================================================
// VEHICULO COMPARTIBLE
//
// Los asientos pertenecen al vehículo.
// El reparto de cupos se hará en B2.
// ======================================================

const sharedVehicle =
  vehicleIdFor(
    'PART-001',
    'EV-SHARED',
    'request-shared-001'
  );


assert.notEqual(
  seatIdFor(
    sharedVehicle,
    20
  ),
  seatIdFor(
    sharedVehicle,
    21
  )
);


console.log(
  'OK: BUILD-118C-3B3E-3G-B1 transport vehicle authority/domain tests passed.'
);
