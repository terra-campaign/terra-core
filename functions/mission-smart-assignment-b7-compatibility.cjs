"use strict";

/**
 * BUILD B8.4-T58: pure, internal reconciliation contract for B7 and B8.4.
 * This is a DESIGN BRIDGE ONLY: no Firestore reads, no writes, no routes,
 * no production permission. Real B7 must adopt canonical claims before use.
 */
const {createHash} = require("node:crypto");
const {canonicalAssignmentClaim} =
  require("./mission-smart-assignment-exclusivity.cjs");

const MAX_ASSIGNEES = 50;
const blockers = Object.freeze([
  "legacy-b7-writer-does-not-create-canonical-claims",
  "legacy-and-canonical-receipt-namespaces-differ",
  "client-mission-create-paths-not-yet-closed",
  "shared-transactional-writer-not-implemented"
]);

function id(value) {
  return typeof value === "string" && value.length > 0 &&
    value.length <= 128 && value.trim() === value &&
    !value.includes("/");
}
function hash(...items) {
  return createHash("sha256")
    .update(JSON.stringify(items))
    .digest("hex");
}
function planB7CanonicalCompatibility({
  campaignId, groupId, parentMissionId = null,
  actorUid, requestId, assignees
} = {}) {
  if (![campaignId, groupId, actorUid, requestId].every(id) ||
      (parentMissionId !== null && !id(parentMissionId))) {
    throw new Error("invalid-compatibility-identity");
  }
  if (!Array.isArray(assignees) || assignees.length === 0 ||
      assignees.length > MAX_ASSIGNEES) {
    throw new Error("invalid-compatibility-selection-size");
  }

  const people = new Set();
  const legacyRecipients = new Set();
  const rows = [];
  for (const person of assignees) {
    if (!person || typeof person !== "object" ||
        Array.isArray(person) ||
        Object.keys(person).some(key =>
          !["personId", "accountUid", "hasDigitalAccount"].includes(key)
        )) {
      throw new Error("invalid-compatibility-recipient");
    }
    const personId = person.personId;
    const accountUid = person.accountUid ?? null;
    if (!id(personId) || (accountUid !== null && !id(accountUid)) ||
        (person.hasDigitalAccount !== undefined &&
          (typeof person.hasDigitalAccount !== "boolean" ||
           person.hasDigitalAccount !== (accountUid !== null)))) {
      throw new Error("invalid-compatibility-recipient");
    }
    if (people.has(personId)) {
      throw new Error("duplicate-compatibility-person");
    }
    people.add(personId);

    const assignedTo = accountUid || personId;
    if (legacyRecipients.has(assignedTo)) {
      throw new Error("ambiguous-legacy-assigned-to");
    }
    legacyRecipients.add(assignedTo);

    const claim = canonicalAssignmentClaim({
      campaignId, groupId, parentMissionId, personId
    });
    const canonicalMissionId = hash(groupId, parentMissionId, personId);
    const legacyMissionId = hash(groupId, parentMissionId, assignedTo);
    rows.push({
      personId, accountUid, legacyAssignedTo: assignedTo,
      canonicalMissionId, legacyMissionId,
      legacyIdDiffers: canonicalMissionId !== legacyMissionId,
      canonicalClaimId: claim.claimId,
      claimCollection: claim.collection
    });
  }

  const legacyReceiptId = hash(actorUid, requestId);
  const canonicalReceiptId = hash(
    "smart-assignment-dispatch-v1", actorUid, requestId
  );
  return {
    ok: true,
    internalOnly: true,
    status: "b7-b84-compatibility-contract-only",
    campaignId, groupId, parentMissionId,
    actorUid, requestId,
    recipientCount: rows.length,
    recipients: rows,
    legacyReceiptId,
    canonicalReceiptId,
    receiptNamespaceDifferent: legacyReceiptId !== canonicalReceiptId,
    blockers: [...blockers],
    // These are intentionally negative until both server writers share
    // claims, a receipt protocol, and verified transaction-level checks.
    serverVerified: false,
    b7CompatibilityVerified: false,
    clientWritePathsClosed: false,
    sharedClaimsImplemented: false,
    writeAuthorized: false,
    productionReady: false,
    operations: []
  };
}
module.exports = {planB7CanonicalCompatibility};

/**
 * Preview-only rule for the agreed hybrid design:
 * one canonical person binding per (campaign, group, parent), while distinct
 * activities can be planned beneath that binding. It does NOT write activity
 * documents or define a production Firestore collection/schema.
 */
function previewActivitiesWithinBindings({compatibility, activities} = {}) {
  if (!compatibility || compatibility.ok !== true ||
      compatibility.status !== "b7-b84-compatibility-contract-only" ||
      compatibility.writeAuthorized !== false ||
      compatibility.productionReady !== false ||
      !Array.isArray(compatibility.recipients)) {
    throw new Error("invalid-activity-binding-contract");
  }
  if (!Array.isArray(activities) || activities.length > 500) {
    throw new Error("invalid-activity-preview-size");
  }
  const bindingByPerson = new Map(
    compatibility.recipients.map(p => [p.personId, p.canonicalClaimId])
  );
  if (bindingByPerson.size !== compatibility.recipients.length) {
    throw new Error("invalid-activity-binding-contract");
  }
  const used = new Set();
  const rows = [];
  for (const task of activities) {
    if (!task || typeof task !== "object" || Array.isArray(task) ||
        Object.keys(task).some(k =>
          !["personId", "activityId", "activityCode"].includes(k)) ||
        !id(task.personId) || !id(task.activityId) ||
        !id(task.activityCode)) {
      throw new Error("invalid-activity-preview");
    }
    if (!bindingByPerson.has(task.personId)) {
      throw new Error("activity-recipient-not-bound");
    }
    const key = JSON.stringify([task.personId, task.activityId]);
    if (used.has(key)) {
      throw new Error("duplicate-activity-under-binding");
    }
    used.add(key);
    rows.push({
      personId: task.personId,
      canonicalClaimId: bindingByPerson.get(task.personId),
      activityId: task.activityId,
      activityCode: task.activityCode
    });
  }
  return {
    ok: true,
    internalOnly: true,
    status: "multiple-activities-policy-preview-only",
    bindingCount: bindingByPerson.size,
    activityCount: rows.length,
    activities: rows,
    activitySchemaDefined: false,
    catalogEligibilityVerified: false,
    writeAuthorized: false,
    productionReady: false,
    operations: []
  };
}
module.exports.previewActivitiesWithinBindings = previewActivitiesWithinBindings;