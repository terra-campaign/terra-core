'use strict';

const assert =
  require(
    'node:assert/strict'
  );

const fs =
  require(
    'node:fs'
  );

const source =
  fs.readFileSync(
    './mision.js',
    'utf8'
  );

assert.match(
  source,
  /function\s+validateMissionModuleAccess\s*\(/
);

assert.match(
  source,
  /"apoyo_territorial"/
);

assert.match(
  source,
  /allowedRoles\.includes\s*\(\s*profile\.role\s*\)/
);

console.log(
  'OK: apoyo_territorial tiene acceso al modulo de mision.'
);
