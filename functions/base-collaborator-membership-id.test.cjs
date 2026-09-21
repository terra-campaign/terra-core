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
      'base-collaborator.cjs'
    ),
    'utf8'
  );


assert.match(
  source,
  /require\(\s*['"]\.\/territorial-membership-id\.cjs['"]\s*\)/
);

assert.match(
  source,
  /const membershipId\s*=\s*canonicalMembershipDocumentId\(\s*campaignId,\s*personId\s*\)/
);

assert.match(
  source,
  /\.collection\(\s*['"]territorialMemberships['"]\s*\)\s*\.doc\(\s*membershipId\s*\)/
);

assert.doesNotMatch(
  source,
  /const membershipId\s*=\s*membershipRef\.id/
);

assert.equal(
  canonicalMembershipDocumentId(
    'CAM-001',
    'PERSON-001'
  ),
  canonicalMembershipDocumentId(
    'CAM-001',
    'PERSON-001'
  )
);

console.log(
  'OK: BUILD-123C4 Base Collaborator uses canonical membership ID helper.'
);
