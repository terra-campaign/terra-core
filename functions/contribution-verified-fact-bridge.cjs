"use strict";

const {
  buildMissionContributionCandidate,
  buildAttendanceContributionCandidate,
} =
  require("./contribution-candidate.cjs");

const BRIDGE_SCHEMA_VERSION =
  "1.0.0";

const BRIDGE_STATUSES =
  Object.freeze({
    DERIVED:
      "DERIVED",

    NOT_ELIGIBLE:
      "NOT_ELIGIBLE",

    ERROR:
      "ERROR",
  });

const BRIDGE_STAGES =
  Object.freeze({
    ELIGIBILITY:
      "ELIGIBILITY",

    IDENTITY:
      "IDENTITY",

    CANDIDATE:
      "CANDIDATE",
  });

function frozenResult({
  status,
  stage,
  reasonCode = null,
  candidate = null,
}) {
  return Object.freeze({
    bridgeSchemaVersion:
      BRIDGE_SCHEMA_VERSION,

    status,

    stage,

    reasonCode,

    candidate,

    persisted:
      false,

    ledgerWritten:
      false,

    pointsPosted:
      false,

    runtimeScoringActivated:
      false,
  });
}

function safeErrorCode(
  error,
  fallback
) {
  const message =
    typeof error?.message ===
      "string"
      ? error.message.trim()
      : "";

  if (
    /^[A-Z][A-Z0-9_]{2,127}$/
      .test(message)
  ) {
    return message;
  }

  return fallback;
}

function missionEligibility(
  review
) {
  if (
    !review ||
    typeof review !==
      "object"
  ) {
    return frozenResult({
      status:
        BRIDGE_STATUSES.ERROR,

      stage:
        BRIDGE_STAGES.ELIGIBILITY,

      reasonCode:
        "INVALID_MISSION_REVIEW",
    });
  }

  if (
    review.status !==
      "validated"
  ) {
    return frozenResult({
      status:
        BRIDGE_STATUSES
          .NOT_ELIGIBLE,

      stage:
        BRIDGE_STAGES.ELIGIBILITY,

      reasonCode:
        "MISSION_NOT_VALIDATED",
    });
  }

  if (
    review.pendingAppeal ===
      true
  ) {
    return frozenResult({
      status:
        BRIDGE_STATUSES
          .NOT_ELIGIBLE,

      stage:
        BRIDGE_STAGES.ELIGIBILITY,

      reasonCode:
        "MISSION_PENDING_APPEAL",
    });
  }

  return null;
}

async function deriveMissionContributionCandidateSafely({
  db,
  mission,
  evidence,
  review,
  reviewId,
  subjectProfile,
  resolveCanonicalIdentity,
}) {
  const eligibility =
    missionEligibility(
      review
    );

  if (eligibility) {
    return eligibility;
  }

  if (
    typeof resolveCanonicalIdentity !==
      "function"
  ) {
    return frozenResult({
      status:
        BRIDGE_STATUSES.ERROR,

      stage:
        BRIDGE_STAGES.IDENTITY,

      reasonCode:
        "IDENTITY_RESOLVER_REQUIRED",
    });
  }

  let canonicalIdentity;

  try {
    canonicalIdentity =
      await resolveCanonicalIdentity({
        db,

        tx:
          null,

        accountUid:
          review.subjectId,

        profile:
          subjectProfile,

        campaignId:
          mission?.campaignId,
      });
  } catch (error) {
    return frozenResult({
      status:
        BRIDGE_STATUSES.ERROR,

      stage:
        BRIDGE_STAGES.IDENTITY,

      reasonCode:
        safeErrorCode(
          error,
          "IDENTITY_RESOLUTION_FAILED"
        ),
    });
  }

  try {
    const candidate =
      buildMissionContributionCandidate({
        mission,
        evidence,
        review,
        reviewId,
        canonicalIdentity,
      });

    return frozenResult({
      status:
        BRIDGE_STATUSES.DERIVED,

      stage:
        BRIDGE_STAGES.CANDIDATE,

      candidate,
    });
  } catch (error) {
    return frozenResult({
      status:
        BRIDGE_STATUSES.ERROR,

      stage:
        BRIDGE_STAGES.CANDIDATE,

      reasonCode:
        safeErrorCode(
          error,
          "MISSION_CANDIDATE_DERIVATION_FAILED"
        ),
    });
  }
}

function deriveAttendanceContributionCandidateSafely({
  attendance,
  attendanceId,
  event,
}) {
  try {
    const candidate =
      buildAttendanceContributionCandidate({
        attendance,
        attendanceId,
        event,
      });

    return frozenResult({
      status:
        BRIDGE_STATUSES.DERIVED,

      stage:
        BRIDGE_STAGES.CANDIDATE,

      candidate,
    });
  } catch (error) {
    return frozenResult({
      status:
        BRIDGE_STATUSES.ERROR,

      stage:
        BRIDGE_STAGES.CANDIDATE,

      reasonCode:
        safeErrorCode(
          error,
          "ATTENDANCE_CANDIDATE_DERIVATION_FAILED"
        ),
    });
  }
}

module.exports = {
  BRIDGE_SCHEMA_VERSION,
  BRIDGE_STATUSES,
  BRIDGE_STAGES,
  deriveMissionContributionCandidateSafely,
  deriveAttendanceContributionCandidateSafely,
};
