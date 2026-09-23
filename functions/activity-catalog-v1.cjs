"use strict";

const CATALOG_VERSION =
  "1.0.0";

const CATALOG_STATUS =
  "DEFINED_NOT_ACTIVATED";

const SOURCE_TYPES =
  Object.freeze({
    MISSION_VALIDATION:
      "MISSION_VALIDATION",

    ATTENDANCE_RECORD:
      "ATTENDANCE_RECORD",

    GROWTH_VALIDATION:
      "GROWTH_VALIDATION",
  });

const SCORE_DIMENSIONS =
  Object.freeze({
    TERRITORIAL_ACTIVITY:
      "TERRITORIAL_ACTIVITY",

    ATTENDANCE:
      "ATTENDANCE",

    ORGANIZATION:
      "ORGANIZATION",

    LOGISTICS:
      "LOGISTICS",

    DIGITAL_ACTIVITY:
      "DIGITAL_ACTIVITY",
  });

const POINT_MODES =
  Object.freeze({
    FIXED:
      "FIXED",

    MAXIMUM:
      "MAXIMUM",
  });

const VALIDATION_MODES =
  Object.freeze({
    HUMAN_MISSION_REVIEW:
      "HUMAN_MISSION_REVIEW",

    INTERNAL_ATTENDANCE:
      "INTERNAL_ATTENDANCE",

    GROWTH_VALIDATION:
      "GROWTH_VALIDATION",
  });

const definitions = [
  {
    code:
      "TERRITORIAL_BRIGADE",

    basePoints:
      30,

    pointMode:
      POINT_MODES.FIXED,

    sourceType:
      SOURCE_TYPES.MISSION_VALIDATION,

    scoreDimension:
      SCORE_DIMENSIONS.TERRITORIAL_ACTIVITY,

    validationMode:
      VALIDATION_MODES.HUMAN_MISSION_REVIEW,
  },

  {
    code:
      "EVENT_GENERAL_ATTENDANCE",

    basePoints:
      30,

    pointMode:
      POINT_MODES.FIXED,

    sourceType:
      SOURCE_TYPES.ATTENDANCE_RECORD,

    scoreDimension:
      SCORE_DIMENSIONS.ATTENDANCE,

    validationMode:
      VALIDATION_MODES.INTERNAL_ATTENDANCE,
  },

  {
    code:
      "LOCAL_MEETING_ATTENDANCE",

    basePoints:
      22,

    pointMode:
      POINT_MODES.FIXED,

    sourceType:
      SOURCE_TYPES.ATTENDANCE_RECORD,

    scoreDimension:
      SCORE_DIMENSIONS.ATTENDANCE,

    validationMode:
      VALIDATION_MODES.INTERNAL_ATTENDANCE,
  },

  {
    code:
      "OPERATIONAL_ACCOMPANIMENT",

    basePoints:
      20,

    pointMode:
      POINT_MODES.FIXED,

    sourceType:
      SOURCE_TYPES.MISSION_VALIDATION,

    scoreDimension:
      SCORE_DIMENSIONS.TERRITORIAL_ACTIVITY,

    validationMode:
      VALIDATION_MODES.HUMAN_MISSION_REVIEW,
  },

  {
    code:
      "ORGANIZATIONAL_GROWTH",

    basePoints:
      18,

    pointMode:
      POINT_MODES.MAXIMUM,

    sourceType:
      SOURCE_TYPES.GROWTH_VALIDATION,

    scoreDimension:
      SCORE_DIMENSIONS.ORGANIZATION,

    validationMode:
      VALIDATION_MODES.GROWTH_VALIDATION,
  },

  {
    code:
      "WALL_PAINTING",

    basePoints:
      16,

    pointMode:
      POINT_MODES.FIXED,

    sourceType:
      SOURCE_TYPES.MISSION_VALIDATION,

    scoreDimension:
      SCORE_DIMENSIONS.TERRITORIAL_ACTIVITY,

    validationMode:
      VALIDATION_MODES.HUMAN_MISSION_REVIEW,
  },

  {
    code:
      "EVENT_SUPPORT_LOGISTICS",

    basePoints:
      14,

    pointMode:
      POINT_MODES.FIXED,

    sourceType:
      SOURCE_TYPES.MISSION_VALIDATION,

    scoreDimension:
      SCORE_DIMENSIONS.LOGISTICS,

    validationMode:
      VALIDATION_MODES.HUMAN_MISSION_REVIEW,
  },

  {
    code:
      "MATERIAL_DISTRIBUTION",

    basePoints:
      12,

    pointMode:
      POINT_MODES.FIXED,

    sourceType:
      SOURCE_TYPES.MISSION_VALIDATION,

    scoreDimension:
      SCORE_DIMENSIONS.TERRITORIAL_ACTIVITY,

    validationMode:
      VALIDATION_MODES.HUMAN_MISSION_REVIEW,
  },

  {
    code:
      "DIGITAL_ACTIVITY",

    basePoints:
      6,

    pointMode:
      POINT_MODES.FIXED,

    sourceType:
      SOURCE_TYPES.MISSION_VALIDATION,

    scoreDimension:
      SCORE_DIMENSIONS.DIGITAL_ACTIVITY,

    validationMode:
      VALIDATION_MODES.HUMAN_MISSION_REVIEW,
  },
];

const activityCatalogV1 =
  Object.freeze(
    definitions.map(
      definition =>
        Object.freeze({
          ...definition,

          catalogVersion:
            CATALOG_VERSION,

          catalogStatus:
            CATALOG_STATUS,

          runtimeScoringEnabled:
            false,
        })
    )
  );

const activityByCode =
  new Map(
    activityCatalogV1.map(
      definition => [
        definition.code,
        definition,
      ]
    )
  );

if (
  activityByCode.size !==
  activityCatalogV1.length
) {
  throw new Error(
    "DUPLICATE_ACTIVITY_CODE"
  );
}

function getActivityDefinition(
  code
) {
  const definition =
    activityByCode.get(
      code
    );

  if (!definition) {
    throw new Error(
      "UNKNOWN_ACTIVITY_CODE:" +
      code
    );
  }

  return definition;
}

function listActivityDefinitions() {
  return activityCatalogV1;
}

module.exports = {
  CATALOG_VERSION,
  CATALOG_STATUS,
  SOURCE_TYPES,
  SCORE_DIMENSIONS,
  POINT_MODES,
  VALIDATION_MODES,
  activityCatalogV1,
  getActivityDefinition,
  listActivityDefinitions,
};
