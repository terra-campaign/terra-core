"use strict";

const {
  CATALOG_VERSION,
  CATALOG_STATUS,
  SOURCE_TYPES,
  POINT_MODES,
  VALIDATION_MODES,
  activityCatalogV1,
} =
  require("./activity-catalog-v1.cjs");

const RULE_SET_VERSION =
  "1.0.0";

const RULE_SET_STATUS =
  "DEFINED_NOT_ACTIVATED";

const RULE_STATUSES =
  Object.freeze({
    DEFINED_NOT_ACTIVATED:
      "DEFINED_NOT_ACTIVATED",

    ACTIVE:
      "ACTIVE",

    RETIRED:
      "RETIRED",
  });

const EVIDENCE_REQUIREMENTS =
  Object.freeze({
    MISSION_EVIDENCE:
      "MISSION_EVIDENCE",

    INTERNAL_ATTENDANCE:
      "INTERNAL_ATTENDANCE",

    GROWTH_VALIDATION:
      "GROWTH_VALIDATION",
  });

const COMPLEXITIES =
  Object.freeze({
    BASE:
      "BASE",

    SIMPLE:
      "SIMPLE",

    MEDIUM:
      "MEDIUM",

    HIGH:
      "HIGH",
  });

function criteriaFor(
  sourceType
) {
  if (
    sourceType ===
    SOURCE_TYPES.MISSION_VALIDATION
  ) {
    return Object.freeze([
      "MISSION_VALIDATED",
      "NO_PENDING_APPEAL",
      "CANONICAL_PERSON_RESOLVED",
    ]);
  }

  if (
    sourceType ===
    SOURCE_TYPES.ATTENDANCE_RECORD
  ) {
    return Object.freeze([
      "ATTENDANCE_TRUE",
      "CANONICAL_ATTENDANCE_ID",
      "CANONICAL_PERSON_RESOLVED",
    ]);
  }

  if (
    sourceType ===
    SOURCE_TYPES.GROWTH_VALIDATION
  ) {
    return Object.freeze([
      "GROWTH_VALIDATED",
      "CANONICAL_PERSON_RESOLVED",
    ]);
  }

  throw new Error(
    "UNSUPPORTED_RULE_SOURCE_TYPE"
  );
}

function evidenceRequirementFor(
  sourceType
) {
  if (
    sourceType ===
    SOURCE_TYPES.MISSION_VALIDATION
  ) {
    return EVIDENCE_REQUIREMENTS
      .MISSION_EVIDENCE;
  }

  if (
    sourceType ===
    SOURCE_TYPES.ATTENDANCE_RECORD
  ) {
    return EVIDENCE_REQUIREMENTS
      .INTERNAL_ATTENDANCE;
  }

  if (
    sourceType ===
    SOURCE_TYPES.GROWTH_VALIDATION
  ) {
    return EVIDENCE_REQUIREMENTS
      .GROWTH_VALIDATION;
  }

  throw new Error(
    "UNSUPPORTED_EVIDENCE_SOURCE_TYPE"
  );
}

const contributionRulesV1 =
  Object.freeze(
    activityCatalogV1.map(
      activity => {
        if (
          activity.catalogVersion !==
          CATALOG_VERSION
        ) {
          throw new Error(
            "CATALOG_VERSION_MISMATCH"
          );
        }

        if (
          activity.catalogStatus !==
          CATALOG_STATUS
        ) {
          throw new Error(
            "CATALOG_STATUS_MISMATCH"
          );
        }

        if (
          activity.runtimeScoringEnabled !==
          false
        ) {
          throw new Error(
            "CATALOG_RUNTIME_SCORING_MUST_BE_DISABLED"
          );
        }

        return Object.freeze({
          ruleId:
            "terra-contribution-rule:" +
            activity.code +
            ":v" +
            RULE_SET_VERSION,

          ruleVersion:
            RULE_SET_VERSION,

          ruleSetVersion:
            RULE_SET_VERSION,

          status:
            RULE_STATUSES
              .DEFINED_NOT_ACTIVATED,

          activityCode:
            activity.code,

          sourceType:
            activity.sourceType,

          scoreDimension:
            activity.scoreDimension,

          pointMode:
            activity.pointMode,

          basePoints:
            activity.basePoints,

          complexity:
            COMPLEXITIES.BASE,

          criteria:
            criteriaFor(
              activity.sourceType
            ),

          evidenceRequirement:
            evidenceRequirementFor(
              activity.sourceType
            ),

          validationMode:
            activity.validationMode,

          validFrom:
            null,

          validUntil:
            null,

          runtimeScoringEnabled:
            false,
        });
      }
    )
  );

const ruleByActivityCode =
  new Map(
    contributionRulesV1.map(
      rule => [
        rule.activityCode,
        rule,
      ]
    )
  );

if (
  ruleByActivityCode.size !==
  contributionRulesV1.length
) {
  throw new Error(
    "DUPLICATE_CONTRIBUTION_RULE_ACTIVITY"
  );
}

function getContributionRule(
  activityCode
) {
  const rule =
    ruleByActivityCode.get(
      activityCode
    );

  if (!rule) {
    throw new Error(
      "UNKNOWN_CONTRIBUTION_ACTIVITY:" +
      activityCode
    );
  }

  return rule;
}

function assertRuleSourceCompatibility({
  rule,
  sourceType,
  scoreDimension,
}) {
  if (
    !rule ||
    typeof rule !==
      "object"
  ) {
    throw new Error(
      "INVALID_RULE"
    );
  }

  if (
    rule.sourceType !==
    sourceType
  ) {
    throw new Error(
      "RULE_SOURCE_TYPE_MISMATCH"
    );
  }

  if (
    rule.scoreDimension !==
    scoreDimension
  ) {
    throw new Error(
      "RULE_SCORE_DIMENSION_MISMATCH"
    );
  }

  return true;
}

function assertPointsAllowed({
  rule,
  points,
}) {
  if (
    !Number.isInteger(points) ||
    points <= 0
  ) {
    throw new Error(
      "INVALID_CONTRIBUTION_POINTS"
    );
  }

  if (
    rule.pointMode ===
    POINT_MODES.FIXED
  ) {
    if (
      points !==
      rule.basePoints
    ) {
      throw new Error(
        "FIXED_RULE_POINTS_MISMATCH"
      );
    }

    return true;
  }

  if (
    rule.pointMode ===
    POINT_MODES.MAXIMUM
  ) {
    if (
      points >
      rule.basePoints
    ) {
      throw new Error(
        "MAXIMUM_RULE_POINTS_EXCEEDED"
      );
    }

    return true;
  }

  throw new Error(
    "UNSUPPORTED_POINT_MODE"
  );
}

function assertRuleCanPost(
  rule
) {
  if (
    rule.status !==
    RULE_STATUSES.ACTIVE
  ) {
    throw new Error(
      "CONTRIBUTION_RULE_NOT_ACTIVE"
    );
  }

  if (
    rule.runtimeScoringEnabled !==
    true
  ) {
    throw new Error(
      "RUNTIME_SCORING_DISABLED"
    );
  }

  return true;
}

module.exports = {
  RULE_SET_VERSION,
  RULE_SET_STATUS,
  RULE_STATUSES,
  EVIDENCE_REQUIREMENTS,
  COMPLEXITIES,
  contributionRulesV1,
  getContributionRule,
  assertRuleSourceCompatibility,
  assertPointsAllowed,
  assertRuleCanPost,
};
