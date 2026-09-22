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
      'quick-affiliation.cjs'
    ),
    'utf8'
  );


// ======================================================
// RESOLUCION CANONICA DEL ACTOR
// ======================================================

assert.match(
  source,
  /require\(\s*['"]\.\/person-identity\.cjs['"]\s*\)/
);

assert.match(
  source,
  /const callerIdentity\s*=\s*await resolveCanonicalPersonForAccount/
);

assert.match(
  source,
  /accountUid:\s*caller\.uid/
);

assert.match(
  source,
  /profile:\s*caller/
);

assert.match(
  source,
  /const callerPersonId\s*=\s*callerIdentity\.personId/
);


// ======================================================
// COMPATIBILIDAD UID
// ======================================================

assert.match(
  source,
  /parentUserId:\s*caller\.uid/
);

const introducedUserMatches =
  source.match(
    /introducedByUserId:\s*caller\.uid/g
  ) || [];

assert.equal(
  introducedUserMatches.length,
  2,
  'Persona y membresía deben conservar introducedByUserId.'
);


// ======================================================
// RELACIONES CANONICAS
// ======================================================

const parentPersonMatches =
  source.match(
    /parentUserId:\s*caller\.uid,\s*parentPersonId:\s*callerPersonId/g
  ) || [];

assert.equal(
  parentPersonMatches.length,
  1,
  'La membresía debe persistir la relación canónica parentUserId + parentPersonId.'
);


const introducedPersonMatches =
  source.match(
    /introducedByPersonId:\s*callerPersonId/g
  ) || [];

assert.equal(
  introducedPersonMatches.length,
  2,
  'Persona y membresía deben guardar introducedByPersonId.'
);


// ======================================================
// MEMBERSHIP ID CANONICO CENTRALIZADO
// ======================================================

assert.match(
  source,
  /canonicalMembershipDocumentId/
);

assert.match(
  source,
  /require\(\s*['"]\.\/territorial-membership-id\.cjs['"]\s*\)/
);

assert.doesNotMatch(
  source,
  /['"]territorial-membership['"]/
);



assert.match(
  source,
  /require\(\s*['"]\.\/territorial-ancestry\.cjs['"]\s*\)/
);

assert.match(
  source,
  /const affiliationAncestry\s*=\s*canonicalChildAncestry\s*\(/
);

assert.match(
  source,
  /const ancestorPersonIds\s*=\s*affiliationAncestry\s*\.ancestorPersonIds/
);

assert.match(
  source,
  /ancestorUserIds,\s*ancestorPersonIds,/
);


console.log(
  'OK: BUILD-123B2 quick affiliation canonical relations contract passed.'
);
