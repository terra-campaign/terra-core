'use strict';

const assert =
  require(
    'node:assert/strict'
  );

const {
  cleanText,
  normalizeText,
  validId,
  opaqueInviterRef,
  doorJurisdictionStatus,
  roleLabel
} =
  require(
    './door-resolution.cjs'
  )._test;


// ======================================================
// NORMALIZACION
// ======================================================

assert.equal(
  cleanText(
    '  Juan   Pérez  '
  ),
  'Juan Pérez'
);


assert.equal(
  normalizeText(
    'José María'
  ),
  'jose maria'
);


// ======================================================
// IDS
// ======================================================

assert.equal(
  validId(
    'MUN-001'
  ),
  'MUN-001'
);


assert.equal(
  validId(
    'MUN/001'
  ),
  ''
);


// ======================================================
// JURISDICCION
// ======================================================

assert.equal(
  doorJurisdictionStatus(
    'MUN-001',
    'MUN-001'
  ),
  'same_municipality'
);


assert.equal(
  doorJurisdictionStatus(
    'MUN-001',
    'MUN-002'
  ),
  'other_municipality'
);


assert.equal(
  doorJurisdictionStatus(
    '',
    'MUN-001'
  ),
  'unresolved'
);


// ======================================================
// REFERENCIA OPACA
// ======================================================

const ref1 =
  opaqueInviterRef(
    'CAM-001',
    'USER-001'
  );


const ref2 =
  opaqueInviterRef(
    'CAM-001',
    'USER-001'
  );


const ref3 =
  opaqueInviterRef(
    'CAM-001',
    'USER-002'
  );


assert.equal(
  ref1,
  ref2
);


assert.notEqual(
  ref1,
  ref3
);


assert.equal(
  ref1.length,
  64
);


// ======================================================
// ROLES
// ======================================================

assert.equal(
  roleLabel(
    'participante'
  ),
  'Participante'
);


assert.equal(
  roleLabel(
    'jefe_estructura'
  ),
  'Responsable de estructura'
);


console.log(
  'OK: BUILD-118C-3B3A neutral door resolution tests passed.'
);
