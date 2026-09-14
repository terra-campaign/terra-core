'use strict';

const assert =
  require(
    'node:assert/strict'
  );

const {
  normalizeIdentityText,
  normalizeIdentityPhone,
  phonesEquivalent,
  maskedPhone,
  personCandidateMatch
} =
  require(
    './person-identity.cjs'
  )._test;


// ======================================================
// TEXTO
// ======================================================

assert.equal(
  normalizeIdentityText(
    '  José   Pérez García '
  ),
  'jose perez garcia'
);


assert.equal(
  normalizeIdentityText(
    'ZACUALPÁN'
  ),
  'zacualpan'
);


// ======================================================
// TELEFONO
// ======================================================

assert.equal(
  normalizeIdentityPhone(
    '+52 322-100-6736'
  ),
  '523221006736'
);


assert.equal(
  phonesEquivalent(
    '+52 322 100 6736',
    '3221006736'
  ),
  true
);


assert.equal(
  phonesEquivalent(
    '3221006736',
    '3229999999'
  ),
  false
);


assert.equal(
  maskedPhone(
    '+52 322 100 6736'
  ),
  '••••6736'
);


// ======================================================
// COINCIDENCIA POR TELEFONO
// ======================================================

const phoneCandidate =
  personCandidateMatch(
    {
      phone:
        '3221006736',

      name:
        'Otro Nombre',

      locality:
        'Otra localidad'
    },
    {
      phone:
        '+52 322 100 6736',

      name:
        'Cristian Gpe',

      locality:
        'Compostela'
    }
  );


assert.ok(
  phoneCandidate
);


assert.equal(
  phoneCandidate
    .reasons
    .includes('phone'),
  true
);


// ======================================================
// NOMBRE + POBLACION
// ======================================================

const nameLocalityCandidate =
  personCandidateMatch(
    {
      name:
        'María López García',

      locality:
        'Zacualpan'
    },
    {
      name:
        'MARIA LOPEZ GARCIA',

      locality:
        'Zacualpán'
    }
  );


assert.ok(
  nameLocalityCandidate
);


assert.deepEqual(
  nameLocalityCandidate.reasons,
  [
    'name',
    'locality'
  ]
);


// ======================================================
// NOMBRE SOLO NO BASTA
// ======================================================

assert.equal(
  personCandidateMatch(
    {
      name:
        'Juan Pérez'
    },
    {
      name:
        'Juan Perez'
    }
  ),
  null
);


// ======================================================
// NOMBRE + DOMICILIO
// ======================================================

const addressCandidate =
  personCandidateMatch(
    {
      name:
        'Juan Pérez',

      street:
        'Hidalgo',

      houseNumber:
        '25'
    },
    {
      name:
        'JUAN PEREZ',

      street:
        'Hidalgo',

      houseNumber:
        '25'
    }
  );


assert.ok(
  addressCandidate
);


assert.equal(
  addressCandidate
    .reasons
    .includes('street'),
  true
);


assert.equal(
  addressCandidate
    .reasons
    .includes('houseNumber'),
  true
);


console.log(
  'OK: BUILD-118C-3B1 global identity search policy passed.'
);
