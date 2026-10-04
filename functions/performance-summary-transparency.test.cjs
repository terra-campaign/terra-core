"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildPerformanceSummaryProjection,
} = require("./performance-summary.cjs");


function ledgerEntry(overrides = {}) {
  return {
    contributionId:
      "CONTRIB-001",

    campaignId:
      "CAM-004",

    personId:
      "PERSON-001",

    ledgerStatus:
      "POSTED",

    runtimeScoringEnabled:
      true,

    activityCode:
      "TERRITORIAL_BRIGADE",

    scoreDimension:
      "TERRITORIAL_ACTIVITY",

    points:
      30,

    occurredAt: {
      seconds:
        1771113600,
      nanoseconds:
        0
    },

    ...overrides,
  };
}


function build(entries) {
  return buildPerformanceSummaryProjection({
    campaignId:
      "CAM-004",

    personId:
      "PERSON-001",

    ledgerEntries:
      entries,

    operationalPeriod: {
      version:
        "1.0.0",

      status:
        "DEFINED_NOT_ACTIVATED",

      scope:
        "OPERATIONAL_PERFORMANCE_PERIOD",

      campaignId:
        "CAM-004",

      periodId:
        "PERIOD-001",

      startDate:
        "2026-01-01",

      endDate:
        "2026-04-01",
    },

    membership: {
      membershipId:
        "MEM-001",

      personId:
        "PERSON-001",

      campaignId:
        "CAM-004",

      createdAt:
        "2026-02-01T00:00:00.000Z",
    },
  });
}


test(
  "official activity points remain traceable by dimension",
  () => {

    const result =
      build([
        ledgerEntry({
          activityCode:
            "TERRITORIAL_BRIGADE",

          scoreDimension:
            "TERRITORIAL_ACTIVITY",

          points:
            30,
        }),

        ledgerEntry({
          contributionId:
            "CONTRIB-002",

          activityCode:
            "EVENT_GENERAL_ATTENDANCE",

          scoreDimension:
            "ATTENDANCE",

          points:
            30,
        }),
      ]);

    assert.equal(
      result.contribution
        .historical
        .points,
      60
    );

    assert.equal(
      result.contribution
        .historical
        .byDimension
        .TERRITORIAL_ACTIVITY,
      30
    );

    assert.equal(
      result.contribution
        .historical
        .byDimension
        .ATTENDANCE,
      30
    );
  }
);


test(
  "all canonical dimensions exist in the transparent breakdown",
  () => {

    const result =
      build([
        ledgerEntry()
      ]);

    const dimensions =
      result.contribution
        .historical
        .byDimension;

    assert.ok(
      Object.hasOwn(
        dimensions,
        "TERRITORIAL_ACTIVITY"
      )
    );

    assert.ok(
      Object.hasOwn(
        dimensions,
        "ATTENDANCE"
      )
    );

    assert.ok(
      Object.hasOwn(
        dimensions,
        "ORGANIZATION"
      )
    );

    assert.ok(
      Object.hasOwn(
        dimensions,
        "LOGISTICS"
      )
    );

    assert.ok(
      Object.hasOwn(
        dimensions,
        "DIGITAL_ACTIVITY"
      )
    );
  }
);


test(
  "general performance index remains uncalculated",
  () => {

    const result =
      build([
        ledgerEntry()
      ]);

    assert.equal(
      result.generalPerformanceIndex
        .calculated,
      false
    );

    assert.equal(
      result.generalPerformanceIndex
        .value,
      null
    );

    assert.equal(
      result.persistenceEnabled,
      false
    );

    assert.equal(
      result.runtimeScoringActivated,
      false
    );
  }
);


test(
  "reversed contribution does not generate transparent points",
  () => {

    const result =
      build([
        ledgerEntry({
          ledgerStatus:
            "REVERSED"
        })
      ]);

    assert.equal(
      result.contribution
        .historical
        .points,
      0
    );
  }
);
