'use strict';

const assert =
  require('node:assert/strict');

const {
  NEXT,
  targetAllowed
} =
  require('./event-delegation.cjs')._test;


assert.equal(
  NEXT.lider_principal,
  'coordinador_municipal'
);

assert.equal(
  NEXT.coordinador_municipal,
  'jefe_estructura'
);

assert.equal(
  NEXT.jefe_estructura,
  'integrante'
);

assert.equal(
  NEXT.integrante,
  'participante'
);


const coordinator = {
  uid: 'COORD',
  role: 'coordinador_municipal',
  active: true,
  campaignId: 'CAM-001',
  municipalityId: 'MUN-001'
};

const chief = {
  uid: 'CHIEF',
  role: 'jefe_estructura',
  active: true,
  campaignId: 'CAM-001',
  municipalityId: 'MUN-001',
  structureId: 'EST-001',
  parentUserId: 'COORD'
};

assert.equal(
  targetAllowed(
    coordinator,
    chief
  ),
  true
);


assert.equal(
  targetAllowed(
    coordinator,
    {
      ...chief,
      municipalityId:
        'MUN-002'
    }
  ),
  false
);


const member = {
  uid: 'MEMBER',
  role: 'integrante',
  active: true,
  campaignId: 'CAM-001',
  municipalityId: 'MUN-001',
  structureId: 'EST-001',
  parentUserId: 'CHIEF'
};

assert.equal(
  targetAllowed(
    chief,
    member
  ),
  true
);


assert.equal(
  targetAllowed(
    chief,
    {
      ...member,
      structureId:
        'EST-999'
    }
  ),
  false
);


const participant = {
  uid: 'PARTICIPANT',
  role: 'participante',
  active: true,
  campaignId: 'CAM-001',
  municipalityId: 'MUN-001',
  structureId: 'EST-001',
  parentUserId: 'MEMBER'
};

assert.equal(
  targetAllowed(
    member,
    participant
  ),
  true
);


assert.equal(
  targetAllowed(
    member,
    {
      ...participant,
      parentUserId:
        'OTHER'
    }
  ),
  false
);



const leader = {
  uid: 'LEADER',
  role: 'lider_principal',
  active: true,
  campaignId: 'CAM-001'
};

const municipalCoordinator = {
  uid: 'COORD-2',
  role: 'coordinador_municipal',
  active: true,
  campaignId: 'CAM-001',
  municipalityId: 'MUN-002'
};

assert.equal(
  targetAllowed(
    leader,
    municipalCoordinator
  ),
  true
);

assert.equal(
  targetAllowed(
    leader,
    {
      ...municipalCoordinator,
      campaignId: 'CAM-999'
    }
  ),
  false
);

assert.equal(
  targetAllowed(
    leader,
    {
      ...municipalCoordinator,
      active: false
    }
  ),
  false
);

assert.equal(
  targetAllowed(
    member,
    {
      ...participant,
      role: 'integrante'
    }
  ),
  false
);

assert.equal(
  NEXT.participante,
  undefined
);


console.log(
  'OK: BUILD-118A-1 event delegation tests passed.'
);
