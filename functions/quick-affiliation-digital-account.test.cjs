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
      'quick-affiliation.cjs'
    ),
    'utf8'
  );

const start =
  source.indexOf(
    'exports.createQuickAffiliation ='
  );

const end =
  source.indexOf(
    'exports.getMyQuickAffiliations ='
  );

assert.notEqual(
  start,
  -1,
  'Debe existir createQuickAffiliation.'
);

assert.notEqual(
  end,
  -1,
  'Debe poder aislarse createQuickAffiliation.'
);

const block =
  source.slice(
    start,
    end
  );

assert.match(
  source,
  /getAuth/,
  'quick-affiliation debe disponer de Firebase Auth.'
);

assert.match(
  block,
  /createDigitalAccount/,
  'El alta rápida debe aceptar createDigitalAccount.'
);

assert.match(
  block,
  /data\.email/,
  'Debe recibir correo electrónico.'
);

assert.match(
  block,
  /data\.password/,
  'Debe recibir contraseña temporal.'
);

assert.match(
  block,
  /if\s*\(\s*createDigitalAccount\s*\)[\s\S]*?auth\.createUser\s*\(\s*\{/,
  'Firebase Auth solo debe crearse cuando se solicita cuenta digital.'
);

assert.match(
  block,
  /\.collection\(\s*['"]usuarios['"]\s*\)/,
  'Debe crear usuarios/{uid} cuando exista cuenta digital.'
);

assert.match(
  block,
  /accountUid:\s*authUser\s*\?\s*authUser\.uid\s*:\s*null/,
  'La persona y membresía deben admitir accountUid opcional.'
);

assert.match(
  block,
  /identityStatus:\s*createDigitalAccount\s*\?\s*['"]digital['"]\s*:\s*['"]minimal['"]/,
  'identityStatus debe distinguir identidad digital y mínima.'
);

assert.match(
  block,
  /mustChangePassword:\s*createDigitalAccount/,
  'La cuenta nueva debe exigir cambio de contraseña cuando corresponda.'
);

assert.match(
  block,
  /if\s*\(\s*authUser(?:\?\.uid)?\s*\)[\s\S]*?auth\.deleteUser/,
  'Debe existir rollback de Firebase Auth si falla el guardado.'
);

console.log(
  'OK: cuenta digital opcional en afiliación rápida validada.'
);