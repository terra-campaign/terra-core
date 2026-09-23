"use strict";

const {
  createHash,
} =
  require("node:crypto");

const {
  SOURCE_TYPES,
  SCORE_DIMENSIONS,
} =
  require("./activity-catalog-v1.cjs");

const LEDGER_ID_VERSION =
  "1";

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

function requireSourceType(
  sourceType
) {
  const allowed =
    new Set(
      Object.values(
        SOURCE_TYPES
      )
    );

  if (
    !allowed.has(
      sourceType
    )
  ) {
    throw new Error(
      "INVALID_SOURCE_TYPE"
    );
  }

  return sourceType;
}

function requireScoreDimension(
  scoreDimension
) {
  const allowed =
    new Set(
      Object.values(
        SCORE_DIMENSIONS
      )
    );

  if (
    !allowed.has(
      scoreDimension
    )
  ) {
    throw new Error(
      "INVALID_SCORE_DIMENSION"
    );
  }

  return scoreDimension;
}

function buildMissionSourceId({
  missionId,
  personId,
}) {
  const mission =
    requireToken(
      missionId,
      "MISSION_ID"
    );

  const person =
    requireToken(
      personId,
      "PERSON_ID"
    );

  return (
    "mission:" +
    mission +
    ":person:" +
    person
  );
}

function buildAttendanceSourceId({
  eventId,
  personId,
}) {
  const event =
    requireToken(
      eventId,
      "EVENT_ID"
    );

  const person =
    requireToken(
      personId,
      "PERSON_ID"
    );

  return (
    "event-attendance:" +
    event +
    ":person:" +
    person
  );
}

function buildGrowthSourceId({
  growthValidationId,
  personId,
}) {
  const validation =
    requireToken(
      growthValidationId,
      "GROWTH_VALIDATION_ID"
    );

  const person =
    requireToken(
      personId,
      "PERSON_ID"
    );

  return (
    "growth-validation:" +
    validation +
    ":person:" +
    person
  );
}

function buildMissionContributionSource({
  missionId,
  personId,
}) {
  return Object.freeze({
    sourceType:
      SOURCE_TYPES
        .MISSION_VALIDATION,

    sourceId:
      buildMissionSourceId({
        missionId,
        personId,
      }),
  });
}

function buildAttendanceContributionSource({
  eventId,
  personId,
}) {
  return Object.freeze({
    sourceType:
      SOURCE_TYPES
        .ATTENDANCE_RECORD,

    sourceId:
      buildAttendanceSourceId({
        eventId,
        personId,
      }),
  });
}

function buildGrowthContributionSource({
  growthValidationId,
  personId,
}) {
  return Object.freeze({
    sourceType:
      SOURCE_TYPES
        .GROWTH_VALIDATION,

    sourceId:
      buildGrowthSourceId({
        growthValidationId,
        personId,
      }),
  });
}

function buildContributionLedgerId({
  sourceType,
  sourceId,
  scoreDimension,
}) {
  const checkedSourceType =
    requireSourceType(
      sourceType
    );

  const checkedSourceId =
    requireToken(
      sourceId,
      "SOURCE_ID"
    );

  const checkedDimension =
    requireScoreDimension(
      scoreDimension
    );

  return createHash(
    "sha256"
  )
    .update(
      JSON.stringify([
        "terra-contribution-ledger",
        LEDGER_ID_VERSION,
        checkedSourceType,
        checkedSourceId,
        checkedDimension,
      ])
    )
    .digest("hex");
}

function buildDedupIdentity({
  sourceType,
  sourceId,
  scoreDimension,
}) {
  const checkedSourceType =
    requireSourceType(
      sourceType
    );

  const checkedSourceId =
    requireToken(
      sourceId,
      "SOURCE_ID"
    );

  const checkedDimension =
    requireScoreDimension(
      scoreDimension
    );

  return Object.freeze({
    sourceType:
      checkedSourceType,

    sourceId:
      checkedSourceId,

    scoreDimension:
      checkedDimension,

    ledgerId:
      buildContributionLedgerId({
        sourceType:
          checkedSourceType,

        sourceId:
          checkedSourceId,

        scoreDimension:
          checkedDimension,
      }),
  });
}

module.exports = {
  LEDGER_ID_VERSION,
  buildMissionSourceId,
  buildAttendanceSourceId,
  buildGrowthSourceId,
  buildMissionContributionSource,
  buildAttendanceContributionSource,
  buildGrowthContributionSource,
  buildContributionLedgerId,
  buildDedupIdentity,
};
