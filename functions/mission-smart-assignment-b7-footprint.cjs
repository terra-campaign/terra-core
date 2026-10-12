"use strict";

/**
 * BUILD B8.4-T60: inspect legacy B7 and canonical B8.4 document footprints
 * in an EXTERNALLY SUPPLIED Firestore transaction. READ ONLY.
 *
 * This audit does not certify global absence of assignments: it checks only
 * derived document paths and never authorizes either writer or production.
 */
const {
  planB7CanonicalCompatibility
} = require("./mission-smart-assignment-b7-compatibility.cjs");

const ID_HASH = /^[a-f0-9]{64}$/;

function ensureCanonicalContract(compatibility) {
  if (!compatibility || compatibility.ok !== true ||
      compatibility.internalOnly !== true ||
      compatibility.status !== "b7-b84-compatibility-contract-only" ||
      compatibility.serverVerified !== false ||
      compatibility.writeAuthorized !== false ||
      compatibility.productionReady !== false ||
      compatibility.b7CompatibilityVerified !== false ||
      compatibility.sharedClaimsImplemented !== false ||
      compatibility.clientWritePathsClosed !== false ||
      !Array.isArray(compatibility.operations) ||
      compatibility.operations.length !== 0 ||
      !Array.isArray(compatibility.recipients)) {
    throw new Error("invalid-b7-footprint-contract");
  }

  const expected = planB7CanonicalCompatibility({
    campaignId: compatibility.campaignId,
    groupId: compatibility.groupId,
    parentMissionId: compatibility.parentMissionId,
    actorUid: compatibility.actorUid,
    requestId: compatibility.requestId,
    assignees: compatibility.recipients.map(row => ({
      personId: row?.personId,
      accountUid: row?.accountUid ?? null
    }))
  });

  const fields = [
    "personId", "accountUid", "legacyAssignedTo",
    "canonicalMissionId", "legacyMissionId", "legacyIdDiffers",
    "canonicalClaimId", "claimCollection"
  ];

  if (compatibility.recipientCount !== expected.recipientCount ||
      compatibility.legacyReceiptId !== expected.legacyReceiptId ||
      compatibility.canonicalReceiptId !== expected.canonicalReceiptId ||
      compatibility.receiptNamespaceDifferent !== true ||
      compatibility.recipients.some((row, index) =>
        !row || fields.some(field =>
          row[field] !== expected.recipients[index][field]
        )
      )) {
    throw new Error("modified-b7-footprint-contract");
  }
  return expected;
}

async function inspectB7CanonicalDocumentFootprintWithinTransaction({
  db, tx, compatibility
} = {}) {
  if (!db || typeof db.collection !== "function" ||
      !tx || typeof tx.get !== "function") {
    throw new TypeError("invalid-b7-footprint-transaction");
  }

  const contract = ensureCanonicalContract(compatibility);
  const paths = new Map();

  function add(collection, id, origin) {
    if (!ID_HASH.test(id)) {
      throw new Error("invalid-b7-footprint-id");
    }
    const path = `${collection}/${id}`;
    if (!paths.has(path)) {
      paths.set(path, {collection, id, path, origins: []});
    }
    paths.get(path).origins.push(origin);
  }

  for (const row of contract.recipients) {
    add("misiones", row.legacyMissionId, "b7-mission");
    add("missionLinks", row.legacyMissionId, "b7-link");
    add("misiones", row.canonicalMissionId, "b84-mission");
    add("missionLinks", row.canonicalMissionId, "b84-link");
    add("missionAssignmentClaims", row.canonicalClaimId, "canonical-claim");
  }

  add("missionDispatches", contract.legacyReceiptId, "b7-receipt");
  add("missionDispatches", contract.canonicalReceiptId, "b84-receipt");

  const observed = [];
  for (const record of paths.values()) {
    const ref = db.collection(record.collection).doc(record.id);
    const snapshot = await tx.get(ref);

    if (!snapshot || typeof snapshot.exists !== "boolean" ||
        snapshot.id !== record.id) {
      throw new Error("invalid-b7-footprint-snapshot");
    }
    if (!snapshot.exists) continue;

    if (typeof snapshot.data !== "function") {
      throw new Error("invalid-b7-footprint-snapshot");
    }
    const data = snapshot.data();
    if (!data || typeof data !== "object" ||
        Array.isArray(data) || data.campaignId !== contract.campaignId) {
      throw new Error("b7-footprint-campaign-mismatch");
    }

    observed.push({path: record.path, origins: [...record.origins]});
  }

  return {
    ok: true,
    internalOnly: true,
    status: "b7-b84-read-only-footprint-inspected",
    campaignId: contract.campaignId,
    examinedPaths: [...paths.keys()],
    examinedCount: paths.size,
    occupiedPaths: observed,
    occupiedCount: observed.length,
    knownPathsUnoccupied: observed.length === 0,
    // An empty path set does NOT prove global exclusivity or B7 compatibility.
    globalExclusivityVerified: false,
    b7CompatibilityVerified: false,
    sharedClaimsImplemented: false,
    clientWritePathsClosed: false,
    serverWriterEnabled: false,
    writeAuthorized: false,
    productionReady: false,
    operations: []
  };
}

module.exports = {
  inspectB7CanonicalDocumentFootprintWithinTransaction
};