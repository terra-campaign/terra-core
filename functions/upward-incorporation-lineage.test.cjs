'use strict';

const fs =
  require('node:fs');

const path =
  require('node:path');

const assert =
  require('node:assert/strict');

const source =
  fs.readFileSync(
    path.join(
      __dirname,
      'upward-incorporation.cjs'
    ),
    'utf8'
  );


// ======================================================
// SEGURIDAD DE LÍNEA JERÁRQUICA
// ======================================================

assert.match(
  source,
  /ancestorPersonIds/,
  'La incorporación ascendente debe usar la línea canónica del incorporador.'
);

assert.match(
  source,
  /isParentInIntroducerLineage/,
  'Debe existir una validación explícita del padre dentro de la línea del incorporador.'
);

assert.match(
  source,
  /parentPersonId/,
  'La autorización debe validar el parentPersonId solicitado.'
);

assert.match(
  source,
  /requiredParentRoleFor/,
  'La autorización debe conservar la validación del rol jerárquico requerido.'
);

assert.match(
  source,
  /parentCandidates/,
  'El contexto debe devolver únicamente candidatos autorizados.'
);


console.log(
  'OK: contrato de seguridad por línea jerárquica validado.'
);