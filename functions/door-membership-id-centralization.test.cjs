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

const registration =
  require(
    './door-person-registration.cjs'
  )._test;

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
      'door-person-registration.cjs'
    ),
    'utf8'
  );


// ======================================================
// MISMO RESULTADO QUE EL HELPER CENTRAL
// ======================================================

const cases = [

  [
    'CAM-001',
    'PERSON-001'
  ],

  [
    'CAM-ABC',
    'PERSON-XYZ'
  ]
];


for (
  const [
    campaignId,
    personId
  ] of cases
) {

  assert.equal(
    registration.membershipDocumentId(
      campaignId,
      personId
    ),
    canonicalMembershipDocumentId(
      campaignId,
      personId
    )
  );
}


// ======================================================
// DOOR YA NO DEFINE LA FORMULA DEL HASH DE MEMBERSHIP
// ======================================================

assert.doesNotMatch(
  source,
  /territorial-membership-v1/
);


// ======================================================
// DOOR CONSERVA SU API INTERNA COMPATIBLE
// ======================================================

assert.match(
  source,
  /function membershipDocumentId/
);

assert.match(
  source,
  /return canonicalMembershipDocumentId/
);


console.log(
  'OK: BUILD-123C2 Door Registration uses canonical membership ID helper.'
);
