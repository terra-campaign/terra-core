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
// CUENTA DIGITAL OBLIGATORIA
// ======================================================

assert.match(
  source,
  /createDigitalAccount/,
  'El motor debe recibir explícitamente createDigitalAccount.'
);

assert.match(
  source,
  /data\.createDigitalAccount\s*!==\s*true/,
  'El backend debe rechazar cualquier incorporación que no declare createDigitalAccount === true.'
);

assert.match(
  source,
  /requiresOwnDigitalAccount/,
  'Debe conservarse la política canónica de cuenta digital obligatoria.'
);

assert.match(
  source,
  /createUser/,
  'La incorporación ascendente debe crear una cuenta Auth propia.'
);

assert.match(
  source,
  /accountUid/,
  'La persona y membresía deben quedar vinculadas a su cuenta digital.'
);

assert.match(
  source,
  /deleteUser/,
  'Debe conservarse rollback de Auth si falla la persistencia.'
);


console.log(
  'OK: contrato de cuenta digital obligatoria validado.'
);