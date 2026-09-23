"use strict";

const test =
  require("node:test");

const assert =
  require("node:assert/strict");

const {
  CATALOG_VERSION,
  CATALOG_STATUS,
  SOURCE_TYPES,
  SCORE_DIMENSIONS,
  POINT_MODES,
  activityCatalogV1,
  getActivityDefinition,
} =
  require("./activity-catalog-v1.cjs");

test(
  "catalog V1 exposes the nine official base activities",
  () => {
    assert.equal(
      CATALOG_VERSION,
      "1.0.0"
    );

    assert.equal(
      CATALOG_STATUS,
      "DEFINED_NOT_ACTIVATED"
    );

    assert.equal(
      activityCatalogV1.length,
      9
    );

    const points =
      Object.fromEntries(
        activityCatalogV1.map(
          definition => [
            definition.code,
            definition.basePoints,
          ]
        )
      );

    assert.deepEqual(
      points,
      {
        TERRITORIAL_BRIGADE:
          30,

        EVENT_GENERAL_ATTENDANCE:
          30,

        LOCAL_MEETING_ATTENDANCE:
          22,

        OPERATIONAL_ACCOMPANIMENT:
          20,

        ORGANIZATIONAL_GROWTH:
          18,

        WALL_PAINTING:
          16,

        EVENT_SUPPORT_LOGISTICS:
          14,

        MATERIAL_DISTRIBUTION:
          12,

        DIGITAL_ACTIVITY:
          6,
      }
    );
  }
);

test(
  "catalog definitions remain disabled for runtime scoring",
  () => {
    for (
      const definition
      of activityCatalogV1
    ) {
      assert.equal(
        definition
          .runtimeScoringEnabled,
        false
      );

      assert.equal(
        definition
          .catalogVersion,
        CATALOG_VERSION
      );

      assert.ok(
        Object.isFrozen(
          definition
        )
      );
    }

    assert.ok(
      Object.isFrozen(
        activityCatalogV1
      )
    );
  }
);

test(
  "attendance categories require attendance records",
  () => {
    const general =
      getActivityDefinition(
        "EVENT_GENERAL_ATTENDANCE"
      );

    const local =
      getActivityDefinition(
        "LOCAL_MEETING_ATTENDANCE"
      );

    assert.equal(
      general.sourceType,
      SOURCE_TYPES
        .ATTENDANCE_RECORD
    );

    assert.equal(
      local.sourceType,
      SOURCE_TYPES
        .ATTENDANCE_RECORD
    );

    assert.equal(
      general.scoreDimension,
      SCORE_DIMENSIONS
        .ATTENDANCE
    );

    assert.equal(
      local.scoreDimension,
      SCORE_DIMENSIONS
        .ATTENDANCE
    );
  }
);

test(
  "growth is a maximum-value category",
  () => {
    const growth =
      getActivityDefinition(
        "ORGANIZATIONAL_GROWTH"
      );

    assert.equal(
      growth.basePoints,
      18
    );

    assert.equal(
      growth.pointMode,
      POINT_MODES.MAXIMUM
    );

    assert.equal(
      growth.sourceType,
      SOURCE_TYPES
        .GROWTH_VALIDATION
    );
  }
);

test(
  "unknown activity code is rejected",
  () => {
    assert.throws(
      () =>
        getActivityDefinition(
          "NOT_A_REAL_ACTIVITY"
        ),
      /UNKNOWN_ACTIVITY_CODE/
    );
  }
);
