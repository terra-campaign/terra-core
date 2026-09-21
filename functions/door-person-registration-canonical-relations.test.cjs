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
      'door-person-registration.cjs'
    ),
    'utf8'
  );


// ======================================================
// RESOLVER CENTRAL
// ======================================================

assert.match(
  source,
  /require\(\s*['"]\.\/person-identity\.cjs['"]\s*\)/
);

assert.match(
  source,
  /resolveCanonicalPersonForAccount/
);


// ======================================================
// HANDOFF:
// INVITADOR Y TUTOR QUEDAN CANONICOS
// ======================================================

assert.match(
  source,
  /const inviterPersonId\s*=\s*inviterIdentity\.personId/
);

assert.match(
  source,
  /const tutorPersonId\s*=\s*tutorIdentity\.personId/
);

assert.match(
  source,
  /inviterPersonId:\s*inviterPersonId/
);

assert.match(
  source,
  /mentorPersonId:\s*tutorPersonId/
);


// ======================================================
// TUTOR QUE COMPLETA
// ======================================================

assert.match(
  source,
  /const callerPersonId\s*=\s*callerIdentity\.personId/
);


// ======================================================
// PERSONA:
// TUTOR = INTRODUCTOR / MENTOR
// INVITADOR = REFERENTE
// ======================================================

assert.match(
  source,
  /introducedByUserId:\s*caller\.uid,\s*introducedByPersonId:\s*callerPersonId/
);

assert.match(
  source,
  /referredByUserId:\s*handoff\.inviterUserId,\s*referredByPersonId:\s*inviterPersonId/
);

assert.match(
  source,
  /mentorUserId:\s*caller\.uid,\s*mentorPersonId:\s*callerPersonId/
);


// ======================================================
// MEMBRESIA:
// TUTOR = PARENT / INTRODUCTOR / MENTOR
// ======================================================

assert.match(
  source,
  /parentUserId:\s*caller\.uid,\s*parentPersonId:\s*callerPersonId/
);

const introducedPersonMatches =
  source.match(
    /introducedByPersonId:\s*callerPersonId/g
  ) || [];

assert.ok(
  introducedPersonMatches.length >= 2,
  'Persona y membresía deben guardar introducedByPersonId.'
);


// ======================================================
// REFERENCIA HISTORICA DEL INVITADOR
// ======================================================

const referredPersonMatches =
  source.match(
    /referredByPersonId:\s*inviterPersonId/g
  ) || [];

assert.ok(
  referredPersonMatches.length >= 2,
  'Persona y membresía deben conservar referredByPersonId.'
);


// ======================================================
// NO ALTERAR MEMBERSHIP ID DETERMINISTICO
// ======================================================

assert.match(
  source,
  /['"]territorial-membership-v1['"]/
);


console.log(
  'OK: BUILD-123B3 door registration canonical relations contract passed.'
);
