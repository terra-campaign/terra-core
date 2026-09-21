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
      'base-collaborator.cjs'
    ),
    'utf8'
  );


// ======================================================
// RESOLVER CENTRALIZADO
// ======================================================

assert.match(
  source,
  /require\(\s*['"]\.\/person-identity\.cjs['"]\s*\)/
);

assert.match(
  source,
  /resolveCanonicalPersonForAccount/
);

assert.match(
  source,
  /const creatorIdentity\s*=\s*await resolveCanonicalPersonForAccount/
);

assert.match(
  source,
  /const creatorPersonId\s*=\s*creatorIdentity\.personId/
);


// ======================================================
// COMPATIBILIDAD POR UID SE CONSERVA
// ======================================================

assert.match(
  source,
  /parentUserId:\s*creatorUid/
);

assert.match(
  source,
  /introducedByUserId:\s*creatorUid/
);


// ======================================================
// RELACIONES CANONICAS POR personId
// ======================================================

const parentPersonMatches =
  source.match(
    /parentPersonId:\s*creatorPersonId/g
  ) || [];

assert.equal(
  parentPersonMatches.length,
  2,
  'Debe persistirse parentPersonId en usuario y membresía.'
);


const introducedPersonMatches =
  source.match(
    /introducedByPersonId:\s*creatorPersonId/g
  ) || [];

assert.equal(
  introducedPersonMatches.length,
  2,
  'Debe persistirse introducedByPersonId en persona y membresía.'
);


console.log(
  'OK: BUILD-123B1 base collaborator canonical relations contract passed.'
);
