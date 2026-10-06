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


/*
  optional digital account contract
*/

for (
  const expected of [
    'createDigitalAccount',
    'authUser ?',
    'authUser.uid',
    'accountUid:',
    'mustChangePassword:',
    'if (authUser?.uid)',
    'if (authUser)'
  ]
) {

  assert.ok(
    block.includes(
      expected
    ),
    `Falta contrato de cuenta digital opcional: ${expected}`
  );
}


assert.match(
  block,
  /createDigitalAccount\s*=\s*data\.createDigitalAccount\s*!==\s*false/,
  'Integrante debe conservar compatibilidad: si no se envía createDigitalAccount, se crea cuenta digital.'
);


assert.match(
  block,
  /if\s*\(\s*createDigitalAccount\s*\)\s*\{/,
  'La creación de Firebase Auth debe depender de createDigitalAccount.'
);


assert.match(
  block,
  /accountUid:\s*authUser\s*\?\s*authUser\.uid\s*:\s*null/,
  'Person y membership deben admitir accountUid null.'
);


assert.match(
  block,
  /if\s*\(\s*authUser\s*\)\s*\{[\s\S]*batch\.set\(/,
  'usuarios/{uid} sólo debe escribirse cuando existe cuenta digital.'
);


assert.match(
  block,
  /if\s*\(\s*authUser\?\.uid\s*\)\s*\{[\s\S]*auth\.deleteUser/,
  'El rollback de Authentication sólo debe ejecutarse si existe authUser.'
);


console.log(
  'OK: optional digital account contract passed.'
);
