'use strict';

const assert =
  require('node:assert/strict');

const fs =
  require('node:fs');

const path =
  require('node:path');


const source =
  fs.readFileSync(
    path.join(
      __dirname,
      'base-collaborator.cjs'
    ),
    'utf8'
  );


for (
  const expected of [
    "'participante'",
    "auth.createUser({",
    "'colaborador_base'",
    "'usuarios'",
    "'persons'",
    "'territorialMemberships'",
    "personId,",
    "membershipId,",
    "parentUserId:",
    "introducedByUserId:",
    "accountUid:",
    "mustChangePassword:",
    "db.batch()",
    "await batch.commit()",
    "await auth.deleteUser("
  ]
) {

  assert.ok(
    source.includes(expected),
    `Falta contrato: ${expected}`
  );
}


const test =
  require(
    './base-collaborator.cjs'
  )._test;


assert.equal(
  test.normalizeEmail(
    ' PRUEBA@EXAMPLE.COM '
  ),
  'prueba@example.com'
);


assert.equal(
  test.normalizePhone(
    '+52 322 100 9003'
  ),
  '3221009003'
);


assert.equal(
  test.isValidEmail(
    'colaborador@example.com'
  ),
  true
);


console.log(
  'OK: BUILD-118C-3B3E-3E-A base collaborator backend contract passed.'
);
