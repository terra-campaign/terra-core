'use strict';

const assert =
  require(
    'node:assert/strict'
  );


const doorTutor =
  require(
    './door-tutor.cjs'
  )._test;


const doorResolution =
  require(
    './door-resolution.cjs'
  )._test;


// ======================================================
// REFERENCIA INVITADOR DEBE SER COMPATIBLE CON 3B3A
// ======================================================

assert.equal(
  doorTutor.opaqueInviterRef(
    'CAM-001',
    'USER-001'
  ),
  doorResolution.opaqueInviterRef(
    'CAM-001',
    'USER-001'
  )
);


assert.equal(
  doorTutor.validOpaqueRef(
    doorTutor.opaqueInviterRef(
      'CAM-001',
      'USER-001'
    )
  ),
  true
);


assert.equal(
  doorTutor.validOpaqueRef(
    'abc'
  ),
  false
);


// ======================================================
// MODOS
// ======================================================

assert.equal(
  doorTutor.tutorResolutionMode(
    'participante'
  ),
  'inviter_is_tutor'
);


assert.equal(
  doorTutor.tutorResolutionMode(
    'integrante'
  ),
  'direct_participants'
);


assert.equal(
  doorTutor.tutorResolutionMode(
    'jefe_estructura'
  ),
  'structure_participants'
);


assert.equal(
  doorTutor.tutorResolutionMode(
    'coordinador_municipal'
  ),
  'pending_structure_assignment'
);


// ======================================================
// DATOS BASE
// ======================================================

const participant = {
  uid:
    'PART-1',

  name:
    'Participante Uno',

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


// ======================================================
// PARTICIPANTE = EL MISMO TUTOR
// ======================================================

assert.equal(
  doorTutor.tutorCandidateAllowed(
    participant,
    participant
  ),
  true
);


assert.equal(
  doorTutor.tutorCandidateAllowed(
    {
      ...participant,
      uid:
        'PART-OTHER'
    },
    participant
  ),
  false
);


// ======================================================
// INTEGRANTE = SOLO PARTICIPANTE DIRECTO
// ======================================================

assert.equal(
  doorTutor.tutorCandidateAllowed(
    member,
    participant
  ),
  true
);


assert.equal(
  doorTutor.tutorCandidateAllowed(
    member,
    {
      ...participant,
      parentUserId:
        'MEMBER-OTHER'
    }
  ),
  false
);


assert.equal(
  doorTutor.tutorCandidateAllowed(
    member,
    {
      ...participant,
      structureId:
        'EST-999'
    }
  ),
  false
);


// ======================================================
// JEFE = PARTICIPANTES DE SU ESTRUCTURA
// ======================================================

assert.equal(
  doorTutor.tutorCandidateAllowed(
    chief,
    participant
  ),
  true
);


assert.equal(
  doorTutor.tutorCandidateAllowed(
    chief,
    {
      ...participant,
      structureId:
        'EST-999'
    }
  ),
  false
);


// ======================================================
// NUNCA OTRO MUNICIPIO
// ======================================================

assert.equal(
  doorTutor.tutorCandidateAllowed(
    member,
    {
      ...participant,
      municipalityId:
        'MUN-002'
    }
  ),
  false
);


// ======================================================
// NUNCA OTRA CAMPAÑA
// ======================================================

assert.equal(
  doorTutor.tutorCandidateAllowed(
    member,
    {
      ...participant,
      campaignId:
        'CAM-999'
    }
  ),
  false
);


// ======================================================
// NUNCA INACTIVO
// ======================================================

assert.equal(
  doorTutor.tutorCandidateAllowed(
    member,
    {
      ...participant,
      active:
        false
    }
  ),
  false
);


console.log(
  'OK: BUILD-118C-3B3C tutor resolution tests passed.'
);
