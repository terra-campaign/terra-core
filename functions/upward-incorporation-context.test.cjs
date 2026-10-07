'use strict';

const fs =
  require('node:fs');

const path =
  require('node:path');

const assert =
  require('node:assert/strict');

const modulePath =
  path.join(
    __dirname,
    'upward-incorporation.cjs'
  );

const source =
  fs.readFileSync(
    modulePath,
    'utf8'
  );


// ======================================================
// CONTEXTO OPERATIVO
// ======================================================

assert.match(
  source,
  /getUpwardIncorporationContext/,
  'Debe existir getUpwardIncorporationContext.'
);

assert.match(
  source,
  /allowedUpwardRolesFor/,
  'El contexto debe usar la política de roles permitidos.'
);

assert.match(
  source,
  /requiredParentRoleFor/,
  'El contexto debe resolver el rol jerárquico requerido.'
);

assert.match(
  source,
  /territorialMemberships/,
  'Los responsables deben resolverse desde membresías territoriales.'
);

assert.match(
  source,
  /parentCandidates/,
  'El contexto debe devolver candidatos de padre jerárquico.'
);

assert.match(
  source,
  /personId/,
  'Cada candidato debe exponer personId canónico.'
);

assert.match(
  source,
  /apoyo_territorial/,
  'Solo Apoyo Territorial debe utilizar este contexto.'
);


console.log(
  'OK: contrato de contexto de incorporación ascendente validado.'
);