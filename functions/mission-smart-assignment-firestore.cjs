"use strict";

const {
  canonicalMembershipDocumentId
} = require("./territorial-membership-id.cjs");

const DEFAULT_MAX_CANDIDATES = 1000;

function validId(value) {
  return (
    typeof value === "string" &&
    value.trim() === value &&
    value.length > 0 &&
    value.length <= 128 &&
    !value.includes("/")
  );
}

/**
 * B8.3 - Consulta interna de posibles descendientes.
 *
 * Los identificadores deben provenir del servidor
 * y de una identidad autenticada.
 *
 * ancestorPersonIds solo permite descubrir candidatos.
 * B8.1 debe autorizar cada cadena jerarquica.
 */
async function querySmartAssignmentDescendantMemberships({
  db,
  campaignId,
  actorPersonId,
  tx,
  maxCandidates = DEFAULT_MAX_CANDIDATES
} = {}) {

  if (
    !db ||
    typeof db.collection !== "function" ||
    !validId(campaignId) ||
    !validId(actorPersonId) ||
    !Number.isInteger(maxCandidates) ||
    maxCandidates < 1 ||
    maxCandidates > DEFAULT_MAX_CANDIDATES
  ) {
    throw new TypeError(
      "invalid-smart-assignment-query"
    );
  }

  const actorMembershipId =
    canonicalMembershipDocumentId(
      campaignId,
      actorPersonId
    );

  const actorRef = db
    .collection("territorialMemberships")
    .doc(actorMembershipId);

  const actorSnapshot = await (
    tx ? tx.get(actorRef) : actorRef.get()
  );

  if (
    !actorSnapshot.exists ||
    actorSnapshot.data()?.personId !== actorPersonId ||
    actorSnapshot.data()?.campaignId !== campaignId ||
    actorSnapshot.data()?.active !== true ||
    actorSnapshot.data()?.role !== "jefe_estructura"
  ) {
    throw new Error("invalid-actor-membership");
  }

  const actorMembership = {
    ...actorSnapshot.data(),
    membershipId: actorSnapshot.id
  };

  if (
    !validId(actorMembership.municipalityId) ||
    !validId(actorMembership.structureId)
  ) {
    throw new Error(
      "invalid-actor-territorial-scope"
    );
  }

  const descendantsQuery = db
    .collection("territorialMemberships")
    .where("campaignId", "==", campaignId)
    .where(
      "ancestorPersonIds",
      "array-contains",
      actorPersonId
    )
    .limit(maxCandidates + 1);

  const snapshot = await (
    tx ? tx.get(descendantsQuery) : descendantsQuery.get()
  );

  if (
    !Array.isArray(snapshot.docs) ||
    snapshot.docs.length > maxCandidates ||
    snapshot.size !== snapshot.docs.length
  ) {
    throw new Error(
      "incomplete-smart-assignment-candidate-set"
    );
  }

  const memberships = snapshot.docs.map(doc => ({
    ...doc.data(),
    membershipId: doc.id
  }));

  return {
    actorMembership,
    memberships,
    complete: true
  };
}

module.exports = {
  querySmartAssignmentDescendantMemberships
};
