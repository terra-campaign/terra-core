const MODES = new Set(['operational', 'demo']);
const SCOPE_TYPES = new Set(['campaign', 'municipality', 'structure', 'brigade']);

const text = value =>
  typeof value === 'string' ? value.trim() : '';

function toMillis(value) {
  if (!value) return NaN;

  if (typeof value.toMillis === 'function') {
    return value.toMillis();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === 'number') {
    return value;
  }

  return NaN;
}

function normalizePermissions(value) {
  if (!Array.isArray(value)) return [];

  return [...new Set(
    value
      .map(text)
      .filter(permission =>
        permission === 'read' ||
        permission === 'write'
      )
  )];
}

function normalizeGrant(grant = {}) {
  return {
    grantId: text(grant.grantId),
    uid: text(grant.uid),
    personId: text(grant.personId),
    campaignId: text(grant.campaignId),
    mode: text(grant.mode),
    scopeType: text(grant.scopeType),
    municipalityId: text(grant.municipalityId),
    structureId: text(grant.structureId),
    brigadeId: text(grant.brigadeId),
    permissions: normalizePermissions(grant.permissions),
    active: grant.active === true,
    startsAtMs: toMillis(grant.startsAt),
    expiresAtMs: toMillis(grant.expiresAt),
    revokedAtMs: toMillis(grant.revokedAt),
    grantedBy: text(grant.grantedBy),
    reason: text(grant.reason)
  };
}

function grantScopeValid(grant) {
  if (!SCOPE_TYPES.has(grant.scopeType)) {
    return false;
  }

  if (grant.scopeType === 'campaign') {
    return true;
  }

  if (grant.scopeType === 'municipality') {
    return Boolean(grant.municipalityId);
  }

  if (grant.scopeType === 'structure') {
    return Boolean(grant.municipalityId && grant.structureId);
  }

  if (grant.scopeType === 'brigade') {
    return Boolean(grant.brigadeId);
  }

  return false;
}


function territorialRecordMetadata(grant = {}) {
  const g = normalizeGrant(grant);

  if (
    !g.grantId ||
    !g.uid ||
    !g.personId ||
    !g.campaignId ||
    !MODES.has(g.mode)
  ) {
    return null;
  }

  return {
    territorialGrantId: g.grantId,
    territorialGrantMode: g.mode,
    territorialPersonId: g.personId,
    recordMode: g.mode === 'demo'
      ? 'demo'
      : 'production',
    productionEligible: g.mode === 'operational',
    municipalityId: g.municipalityId || null,
    structureId: g.structureId || null,
    brigadeId: g.brigadeId || null
  };
}

function evaluateTerritorialGrant({
  grant,
  uid,
  campaignId,
  permission,
  nowMs = Date.now(),
  resource = null
} = {}) {
  const g = normalizeGrant(grant);

  if (!g.active) {
    return {allowed:false, reason:'inactive'};
  }

  if (!g.uid || g.uid !== text(uid)) {
    return {allowed:false, reason:'wrong-user'};
  }

  if (!g.personId) {
    return {allowed:false, reason:'missing-person'};
  }

  if (!g.campaignId || g.campaignId !== text(campaignId)) {
    return {allowed:false, reason:'wrong-campaign'};
  }

  if (!MODES.has(g.mode)) {
    return {allowed:false, reason:'invalid-mode'};
  }

  if (!grantScopeValid(g)) {
    return {allowed:false, reason:'invalid-scope'};
  }

  if (!g.permissions.includes(permission)) {
    return {allowed:false, reason:'missing-permission'};
  }

  if (!Number.isFinite(g.startsAtMs) ||
      !Number.isFinite(g.expiresAtMs) ||
      g.startsAtMs >= g.expiresAtMs) {
    return {allowed:false, reason:'invalid-window'};
  }

  if (nowMs < g.startsAtMs) {
    return {allowed:false, reason:'not-started'};
  }

  if (nowMs >= g.expiresAtMs) {
    return {allowed:false, reason:'expired'};
  }

  if (Number.isFinite(g.revokedAtMs)) {
    return {allowed:false, reason:'revoked'};
  }

  if (resource) {
    if (
      g.scopeType === 'municipality' &&
      text(resource.municipalityId) !== g.municipalityId
    ) {
      return {allowed:false, reason:'outside-scope'};
    }

    if (
      g.scopeType === 'structure' &&
      (
        text(resource.municipalityId) !== g.municipalityId ||
        text(resource.structureId) !== g.structureId
      )
    ) {
      return {allowed:false, reason:'outside-scope'};
    }

    if (
      g.scopeType === 'brigade' &&
      text(resource.brigadeId) !== g.brigadeId
    ) {
      return {allowed:false, reason:'outside-scope'};
    }
  }

  return {
    allowed:true,
    reason:'authorized',
    grant:g
  };
}

module.exports = {
  MODES,
  SCOPE_TYPES,
  normalizeGrant,
  territorialRecordMetadata,
  evaluateTerritorialGrant,
  _test: {
    toMillis,
    normalizePermissions,
    grantScopeValid
  }
};
