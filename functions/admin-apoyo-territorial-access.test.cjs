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
  'Apoyo Territorial debe ser un rol válido en admin.'
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

assert.match(
  organizationRolesMatch[0],
  /"apoyo_territorial"/,
  'Apoyo Territorial debe poder abrir Mi organización para incorporación ascendente.'
);


assert.match(
  source,
  /role === "apoyo_territorial"[\s\S]*?incorporacion-ascendente\.html/,
  'Mi organización de Apoyo Territorial debe dirigir a incorporación ascendente.'
);


assert.match(
  source,
  /case "apoyo_territorial"[\s\S]*?incorporacion-ascendente\.html/,
  'El switch de navegación debe soportar Apoyo Territorial.'
);


assert.match(
  source,
  /apoyo_territorial:\s*"Apoyo territorial"/,
  'Debe existir la etiqueta visual de Apoyo Territorial.'
);


console.log(
  'OK: acceso de Apoyo Territorial a Mi organización validado.'
);