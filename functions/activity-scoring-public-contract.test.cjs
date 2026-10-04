"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  listActivityDefinitions,
} = require("./activity-catalog-v1.cjs");


test(
  "public scoring catalog exposes all official activities",
  () => {

    const catalog =
      listActivityDefinitions();

    assert.ok(
      Array.isArray(catalog)
    );

    assert.equal(
      catalog.length,
      9
    );
  }
);


test(
  "every public scoring entry exposes explanation fields",
  () => {

    const catalog =
      listActivityDefinitions();

    for (
      const activity of catalog
    ) {

      assert.equal(
        typeof activity.code,
        "string"
      );

      assert.equal(
        typeof activity.basePoints,
        "number"
      );

      assert.equal(
        typeof activity.pointMode,
        "string"
      );

      assert.equal(
        typeof activity.scoreDimension,
        "string"
      );

      assert.equal(
        typeof activity.sourceType,
        "string"
      );

      assert.equal(
        typeof activity.validationMode,
        "string"
      );

      assert.equal(
        activity.catalogVersion,
        "1.0.0"
      );
    }
  }
);


test(
  "public catalog preserves the official point values",
  () => {

    const catalog =
      listActivityDefinitions();

    const expected = {
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
    };

    for (
      const activity of catalog
    ) {

      assert.equal(
        activity.basePoints,
        expected[
          activity.code
        ]
      );
    }
  }
);


test(
  "public catalog preserves the five canonical dimensions",
  () => {

    const catalog =
      listActivityDefinitions();

    const dimensions =
      new Set(
        catalog.map(
          activity =>
            activity.scoreDimension
        )
      );

    assert.deepEqual(
      [
        ...dimensions
      ].sort(),
      [
        "ATTENDANCE",
        "DIGITAL_ACTIVITY",
        "LOGISTICS",
        "ORGANIZATION",
        "TERRITORIAL_ACTIVITY",
      ].sort()
    );
  }
);


test(
  "public scoring catalog does not activate runtime scoring",
  () => {

    const catalog =
      listActivityDefinitions();

    for (
      const activity of catalog
    ) {

      assert.equal(
        activity.runtimeScoringEnabled,
        false
      );

      assert.equal(
        activity.catalogStatus,
        "DEFINED_NOT_ACTIVATED"
      );
    }
  }
);


test(
  "public scoring catalog is immutable",
  () => {

    const catalog =
      listActivityDefinitions();

    assert.ok(
      Object.isFrozen(catalog)
    );

    for (
      const activity of catalog
    ) {

      assert.ok(
        Object.isFrozen(activity)
      );
    }
  }
);
