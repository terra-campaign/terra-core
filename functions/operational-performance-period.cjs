"use strict";

/**
 * TERRA CAMPAIGN
 * BUILD-125
 *
 * OPERATIONAL PERFORMANCE PERIOD FOUNDATION
 *
 * Define el contrato temporal para capítulos/períodos
 * operacionales utilizados posteriormente por Performance.
 *
 * IMPORTANTE:
 * - No activa scoring.
 * - No calcula índice general.
 * - No escribe Firestore.
 * - No persiste Performance Summary.
 * - No interpreta calendario electoral.
 */

const OPERATIONAL_PERIOD_VERSION =
  "1.0.0";

const OPERATIONAL_PERIOD_STATUS =
  "DEFINED_NOT_ACTIVATED";

const OPERATIONAL_PERIOD_SCOPE =
  "OPERATIONAL_PERFORMANCE_PERIOD";

const MIN_DURATION_MONTHS = 3;

const STANDARD_DURATION_MONTHS = 3;

const MAX_DURATION_MONTHS = 6;

const DATE_PATTERN =
  /^\d{4}-\d{2}-\d{2}$/;


function requireDateToken(
  value,
  label
) {
  if (
    typeof value !== "string" ||
    !DATE_PATTERN.test(value.trim())
  ) {
    throw new Error(
      "INVALID_" + label
    );
  }

  const token =
    value.trim();

  const date =
    new Date(
      token + "T00:00:00.000Z"
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    throw new Error(
      "INVALID_" + label
    );
  }

  const normalized =
    date.toISOString()
      .slice(0, 10);

  if (
    normalized !== token
  ) {
    throw new Error(
      "INVALID_" + label
    );
  }

  return token;
}


function addMonths(
  dateToken,
  months
) {
  const date =
    new Date(
      dateToken +
      "T00:00:00.000Z"
    );

  const originalDay =
    date.getUTCDate();

  date.setUTCDate(1);

  date.setUTCMonth(
    date.getUTCMonth() +
    months
  );

  const lastDay =
    new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth() + 1,
        0
      )
    ).getUTCDate();

  date.setUTCDate(
    Math.min(
      originalDay,
      lastDay
    )
  );

  return date
    .toISOString()
    .slice(0, 10);
}


function monthsBetween(
  startDate,
  endDate
) {
  const start =
    new Date(
      startDate +
      "T00:00:00.000Z"
    );

  const end =
    new Date(
      endDate +
      "T00:00:00.000Z"
    );

  let months =
    (
      end.getUTCFullYear() -
      start.getUTCFullYear()
    ) * 12;

  months +=
    end.getUTCMonth() -
    start.getUTCMonth();

  if (
    end.getUTCDate() <
    start.getUTCDate()
  ) {
    months--;
  }

  return months;
}


function validateOperationalPeriod({
  campaignId,
  periodId,
  startDate,
  endDate
}) {
  if (
    typeof campaignId !== "string" ||
    !campaignId.trim()
  ) {
    throw new Error(
      "INVALID_CAMPAIGN_ID"
    );
  }

  if (
    typeof periodId !== "string" ||
    !periodId.trim()
  ) {
    throw new Error(
      "INVALID_PERIOD_ID"
    );
  }

  const start =
    requireDateToken(
      startDate,
      "PERIOD_START_DATE"
    );

  const end =
    requireDateToken(
      endDate,
      "PERIOD_END_DATE"
    );

  if (
    end <= start
  ) {
    throw new Error(
      "INVALID_PERIOD_DATE_ORDER"
    );
  }

  const durationMonths =
    monthsBetween(
      start,
      end
    );

  if (
    durationMonths <
    MIN_DURATION_MONTHS
  ) {
    throw new Error(
      "PERIOD_SHORTER_THAN_MINIMUM"
    );
  }

  if (
    durationMonths >
    MAX_DURATION_MONTHS
  ) {
    throw new Error(
      "PERIOD_LONGER_THAN_MAXIMUM"
    );
  }

  return Object.freeze({
    version:
      OPERATIONAL_PERIOD_VERSION,

    status:
      OPERATIONAL_PERIOD_STATUS,

    scope:
      OPERATIONAL_PERIOD_SCOPE,

    campaignId:
      campaignId.trim(),

    periodId:
      periodId.trim(),

    startDate:
      start,

    endDate:
      end,

    durationMonths,

    standardDuration:
      durationMonths ===
      STANDARD_DURATION_MONTHS
  });
}


function createStandardOperationalPeriod({
  campaignId,
  periodId,
  startDate
}) {
  const start =
    requireDateToken(
      startDate,
      "PERIOD_START_DATE"
    );

  const end =
    addMonths(
      start,
      STANDARD_DURATION_MONTHS
    );

  return validateOperationalPeriod({
    campaignId,
    periodId,
    startDate:
      start,
    endDate:
      end
  });
}


const OPERATIONAL_PERIOD_POLICY =
  Object.freeze({
    version:
      OPERATIONAL_PERIOD_VERSION,

    status:
      OPERATIONAL_PERIOD_STATUS,

    scope:
      OPERATIONAL_PERIOD_SCOPE,

    minimumDurationMonths:
      MIN_DURATION_MONTHS,

    standardDurationMonths:
      STANDARD_DURATION_MONTHS,

    maximumDurationMonths:
      MAX_DURATION_MONTHS,

    scoringActivated:
      false,

    performanceSummaryPersistenceEnabled:
      false,

    electoralCalendarCoupled:
      false
  });


module.exports = {
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
};
