"use strict";

const { createHash } = require("node:crypto");

function hash(...parts) {
  return createHash("sha256")
    .update(JSON.stringify(parts))
    .digest("hex");
}

function toPublicSmartAssignment({
  result,
  campaignId,
  actorPersonId
} = {}) {

  if (
    !result ||
    result.ok !== true ||
    result.internalOnly !== true ||
    !Array.isArray(result.eligible)
  ) {
    throw new Error("invalid-smart-assignment-result");
  }

  for (const value of [campaignId, actorPersonId]) {
    if (
      typeof value !== "string" ||
      !value ||
      value.trim() !== value
    ) {
      throw new Error("invalid-smart-assignment-identity");
    }
  }

  if (
    typeof result.activityCode !== "string" ||
    !result.activityCode.trim() ||
    result.activityCode.trim() !== result.activityCode
  ) {
    throw new Error("invalid-smart-assignment-activity");
  }

  const seen = new Set();

  const eligible = result.eligible.map(candidate => {
    const personId = candidate?.personId;

    if (
      typeof personId !== "string" ||
      !personId ||
      personId.trim() !== personId ||
      personId.includes("/")
    ) {
      throw new Error("invalid-smart-assignment-candidate");
    }

    if (seen.has(personId)) {
      throw new Error("duplicate-smart-assignment-candidate");
    }

    seen.add(personId);

    for (const field of [
      "name",
      "role",
      "municipalityId",
      "structureId"
    ]) {
      const value = candidate[field];

      if (
        typeof value !== "string" ||
        !value.trim() ||
        value.trim() !== value
      ) {
        throw new Error("invalid-smart-assignment-candidate");
      }
    }

    if (
      typeof candidate.hasDigitalAccount !== "boolean" ||
      typeof candidate.preferenceSelected !== "boolean"
    ) {
      throw new Error("invalid-smart-assignment-candidate");
    }

    return {
      assigneeRef: hash(
        "mission-assignee",
        campaignId,
        actorPersonId,
        personId
      ),
      name: candidate.name,
      role: candidate.role,
      municipalityId: candidate.municipalityId,
      structureId: candidate.structureId,
      hasDigitalAccount: candidate.hasDigitalAccount,
      preferenceSelected: candidate.preferenceSelected
    };
  });
  return {
    ok: true,
    activityCode: result.activityCode,
    eligible
  };
}

module.exports = { toPublicSmartAssignment };