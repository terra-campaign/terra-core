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


const {
  invitationView
} =
  require(
    './event-delegation.cjs'
  )._test;


const source =
  fs.readFileSync(
    path.join(
      __dirname,
      'event-delegation.cjs'
    ),
    'utf8'
  );


// ======================================================
// INVITACION CANONICA
// ======================================================

const canonical =
  invitationView({

    id:
      'INV-CANONICAL',

    data() {

      return {

        eventId:
          'EVENT-1',

        active:
          true,

        assignedTo:
          'ACCOUNT-1',

        accountUid:
          'ACCOUNT-1',

        personId:
          'PERSON-1',

        assignedToName:
          'Persona uno',

        assignedToRole:
          'colaborador_base',

        version:
          1
      };
    }
  });


assert.equal(
  canonical.personId,
  'PERSON-1'
);


assert.equal(
  canonical.accountUid,
  'ACCOUNT-1'
);


assert.equal(
  canonical.assignedTo,
  'ACCOUNT-1'
);


// ======================================================
// INVITACION LEGADA
//
// assignedTo NO puede disfrazarse como personId.
// ======================================================

const legacy =
  invitationView({

    id:
      'INV-LEGACY',

    data() {

      return {

        eventId:
          'EVENT-1',

        active:
          true,

        assignedTo:
          'ACCOUNT-LEGACY',

        assignedToName:
          'Persona legado',

        assignedToRole:
          'participante',

        version:
          1
      };
    }
  });


assert.equal(
  legacy.personId,
  ''
);


assert.equal(
  legacy.accountUid,
  'ACCOUNT-LEGACY'
);


// ======================================================
// CONTRATO ESTATICO
// ======================================================

assert.match(
  source,
  /personId:\s*targetIdentity\.personId/
);


assert.match(
  source,
  /accountUid:\s*uid/
);


assert.match(
  source,
  /resolveInvitationCanonicalIdentity\(\s*tx,\s*db,\s*invitation,\s*validator\.campaignId/
);


assert.match(
  source,
  /resolveDigitalCanonicalIdentity\(\s*tx,\s*db,\s*\{\s*accountUid:\s*identity\.id/
);


// El backend productivo ya no debe contener el antiguo
// personId = invitation.personId || invitation.assignedTo.
assert.doesNotMatch(
  source,
  /invitation\.personId\s*\|\|\s*invitation\.assignedTo/
);



// =========================================================
// B3D1A — RESPUESTA DE EVENTO CON IDENTIDAD CANONICA
// =========================================================

const responseCanonicalStart =
  source.indexOf(
    'exports.respondToEventInvitation ='
  );

const responseCanonicalEnd =
  source.indexOf(
    '// BUILD-118B-3C-1',
    responseCanonicalStart
  );

assert.notEqual(
  responseCanonicalStart,
  -1,
  'Debe existir respondToEventInvitation.'
);

assert.notEqual(
  responseCanonicalEnd,
  -1,
  'Debe existir el final de respondToEventInvitation.'
);

const responseCanonicalBlock =
  source.slice(
    responseCanonicalStart,
    responseCanonicalEnd
  );

assert.match(
  responseCanonicalBlock,
  /resolveInvitationCanonicalIdentity\s*\(/,
  'La respuesta debe resolver identidad canónica.'
);

assert.equal(
  (
    responseCanonicalBlock.match(
      /personId:\s*profile\.uid/g
    ) || []
  ).length,
  0,
  'No debe usarse UID como personId.'
);

assert.equal(
  (
    responseCanonicalBlock.match(
      /personId,\s*accountUid,/g
    ) || []
  ).length,
  2,
  'eventResponses e historial deben guardar personId + accountUid.'
);

assert.match(
  responseCanonicalBlock,
  /canonicalIdentity\.accountUid\s*!==\s*profile\.uid/,
  'Debe verificarse la correspondencia con la cuenta autenticada.'
);

console.log(
  'OK: BUILD-118C-3B3E-3G-B3D1A canonical event response identity passed.'
);


console.log(
  'OK: BUILD-118C-3B3E-3G-B3D1 canonical event identity tests passed.'
);
