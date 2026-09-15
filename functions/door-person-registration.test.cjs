'use strict';

const assert =
  require(
    'node:assert/strict'
  );


const registration =
  require(
    './door-person-registration.cjs'
  )._test;


const doorResolution =
  require(
    './door-resolution.cjs'
  )._test;


const doorTutor =
  require(
    './door-tutor.cjs'
  )._test;


// ======================================================
// REFERENCIAS COMPATIBLES
// ======================================================

assert.equal(
  registration.opaqueInviterRef(
    'CAM-001',
    'USER-001'
  ),
  doorResolution.opaqueInviterRef(
    'CAM-001',
    'USER-001'
  )
);


assert.equal(
  registration.opaqueTutorRef(
    'CAM-001',
    'USER-001'
  ),
  doorTutor.opaqueTutorRef(
    'CAM-001',
    'USER-001'
  )
);


// ======================================================
// TELÉFONO
// ======================================================

assert.equal(
  registration.normalizePhone(
    '+52 322 100 6736'
  ),
  '3221006736'
);


assert.equal(
  registration.normalizePhone(
    '3221006736'
  ),
  '3221006736'
);


// ======================================================
// RELACIONES TERRITORIALES
// ======================================================

const participant = {
  uid:
    'PART-1',

  role:
    'participante',

  active:
    true,

  campaignId:
    'CAM-001',

  municipalityId:
    'MUN-001',

  structureId:
    'EST-001',

  parentUserId:
    'MEMBER-1'
};


const member = {
  uid:
    'MEMBER-1',

  role:
    'integrante',

  active:
    true,

  campaignId:
    'CAM-001',

  municipalityId:
    'MUN-001',

  structureId:
    'EST-001'
};


const chief = {
  uid:
    'CHIEF-1',

  role:
    'jefe_estructura',

  active:
    true,

  campaignId:
    'CAM-001',

  municipalityId:
    'MUN-001',

  structureId:
    'EST-001'
};


assert.equal(
  registration.tutorMatchesInviter(
    participant,
    participant
  ),
  true
);


assert.equal(
  registration.tutorMatchesInviter(
    member,
    participant
  ),
  true
);


assert.equal(
  registration.tutorMatchesInviter(
    member,
    {
      ...participant,

      parentUserId:
        'OTHER-MEMBER'
    }
  ),
  false
);


assert.equal(
  registration.tutorMatchesInviter(
    chief,
    participant
  ),
  true
);


assert.equal(
  registration.tutorMatchesInviter(
    chief,
    {
      ...participant,

      structureId:
        'EST-999'
    }
  ),
  false
);


assert.equal(
  registration.tutorMatchesInviter(
    member,
    {
      ...participant,

      municipalityId:
        'MUN-999'
    }
  ),
  false
);


// ======================================================
// MEMBERSHIP ID DETERMINÍSTICO
// ======================================================

assert.equal(
  registration.membershipDocumentId(
    'CAM-001',
    'PERSON-1'
  ),
  registration.membershipDocumentId(
    'CAM-001',
    'PERSON-1'
  )
);


assert.notEqual(
  registration.membershipDocumentId(
    'CAM-001',
    'PERSON-1'
  ),
  registration.membershipDocumentId(
    'CAM-001',
    'PERSON-2'
  )
);


console.log(
  'OK: BUILD-118C-3B3E-1 accountless registration tests passed.'
);
