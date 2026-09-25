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
      'index.js'
    ),
    'utf8'
  );


const start =
  source.indexOf(
    'exports.createStructureMember = onCall('
  );

const end =
  source.indexOf(
    'exports.createParticipant = onCall(',
    start
  );


assert.notEqual(
  start,
  -1,
  'Debe existir createStructureMember.'
);

assert.notEqual(
  end,
  -1,
  'Debe existir createParticipant después de createStructureMember.'
);


const block =
  source.slice(
    start,
    end
  ).replace(
    /\r\n/g,
    '\n'
  );


for (
  const expected of [
    'auth.createUser({',
    '.collection("usuarios")',
    '.collection("persons")',
    '"territorialMemberships"',
    'memberProfile.personId =',
    'memberProfile.membershipId =',
    'accountUid:',
    'role:\n          "integrante"',
    'introducedByUserId:',
    'parentUserId,',
    'ancestorUserIds:',
    'eventos_mitines:',
    'db.batch()',
    'await batch.commit()'
  ]
) {

  assert.ok(
    block.includes(
      expected
    ),
    `Falta contrato canónico: ${expected}`
  );
}


assert.equal(
  (
    block.match(
      /await memberRef\.set/g
    ) ||
    []
  ).length,
  0,
  'El perfil no debe escribirse fuera del batch canónico.'
);


console.log(
  'OK: BUILD-118C-3B3E-3C canonical structure member static contract passed.'
);
