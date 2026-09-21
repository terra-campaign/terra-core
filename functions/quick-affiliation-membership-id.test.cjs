'use strict';

const assert =
  require(
    'node:assert/strict'
  );

const fs =
  require(
    'node:fs'
  );

const path =
  require(
    'node:path'
  );

const {
  canonicalMembershipDocumentId
} =
  require(
    './territorial-membership-id.cjs'
  );


const source =
  fs.readFileSync(
    path.join(
      __dirname,
      'quick-affiliation.cjs'
    ),
    'utf8'
  );


// ======================================================
// QUICK AFFILIATION DEBE USAR HELPER CENTRAL
// ======================================================

assert.match(
  source,
  /canonicalMembershipDocumentId\(\s*caller\.campaignId,\s*personRef\.id\s*\)/
);


// ======================================================
// FORMULA ANTIGUA YA NO DEBE EXISTIR
// ======================================================

assert.doesNotMatch(
  source,
  /hash\(\s*['"]territorial-membership['"]/
);


// ======================================================
// hash() GENERICO DEBE SEGUIR EXISTIENDO
// PARA structure-member
// ======================================================

assert.match(
  source,
  /function hash\(\s*\.\.\.parts\s*\)/
);

assert.match(
  source,
  /hash\(\s*['"]structure-member['"],\s*viewer\.campaignId,\s*structure\.id,\s*snapshot\.id\s*\)/
);


// ======================================================
// EL HELPER CENTRAL PRODUCE ID DETERMINISTICO
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


console.log(
  'OK: BUILD-123C3 Quick Affiliation uses canonical membership ID helper.'
);
