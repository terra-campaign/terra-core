'use strict';

const assert =
  require(
    'node:assert/strict'
  );

const {
  createHash
} =
  require(
    'node:crypto'
  );

const {
  canonicalMembershipDocumentId
} =
  require(
    './territorial-membership-id.cjs'
  );


function legacyDoorFormula(
  campaignId,
  personId
) {

  return createHash(
    'sha256'
  )
    .update(
      JSON.stringify([
        'territorial-membership-v1',
        campaignId,
        personId
      ])
    )
    .digest(
      'hex'
    );
}


// ======================================================
// DETERMINISMO
// ======================================================

const id1 =
  canonicalMembershipDocumentId(
    'CAM-001',
    'PERSON-001'
  );

const id2 =
  canonicalMembershipDocumentId(
    'CAM-001',
    'PERSON-001'
  );


assert.equal(
  id1,
  id2
);


// ======================================================
// COMPATIBILIDAD CON DOOR REGISTRATION
// ======================================================

assert.equal(
  id1,
  legacyDoorFormula(
    'CAM-001',
    'PERSON-001'
  )
);


// ======================================================
// CAMPAÑA DIFERENTE -> MEMBERSHIP DIFERENTE
// ======================================================

assert.notEqual(
  canonicalMembershipDocumentId(
    'CAM-001',
    'PERSON-001'
  ),
  canonicalMembershipDocumentId(
    'CAM-002',
    'PERSON-001'
  )
);


// ======================================================
// PERSONA DIFERENTE -> MEMBERSHIP DIFERENTE
// ======================================================

assert.notEqual(
  canonicalMembershipDocumentId(
    'CAM-001',
    'PERSON-001'
  ),
  canonicalMembershipDocumentId(
    'CAM-001',
    'PERSON-002'
  )
);


// ======================================================
// FORMATO SHA-256
// ======================================================

assert.match(
  id1,
  /^[a-f0-9]{64}$/
);


// ======================================================
// NORMALIZACION SEGURA
// ======================================================

assert.equal(
  canonicalMembershipDocumentId(
    ' CAM-001 ',
    ' PERSON-001 '
  ),
  id1
);


// ======================================================
// IDs INVALIDOS
// ======================================================

assert.throws(
  () =>
    canonicalMembershipDocumentId(
      '',
      'PERSON-001'
    ),
  TypeError
);

assert.throws(
  () =>
    canonicalMembershipDocumentId(
      'CAM-001',
      ''
    ),
  TypeError
);

assert.throws(
  () =>
    canonicalMembershipDocumentId(
      'CAM/001',
      'PERSON-001'
    ),
  TypeError
);


console.log(
  'OK: BUILD-123C1 canonical territorial membership ID tests passed.'
);
