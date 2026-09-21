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
    /parentPersonId:\s*callerPersonId/g
  ) || [];

assert.equal(
  parentPersonMatches.length,
  1,
  'La membresía debe guardar parentPersonId.'
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
// NO DEBE CAMBIAR EL membershipId EN ESTE BUILD
// ======================================================

assert.match(
  source,
  /hash\(\s*['"]territorial-membership['"],\s*caller\.campaignId,\s*personRef\.id\s*\)/
);


console.log(
  'OK: BUILD-123B2 quick affiliation canonical relations contract passed.'
);
