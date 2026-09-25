"use strict";

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


const PERFORMANCE_SUMMARY_SCHEMA_VERSION =
  "1.0.0";

const PERFORMANCE_SUMMARY_STATUS =
  "DEFINED_NOT_ACTIVATED";

const PERFORMANCE_SUMMARY_SCOPE =
  "CONTRIBUTION_FOUNDATION_ONLY";


const SCORE_DIMENSION_VALUES =
  Object.freeze(
    Object.values(
      SCORE_DIMENSIONS
    )
  );


function requireToken(
  value,
  label
) {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    throw new Error(
      "INVALID_" + label
    );
  }

  return value.trim();
}


function toMillis(
  value,
  label
) {
  if (value == null) {
    return null;
  }

  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (value instanceof Date) {
    const millis =
      value.getTime();

    if (!Number.isFinite(millis)) {
      throw new Error(
        "INVALID_" + label
      );
    }

    return millis;
  }

  if (
    value &&
    typeof value.toMillis ===
      "function"
  ) {
    const millis =
      value.toMillis();

    if (
      typeof millis !== "number" ||
      !Number.isFinite(millis)
    ) {
      throw new Error(
        "INVALID_" + label
      );
    }

    return millis;
  }

  if (
    value &&
    typeof value.seconds ===
      "number" &&
    Number.isFinite(
      value.seconds
    )
  ) {
    const nanos =
      typeof value.nanoseconds ===
        "number" &&
      Number.isFinite(
        value.nanoseconds
      )
        ? value.nanoseconds
        : 0;

    return (
      value.seconds * 1000 +
      Math.floor(
        nanos / 1000000
      )
    );
  }

  throw new Error(
    "INVALID_" + label
  );
}


function normalizePeriod({
  periodStart = null,
  periodEnd = null,
}) {
  const hasStart =
    periodStart != null;

  const hasEnd =
    periodEnd != null;

  if (hasStart !== hasEnd) {
    throw new Error(
      "PERFORMANCE_PERIOD_REQUIRES_BOTH_BOUNDARIES"
    );
  }

  if (!hasStart) {
    return Object.freeze({
      enabled:
        false,

      startMillis:
        null,

      endMillis:
        null,

      endExclusive:
        true,
    });
  }

  const startMillis =
    toMillis(
      periodStart,
      "PERIOD_START"
    );

  const endMillis =
    toMillis(
      periodEnd,
      "PERIOD_END"
    );

  if (
    endMillis <=
    startMillis
  ) {
    throw new Error(
      "INVALID_PERFORMANCE_PERIOD"
    );
  }

  return Object.freeze({
    enabled:
      true,

    startMillis,

    endMillis,

    endExclusive:
      true,
  });
}


function createDimensionTotals() {
  const totals = {};

  for (
    const dimension of
    SCORE_DIMENSION_VALUES
  ) {
    totals[dimension] = 0;
  }

  return totals;
}


function validatePostedContribution(
  entry
) {
  if (
    !entry ||
    typeof entry !== "object"
  ) {
    throw new Error(
      "INVALID_LEDGER_ENTRY"
    );
  }

  const activityCode =
    requireToken(
      entry.activityCode,
      "LEDGER_ACTIVITY_CODE"
    );

  const scoreDimension =
    requireToken(
      entry.scoreDimension,
      "LEDGER_SCORE_DIMENSION"
    );

  if (
    !SCORE_DIMENSION_VALUES
      .includes(
        scoreDimension
      )
  ) {
    throw new Error(
      "UNKNOWN_LEDGER_SCORE_DIMENSION:" +
      scoreDimension
    );
  }

  if (
    !Number.isInteger(
      entry.points
    ) ||
    entry.points <= 0
  ) {
    throw new Error(
      "INVALID_LEDGER_POINTS"
    );
  }

  return Object.freeze({
    activityCode,

    scoreDimension,

    points:
      entry.points,
  });
}


