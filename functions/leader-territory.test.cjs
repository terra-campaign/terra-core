const assert = require('node:assert/strict');
const fs = require('node:fs');

const {
  _test: {
    recordModeForGrant,
    territoryQuery,
    visitAllowedByGrant
  }
} = require('./leader-territory.cjs');

const NOW = Date.UTC(2026, 8, 19, 5, 45, 0);

function grant(overrides = {}) {
  return {
    grantId: 'TAG-001',
    uid: 'UID-001',
    personId: 'PER-001',
    campaignId: 'CAM-001',
    mode: 'demo',
    scopeType: 'municipality',
    municipalityId: 'MUN-001',
    structureId: '',
    brigadeId: '',
    permissions: ['read', 'write'],
    active: true,
    startsAt: NOW - 60_000,
    expiresAt: NOW + 60_000,
    revokedAt: null,
    ...overrides
  };
}

assert.equal(
  recordModeForGrant(grant({mode:'demo'})),
  'demo'
);

assert.equal(
  recordModeForGrant(grant({mode:'operational'})),
  'production'
);

assert.equal(
  visitAllowedByGrant(
    grant(),
    'UID-001',
    'CAM-001',
    {
      municipalityId:'MUN-001'
    },
    NOW
  ),
  true,
  'Grant vigente debe permitir visita dentro del municipio.'
);

assert.equal(
  visitAllowedByGrant(
    grant(),
    'UID-001',
    'CAM-001',
    {
      municipalityId:'MUN-999'
    },
    NOW
  ),
  false,
  'Grant municipal debe bloquear otro municipio.'
);

assert.equal(
  visitAllowedByGrant(
    grant({
      expiresAt: NOW
    }),
    'UID-001',
    'CAM-001',
    {
      municipalityId:'MUN-001'
    },
    NOW
  ),
  false,
  'Grant vencido debe bloquear lectura.'
);

function fakeDb() {
  const filters = [];

  const q = {
    where(field, operator, value) {
      filters.push([field, operator, value]);
      return this;
    }
  };

  return {
    filters,
    collection(name) {
      assert.equal(name, 'visitas');
      return q;
    }
  };
}

{
  const db = fakeDb();

  territoryQuery(
    db,
    'CAM-001',
    grant({
      mode:'demo'
    })
  );

  assert.deepEqual(
    db.filters,
    [
      ['campaignId','==','CAM-001'],
      ['recordMode','==','demo'],
      ['municipalityId','==','MUN-001']
    ]
  );
}

{
  const db = fakeDb();

  territoryQuery(
    db,
    'CAM-001',
    grant({
      mode:'operational',
      scopeType:'campaign',
      municipalityId:''
    })
  );

  assert.deepEqual(
    db.filters,
    [
      ['campaignId','==','CAM-001'],
      ['recordMode','==','production']
    ]
  );
}

const source = fs.readFileSync(
  require.resolve('./leader-territory.cjs'),
  'utf8'
);

assert.match(
  source,
  /territorialAccessGrants\/\$\{uid\}/,
  'El callable debe cargar el grant del usuario.'
);

assert.match(
  source,
  /No existe autorización territorial vigente/,
  'El callable debe rechazar ausencia de grant.'
);

assert.match(
  source,
  /permission:'read'/,
  'El callable debe exigir permiso de lectura.'
);

assert.match(
  source,
  /recordModeForGrant/,
  'La consulta territorial debe separar demo de producción.'
);

console.log(
  'OK: BUILD-119A2 secure territorial read barrier passed.'
);
