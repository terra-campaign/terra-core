"use strict";

const test =
  require("node:test");

const assert =
  require("node:assert/strict");

const {
  SCORE_DIMENSIONS,
} =
  require(
    "./activity-catalog-v1.cjs"
  );

const {
  LEDGER_STATUSES,
} =
  require(
    "./contribution-ledger.cjs"
  );

const {
  PERFORMANCE_SUMMARY_SCHEMA_VERSION,
  PERFORMANCE_SUMMARY_STATUS,
  PERFORMANCE_SUMMARY_SCOPE,
  SCORE_DIMENSION_VALUES,
  normalizePeriod,
  buildPerformanceSummaryProjection,
} =
  require(
    "./performance-summary.cjs"
  );


function posted({
  ledgerId,
  campaignId =
    "CAM-001",
  personId =
    "PER-001",
  activityCode =
    "TERRITORIAL_BRIGADE",
  scoreDimension =
    SCORE_DIMENSIONS
      .TERRITORIAL_ACTIVITY,
  points = 30,
  occurredAt =
    1000,
} = {}) {
  return {
    ledgerId:
      ledgerId ||
      "LEDGER-" +
        Math.random(),

    campaignId,

    personId,

    activityCode,

    scoreDimension,

    points,

    occurredAt,

    ledgerStatus:
      LEDGER_STATUSES.POSTED,

    runtimeScoringEnabled:
      true,
  };
}


test(
  "performance summary foundation remains explicitly inactive",
  () => {
    assert.equal(
      PERFORMANCE_SUMMARY_SCHEMA_VERSION,
      "1.0.0"
    );

    assert.equal(
      PERFORMANCE_SUMMARY_STATUS,
      "DEFINED_NOT_ACTIVATED"
    );

    assert.equal(
      PERFORMANCE_SUMMARY_SCOPE,
      "CONTRIBUTION_FOUNDATION_ONLY"
    );

    assert.equal(
      SCORE_DIMENSION_VALUES.length,
      5
    );
  }
);


test(
  "projection requires canonical campaign person and ledger array",
  () => {
    assert.throws(
      () =>
        buildPerformanceSummaryProjection({
          campaignId:
            "",
          personId:
            "PER-001",
          ledgerEntries:
            [],
        }),
      /INVALID_CAMPAIGN_ID/
    );

    assert.throws(
      () =>
        buildPerformanceSummaryProjection({
          campaignId:
            "CAM-001",
          personId:
            "",
          ledgerEntries:
            [],
        }),
      /INVALID_PERSON_ID/
    );

    assert.throws(
      () =>
        buildPerformanceSummaryProjection({
          campaignId:
            "CAM-001",
          personId:
            "PER-001",
          ledgerEntries:
            null,
        }),
      /INVALID_LEDGER_ENTRIES/
    );
  }
);


test(
  "historical projection counts only posted runtime scoring entries for same person and campaign",
  () => {
    const summary =
      buildPerformanceSummaryProjection({
        campaignId:
          "CAM-001",

        personId:
          "PER-001",

        ledgerEntries: [
          posted({
            points: 30,
          }),

          posted({
            activityCode:
              "EVENT_GENERAL_ATTENDANCE",

            scoreDimension:
              SCORE_DIMENSIONS
                .ATTENDANCE,

            points:
              30,
          }),

          {
            ...posted({
              points: 16,
            }),

            ledgerStatus:
              LEDGER_STATUSES
                .DRAFT_NOT_POSTABLE,

            runtimeScoringEnabled:
              false,
          },

          posted({
            campaignId:
              "CAM-OTHER",

            points:
              30,
          }),

          posted({
            personId:
              "PER-OTHER",

            points:
              30,
          }),
        ],
      });

    assert.equal(
      summary
        .contribution
        .historical
        .points,
      60
    );

    assert.equal(
      summary
        .contribution
        .historical
        .contributionCount,
      2
    );

    assert.equal(
      summary
        .ignoredEntryCount,
      3
    );
  }
);