function isScoredPostedEntry(
  entry
) {
  return (
    entry &&
    typeof entry === "object" &&
    entry.ledgerStatus ===
      LEDGER_STATUSES.POSTED &&
    entry.runtimeScoringEnabled ===
      true
  );
}


function deepFreeze(
  value
) {
  if (
    !value ||
    typeof value !== "object" ||
    Object.isFrozen(value)
  ) {
    return value;
  }

  for (
    const child of
    Object.values(value)
  ) {
    deepFreeze(child);
  }

  return Object.freeze(value);
}


function buildPerformanceSummaryProjection({
  campaignId,
  personId,
  ledgerEntries,
  periodStart = null,
  periodEnd = null,
}) {
  const campaign =
    requireToken(
      campaignId,
      "CAMPAIGN_ID"
    );

  const person =
    requireToken(
      personId,
      "PERSON_ID"
    );

  if (
    !Array.isArray(
      ledgerEntries
    )
  ) {
    throw new Error(
      "INVALID_LEDGER_ENTRIES"
    );
  }

  const period =
    normalizePeriod({
      periodStart,
      periodEnd,
    });

  const historicalByDimension =
    createDimensionTotals();

  const periodByDimension =
    createDimensionTotals();

  let historicalPoints = 0;
  let historicalContributionCount = 0;

  let periodPoints = 0;
  let periodContributionCount = 0;

  let ignoredEntryCount = 0;

  for (
    const entry of
    ledgerEntries
  ) {
    if (
      !entry ||
      typeof entry !== "object"
    ) {
      ignoredEntryCount++;
      continue;
    }

    if (
      entry.campaignId !==
        campaign ||
      entry.personId !==
        person
    ) {
      ignoredEntryCount++;
      continue;
    }

    if (
      !isScoredPostedEntry(
        entry
      )
    ) {
      ignoredEntryCount++;
      continue;
    }

    const validated =
      validatePostedContribution(
        entry
      );

    historicalPoints +=
      validated.points;

    historicalContributionCount++;

    historicalByDimension[
      validated.scoreDimension
    ] += validated.points;

    if (!period.enabled) {
      continue;
    }

    const occurredAtMillis =
      toMillis(
        entry.occurredAt,
        "POSTED_LEDGER_OCCURRED_AT"
      );

    if (occurredAtMillis == null) {
      throw new Error(
        "INVALID_POSTED_LEDGER_OCCURRED_AT"
      );
    }

    if (
      occurredAtMillis >=
        period.startMillis &&
      occurredAtMillis <
        period.endMillis
    ) {
      periodPoints +=
        validated.points;

      periodContributionCount++;

      periodByDimension[
        validated.scoreDimension
      ] += validated.points;
    }
  }

  return deepFreeze({
    schemaVersion:
      PERFORMANCE_SUMMARY_SCHEMA_VERSION,

    status:
      PERFORMANCE_SUMMARY_STATUS,

    scope:
      PERFORMANCE_SUMMARY_SCOPE,

    campaignId:
      campaign,

    personId:
      person,

    period,

    contribution: {
      historical: {
        points:
          historicalPoints,

        contributionCount:
          historicalContributionCount,

        byDimension:
          historicalByDimension,
      },

      currentPeriod: {
        enabled:
          period.enabled,

        points:
          period.enabled
            ? periodPoints
            : null,

        contributionCount:
          period.enabled
            ? periodContributionCount
            : null,

        byDimension:
          period.enabled
            ? periodByDimension
            : null,
      },
    },

    ignoredEntryCount,

    generalPerformanceIndex: {
      calculated:
        false,

      value:
        null,

      formulaVersion:
        null,
    },

    persistenceEnabled:
      false,

    runtimeScoringActivated:
      false,
  });
}


module.exports = {
  PERFORMANCE_SUMMARY_SCHEMA_VERSION,
  PERFORMANCE_SUMMARY_STATUS,
  PERFORMANCE_SUMMARY_SCOPE,
  SCORE_DIMENSION_VALUES,
  normalizePeriod,
  buildPerformanceSummaryProjection,
};