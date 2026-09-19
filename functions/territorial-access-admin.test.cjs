const assert = require('node:assert/strict');

const {
  _test: {
    managerProfileValid,
    validateGrantInput
  }
} = require('./territorial-access-admin.cjs');

function expectHttpsError(fn, code) {
  let error = null;

  try {
    fn();
  } catch (e) {
    error = e;
  }

  assert.ok(error, `Se esperaba error ${code}.`);
  assert.equal(error.code, code);
}

assert.equal(
  managerProfileValid(
    {
      active: true,
      role: 'admin',
      campaignId: 'CAM-001'
    },
    'CAM-001'
  ),
  true
);

assert.equal(
  managerProfileValid(
    {
      active: true,
      role: 'lider_principal',
      campaignId: 'CAM-001'
    },
    'CAM-001'
  ),
  true
);

assert.equal(
  managerProfileValid(
    {
      active: true,
      role: 'coordinador_municipal',
      campaignId: 'CAM-001'
    },
    'CAM-001'
  ),
  false
);

assert.equal(
  managerProfileValid(
    {
      active: false,
      role: 'admin',
      campaignId: 'CAM-001'
    },
    'CAM-001'
  ),
  false
);

assert.equal(
  managerProfileValid(
    {
      active: true,
      role: 'admin',
      campaignId: 'CAM-999'
    },
    'CAM-001'
  ),
  false
);

const demo = validateGrantInput({
  uid: 'UID-001',
  mode: 'demo',
  scopeType: 'municipality',
  municipalityId: 'MUN-001',
  permissions: ['read', 'write', 'read', 'otro'],
  durationMinutes: 45,
  reason: 'Demostración comercial'
});

assert.equal(demo.uid, 'UID-001');
assert.equal(demo.mode, 'demo');
assert.equal(demo.scopeType, 'municipality');
assert.equal(demo.municipalityId, 'MUN-001');
assert.deepEqual(demo.permissions, ['read', 'write']);
assert.equal(demo.durationMinutes, 45);

const operational = validateGrantInput({
  uid: 'UID-002',
  mode: 'operational',
  scopeType: 'structure',
  municipalityId: 'MUN-001',
  structureId: 'EST-001',
  permissions: ['read', 'write'],
  durationMinutes: 480
});

assert.equal(operational.mode, 'operational');
assert.equal(operational.structureId, 'EST-001');

expectHttpsError(
  () => validateGrantInput({
    uid: '',
    mode: 'demo',
    scopeType: 'campaign',
    permissions: ['read'],
    durationMinutes: 30
  }),
  'invalid-argument'
);

expectHttpsError(
  () => validateGrantInput({
    uid: 'UID-001',
    mode: 'otro',
    scopeType: 'campaign',
    permissions: ['read'],
    durationMinutes: 30
  }),
  'invalid-argument'
);

expectHttpsError(
  () => validateGrantInput({
    uid: 'UID-001',
    mode: 'demo',
    scopeType: 'municipality',
    permissions: ['read'],
    durationMinutes: 30
  }),
  'invalid-argument'
);

expectHttpsError(
  () => validateGrantInput({
    uid: 'UID-001',
    mode: 'demo',
    scopeType: 'campaign',
    permissions: [],
    durationMinutes: 30
  }),
  'invalid-argument'
);

expectHttpsError(
  () => validateGrantInput({
    uid: 'UID-001',
    mode: 'demo',
    scopeType: 'campaign',
    permissions: ['read'],
    durationMinutes: 4
  }),
  'invalid-argument'
);

expectHttpsError(
  () => validateGrantInput({
    uid: 'UID-001',
    mode: 'demo',
    scopeType: 'campaign',
    permissions: ['read'],
    durationMinutes: 1441
  }),
  'invalid-argument'
);

console.log(
  'OK: BUILD-119A1B territorial access administration contract passed.'
);