test(
  "projection aggregates all five canonical score dimensions",
  () => {
    const summary =
      buildPerformanceSummaryProjection({
        campaignId:
          "CAM-001",

        personId:
          "PER-001",

        ledgerEntries: [
          posted({
            scoreDimension:
              SCORE_DIMENSIONS
                .TERRITORIAL_ACTIVITY,
            points:
              30,
          }),

          posted({
            scoreDimension:
              SCORE_DIMENSIONS
                .ATTENDANCE,
            points:
              22,
          }),

          posted({
            scoreDimension:
              SCORE_DIMENSIONS
                .ORGANIZATION,
            points:
              18,
          }),

          posted({
            scoreDimension:
              SCORE_DIMENSIONS
                .LOGISTICS,
            points:
              14,
          }),

          posted({
            scoreDimension:
              SCORE_DIMENSIONS
                .DIGITAL_ACTIVITY,
            points:
              6,
          }),
        ],
      });

    const dimensions =
      summary
        .contribution
        .historical
        .byDimension;

    assert.equal(
      dimensions
        .TERRITORIAL_ACTIVITY,
      30
    );

    assert.equal(
      dimensions.ATTENDANCE,
      22
    );

    assert.equal(
      dimensions.ORGANIZATION,
      18
    );

    assert.equal(
      dimensions.LOGISTICS,
      14
    );

    assert.equal(
      dimensions.DIGITAL_ACTIVITY,
      6
    );

    assert.equal(
      summary
        .contribution
        .historical
        .points,
      90
    );
  }
);


test(
  "period projection uses start inclusive and end exclusive occurredAt",
  () => {
    const summary =
      buildPerformanceSummaryProjection({
        campaignId:
          "CAM-001",

        personId:
          "PER-001",

        periodStart:
          1000,

        periodEnd:
          2000,

        ledgerEntries: [
          posted({
            points:
              10,
            occurredAt:
              999,
          }),

          posted({
            points:
              20,
            occurredAt:
              1000,
          }),

          posted({
            points:
              30,
            occurredAt:
              1999,
          }),

          posted({
            points:
              40,
            occurredAt:
              2000,
          }),
        ],
      });

    assert.equal(
      summary
        .contribution
        .historical
        .points,
      100
    );

    assert.equal(
      summary
        .contribution
        .currentPeriod
        .points,
      50
    );

    assert.equal(
      summary
        .contribution
        .currentPeriod
        .contributionCount,
      2
    );
  }
);


test(
  "period requires both boundaries and valid ordering",
  () => {
    assert.throws(
      () =>
        normalizePeriod({
          periodStart:
            1000,
        }),
      /PERFORMANCE_PERIOD_REQUIRES_BOTH_BOUNDARIES/
    );

    assert.throws(
      () =>
        normalizePeriod({
          periodStart:
            2000,
          periodEnd:
            1000,
        }),
      /INVALID_PERFORMANCE_PERIOD/
    );
  }
);


test(
  "period projection refuses scored posted entry without occurredAt",
  () => {
    assert.throws(
      () =>
        buildPerformanceSummaryProjection({
          campaignId:
            "CAM-001",

          personId:
            "PER-001",

          periodStart:
            1000,

          periodEnd:
            2000,

          ledgerEntries: [
            posted({
              occurredAt:
                null,
            }),
          ],
        }),
      /INVALID_POSTED_LEDGER_OCCURRED_AT/
    );
  }
);


test(
  "draft and reversed ledger states never contribute points",
  () => {
    const base =
      posted({
        points:
          30,
      });

    const summary =
      buildPerformanceSummaryProjection({
        campaignId:
          "CAM-001",

        personId:
          "PER-001",

        ledgerEntries: [
          {
            ...base,

            ledgerStatus:
              LEDGER_STATUSES
                .DRAFT_NOT_POSTABLE,

            runtimeScoringEnabled:
              false,
          },

          {
            ...base,

            ledgerStatus:
              LEDGER_STATUSES
                .REVERSED,

            runtimeScoringEnabled:
              false,
          },
        ],
      });

    assert.equal(
      summary
        .contribution
        .historical
        .points,
      0
    );

    assert.equal(
      summary
        .contribution
        .historical
        .contributionCount,
      0
    );
  }
);


test(
  "unknown score dimension in posted contribution fails closed",
  () => {
    assert.throws(
      () =>
        buildPerformanceSummaryProjection({
          campaignId:
            "CAM-001",

          personId:
            "PER-001",

          ledgerEntries: [
            posted({
              scoreDimension:
                "UNKNOWN_DIMENSION",
            }),
          ],
        }),
      /UNKNOWN_LEDGER_SCORE_DIMENSION/
    );
  }
);


test(
  "foundation calculates no general performance index and persists nothing",
  () => {
    const summary =
      buildPerformanceSummaryProjection({
        campaignId:
          "CAM-001",

        personId:
          "PER-001",

        ledgerEntries: [
          posted(),
        ],
      });

    assert.deepEqual(
      summary
        .generalPerformanceIndex,
      {
        calculated:
          false,

        value:
          null,

        formulaVersion:
          null,
      }
    );

    assert.equal(
      summary.persistenceEnabled,
      false
    );

    assert.equal(
      summary
        .runtimeScoringActivated,
      false
    );

    assert.equal(
      Object.isFrozen(summary),
      true
    );

    assert.equal(
      Object.isFrozen(
        summary.contribution
      ),
      true
    );
  }
);