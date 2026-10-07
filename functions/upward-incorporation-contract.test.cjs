'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const modulePath =
  path.join(
    __dirname,
    'upward-incorporation.cjs'
  );

assert.equal(
  fs.existsSync(modulePath),
  true,
  'Debe existir upward-incorporation.cjs'
);

const source =
  fs.readFileSync(
    modulePath,
    'utf8'
  );

assert.match(
  source,
  /createUpwardIncorporation/,
  'Debe exportar createUpwardIncorporation.'
);

assert.match(
  source,
  /apoyo_territorial/,
  'El actor autorizado debe ser Apoyo Territorial.'
);

assert.match(
  source,
  /allowedUpwardRolesFor/,
  'Debe usar la política canónica de roles permitidos.'
);

assert.match(
  source,
  /requiredParentRoleFor/,
  'Debe validar el rol del padre jerárquico.'
);

assert.match(
  source,
  /introducedByPersonId/,
  'Debe conservar al incorporador real.'
);

assert.match(
  source,
  /parentPersonId/,
  'Debe almacenar un padre jerárquico válido.'
);

assert.match(
  source,
  /createUser/,
  'Debe crear cuenta digital propia.'
);

assert.match(
  source,
  /canonicalMembershipDocumentId/,
  'Debe usar membresía canónica.'
);

assert.match(
  source,
  /canonicalChildAncestry/,
  'Debe calcular ancestry desde el padre real.'
);

assert.match(
  source,
  /deleteUser/,
  'Debe revertir Authentication si falla Firestore.'
);

assert.match(
  source,
  /UPWARD_INCORPORATION/,
  'Debe registrar auditoría específica de incorporación ascendente.'
);

console.log(
  'OK: contrato estático de incorporación ascendente validado.'
);