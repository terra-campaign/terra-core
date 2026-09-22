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
    /parentUserId:\s*creatorUid,\s*parentPersonId:\s*creatorPersonId/g
  ) || [];

assert.equal(
  parentPersonMatches.length,
  2,
  'Usuario y membresía deben persistir la relación canónica parentUserId + parentPersonId.'
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



assert.match(
  source,
  /require\(\s*['"]\.\/territorial-ancestry\.cjs['"]\s*\)/
);

assert.match(
  source,
  /const collaboratorAncestry\s*=\s*canonicalChildAncestry\s*\(/
);

assert.match(
  source,
  /const ancestorPersonIds\s*=\s*collaboratorAncestry\s*\.ancestorPersonIds/
);

assert.match(
  source,
  /ancestorIds,\s*ancestorPersonIds,\s*createdBy:/
);

assert.match(
  source,
  /ancestorUserIds:\s*ancestorIds,\s*ancestorPersonIds,/
);


console.log(
  'OK: BUILD-123B1 base collaborator canonical relations contract passed.'
);
