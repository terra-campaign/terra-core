'use strict';

const assert =
  require(
    'node:assert/strict'
  );


const eventTest =
  require(
    './event-delegation.cjs'
  )._test;


const identityTest =
  require(
    './person-identity.cjs'
  )._test;


// La referencia producida por búsqueda y la que
// resuelve asistencia DEBEN ser idénticas.
const searchRef =
  identityTest.opaquePersonCandidateRef(
    'CAM-001',
    'person',
    'PERSON-001'
  );


const attendanceRef =
  eventTest.doorPersonCandidateRef(
    'CAM-001',
    'person',
    'PERSON-001'
  );


assert.equal(
  searchRef,
  attendanceRef
);


assert.match(
  attendanceRef,
  /^[a-f0-9]{64}$/
);


// PERSONA vinculada debe prevalecer sobre usuario.
const records =
  eventTest.canonicalDoorIdentityRecords(

    [
      {
        source:
          'user',

        id:
          'UID-001',

        profile: {
          name:
            'Usuario'
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
            'Persona sin cuenta'
        }
      }
    ]
  );


assert.equal(
  records.length,
  2
);


assert.equal(
  records.some(
    item =>
      item.id ===
      'PERSON-001'
  ),
  true
);


assert.equal(
  records.some(
    item =>
      item.id ===
      'PERSON-002'
  ),
  true
);


assert.equal(
  records.some(
    item =>
      item.source ===
        'user' &&
      item.id ===
        'UID-001'
  ),
  false
);


console.log(
  'OK: BUILD-118C-3B3E-2B door event attendance tests passed.'
);
