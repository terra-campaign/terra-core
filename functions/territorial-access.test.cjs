const assert = require('node:assert/strict');
const {
  evaluateTerritorialGrant,
  normalizeGrant,
  territorialRecordMetadata
} = require('./territorial-access.cjs');

const NOW = Date.UTC(2026, 8, 19, 12, 0, 0);

function grant(overrides = {}) {
  return {
    grantId: 'TAG-001',
    uid: 'UID-001',
    personId: 'PER-001',
    campaignId: 'CAM-001',
    mode: 'operational',
    scopeType: 'municipality',
    municipalityId: 'MUN-001',
    permissions: ['read', 'write'],
    active: true,
    startsAt: NOW - 60_000,
    expiresAt: NOW + 60_000,
    grantedBy: 'UID-ADMIN',
    reason: 'Operación territorial',
    ...overrides
  };
}

assert.equal(
  evaluateTerritorialGrant({
    grant: grant(),
    uid: 'UID-001',
    campaignId: 'CAM-001',
    permission: 'read',
    nowMs: NOW,
    resource: {municipalityId:'MUN-001'}
  }).allowed,
  true
);

assert.equal(
  evaluateTerritorialGrant({
    grant: grant({mode:'demo'}),
    uid: 'UID-001',
    campaignId: 'CAM-001',
    permission: 'write',
    nowMs: NOW,
    resource: {municipalityId:'MUN-001'}
  }).allowed,
  true
);

assert.equal(
  evaluateTerritorialGrant({
    grant: grant({expiresAt:NOW}),
    uid: 'UID-001',
    campaignId: 'CAM-001',
    permission: 'read',
    nowMs: NOW,
    resource: {municipalityId:'MUN-001'}
  }).reason,
  'expired'
);

assert.equal(
  evaluateTerritorialGrant({
    grant: grant({revokedAt:NOW - 1}),
    uid: 'UID-001',
    campaignId: 'CAM-001',
    permission: 'read',
    nowMs: NOW,
    resource: {municipalityId:'MUN-001'}
  }).reason,
  'revoked'
);

assert.equal(
  evaluateTerritorialGrant({
    grant: grant(),
    uid: 'UID-001',
    campaignId: 'CAM-001',
    permission: 'read',
    nowMs: NOW,
    resource: {municipalityId:'MUN-999'}
  }).reason,
  'outside-scope'
);

assert.equal(
  evaluateTerritorialGrant({
    grant: grant({personId:''}),
    uid: 'UID-001',
    campaignId: 'CAM-001',
    permission: 'read',
    nowMs: NOW,
    resource: {municipalityId:'MUN-001'}
  }).reason,
  'missing-person'
);

assert.equal(
  evaluateTerritorialGrant({
    grant: grant({permissions:['read']}),
    uid: 'UID-001',
    campaignId: 'CAM-001',
    permission: 'write',
    nowMs: NOW,
    resource: {municipalityId:'MUN-001'}
  }).reason,
  'missing-permission'
);

assert.equal(
  normalizeGrant(
    grant({permissions:['read','read','write','otro']})
  ).permissions.join(','),
  'read,write'
);


assert.equal(
  evaluateTerritorialGrant({
    grant: grant(),
    uid: 'UID-001',
    campaignId: 'CAM-001',
    permission: 'read',
    nowMs: NOW
  }).allowed,
  true,
  'Un grant municipal vigente debe poder validarse antes de evaluar un recurso concreto.'
);

assert.equal(
  evaluateTerritorialGrant({
    grant: grant(),
    uid: 'UID-001',
    campaignId: 'CAM-001',
    permission: 'read',
    nowMs: NOW,
    resource: {municipalityId:'MUN-999'}
  }).reason,
  'outside-scope',
  'El mismo grant debe bloquear recursos fuera de su municipio.'
);


const demoMetadata = territorialRecordMetadata(
  grant({mode:'demo'})
);

assert.equal(demoMetadata.territorialGrantId, 'TAG-001');
assert.equal(demoMetadata.territorialPersonId, 'PER-001');
assert.equal(demoMetadata.recordMode, 'demo');
assert.equal(demoMetadata.productionEligible, false);
assert.equal(demoMetadata.municipalityId, 'MUN-001');

const operationalMetadata = territorialRecordMetadata(
  grant({mode:'operational'})
);

assert.equal(operationalMetadata.recordMode, 'production');
assert.equal(operationalMetadata.productionEligible, true);

assert.equal(
  territorialRecordMetadata(
    grant({grantId:''})
  ),
  null
);

console.log('OK: BUILD-119A1 territorial access grant contract passed.');
