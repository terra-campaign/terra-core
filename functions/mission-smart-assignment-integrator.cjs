"use strict";

const {
  canonicalMembershipDocumentId
} = require("./territorial-membership-id.cjs");

const {
  querySmartAssignmentDescendantMemberships
} = require("./mission-smart-assignment-firestore.cjs");

const {
  loadSmartAssignmentLineage
} = require("./mission-smart-assignment-lineage.cjs");

const {
  discoverSmartAssignmentCandidates
} = require("./mission-smart-assignment-discovery.cjs");

/**
 * B8.3 - Integracion experimental interna.
 *
 * RESTRICCIONES:
 * - db debe ser proporcionado por el servidor.
 * - campaignId y actorPersonId deben proceder de
 *   identidad autenticada y verificada.
 * - No exponer directamente este resultado al navegador.
 * - No usar para crear asignaciones en produccion.
 * - No constituye una lectura transaccional consistente.
 */
async function discoverSmartAssignmentFromFirestore({
  db,
  campaignId,
  actorPersonId,
  activityCode,
  maxCandidates,
  tx
} = {}) {

  const selection = await
    querySmartAssignmentDescendantMemberships({
      db,
      campaignId,
      actorPersonId,
      maxCandidates,
      tx
    });

  if (selection.complete !== true) {
    throw new Error(
      "incomplete-smart-assignment-candidate-set"
    );
  }

  // Validar integridad global antes de filtrar candidatos.
  // Una contradiccion invalida el resultado completo.
  if (!Array.isArray(selection.memberships)) {
    throw new Error("invalid-smart-assignment-memberships");
  }

  const seenMemberships = new Set();

  for (const membership of selection.memberships) {
    const personId = membership?.personId;

    if (
      typeof personId !== "string" ||
      !personId ||
      personId.trim() !== personId ||
      !membership.membershipId ||
      membership.campaignId !== campaignId
    ) {
      throw new Error("invalid-smart-assignment-membership");
    }

    let expectedId;

    try {
      expectedId = canonicalMembershipDocumentId(
        campaignId,
        personId
      );
    } catch {
      throw new Error("invalid-smart-assignment-membership");
    }

    if (membership.membershipId !== expectedId) {
      throw new Error("invalid-smart-assignment-membership");
    }

    if (seenMemberships.has(personId)) {
      throw new Error("duplicate-smart-assignment-membership");
    }

    seenMemberships.add(personId);
  }

  const candidates = [];

  for (const membership of selection.memberships) {

    const lineageResult =
      await loadSmartAssignmentLineage({
        db,
        campaignId,
        actorMembership: selection.actorMembership,
        targetMembership: membership,
        tx
      });

    if (!lineageResult.authorized) {
      continue;
    }

    const personId = membership.personId;

    const personRef = db
      .collection("persons")
      .doc(personId);

    const personSnapshot = await (
      tx ? tx.get(personRef) : personRef.get()
    );

    if (!personSnapshot.exists) {
      continue;
    }

    const person = {
      ...personSnapshot.data(),
      personId: personSnapshot.id
    };

    if (
      person.personId !== personId ||
      person.campaignId !== campaignId ||
      person.active !== true
    ) {
      continue;
    }

    // Una cuenta digital es opcional, pero su identidad
    // debe coincidir entre persona y membresia canonicas.
    const membershipAccountUid = membership.accountUid ?? null;
    const personAccountUid = person.accountUid ?? null;

    if (
      membershipAccountUid !== personAccountUid
    ) {
      continue;
    }

    candidates.push({
      membership,
      person,
      lineage: lineageResult.lineage
    });
  }

  const result = discoverSmartAssignmentCandidates({
    campaignId,
    actorMembership: selection.actorMembership,
    activityCode,
    candidates,
    complete: selection.complete
  });

  if (!result.ok) {
    throw new Error(
      result.reason || "smart-assignment-discovery-failed"
    );
  }

  return {
    ok: true,
    activityCode: result.activityCode,
    eligible: result.eligible,
    internalOnly: true
  };
}

module.exports = {
  discoverSmartAssignmentFromFirestore
};
