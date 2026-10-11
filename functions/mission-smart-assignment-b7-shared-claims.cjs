"use strict";

/**
 * BUILD B8.4-T64 - compatibility guard for the existing B7 transaction.
 * Must be invoked within B7's authenticated Firestore transaction,
 * after all B7 mission candidates have been prepared, before any writes.
 * It only reads; the caller must atomically create returned claims.
 * This does NOT enable the B8.4 writer or production deployment.
 */
const {createHash} = require("node:crypto");
const {
  planB7CanonicalCompatibility
} = require("./mission-smart-assignment-b7-compatibility.cjs");
const {
  inspectB7CanonicalDocumentFootprintWithinTransaction
} = require("./mission-smart-assignment-b7-footprint.cjs");

function validId(x) {
  return typeof x === "string" && x.length > 0 &&
    x.length <= 128 && x.trim() === x && !x.includes("/");
}
function hash(...items) {
  return createHash("sha256").update(JSON.stringify(items)).digest("hex");
}

async function prepareB7SharedClaimsWithinTransaction({
  db, tx, campaignId, groupId, parentMissionId = null,
  actorUid, actorPersonId, requestId, fingerprint, records
} = {}) {
  if (!db || typeof db.collection !== "function" ||
      !tx || typeof tx.get !== "function" ||
      typeof tx.create !== "function" ||
      ![campaignId, groupId, actorUid, actorPersonId, requestId].every(validId) ||
      (parentMissionId !== null && !validId(parentMissionId)) ||
      !/^[0-9a-f]{64}$/.test(fingerprint || "") ||
      !Array.isArray(records) || records.length > 50) {
    throw new Error("invalid-b7-shared-claims-context");
  }

  // Check the cross-writer receipt even for an empty B7 dispatch.
  // B7's own receipt was checked by its existing idempotency logic.
  const canonicalReceiptId = hash(
    "smart-assignment-dispatch-v1", actorUid, requestId
  );
  if (records.length === 0) {
    const ref = db.collection("missionDispatches").doc(canonicalReceiptId);
    const receipt = await tx.get(ref);
    if (!receipt || typeof receipt.exists !== "boolean" ||
        receipt.id !== canonicalReceiptId) {
      throw new Error("invalid-b7-shared-receipt-snapshot");
    }
    if (receipt.exists) {
      throw new Error("b7-b84-assignment-conflict");
    }
    return {ok: true, claimWrites: [], writeAuthorized: false,
      productionReady: false, clientWritePathsClosed: false};
  }

  const assignees = records.map(r => {
    const personId = r?.data?.personId;
    const accountUid = r?.data?.accountUid ?? null;
    const missionId = r?.data?.id;
    if (!validId(personId) ||
        (accountUid !== null && !validId(accountUid)) ||
        !validId(missionId) ||
        r?.data?.campaignId !== campaignId ||
        r?.link?.campaignId !== campaignId ||
        r?.data?.personId !== r?.link?.personId ||
        (r?.link?.accountUid ?? null) !== accountUid ||
        r?.link?.groupId !== groupId ||
        (r?.link?.parentMissionId ?? null) !== parentMissionId ||
        r?.missionRef?.id !== missionId ||
        r?.linkRef?.id !== missionId ||
        r?.data?.createdBy !== actorUid ||
        r?.link?.createdBy !== actorUid) {
      throw new Error("invalid-b7-shared-claim-record");
    }
    return {personId, accountUid};
  });

  const compatibility = planB7CanonicalCompatibility({
    campaignId, groupId, parentMissionId,
    actorUid, requestId, assignees
  });

  for (let i = 0; i < records.length; i++) {
    if (records[i].data.id !== compatibility.recipients[i].legacyMissionId) {
      throw new Error("b7-legacy-mission-id-mismatch");
    }
  }

  // Reads BOTH B7/B8.4 mission paths, BOTH receipts and the shared claim.
  // A vacant candidate path is not a global production authorization.
  const footprint = await inspectB7CanonicalDocumentFootprintWithinTransaction({
    db, tx, compatibility
  });
  if (footprint.ok !== true || footprint.occupiedCount !== 0 ||
      footprint.knownPathsUnoccupied !== true ||
      footprint.writeAuthorized !== false) {
    throw new Error("b7-b84-assignment-conflict");
  }

  const receiptId = compatibility.legacyReceiptId;
  const claimWrites = compatibility.recipients.map(row => ({
    id: row.canonicalClaimId,
    data: {
      schemaVersion: 1,
      campaignId, groupId, parentMissionId,
      personId: row.personId,
      actorUid, actorPersonId, requestId,
      receiptId, fingerprint
    }
  }));
  return {
    ok: true, claimWrites,
    writeAuthorized: false,
    productionReady: false,
    clientWritePathsClosed: false
  };
}

module.exports = {prepareB7SharedClaimsWithinTransaction};