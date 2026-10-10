"use strict";

const {
  evaluateSmartAssignmentDescendant
} = require("./mission-smart-assignment-policy.cjs");

const {
  evaluateMissionAssigneeEligibility
} = require("./mission-assignee-eligibility.cjs");

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * B8.2: seleccion pura sobre datos ya recuperados
 * y verificados por una futura capa de servidor.
 *
 * No consulta Firestore.
 * No confia en cadenas enviadas por el navegador.
 * No invita, acepta ni asigna misiones.
 */
function discoverSmartAssignmentCandidates({
  campaignId,
  actorMembership,
  activityCode,
  candidates,
  complete
} = {}) {
  if (!Array.isArray(candidates)) {
    return Object.freeze({
      ok: false,
      reason: "invalid-candidate-set",
      eligible: []
    });
  }

  // Un conjunto incompleto nunca puede autorizar
  // un listado aparentemente definitivo.
  if (complete !== true) {
    return Object.freeze({
      ok: false,
      reason: "incomplete-candidate-set",
      eligible: []
    });
  }

  // Detectar identidades contradictorias antes de filtrar.
  // Los duplicados identicos son tolerados.
  const fingerprints = new Map();

  for (const candidate of candidates) {
    const personId = clean(candidate?.membership?.personId);

    if (!personId) {
      continue;
    }

    const normalize = value => {
      if (Array.isArray(value)) {
        return value.map(normalize);
      }

      if (value && typeof value === "object") {
        return Object.fromEntries(
          Object.keys(value)
            .sort()
            .map(key => [key, normalize(value[key])])
        );
      }

      return value;
    };

    const fingerprint = JSON.stringify(normalize({
      membership: candidate?.membership,
      person: candidate?.person,
      lineage: candidate?.lineage
    }));

    if (
      fingerprints.has(personId) &&
      fingerprints.get(personId) !== fingerprint
    ) {
      return Object.freeze({
        ok: false,
        reason: "conflicting-candidate-identity",
        eligible: []
      });
    }

    fingerprints.set(personId, fingerprint);
  }

  const eligible = [];
  const seen = new Set();

  for (const candidate of candidates) {
    const membership = candidate?.membership;
    const person = candidate?.person;
    const lineage = candidate?.lineage;

    const authorization =
      evaluateSmartAssignmentDescendant({
        campaignId,
        actorMembership,
        targetMembership: membership,
        lineage
      });

    if (!authorization.authorized) {
      continue;
    }

    const personId = clean(membership?.personId);

    if (
      !personId ||
      seen.has(personId) ||
      !person ||
      clean(person.personId) !== personId ||
      person.campaignId !== campaignId ||
      person.active === false
    ) {
      continue;
    }

    const membershipUid = clean(membership.accountUid);
    const personUid = clean(person.accountUid);

    if (
      membershipUid &&
      personUid &&
      membershipUid !== personUid
    ) {
      continue;
    }

    const accountUid = membershipUid || personUid || null;

    const eligibility =
      evaluateMissionAssigneeEligibility({
        activityCode,
        activityPreferences: membership.activityPreferences,
        hasDigitalAccount: Boolean(accountUid)
      });

    if (!eligibility.eligible) {
      continue;
    }

    seen.add(personId);

    eligible.push({
      personId,
      name: clean(person.name) || "Sin nombre",
      role: membership.role,
      municipalityId: membership.municipalityId,
      structureId: membership.structureId,
      hasDigitalAccount: Boolean(accountUid),
      preferenceSelected:
        eligibility.preferenceSelected === true
    });
  }

  eligible.sort((a, b) =>
    a.name.localeCompare(b.name, "es") ||
    a.personId.localeCompare(b.personId)
  );

  return Object.freeze({
    ok: true,
    activityCode,
    eligible
  });
}

module.exports = {
  discoverSmartAssignmentCandidates
};