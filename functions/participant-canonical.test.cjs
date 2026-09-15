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
    'exports.createParticipant = onCall('
  );

assert.notEqual(
  start,
  -1,
  'Debe existir createParticipant.'
);


let end =
  source.indexOf(
    '\nexports.',
    start + 10
  );

if (end === -1) {
  end = source.length;
}


const block =
  source.slice(
    start,
    end
  );


for (
  const expected of [
    'auth.createUser({',
    '.collection("usuarios")',
    '.collection("persons")',
    '"territorialMemberships"',
    'participantProfile.personId =',
    'participantProfile.membershipId =',
    'accountUid:',
    'role:\n          "participante"',
    'introducedByUserId:',
    'parentUserId,',
    'ancestorUserIds:',
    'eventos_mitines:',
    'db.batch()',
    'await batch.commit()',
    'await auth.deleteUser('
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
      /await participantRef\.set/g
    ) ||
    []
  ).length,
  0,
  'El perfil no debe escribirse fuera del batch.'
);


assert.equal(
  (
    block.match(
      /\.collection\("logs"\)\s*\.add/g
    ) ||
    []
  ).length,
  0,
  'La auditoría no debe escribirse fuera del batch.'
);


console.log(
  'OK: BUILD-118C-3B3E-3D canonical participant static contract passed.'
);
