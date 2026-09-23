"use strict";

const {
  createHash,
} =
  require("node:crypto");

const {
  buildDedupIdentity,
} =
  require("./contribution-source.cjs");

const {
  SOURCE_TYPES,
} =
  require("./activity-catalog-v1.cjs");

const {
  getContributionRule,
  assertRuleSourceCompatibility,
  assertPointsAllowed,
  assertRuleCanPost,
} =
  require("./contribution-rules-v1.cjs");

const LEDGER_SCHEMA_VERSION =
  "1.0.0";

const LEDGER_STATUSES =
  Object.freeze({
    DRAFT_NOT_POSTABLE:
      "DRAFT_NOT_POSTABLE",

    POSTED:
      "POSTED",

    REVERSED:
      "REVERSED",
  });

function requireToken(
  value,
  fieldName
) {
  if (
    typeof value !==
      "string" ||
    !value.trim()
  ) {
    throw new Error(
      "INVALID_" +
      fieldName
    );
  }

  return value.trim();
}

function assertCanonicalSourceShape({
  sourceType,
  sourceId,
}) {
  const source =
    requireToken(
      sourceId,
      "SOURCE_ID"
    );

  if (
    sourceType ===
    SOURCE_TYPES.MISSION_VALIDATION
  ) {
    if (
      !source.startsWith(
        "mission:"
      ) ||
      !source.includes(
        ":person:"
      )
    ) {
      throw new Error(
        "INVALID_MISSION_SOURCE_ID"
      );
    }

    return true;
  }

  if (
    sourceType ===
    SOURCE_TYPES.ATTENDANCE_RECORD
  ) {
    if (
      !source.startsWith(
        "event-attendance:"
      ) ||
      !source.includes(
        ":person:"
      )
    ) {
      throw new Error(
        "INVALID_ATTENDANCE_SOURCE_ID"
      );
    }

    return true;
  }

  if (
    sourceType ===
    SOURCE_TYPES.GROWTH_VALIDATION
  ) {
    if (
      !source.startsWith(
        "growth-validation:"
      ) ||
      !source.includes(
        ":person:"
      )
    ) {
      throw new Error(
        "INVALID_GROWTH_SOURCE_ID"
      );
    }

    return true;
  }

  throw new Error(
    "UNSUPPORTED_SOURCE_TYPE"
  );
}

function freezeRuleSnapshot(
  rule
) {
  if (
    !Array.isArray(
      rule.criteria
    ) ||
    rule.criteria.length ===
      0
  ) {
    throw new Error(
      "RULE_CRITERIA_MISSING"
    );
  }

  const criteria =
    Object.freeze([
      ...rule.criteria,
    ]);

  return Object.freeze({
    ruleId:
      rule.ruleId,

    ruleVersion:
      rule.ruleVersion,

    ruleSetVersion:
      rule.ruleSetVersion,

    activityCode:
      rule.activityCode,

    sourceType:
      rule.sourceType,

    scoreDimension:
      rule.scoreDimension,

    pointMode:
      rule.pointMode,

    basePoints:
      rule.basePoints,

    complexity:
      rule.complexity,

    criteria,

    evidenceRequirement:
      rule.evidenceRequirement,

    validationMode:
      rule.validationMode,

    status:
      rule.status,

    validFrom:
      rule.validFrom,

    validUntil:
      rule.validUntil,

    runtimeScoringEnabled:
      rule.runtimeScoringEnabled,
  });
}

function assertSourcePersonConsistency({
  sourceId,
  personId,
}) {
  const source =
    requireToken(
      sourceId,
      "SOURCE_ID"
    );

  const person =
    requireToken(
      personId,
      "PERSON_ID"
    );

  const expectedSuffix =
    ":person:" +
    person;

  if (
    !source.endsWith(
      expectedSuffix
    )
  ) {
    throw new Error(
      "SOURCE_PERSON_MISMATCH"
    );
  }

  return true;
}

