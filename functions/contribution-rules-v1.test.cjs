"use strict";

const test =
  require("node:test");

const assert =
  require("node:assert/strict");

const {
  SOURCE_TYPES,
  SCORE_DIMENSIONS,
  POINT_MODES,
} =
  require("./activity-catalog-v1.cjs");

const {
  RULE_SET_VERSION,
  RULE_SET_STATUS,
  RULE_STATUSES,
  contributionRulesV1,
  getContributionRule,
  assertRuleSourceCompatibility,
  assertPointsAllowed,
  assertRuleCanPost,
} =
  require("./contribution-rules-v1.cjs");

test(
  "rule set V1 mirrors all nine catalog activities",
  () => {
    assert.equal(
      RULE_SET_VERSION,
      "1.0.0"
    );

    assert.equal(
      RULE_SET_STATUS,
      "DEFINED_NOT_ACTIVATED"
    );

    assert.equal(
      contributionRulesV1.length,
      9
    );

    assert.equal(
      new Set(
        contributionRulesV1.map(
          rule =>
            rule.ruleId
        )
      ).size,
      9
    );
  }
);

test(
  "every V1 rule is versioned and not activated",
  () => {
    for (
      const rule
      of contributionRulesV1
    ) {
      assert.equal(
        rule.ruleVersion,
        "1.0.0"
      );

      assert.equal(
        rule.ruleSetVersion,
        "1.0.0"
      );

      assert.equal(
        rule.status,
        RULE_STATUSES
          .DEFINED_NOT_ACTIVATED
      );

      assert.equal(
        rule.runtimeScoringEnabled,
        false
      );

      assert.equal(
        rule.validFrom,
        null
      );

      assert.equal(
        rule.validUntil,
        null
      );

      assert.ok(
        Object.isFrozen(
          rule
        )
      );

      assert.ok(
        Object.isFrozen(
          rule.criteria
        )
      );
    }
  }
);

test(
  "fixed rule requires exact base points",
  () => {
    const digital =
      getContributionRule(
        "DIGITAL_ACTIVITY"
      );

    assert.equal(
      digital.pointMode,
      POINT_MODES.FIXED
    );

    assert.equal(
      assertPointsAllowed({
        rule:
          digital,

        points:
          6,
      }),
      true
    );

    assert.throws(
      () =>
        assertPointsAllowed({
          rule:
            digital,

          points:
            5,
        }),
      /FIXED_RULE_POINTS_MISMATCH/
    );
  }
);

test(
  "maximum rule allows a positive value up to its maximum",
  () => {
    const growth =
      getContributionRule(
        "ORGANIZATIONAL_GROWTH"
      );

    assert.equal(
      growth.pointMode,
      POINT_MODES.MAXIMUM
    );

    assert.equal(
      assertPointsAllowed({
        rule:
          growth,

        points:
          5,
      }),
      true
    );

    assert.equal(
      assertPointsAllowed({
        rule:
          growth,

        points:
          18,
      }),
      true
    );

    assert.throws(
      () =>
        assertPointsAllowed({
          rule:
            growth,

          points:
            19,
        }),
      /MAXIMUM_RULE_POINTS_EXCEEDED/
    );

    assert.throws(
      () =>
        assertPointsAllowed({
          rule:
            growth,

          points:
            0,
        }),
      /INVALID_CONTRIBUTION_POINTS/
    );
  }
);

test(
  "rule rejects incompatible source type and dimension",
  () => {
    const attendance =
      getContributionRule(
        "EVENT_GENERAL_ATTENDANCE"
      );

    assert.equal(
      assertRuleSourceCompatibility({
        rule:
          attendance,

        sourceType:
          SOURCE_TYPES
            .ATTENDANCE_RECORD,

        scoreDimension:
          SCORE_DIMENSIONS
            .ATTENDANCE,
      }),
      true
    );

    assert.throws(
      () =>
        assertRuleSourceCompatibility({
          rule:
            attendance,

          sourceType:
            SOURCE_TYPES
              .MISSION_VALIDATION,

          scoreDimension:
            SCORE_DIMENSIONS
              .ATTENDANCE,
        }),
      /RULE_SOURCE_TYPE_MISMATCH/
    );
  }
);

test(
  "inactive V1 rule cannot post contribution",
  () => {
    const rule =
      getContributionRule(
        "TERRITORIAL_BRIGADE"
      );

    assert.throws(
      () =>
        assertRuleCanPost(
          rule
        ),
      /CONTRIBUTION_RULE_NOT_ACTIVE/
    );
  }
);
