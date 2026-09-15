'use strict';

const assert =
  require(
    'node:assert/strict'
  );


const identity =
  require(
    './person-identity.cjs'
  )._test;


// ======================================================
// REFERENCIAS OPACAS
// ======================================================

const userRef =
  identity.opaquePersonCandidateRef(
    'CAM-001',
    'user',
    'UID-001'
  );


const personRef =
  identity.opaquePersonCandidateRef(
    'CAM-001',
    'person',
    'PERSON-001'
  );


assert.match(
  userRef,
  /^[a-f0-9]{64}$/
);


assert.match(
  personRef,
  /^[a-f0-9]{64}$/
);


assert.notEqual(
  userRef,
  personRef
);


// ======================================================
// CLAVES CANONICAS
// ======================================================

assert.equal(
  identity.identityRecordKey({
    source:
      'user',

    id:
      'UID-001',

    profile:
      {}
  }),
  'account:UID-001'
);


assert.equal(
  identity.identityRecordKey({
    source:
      'person',

    id:
      'PERSON-001',

    profile: {
      accountUid:
        null
    }
  }),
  'person:PERSON-001'
);


assert.equal(
  identity.identityRecordKey({
    source:
      'person',

    id:
      'PERSON-001',

    profile: {
      accountUid:
        'UID-001'
    }
  }),
  'account:UID-001'
);


// ======================================================
// PERSONA CANONICA PREVALECE SOBRE USUARIO VINCULADO
// ======================================================

const merged =
  identity.mergeIdentityRecords(

    [
      {
        source:
          'user',

        id:
          'UID-001',

        profile: {
          name:
            'Registro digital'
        }
      }
    ],

    [
      {
        source:
          'person',

        id:
          'PERSON-001',

        profile: {
          accountUid:
            'UID-001',

          name:
            'Persona canónica'
        }
      },

      {
        source:
          'person',

        id:
          'PERSON-002',

        profile: {
          accountUid:
            null,

          name:
            'Colaborador sin cuenta'
        }
      }
    ]
  );


assert.equal(
  merged.length,
  2
);


assert.equal(
  merged.find(
    item =>
      item.profile
        ?.accountUid ===
      'UID-001'
  )?.source,
  'person'
);


assert.equal(
  merged.some(
    item =>
      item.id ===
      'PERSON-002'
  ),
  true
);


console.log(
  'OK: BUILD-118C-3B3E-2A multisource identity tests passed.'
);
