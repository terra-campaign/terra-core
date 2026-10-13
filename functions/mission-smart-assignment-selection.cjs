"use strict";

const {createHash} = require("node:crypto");

const REF_PATTERN = /^[a-f0-9]{64}$/;

function assigneeRef(campaignId, actorPersonId, personId) {
  return createHash("sha256")
    .update(JSON.stringify([
      "mission-assignee",
      campaignId,
      actorPersonId,
      personId
    ]))
    .digest("hex");
}

function validateSmartAssignmentSelection({
  assigneeRefs,
  eligible,
  campaignId,
  actorPersonId
} = {}) {

  for (const value of [campaignId, actorPersonId]) {
    if (
      typeof value !== "string" ||
      !value ||
      value.trim() !== value ||
      value.includes("/")
    ) {
      throw new Error("invalid-smart-assignment-identity");
    }
  }

  if (
    !Array.isArray(assigneeRefs) ||
    assigneeRefs.length < 1 ||
    assigneeRefs.length > 50
  ) {
    throw new Error("invalid-smart-assignment-selection-size");
  }

  if (!Array.isArray(eligible)) {
    throw new Error("invalid-smart-assignment-eligible-set");
  }

  const selected = new Set();

  for (const ref of assigneeRefs) {
    if (typeof ref !== "string" || !REF_PATTERN.test(ref)) {
      throw new Error("invalid-smart-assignment-reference");
    }

    if (selected.has(ref)) {
      throw new Error("duplicate-smart-assignment-reference");
    }

    selected.add(ref);
  }

  const authorized = new Map();
  const identities = new Set();

  for (const candidate of eligible) {
    const personId = candidate?.personId;

    if (
      typeof personId !== "string" ||
      !personId ||
      personId.trim() !== personId ||
      personId.includes("/")
    ) {
      throw new Error("invalid-smart-assignment-candidate");
    }

    if (identities.has(personId)) {
      throw new Error("duplicate-smart-assignment-candidate");
    }

    identities.add(personId);

    const ref = assigneeRef(
      campaignId,
      actorPersonId,
      personId
    );

    if (authorized.has(ref)) {
      throw new Error("ambiguous-smart-assignment-reference");
    }

    authorized.set(ref, candidate);
  }

  const resolved = [];

  for (const ref of assigneeRefs) {
    const candidate = authorized.get(ref);

    if (!candidate) {
      throw new Error("unauthorized-smart-assignment-reference");
    }

    resolved.push(candidate);
  }

  return {
    ok: true,
    internalOnly: true,
    selected: resolved
  };
}

module.exports = {
  validateSmartAssignmentSelection
};