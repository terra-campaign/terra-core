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

const source =
  fs.readFileSync(
    path.join(
      __dirname,
      'index.js'
    ),
    'utf8'
  );


assert.match(
  source,
  /require\(\s*["']\.\/territorial-membership-id\.cjs["']\s*\)/
);


assert.doesNotMatch(
  source,
  /membershipRef\.id/
);


const canonicalCalls =
  source.match(
    /canonicalMembershipDocumentId\(\s*campaignId,\s*personId\s*\)/g
  ) || [];

assert.equal(
  canonicalCalls.length,
  2,
  'Integrante y Participante deben usar membershipId canonico.'
);


const canonicalRefs =
  source.match(
    /\.collection\(\s*["']territorialMemberships["']\s*\)\s*\.doc\(\s*membershipId\s*\)/g
  ) || [];

assert.equal(
  canonicalRefs.length,
  2,
  'Deben existir dos referencias canonicas a territorialMemberships.'
);


assert.match(
  source,
  /memberProfile\.membershipId\s*=\s*membershipId/
);

assert.match(
  source,
  /participantProfile\.membershipId\s*=\s*membershipId/
);


console.log(
  'OK: BUILD-123C5 index.js uses canonical membership IDs for Integrante and Participante.'
);
