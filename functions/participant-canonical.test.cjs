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
  ).replace(
    /\r\n/g,
    '\n'
  );


for (
  const expected of [
    'createDigitalAccount',
    'data.parentPersonId',
    'resolveCanonicalPersonForAccount({',
    '.collection("persons")',
    '"territorialMemberships"',
    'canonicalMembershipDocumentId(',
    'actorCanAssistTarget({',
    'canonicalChildAncestry({',
    'participantProfile.personId =',
    'participantProfile.membershipId =',
    'accountUid:',
    'role:\n          "participante"',
    'parentPersonId',
    'parentUserId',
    'ancestorUserIds:',
    'ancestorPersonIds',
    'eventos_mitines:',
    'db.batch()',
    'await batch.commit()'
  ]
) {

  assert.ok(
    block.includes(
      expected
    ),
    `Falta contrato can?nico de participante: ${expected}`
  );
}


/*
 * La cuenta digital del nuevo participante
 * debe ser opcional.
 */
assert.ok(
  block.includes(
    'data.createDigitalAccount !== false'
  ),
  'createParticipant debe conservar cuenta digital por defecto para compatibilidad.'
);

assert.ok(
  /if\s*\(\s*createDigitalAccount\s*\)[\s\S]*?auth\.createUser\(\{/.test(
    block
  ),
  'Authentication solo debe crearse cuando createDigitalAccount sea verdadero.'
);

assert.ok(
  /accountUid:\s*authUser\s*\?\s*authUser\.uid\s*:\s*null/.test(
    block
  ),
  'La identidad can?nica debe admitir accountUid nulo.'
);

assert.ok(
  /if\s*\(\s*authUser\s*\)[\s\S]*?batch\.set/.test(
    block
  ),
  'usuarios solo debe escribirse cuando exista cuenta digital.'
);

assert.ok(
  /if\s*\(\s*authUser\?\.uid\s*\)/.test(
    block
  ),
  'El rollback de Authentication debe ser condicional.'
);


/*
 * El padre territorial debe poder existir sin cuenta.
 */
assert.ok(
  block.includes(
    'parentMembership'
  ),
  'Debe resolverse la membres?a can?nica del Integrante padre.'
);

assert.ok(
  block.includes(
    'parentPerson'
  ),
  'Debe resolverse la persona can?nica del Integrante padre.'
);


/*
 * Actor digital y padre territorial son identidades distintas.
 */
assert.ok(
  block.includes(
    'actorPersonId'
  ),
  'Debe existir actorPersonId independiente del parentPersonId.'
);

assert.ok(
  block.includes(
    'actorCanAssistTarget({'
  ),
  'La operaci?n asistida debe usar la pol?tica territorial com?n.'
);

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
