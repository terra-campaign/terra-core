"use strict";

/** BUILD B8.4-T49. Solo lecturas en la tx entregada. */
const {canonicalMembershipDocumentId} = require("./territorial-membership-id.cjs");

function validId(x) {
  return typeof x === "string" && x.length > 0 &&
    x.length <= 256 && x.trim() === x && !x.includes("/");
}
function error(code) { throw new Error(code); }
function uidOf(value) {
  if (value === null || value === undefined) return null;
  if (!validId(value)) error("invalid-canonical-account-uid");
  return value;
}
function field(value, code) {
  if (value == null) return "";
  if (typeof value !== "string" || value.length > 256 || value.trim() !== value) {
    error(code);
  }
  return value;
}
function nameOf(value) {
  if (value == null || value === "") return "Sin nombre";
  if (typeof value !== "string" || !value.trim() || value.length > 150) {
    error("invalid-canonical-name");
  }
  return value;
}
async function read(db, tx, collection, id, code) {
  if (!validId(id)) error(code);
  const ref = db.collection(collection).doc(id);
  const snap = await tx.get(ref);
  if (!snap?.exists || snap.id !== id || typeof snap.data !== "function") {
    error(code);
  }
  const data = snap.data();
  if (!data || typeof data !== "object" || Array.isArray(data)) error(code);
  return data;
}
async function resolveCanonicalAssignmentPresentation({
  db, tx, authorization
} = {}) {
  if (!db || typeof db.collection !== "function" || !tx || typeof tx.get !== "function") {
    error("invalid-canonical-presentation-transaction");
  }
  if (authorization?.ok !== true || authorization.internalOnly !== true ||
      !validId(authorization.actorUid) || !validId(authorization.actorPersonId) ||
      !validId(authorization.campaignId) || !Array.isArray(authorization.selected) ||
      authorization.selected.length < 1 || authorization.selected.length > 50) {
    error("invalid-canonical-presentation-authorization");
  }
  const {actorUid, actorPersonId, campaignId} = authorization;
  const seen = new Set();
  for (const selected of authorization.selected) {
    if (!validId(selected?.personId) || selected.personId === actorPersonId ||
        seen.has(selected.personId) || typeof selected.hasDigitalAccount !== "boolean") {
      error("invalid-canonical-presentation-selection");
    }
    seen.add(selected.personId);
  }

  const profile = await read(db, tx, "usuarios", actorUid, "canonical-actor-profile-missing");
  if (profile.active !== true || profile.campaignId !== campaignId ||
      profile.role !== "jefe_estructura" ||
      (profile.uid != null && profile.uid !== actorUid)) {
    error("canonical-actor-profile-mismatch");
  }
  const actorPerson = await read(db, tx, "persons", actorPersonId,
    "canonical-actor-person-missing");
  const actorMembership = await read(db, tx, "territorialMemberships",
    canonicalMembershipDocumentId(campaignId, actorPersonId),
    "canonical-actor-membership-missing");
  if (actorPerson.active !== true || actorPerson.campaignId !== campaignId ||
      actorPerson.personId != null && actorPerson.personId !== actorPersonId ||
      actorMembership.active !== true || actorMembership.campaignId !== campaignId ||
      actorMembership.personId !== actorPersonId ||
      actorMembership.role !== profile.role ||
      uidOf(actorPerson.accountUid) !== actorUid ||
      uidOf(actorMembership.accountUid) !== actorUid) {
    error("canonical-actor-identity-mismatch");
  }
  const ancestors = profile.ancestorIds ?? [];
  if (!Array.isArray(ancestors) || !ancestors.every(validId) ||
      new Set(ancestors).size !== ancestors.length || ancestors.includes(actorUid)) {
    error("invalid-canonical-actor-ancestors");
  }
  const actor = {
    uid: actorUid, personId: actorPersonId,
    name: nameOf(profile.name || actorPerson.name),
    role: profile.role, ancestorUids: [...ancestors]
  };
  const recipients = [];
  const enrichedSelection = [];

  for (const candidate of authorization.selected) {
    const {personId} = candidate;
    const person = await read(db, tx, "persons", personId,
      "canonical-recipient-person-missing");
    const membership = await read(db, tx, "territorialMemberships",
      canonicalMembershipDocumentId(campaignId, personId),
      "canonical-recipient-membership-missing");
    if (person.active !== true || person.campaignId !== campaignId ||
        (person.personId != null && person.personId !== personId) ||
        membership.active !== true || membership.campaignId !== campaignId ||
        membership.personId !== personId || !validId(membership.role)) {
      error("canonical-recipient-identity-mismatch");
    }
    const accountFromPerson = uidOf(person.accountUid);
    const accountFromMembership = uidOf(membership.accountUid);
    if (accountFromPerson !== accountFromMembership) {
      error("canonical-recipient-account-mismatch");
    }
    if (candidate.hasDigitalAccount !== (accountFromPerson !== null) ||
        (candidate.accountUid != null && candidate.accountUid !== accountFromPerson)) {
      error("canonical-recipient-digital-state-mismatch");
    }
    if (candidate.role != null && candidate.role !== membership.role) {
      error("canonical-recipient-role-mismatch");
    }
    for (const key of ["municipalityId", "structureId"]) {
      if (candidate[key] != null && candidate[key] !== (membership[key] ?? "")) {
        error("canonical-recipient-territory-mismatch");
      }
    }
    const recipient = {
      personId,
      accountUid: accountFromPerson,
      name: nameOf(person.name),
      role: membership.role,
      municipalityId: field(membership.municipalityId, "invalid-canonical-municipality"),
      municipalityName: field(membership.municipalityName, "invalid-canonical-municipality"),
      structureId: field(membership.structureId, "invalid-canonical-structure"),
      structureName: field(membership.structureName, "invalid-canonical-structure")
    };
    recipients.push(recipient);
    enrichedSelection.push({
      ...candidate,
      personId,
      accountUid: accountFromPerson,
      hasDigitalAccount: accountFromPerson !== null
    });
  }
  return {
    ok: true, internalOnly: true, status: "canonical-presentation-resolved",
    campaignId, actorUid, actorPersonId,
    actor, recipients, enrichedSelection,
    canonicalAccountsVerified: true,
    writeAuthorized: false, productionReady: false
  };
}
module.exports = {resolveCanonicalAssignmentPresentation};