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
      '..',
      'admin.js'
    ),
    'utf8'
  );

const allowedRolesMatch =
  source.match(
    /const allowedRoles = \[[\s\S]*?\];/
  );

assert.ok(
  allowedRolesMatch,
  'Debe existir allowedRoles en admin.js.'
);

assert.match(
  allowedRolesMatch[0],
  /"apoyo_territorial"/,
  'Apoyo Territorial debe ser un rol válido en admin.html.'
);

const missionRolesMatch =
  source.match(
    /const canAccessMissions = \[[\s\S]*?\]\.includes\(role\);/
  );

assert.ok(
  missionRolesMatch,
  'Debe existir canAccessMissions.'
);

assert.match(
  missionRolesMatch[0],
  /"apoyo_territorial"/,
  'Apoyo Territorial debe tener acceso a Misiones.'
);

const eventRolesMatch =
  source.match(
    /const canAccessEvents = \[[\s\S]*?\]\.includes\(role\);/
  );

assert.ok(
  eventRolesMatch,
  'Debe existir canAccessEvents.'
);

assert.match(
  eventRolesMatch[0],
  /"apoyo_territorial"/,
  'Apoyo Territorial debe tener acceso a Eventos.'
);

const organizationRolesMatch =
  source.match(
    /const canAccessOrganization = \[[\s\S]*?\]\.includes\(role\);/
  );

assert.ok(
  organizationRolesMatch,
  'Debe existir canAccessOrganization.'
);

assert.doesNotMatch(
  organizationRolesMatch[0],
  /"apoyo_territorial"/,
  'Apoyo Territorial debe seguir siendo terminal y no abrir Mi organización.'
);

assert.match(
  source,
  /apoyo_territorial:\s*"Apoyo territorial"/,
  'Debe existir la etiqueta visual de Apoyo Territorial.'
);

console.log(
  'OK: contrato de acceso del Apoyo Territorial en admin validado.'
);