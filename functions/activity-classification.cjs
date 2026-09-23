"use strict";

const {
  CATALOG_VERSION,
  SOURCE_TYPES,
  POINT_MODES,
  getActivityDefinition,
} =
  require(
    "./activity-catalog-v1.cjs"
  );

const CLASSIFICATION_SCHEMA_VERSION =
  "1.0.0";

function normalizeActivityCode(
  value
) {
  if (value == null) {
    return null;
  }

  if (
    typeof value !==
      "string"
  ) {
    throw new Error(
      "INVALID_ACTIVITY_CODE"
    );
  }

  const code =
    value.trim();

  if (!code) {
    return null;
  }

  if (
    code.length > 128
  ) {
    throw new Error(
      "INVALID_ACTIVITY_CODE"
    );
  }

  return code;
}

function classifyForSource(
  value,
  expectedSourceType
) {
  const code =
    normalizeActivityCode(
      value
    );

  if (!code) {
    return null;
  }

  let definition;

  try {
    definition =
      getActivityDefinition(
        code
      );
  } catch {
    throw new Error(
      "UNKNOWN_ACTIVITY_CODE"
    );
  }

  if (
    definition.sourceType !==
      expectedSourceType
  ) {
    throw new Error(
      "ACTIVITY_SOURCE_TYPE_MISMATCH"
    );
  }

  if (
    definition.pointMode !==
      POINT_MODES.FIXED
  ) {
    throw new Error(
      "ACTIVITY_REQUIRES_SPECIALIZED_CLASSIFICATION"
    );
  }

  return Object.freeze({
    activityCode:
      definition.code,

    activityCatalogVersion:
      CATALOG_VERSION,

    classificationSchemaVersion:
      CLASSIFICATION_SCHEMA_VERSION,

    sourceType:
      definition.sourceType,

    scoreDimension:
      definition.scoreDimension,

    pointMode:
      definition.pointMode,
  });
}

function classifyMissionActivity(
  value
) {
  return classifyForSource(
    value,
    SOURCE_TYPES.MISSION_VALIDATION
  );
}

function classifyEventAttendanceActivity(
  value
) {
  return classifyForSource(
    value,
    SOURCE_TYPES.ATTENDANCE_RECORD
  );
}

module.exports = {
  CLASSIFICATION_SCHEMA_VERSION,
  normalizeActivityCode,
  classifyForSource,
  classifyMissionActivity,
  classifyEventAttendanceActivity,
};
