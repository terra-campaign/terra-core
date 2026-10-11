"use strict";

const {
  canonicalMembershipDocumentId
} = require("./territorial-membership-id.cjs");

const {
  evaluateSmartAssignmentDescendant
} = require("./mission-smart-assignment-policy.cjs");

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * B8.3 - Reconstruccion jerarquica desde Firestore.
 *
 * No acepta cadenas proporcionadas por el navegador.
 * No crea asignaciones ni modifica documentos.
 * La autorizacion definitiva corresponde a B8.1.
 */
async function loadSmartAssignmentLineage({
  db,
  campaignId,
  actorMembership,
  targetMembership,
  tx
} = {}) {
  const actorId = clean(actorMembership?.personId);
  const targetId = clean(targetMembership?.personId);

  if (
    !db ||
    typeof db.collection !== "function" ||
    !clean(campaignId) ||
    !actorId ||
    !targetId ||
    actorId === targetId
  ) {
    return {
      authorized: false,
      reason: "invalid-lineage-request",
      lineage: []
    };
  }

  const lineage = [];
  const seen = new Set();

  let currentId = targetId;

  while (currentId && lineage.length < 5) {
    if (seen.has(currentId)) {
      return {
        authorized: false,
        reason: "cyclic-lineage",
        lineage: []
      };
    }

    seen.add(currentId);

    let membershipId;

    try {
      membershipId = canonicalMembershipDocumentId(
        campaignId,
        currentId
      );
    } catch {
      return {
        authorized: false,
        reason: "invalid-canonical-membership",
        lineage: []
      };
    }

    const membershipRef = db
      .collection("territorialMemberships")
      .doc(membershipId);

    const snapshot = await (
      tx ? tx.get(membershipRef) : membershipRef.get()
    );

    if (!snapshot.exists) {
      return {
        authorized: false,
        reason: "missing-lineage-membership",
        lineage: []
      };
    }

    const membership = {
      ...snapshot.data(),
      membershipId: snapshot.id
    };

    if (
      membership.personId !== currentId ||
      membership.campaignId !== campaignId ||
      membership.active !== true
    ) {
      return {
        authorized: false,
        reason: "invalid-lineage-membership",
        lineage: []
      };
    }

    // La membresia encontrada por la consulta debe coincidir
    // con el documento canonico recuperado desde Firestore.
    if (currentId === targetId) {
      const fields = [
        "membershipId",
        "personId",
        "campaignId",
        "role",
        "parentPersonId",
        "municipalityId",
        "structureId",
        "active",
        "accountUid"
      ];

      const sameFields = fields.every(
        field => membership[field] === targetMembership[field]
      );

      const readAncestors = membership.ancestorPersonIds;
      const queryAncestors = targetMembership.ancestorPersonIds;

      const sameAncestors =
        Array.isArray(readAncestors) &&
        Array.isArray(queryAncestors) &&
        readAncestors.length === queryAncestors.length &&
        readAncestors.every(
          (value, index) => value === queryAncestors[index]
        );

      if (!sameFields || !sameAncestors) {
        return {
          authorized: false,
          reason: "membership-query-mismatch",
          lineage: []
        };
      }
    }

    lineage.push(membership);

    if (currentId === actorId) {
      const authorization =
        evaluateSmartAssignmentDescendant({
          campaignId,
          actorMembership,
          targetMembership,
          lineage
        });

      return {
        authorized: authorization.authorized,
        reason: authorization.reason,
        lineage: authorization.authorized
          ? lineage
          : []
      };
    }

    currentId = clean(membership.parentPersonId);
  }

  return {
    authorized: false,
    reason: "incomplete-lineage",
    lineage: []
  };
}

module.exports = {
  loadSmartAssignmentLineage
};
