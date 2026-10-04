"use strict";

const test =
  require("node:test");

const assert =
  require("node:assert/strict");

const {
  OPERATIONAL_PERIOD_VERSION,
  OPERATIONAL_PERIOD_STATUS,
  OPERATIONAL_PERIOD_SCOPE,
  MIN_DURATION_MONTHS,
  STANDARD_DURATION_MONTHS,
  MAX_DURATION_MONTHS,
  OPERATIONAL_PERIOD_POLICY,
  addMonths,
  monthsBetween,
  validateOperationalPeriod,
  createStandardOperationalPeriod
} =
  require("./operational-performance-period.cjs");


test(
  "operational period foundation remains explicitly inactive",
  () => {
    assert.equal(
      OPERATIONAL_PERIOD_VERSION,
      "1.0.0"
    );

    assert.equal(
      OPERATIONAL_PERIOD_STATUS,
      "DEFINED_NOT_ACTIVATED"
    );

    assert.equal(
      OPERATIONAL_PERIOD_SCOPE,
      "OPERATIONAL_PERFORMANCE_PERIOD"
    );

    assert.equal(
      OPERATIONAL_PERIOD_POLICY.scoringActivated,
      false
    );

    assert.equal(
      OPERATIONAL_PERIOD_POLICY.performanceSummaryPersistenceEnabled,
      false
    );

    assert.equal(
      OPERATIONAL_PERIOD_POLICY.electoralCalendarCoupled,
      false
    );
  }
);


test(
  "minimum standard and maximum duration are three to six months",
  () => {
    assert.equal(
      MIN_DURATION_MONTHS,
      3
    );

    assert.equal(
      STANDARD_DURATION_MONTHS,
      3
    );

    assert.equal(
      MAX_DURATION_MONTHS,
      6
    );
  }
);


test(
  "standard operational period creates exactly three calendar months",
  () => {
    const period =
      createStandardOperationalPeriod({
        campaignId:
          "CAM-001",

        periodId:
          "PER-001",

        startDate:
          "2026-01-01"
      });

    assert.equal(
      period.startDate,
      "2026-01-01"
    );

    assert.equal(
      period.endDate,
      "2026-04-01"
    );

    assert.equal(
      period.durationMonths,
      3
    );

    assert.equal(
      period.standardDuration,
      true
    );
  }
);


test(
  "six month operational period is accepted",
  () => {
    const period =
      validateOperationalPeriod({
        campaignId:
          "CAM-001",

        periodId:
          "PER-002",

        startDate:
          "2026-01-01",

        endDate:
          "2026-07-01"
      });

    assert.equal(
      period.durationMonths,
      6
    );

    assert.equal(
      period.standardDuration,
      false
    );
  }
);


test(
  "period shorter than three months is rejected",
  () => {
    assert.throws(
      () =>
        validateOperationalPeriod({
          campaignId:
            "CAM-001",

          periodId:
            "PER-003",

          startDate:
            "2026-01-01",

          endDate:
            "2026-03-31"
        }),
      {
        message:
          "PERIOD_SHORTER_THAN_MINIMUM"
      }
    );
  }
);


test(
  "period longer than six months is rejected",
  () => {
    assert.throws(
      () =>
        validateOperationalPeriod({
          campaignId:
            "CAM-001",

          periodId:
            "PER-004",

          startDate:
            "2026-01-01",

          endDate:
            "2026-08-01"
        }),
      {
        message:
          "PERIOD_LONGER_THAN_MAXIMUM"
      }
    );
  }
);


test(
  "end date must be after start date",
  () => {
    assert.throws(
      () =>
        validateOperationalPeriod({
          campaignId:
            "CAM-001",

          periodId:
            "PER-005",

          startDate:
            "2026-06-01",

          endDate:
            "2026-06-01"
        }),
      {
        message:
          "INVALID_PERIOD_DATE_ORDER"
      }
    );
  }
);


test(
  "invalid date tokens fail closed",
  () => {
    assert.throws(
      () =>
        validateOperationalPeriod({
          campaignId:
            "CAM-001",

          periodId:
            "PER-006",

          startDate:
            "2026-02-30",

          endDate:
            "2026-06-01"
        }),
      {
        message:
          "INVALID_PERIOD_START_DATE"
      }
    );
  }
);


test(
  "calendar month arithmetic is deterministic",
  () => {
    assert.equal(
      addMonths(
        "2026-01-15",
        3
      ),
      "2026-04-15"
    );

    assert.equal(
      addMonths(
        "2026-01-31",
        1
      ),
      "2026-02-28"
    );

    assert.equal(
      addMonths(
        "2024-01-31",
        1
      ),
      "2024-02-29"
    );
  }
);


test(
  "monthsBetween resolves exact calendar month boundaries",
  () => {
    assert.equal(
      monthsBetween(
        "2026-01-01",
        "2026-04-01"
      ),
      3
    );

    assert.equal(
      monthsBetween(
        "2026-01-01",
        "2026-07-01"
      ),
      6
    );
  }
);


test(
  "policy object is immutable",
  () => {
    assert.equal(
      Object.isFrozen(
        OPERATIONAL_PERIOD_POLICY
      ),
      true
    );
  }
);