function buildContributionLedgerDraft({
  campaignId,
  personId,
  activityCode,
  sourceType,
  sourceId,
  scoreDimension,
  points,
  occurredAt = null,
  evidenceRef = null,
}) {
  const campaign =
    requireToken(
      campaignId,
      "CAMPAIGN_ID"
    );

  const person =
    requireToken(
      personId,
      "PERSON_ID"
    );

  const activity =
    requireToken(
      activityCode,
      "ACTIVITY_CODE"
    );

  const rule =
    getContributionRule(
      activity
    );

  assertRuleSourceCompatibility({
    rule,
    sourceType,
    scoreDimension,
  });

  assertCanonicalSourceShape({
    sourceType,
    sourceId,
  });

  assertSourcePersonConsistency({
    sourceId,
    personId:
      person,
  });

  assertPointsAllowed({
    rule,
    points,
  });

  const identity =
    buildDedupIdentity({
      sourceType,
      sourceId,
      scoreDimension,
    });

  return Object.freeze({
    ledgerId:
      identity.ledgerId,

    schemaVersion:
      LEDGER_SCHEMA_VERSION,

    ledgerStatus:
      LEDGER_STATUSES
        .DRAFT_NOT_POSTABLE,

    campaignId:
      campaign,

    personId:
      person,

    activityCode:
      activity,

    points,

    scoreDimension:
      identity.scoreDimension,

    sourceType:
      identity.sourceType,

    sourceId:
      identity.sourceId,

    scoreSourceType:
      identity.sourceType,

    scoreSourceId:
      identity.sourceId,

    ruleId:
      rule.ruleId,

    scoreRuleVersion:
      rule.ruleVersion,

    ruleSetVersion:
      rule.ruleSetVersion,

    ruleSnapshot:
      freezeRuleSnapshot(
        rule
      ),

    occurredAt,

    evidenceRef,

    runtimeScoringEnabled:
      false,
  });
}

function buildPostableContribution({
  campaignId,
  personId,
  activityCode,
  sourceType,
  sourceId,
  scoreDimension,
  points,
  occurredAt = null,
  evidenceRef = null,
}) {
  const rule =
    getContributionRule(
      activityCode
    );

  assertRuleCanPost(
    rule
  );

  const draft =
    buildContributionLedgerDraft({
      campaignId,
      personId,
      activityCode,
      sourceType,
      sourceId,
      scoreDimension,
      points,
      occurredAt,
      evidenceRef,
    });

  return Object.freeze({
    ...draft,

    ledgerStatus:
      LEDGER_STATUSES.POSTED,

    runtimeScoringEnabled:
      true,
  });
}

function buildReversalDraft({
  originalLedgerId,
  campaignId,
  personId,
  points,
  reason,
  operationId,
}) {
  const original =
    requireToken(
      originalLedgerId,
      "ORIGINAL_LEDGER_ID"
    );

  const campaign =
    requireToken(
      campaignId,
      "CAMPAIGN_ID"
    );

  const person =
    requireToken(
      personId,
      "PERSON_ID"
    );

  const reversalReason =
    requireToken(
      reason,
      "REVERSAL_REASON"
    );

  const operation =
    requireToken(
      operationId,
      "OPERATION_ID"
    );

  if (
    !Number.isInteger(points) ||
    points <= 0
  ) {
    throw new Error(
      "INVALID_REVERSAL_POINTS"
    );
  }

  const reversalLedgerId =
    createHash("sha256")
      .update(
        JSON.stringify([
          "terra-contribution-reversal",
          LEDGER_SCHEMA_VERSION,
          original,
          operation,
        ])
      )
      .digest("hex");

  return Object.freeze({
    ledgerId:
      reversalLedgerId,

    schemaVersion:
      LEDGER_SCHEMA_VERSION,

    ledgerStatus:
      LEDGER_STATUSES
        .DRAFT_NOT_POSTABLE,

    entryType:
      "REVERSAL",

    originalLedgerId:
      original,

    campaignId:
      campaign,

    personId:
      person,

    deltaPoints:
      -points,

    reason:
      reversalReason,

    operationId:
      operation,

    runtimeScoringEnabled:
      false,
  });
}

module.exports = {
  LEDGER_SCHEMA_VERSION,
  LEDGER_STATUSES,
  assertCanonicalSourceShape,
  assertSourcePersonConsistency,
  buildContributionLedgerDraft,
  buildPostableContribution,
  buildReversalDraft,
};
