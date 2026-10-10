"use strict";

const {
  canonicalMembershipDocumentId
} = require("./territorial-membership-id.cjs");

const {
  membershipMatchesSubject
} = require("./territorial-assistance-policy.cjs");

const DESCENDANT_ROLES = Object.freeze([
  "integrante",
  "participante",
  "colaborador_base",
  "apoyo_territorial"
]);

const NEXT_ROLE = Object.freeze({
  jefe_estructura: "integrante",
  integrante: "participante",
  participante: "colaborador_base",
  colaborador_base: "apoyo_territorial"
});

function clean(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function canonicalMembership(membership, campaignId) {
  const personId = clean(membership?.personId);

  if (!personId || !clean(campaignId)) {
    return false;
  }

  let expectedId;

  try {
    expectedId = canonicalMembershipDocumentId(
      campaignId,
      personId
    );
  } catch {
    return false;
  }

  return membershipMatchesSubject({
    membership,
    membershipId: clean(membership?.membershipId),
    campaignId,
    personId
  }) && clean(membership.membershipId) === expectedId;
}

/**
 * Evalua un camino jerarquico previamente cargado y
 * ordenado desde el candidato hacia el jefe.
 *
 * No consulta Firestore.
 * No concede permisos por ancestorPersonIds solamente.
 * No crea, invita ni asigna misiones.
 */
function evaluateSmartAssignmentDescendant({
  campaignId,
  actorMembership,
  targetMembership,
  lineage
} = {}) {
  const campaign = clean(campaignId);

  if (
    !canonicalMembership(actorMembership, campaign) ||
    !canonicalMembership(targetMembership, campaign)
  ) {
    return Object.freeze({
      authorized: false,
      reason: "invalid-membership"
    });
  }

  if (actorMembership.role !== "jefe_estructura") {
    return Object.freeze({
      authorized: false,
      reason: "actor-role-not-allowed"
    });
  }

  if (
    !DESCENDANT_ROLES.includes(targetMembership.role) ||
    !Array.isArray(lineage)
  ) {
    return Object.freeze({
      authorized: false,
      reason: "invalid-lineage"
    });
  }

  const actorId = clean(actorMembership.personId);
  const targetId = clean(targetMembership.personId);

  if (
    actorId === targetId ||
    !clean(actorMembership.municipalityId) ||
    !clean(actorMembership.structureId) ||
    targetMembership.municipalityId !==
      actorMembership.municipalityId ||
    targetMembership.structureId !==
      actorMembership.structureId
  ) {
    return Object.freeze({
      authorized: false,
      reason: "scope-mismatch"
    });
  }

  if (
    lineage.length < 2 ||
    lineage.length > 5 ||
    lineage[0]?.personId !== targetId ||
    lineage[lineage.length - 1]?.personId !== actorId
  ) {
    return Object.freeze({
      authorized: false,
      reason: "invalid-lineage"
    });
  }

  // Los extremos recibidos deben coincidir con la cadena
  // jerarquica previamente cargada desde datos confiables.
  function sameMembership(left, right) {
    if (!left || !right) {
      return false;
    }

    const fields = [
      "membershipId",
      "personId",
      "campaignId",
      "role",
      "parentPersonId",
      "municipalityId",
      "structureId",
      "active"
    ];

    if (
      fields.some(
        field => left[field] !== right[field]
      )
    ) {
      return false;
    }

    const leftAncestors = left.ancestorPersonIds;
    const rightAncestors = right.ancestorPersonIds;

    return (
      Array.isArray(leftAncestors) &&
      Array.isArray(rightAncestors) &&
      leftAncestors.length === rightAncestors.length &&
      leftAncestors.every(
        (value, index) => value === rightAncestors[index]
      )
    );
  }

  if (
    !sameMembership(targetMembership, lineage[0]) ||
    !sameMembership(
      actorMembership,
      lineage[lineage.length - 1]
    )
  ) {
    return Object.freeze({
      authorized: false,
      reason: "membership-lineage-mismatch"
    });
  }

  const seen = new Set();

  for (let index = 0; index < lineage.length; index++) {
    const current = lineage[index];
    const personId = clean(current?.personId);

    if (
      seen.has(personId) ||
      !canonicalMembership(current, campaign) ||
      current.municipalityId !==
        actorMembership.municipalityId ||
      current.structureId !==
        actorMembership.structureId
    ) {
      return Object.freeze({
        authorized: false,
        reason: "invalid-lineage"
      });
    }

    seen.add(personId);

    if (index + 1 < lineage.length) {
      const parent = lineage[index + 1];

      if (
        clean(current.parentPersonId) !==
          clean(parent.personId) ||
        NEXT_ROLE[parent.role] !== current.role
      ) {
        return Object.freeze({
          authorized: false,
          reason: "invalid-lineage"
        });
      }

      const ancestors = current.ancestorPersonIds;
      const parentAncestors = parent.ancestorPersonIds;

      const expectedAncestors = [
        clean(parent.personId),
        ...(Array.isArray(parentAncestors)
          ? parentAncestors.map(clean)
          : [])
      ];

      if (
        !Array.isArray(ancestors) ||
        !Array.isArray(parentAncestors) ||
        ancestors.length !== expectedAncestors.length ||
        ancestors.some(
          (value, position) =>
            clean(value) !== expectedAncestors[position]
        ) ||
        new Set(ancestors.map(clean)).size !== ancestors.length ||
        ancestors.includes(personId)
      ) {
        return Object.freeze({
          authorized: false,
          reason: "invalid-ancestry"
        });
      }
    }
  }

  return Object.freeze({
    authorized: true,
    reason: "authorized-descendant",
    personId: targetId,
    role: targetMembership.role
  });
}

module.exports = {
  DESCENDANT_ROLES,
  evaluateSmartAssignmentDescendant
};