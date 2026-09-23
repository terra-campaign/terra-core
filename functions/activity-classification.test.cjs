"use strict";

const test =
  require("node:test");

const assert =
  require("node:assert/strict");

const {
  classifyMissionActivity,
  classifyEventAttendanceActivity,
} =
  require(
    "./activity-classification.cjs"
  );

test(
  "expand phase permits missing classification",
  () => {
    assert.equal(
      classifyMissionActivity(null),
      null
    );

    assert.equal(
      classifyEventAttendanceActivity(""),
      null
    );

    assert.equal(
      classifyMissionActivity("   "),
      null
    );
  }
);

test(
  "mission accepts fixed mission activity",
  () => {
    const result =
      classifyMissionActivity(
        "TERRITORIAL_BRIGADE"
      );

    assert.equal(
      result.activityCode,
      "TERRITORIAL_BRIGADE"
    );

    assert.equal(
      result.activityCatalogVersion,
      "1.0.0"
    );

    assert.equal(
      result.sourceType,
      "MISSION_VALIDATION"
    );

    assert.equal(
      result.pointMode,
      "FIXED"
    );
  }
);

test(
  "event accepts attendance activity",
  () => {
    const result =
      classifyEventAttendanceActivity(
        "EVENT_GENERAL_ATTENDANCE"
      );

    assert.equal(
      result.activityCode,
      "EVENT_GENERAL_ATTENDANCE"
    );

    assert.equal(
      result.sourceType,
      "ATTENDANCE_RECORD"
    );
  }
);

test(
  "mission rejects event activity",
  () => {
    assert.throws(
      () =>
        classifyMissionActivity(
          "EVENT_GENERAL_ATTENDANCE"
        ),
      /ACTIVITY_SOURCE_TYPE_MISMATCH/
    );
  }
);

test(
  "event rejects mission activity",
  () => {
    assert.throws(
      () =>
        classifyEventAttendanceActivity(
          "MATERIAL_DISTRIBUTION"
        ),
      /ACTIVITY_SOURCE_TYPE_MISMATCH/
    );
  }
);

test(
  "growth is excluded from generic classification",
  () => {
    assert.throws(
      () =>
        classifyMissionActivity(
          "ORGANIZATIONAL_GROWTH"
        ),
      /ACTIVITY_SOURCE_TYPE_MISMATCH|ACTIVITY_REQUIRES_SPECIALIZED_CLASSIFICATION/
    );

    assert.throws(
      () =>
        classifyEventAttendanceActivity(
          "ORGANIZATIONAL_GROWTH"
        ),
      /ACTIVITY_SOURCE_TYPE_MISMATCH|ACTIVITY_REQUIRES_SPECIALIZED_CLASSIFICATION/
    );
  }
);

test(
  "unknown code is rejected",
  () => {
    assert.throws(
      () =>
        classifyMissionActivity(
          "UNKNOWN_ACTIVITY"
        ),
      /UNKNOWN_ACTIVITY_CODE/
    );
  }
);
