"use strict";

/**
 * B8 -> B7: solo preparacion de destinatarios canonicos dentro de una
 * transaccion autenticada. Sin escrituras, sin callable, sin permiso de produccion.
 *
 * Cada destinatario debe estar autorizado por descubrimiento B8 y validado
 * contra documentos canonicos. La cadena intermedia se obtiene del servidor.
 */
const {createHash} = require("node:crypto");
const {canonicalMembershipDocumentId} = require("./territorial-membership-id.cjs");

function validId(value) {
  return typeof value === "string" && value.length > 0 &&
    value.length <= 128 && value.trim() === value && !value.includes("/");
}
function fail(message) { throw new Error(message); }
function assigneeRef(campaignId, actorPersonId, personId) {
  return createHash("sha256")
    .update(JSON.stringify(["mission-assignee", campaignId, actorPersonId, personId]))
    .digest("hex");
}

function createB8RootBridgeForTests({authorize, resolvePresentation, loadLineage} = {}) {
  if ([authorize, resolvePresentation, loadLineage].some(fn => typeof fn !== "function")) {
    throw new TypeError("invalid-b8-root-bridge-dependencies");
  }
  return async function prepareB8RootRecipients({
    db, tx, request, activityCode, assigneeRefs
  } = {}) {
    const uid = request?.auth?.uid;
    if (!validId(uid) || !db || typeof db.collection !== "function" ||
        !tx || typeof tx.get !== "function" || !validId(activityCode) ||
        !Array.isArray(assigneeRefs) || assigneeRefs.length < 1 ||
        assigneeRefs.length > 50 ||
        assigneeRefs.some(ref => typeof ref !== "string" || !/^[0-9a-f]{64}$/.test(ref)) ||
        new Set(assigneeRefs).size !== assigneeRefs.length) {
      fail("invalid-b8-root-bridge-request");
    }

    const authorization = await authorize({db, tx, request, activityCode, assigneeRefs});
    if (authorization?.ok !== true || authorization.internalOnly !== true ||
        authorization.actorUid !== uid || authorization.activityCode !== activityCode ||
        !validId(authorization.campaignId) ||
        !validId(authorization.actorPersonId) ||
        !Array.isArray(authorization.selected) ||
        authorization.selected.length !== assigneeRefs.length) {
      fail("invalid-b8-root-bridge-authorization");
    }

    const presentation = await resolvePresentation({db, tx, authorization});
    if (presentation?.ok !== true || presentation.internalOnly !== true ||
        presentation.status !== "canonical-presentation-resolved" ||
        presentation.canonicalAccountsVerified !== true ||
        presentation.writeAuthorized !== false ||
        presentation.productionReady !== false ||
        presentation.campaignId !== authorization.campaignId ||
        presentation.actorUid !== uid ||
        presentation.actorPersonId !== authorization.actorPersonId ||
        presentation.actor?.role !== "jefe_estructura" ||
        presentation.actor.uid !== uid ||
        !Array.isArray(presentation.recipients) ||
        presentation.recipients.length !== assigneeRefs.length ||
        !Array.isArray(presentation.enrichedSelection) ||
        presentation.enrichedSelection.length !== assigneeRefs.length) {
      fail("invalid-b8-root-bridge-presentation");
    }

    const actorMembershipRef = db.collection("territorialMemberships").doc(
      canonicalMembershipDocumentId(authorization.campaignId, authorization.actorPersonId)
    );
    const actorSnapshot = await tx.get(actorMembershipRef);
    if (!actorSnapshot?.exists ||
        actorSnapshot.data()?.personId !== authorization.actorPersonId ||
        actorSnapshot.data()?.campaignId !== authorization.campaignId ||
        actorSnapshot.data()?.role !== "jefe_estructura" ||
        actorSnapshot.data()?.active !== true) {
      fail("invalid-b8-root-bridge-actor-membership");
    }
    const actorMembership = {...actorSnapshot.data(), membershipId: actorSnapshot.id};
    const enriched = new Map();
    for (const selected of presentation.enrichedSelection) {
      if (!validId(selected?.personId) ||
          selected.personId === authorization.actorPersonId ||
          enriched.has(selected.personId)) {
        fail("invalid-b8-root-bridge-selection-binding");
      }
      enriched.set(selected.personId, selected);
    }
    const recipients = new Map();
    for (const selected of authorization.selected) {
      const personId = selected?.personId;
      const verified = enriched.get(personId);
      const recipient = presentation.recipients.find(p => p?.personId === personId);
      const ref = assigneeRef(authorization.campaignId, authorization.actorPersonId, personId);
      if (!validId(personId) || !verified || !recipient ||
          !assigneeRefs.includes(ref) || recipients.has(ref) ||
          verified.personId !== personId ||
          verified.hasDigitalAccount !== selected.hasDigitalAccount ||
          (verified.accountUid ?? null) !== (recipient.accountUid ?? null) ||
          Boolean(recipient.accountUid) !== selected.hasDigitalAccount ||
          (selected.accountUid != null && selected.accountUid !== recipient.accountUid) ||
          (selected.role != null && selected.role !== recipient.role) ||
          (selected.municipalityId != null && selected.municipalityId !== recipient.municipalityId) ||
          (selected.structureId != null && selected.structureId !== recipient.structureId)) {
        fail("invalid-b8-root-bridge-selection-binding");
      }
      const membershipRef = db.collection("territorialMemberships").doc(
        canonicalMembershipDocumentId(authorization.campaignId, personId)
      );
      const membershipSnapshot = await tx.get(membershipRef);
      if (!membershipSnapshot?.exists ||
          membershipSnapshot.data()?.personId !== personId ||
          membershipSnapshot.data()?.campaignId !== authorization.campaignId ||
          membershipSnapshot.data()?.active !== true ||
          membershipSnapshot.data()?.role !== recipient.role ||
          (membershipSnapshot.data()?.accountUid ?? null) !== (recipient.accountUid ?? null)) {
        fail("invalid-b8-root-bridge-target-membership");
      }
      const targetMembership = {...membershipSnapshot.data(), membershipId: membershipSnapshot.id};
      const chain = await loadLineage({
        db, tx, campaignId: authorization.campaignId,
        actorMembership, targetMembership
      });
      if (chain?.authorized !== true || !Array.isArray(chain.lineage) ||
          chain.lineage.length < 2 || chain.lineage.length > 5 ||
          chain.lineage[0]?.personId !== personId ||
          chain.lineage.at(-1)?.personId !== authorization.actorPersonId) {
        fail("invalid-b8-root-bridge-lineage");
      }
      const intermediate = chain.lineage.slice(1, -1);
      if (intermediate.some(p => !validId(p?.personId) ||
          (p.accountUid != null && !validId(p.accountUid)))) {
        fail("invalid-b8-root-bridge-intermediate");
      }
      recipients.set(ref, Object.freeze({
        personId,
        accountUid: recipient.accountUid ?? null,
        recipient: Object.freeze({...recipient}),
        intermediateSupervisorPersonIds: Object.freeze(intermediate.map(p => p.personId)),
        intermediateSupervisorUids: Object.freeze(intermediate.map(p => p.accountUid).filter(Boolean))
      }));
    }
    if (recipients.size !== assigneeRefs.length) fail("invalid-b8-root-bridge-count");
    return {
      ok: true,
      internalOnly: true,
      status: "root-recipient-binding-verified",
      campaignId: authorization.campaignId,
      actorUid: uid,
      actorPersonId: authorization.actorPersonId,
      activityCode,
      recipients,
      writeAuthorized: false,
      productionReady: false
    };
  };
}

function prepareB8RootRecipientsWithinTransaction(options) {
  const {authorizeSmartAssignmentWithinTransaction} =
    require("./mission-smart-assignment-write-authorization.cjs");
  const {resolveCanonicalAssignmentPresentation} =
    require("./mission-smart-assignment-canonical-presentation.cjs");
  const {loadSmartAssignmentLineage} =
    require("./mission-smart-assignment-lineage.cjs");
  return createB8RootBridgeForTests({
    authorize: authorizeSmartAssignmentWithinTransaction,
    resolvePresentation: resolveCanonicalAssignmentPresentation,
    loadLineage: loadSmartAssignmentLineage
  })(options);
}

module.exports = {prepareB8RootRecipientsWithinTransaction, createB8RootBridgeForTests};
