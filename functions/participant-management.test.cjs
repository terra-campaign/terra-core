'use strict';

const assert =
  require('node:assert/strict');

const fs =
  require('node:fs');

const path =
  require('node:path');


const implementationFile =
  path.join(
    __dirname,
    'participant-management.cjs'
  );


assert.equal(
  fs.existsSync(
    implementationFile
  ),
  true,
  'Debe existir participant-management.cjs.'
);


const source =
  fs.readFileSync(
    implementationFile,
    'utf8'
  );


for (
  const expected of [
    'exports.getParticipantManagementContext',
    'resolveCanonicalPersonForAccount',
    'canonicalMembershipDocumentId',
    'membershipMatchesSubject',
    'actorCanAssistTarget',
    "'persons'",
    "'territorialMemberships'",
    'parentPersonId',
    "'integrante'",
    "'participante'",
    'personId:',
    'membershipId:',
    'accountUid:',
    'hasDigitalAccount:',
    'recordingMode,',
    'participants'
  ]
) {

  assert.ok(
    source.includes(
      expected
    ),
    `Falta contrato de gestión de participantes: ${expected}`
  );
}


assert.match(
  source,
  /actorPersonId[\s\S]*parentPersonId/,
  'Actor digital y Integrante padre deben permanecer separados.'
);


assert.match(
  source,
  /membership.parentPersonId[\s\S]*parentPersonId/,
  'Los Participantes deben resolverse por parentPersonId canónico.'
);


assert.match(
  source,
  /accountUid:[\s\S]*null/,
  'La respuesta debe admitir personas sin cuenta digital.'
);




/*
 * ADMIN TÉCNICO
 *
 * No requiere personId territorial propio.
 * Su autoridad debe provenir exclusivamente de
 * adminCampaignAccess explícito para la campaña.
 */
for (
  const expected of [
    'adminCampaignAccessDocumentPath',
    'adminCanAccessCampaign',
    'adminAccessRecord',
    "actorProfile.role ===",
    "'admin'"
  ]
) {

  assert.ok(
    source.includes(
      expected
    ),
    `Falta contrato de acceso administrativo: ${expected}`
  );
}


const adminBranchPosition =
  source.indexOf(
    "actorProfile.role ==="
  );

const canonicalActorPosition =
  source.indexOf(
    "resolveCanonicalPersonForAccount({",
    source.indexOf(
      "exports.getParticipantManagementContext"
    )
  );

assert.notEqual(
  adminBranchPosition,
  -1,
  'Debe existir una rama explícita para Admin técnico.'
);

assert.notEqual(
  canonicalActorPosition,
  -1,
  'Debe conservarse resolución canónica para actores territoriales.'
);

assert.ok(
  adminBranchPosition <
    canonicalActorPosition,
  'La autorización de Admin debe resolverse antes de exigir identidad territorial al actor.'
);


assert.ok(
  source.includes(
    "adminCampaignAccessDocumentPath("
  ),
  'El Admin debe consultar la ruta canónica adminCampaignAccess.'
);


assert.ok(
  source.includes(
    "adminCanAccessCampaign({"
  ),
  'El Admin debe validarse mediante la política central de campaña.'
);


console.log(
  'OK: participant management person-centric contract passed.'
);
