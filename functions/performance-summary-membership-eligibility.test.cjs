"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildPerformanceSummaryProjection,
} =
  require("./performance-summary.cjs");


function period(overrides = {}) {
  return {
    version: "1.0.0",
    status: "DEFINED_NOT_ACTIVATED",
    scope: "OPERATIONAL_PERFORMANCE_PERIOD",

    campaignId: "CAM-004",
    periodId: "PERIOD-001",

    startDate: "2026-01-01",
    endDate: "2026-04-01",

    ...overrides,
  };
}


function membership(overrides = {}) {
  return {
    membershipId: "MEM-001",
    personId: "PERSON-001",
    campaignId: "CAM-004",

    createdAt:
      "2026-02-01T00:00:00.000Z",

    ...overrides,
  };
}


function ledgerEntry(overrides = {}) {
  return {
    contributionId: "CONTRIB-001",

    campaignId: "CAM-004",
    personId: "PERSON-001",

    ledgerStatus: "POSTED",

    runtimeScoringEnabled: true,

    activityCode:
      "TERRITORIAL_BRIGADE",

    points: 30,

    scoreDimension:
      "TERRITORIAL_ACTIVITY",

    occurredAt:
      {
        seconds:
          1771113600,
        nanoseconds:
          0
      },

    ...overrides,
  };
}


test(
  "eligible membership participates in operational projection",
  () => {

    const result =
      buildPerformanceSummaryProjection({

        campaignId:
          "CAM-004",

        personId:
          "PERSON-001",

        ledgerEntries: [
          ledgerEntry()
        ],

        operationalPeriod:
          period(),

        membership:
          membership()
      });

    assert.equal(
      result.contribution
        .historical
        .points,
      30
    );
  }
);


test(
  "membership created exactly at period end is excluded",
  () => {

    const result =
      buildPerformanceSummaryProjection({

        campaignId:
          "CAM-004",

        personId:
          "PERSON-001",

        ledgerEntries: [
          ledgerEntry()
        ],

        operationalPeriod:
          period(),

        membership:
          membership({
            createdAt:
              "2026-04-01T00:00:00.000Z"
          })
      });

    assert.equal(
      result.contribution
        .historical
        .points,
      0
    );
  }
);


test(
  "membership created after period is excluded",
  () => {

    const result =
      buildPerformanceSummaryProjection({

        campaignId:
          "CAM-004",

        personId:
          "PERSON-001",

        ledgerEntries: [
          ledgerEntry()
        ],

        operationalPeriod:
          period(),

        membership:
          membership({
            createdAt:
              "2026-05-01T00:00:00.000Z"
          })
      });

    assert.equal(
      result.contribution
        .historical
        .points,
      0
    );
  }
);


test(
  "membership from another campaign fails closed",
  () => {

    assert.throws(
      () =>
        buildPerformanceSummaryProjection({

          campaignId:
            "CAM-004",

          personId:
            "PERSON-001",

          ledgerEntries: [
            ledgerEntry()
          ],

          operationalPeriod:
            period(),

          membership:
            membership({
              campaignId:
                "CAM-999"
            })
        }),

      /CAMPAIGN_MISMATCH/
    );
  }
);
