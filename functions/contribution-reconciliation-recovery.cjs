"use strict";

const RECOVERY_SCHEMA_VERSION =
  "1.0.0-foundation";

const RECOVERY_STATUSES =
  Object.freeze({
    PENDING:
      "PENDING",

    RETRY_REQUIRED:
      "RETRY_REQUIRED",

    RECONCILED:
      "RECONCILED",
  });

function requireToken(
  value,
  fieldName
) {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    throw new Error(
      "INVALID_" + fieldName
    );
  }

  return value.trim();
}

function requirePositiveInteger(
  value,
  fieldName
) {
  if (
    !Number.isInteger(value) ||
    value < 1
  ) {
    throw new Error(
      "INVALID_" + fieldName
    );
  }

  return value;
}

function requireObject(
  value,
  fieldName
) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new Error(
      "INVALID_" + fieldName
    );
  }

  return value;
}

function requireBoolean(
  value,
  fieldName
) {
  if (typeof value !== "boolean") {
    throw new Error(
      "INVALID_" + fieldName
    );
  }

  return value;
}

function buildMissionReviewRecoveryRecord({
  operationId,
  campaignId,
  evidenceId,
  missionId,
  reviewId,
  revision,
  actorUid,
  subjectAccountUid,
  missionFact,
  evidenceFact,
  previousReviewFact,
  currentReviewFact,
  createdAt,
}) {
  const checkedOperationId =
    requireToken(
      operationId,
      "RECOVERY_OPERATION_ID"
    );

  const checkedCampaignId =
    requireToken(
      campaignId,
      "CAMPAIGN_ID"
    );

  const checkedEvidenceId =
    requireToken(
      evidenceId,
      "EVIDENCE_ID"
    );

  const checkedMissionId =
    requireToken(
      missionId,
      "MISSION_ID"
    );

  const checkedReviewId =
    requireToken(
      reviewId,
      "REVIEW_ID"
    );

  const checkedRevision =
    requirePositiveInteger(
      revision,
      "REVISION"
    );

  const checkedActorUid =
    requireToken(
      actorUid,
      "ACTOR_UID"
    );

  const checkedSubjectAccountUid =
    requireToken(
      subjectAccountUid,
      "SUBJECT_ACCOUNT_UID"
    );

  const checkedMissionFact =
    requireObject(
      missionFact,
      "MISSION_FACT"
    );

  const checkedEvidenceFact =
    requireObject(
      evidenceFact,
      "EVIDENCE_FACT"
    );

  const checkedPreviousReviewFact =
    previousReviewFact == null
      ? null
      : requireObject(
          previousReviewFact,
          "PREVIOUS_REVIEW_FACT"
        );

  const checkedCurrentReviewFact =
    requireObject(
      currentReviewFact,
      "CURRENT_REVIEW_FACT"
    );

  if (createdAt == null) {
    throw new Error(
      "RECOVERY_CREATED_AT_REQUIRED"
    );
  }

  return Object.freeze({
    schemaVersion:
      RECOVERY_SCHEMA_VERSION,

    operationId:
      checkedOperationId,

    status:
      RECOVERY_STATUSES.PENDING,

    campaignId:
      checkedCampaignId,

    evidenceId:
      checkedEvidenceId,

    missionId:
      checkedMissionId,

    reviewId:
      checkedReviewId,

    revision:
      checkedRevision,

    actorUid:
      checkedActorUid,

    subjectAccountUid:
      checkedSubjectAccountUid,

    missionFact:
      checkedMissionFact,

    evidenceFact:
      checkedEvidenceFact,

    previousReviewFact:
      checkedPreviousReviewFact,

    currentReviewFact:
      checkedCurrentReviewFact,

    attemptCount:
      0,

    lastError:
      null,

    createdAt,

    updatedAt:
      createdAt,

    reconciledAt:
      null,

    serverSideOnly:
      true,

    ledgerWritten:
      false,

    pointsPosted:
      false,

    performanceSummaryWritten:
      false,
  });
}


function assertRecoveryRecord(
  record
) {
  requireObject(
    record,
    "RECOVERY_RECORD"
  );

  requireToken(
    record.operationId,
    "RECOVERY_OPERATION_ID"
  );

  if (
    !Object.values(
      RECOVERY_STATUSES
    ).includes(record.status)
  ) {
    throw new Error(
      "INVALID_RECOVERY_STATUS"
    );
  }

  if (
    !Number.isInteger(
      record.attemptCount
    ) ||
    record.attemptCount < 0
  ) {
    throw new Error(
      "INVALID_RECOVERY_ATTEMPT_COUNT"
    );
  }

  return record;
}

function requireTransitionTimestamp(
  value
) {
  if (value == null) {
    throw new Error(
      "RECOVERY_UPDATED_AT_REQUIRED"
    );
  }

  return value;
}

function markRecoveryRetryRequired({
  record,
  errorCode,
  updatedAt,
}) {
  const checkedRecord =
    assertRecoveryRecord(
      record
    );

  if (
    checkedRecord.status ===
    RECOVERY_STATUSES.RECONCILED
  ) {
    throw new Error(
      "RECONCILED_RECOVERY_CANNOT_REQUIRE_RETRY"
    );
  }

  const checkedErrorCode =
    requireToken(
      errorCode,
      "RECOVERY_ERROR_CODE"
    );

  const checkedUpdatedAt =
    requireTransitionTimestamp(
      updatedAt
    );

  return Object.freeze({
    ...checkedRecord,

    status:
      RECOVERY_STATUSES.RETRY_REQUIRED,

    attemptCount:
      checkedRecord.attemptCount + 1,

    lastError:
      checkedErrorCode,

    updatedAt:
      checkedUpdatedAt,

    reconciledAt:
      null,
  });
}

function markRecoveryReconciled({
  record,
  observability,
  updatedAt,
}) {
  const checkedRecord =
    assertRecoveryRecord(
      record
    );

  if (
    checkedRecord.status ===
    RECOVERY_STATUSES.RECONCILED
  ) {
    throw new Error(
      "RECOVERY_ALREADY_RECONCILED"
    );
  }

  const checkedObservability =
    requireObject(
      observability,
      "RECOVERY_OBSERVABILITY"
    );

  const checkedLedgerWritten =
    requireBoolean(
      checkedObservability.ledgerWritten,
      "RECOVERY_LEDGER_WRITTEN"
    );

  const checkedPointsPosted =
    requireBoolean(
      checkedObservability.pointsPosted,
      "RECOVERY_POINTS_POSTED"
    );

  const checkedPerformanceSummaryWritten =
    requireBoolean(
      checkedObservability.performanceSummaryWritten,
      "RECOVERY_PERFORMANCE_SUMMARY_WRITTEN"
    );

  const checkedUpdatedAt =
    requireTransitionTimestamp(
      updatedAt
    );

  return Object.freeze({
    ...checkedRecord,

    status:
      RECOVERY_STATUSES.RECONCILED,

    attemptCount:
      checkedRecord.attemptCount + 1,

    lastError:
      null,

    ledgerWritten:
      checkedLedgerWritten,

    pointsPosted:
      checkedPointsPosted,

    performanceSummaryWritten:
      checkedPerformanceSummaryWritten,

    updatedAt:
      checkedUpdatedAt,

    reconciledAt:
      checkedUpdatedAt,
  });
}
function projectOptionalFields(
  source,
  fields
) {
  const result = {};

  for (const field of fields) {
    if (
      Object.prototype.hasOwnProperty.call(
        source,
        field
      )
    ) {
      result[field] =
        source[field];
    }
  }

  return result;
}

function projectMissionReviewRecoveryFact(
  review
) {
  if (review == null) {
    return null;
  }

  const source =
    requireObject(
      review,
      "RECOVERY_MISSION_REVIEW_REQUIRED"
    );

  return Object.freeze({
    campaignId:
      source.campaignId,

    missionId:
      source.missionId,

    evidenceId:
      source.evidenceId,

    subjectId:
      source.subjectId,

    status:
      source.status,

    pendingAppeal:
      source.pendingAppeal,

    ...projectOptionalFields(
      source,
      [
        "updatedAt",
        "firstDecisionAt",
      ]
    ),
  });
}

function projectMissionContributionRecoveryFacts({
  mission,
  evidence,
  previousReview,
  currentReview,
  reviewId,
}) {
  const missionSource =
    requireObject(
      mission,
      "RECOVERY_MISSION_REQUIRED"
    );

  const evidenceSource =
    requireObject(
      evidence,
      "RECOVERY_MISSION_EVIDENCE_REQUIRED"
    );

  const currentReviewSource =
    requireObject(
      currentReview,
      "RECOVERY_CURRENT_REVIEW_REQUIRED"
    );

  const checkedReviewId =
    requireToken(
      reviewId,
      "RECOVERY_REVIEW_ID_REQUIRED"
    );

  const projectedMission =
    Object.freeze({
      id:
        missionSource.id ??
        missionSource.missionId,

      campaignId:
        missionSource.campaignId,

      assignedTo:
        missionSource.assignedTo,

      ...projectOptionalFields(
        missionSource,
        [
          "activityCode",
          "activityCatalogVersion",
          "updatedAt",
        ]
      ),
    });

  const projectedEvidence =
    Object.freeze({
      id:
        evidenceSource.id ??
        evidenceSource.evidenceId,

      evidenceId:
        evidenceSource.evidenceId ??
        evidenceSource.id,

      campaignId:
        evidenceSource.campaignId,

      missionId:
        evidenceSource.missionId,

      uploadedBy:
        evidenceSource.uploadedBy,

      ...projectOptionalFields(
        evidenceSource,
        [
          "assignedTo",
          "updatedAt",
          "createdAt",
        ]
      ),
    });

  return Object.freeze({
    mission:
      projectedMission,

    evidence:
      projectedEvidence,

    previousReview:
      projectMissionReviewRecoveryFact(
        previousReview
      ),

    currentReview:
      projectMissionReviewRecoveryFact(
        currentReviewSource
      ),

    reviewId:
      checkedReviewId,
  });
}
module.exports = {
  projectMissionContributionRecoveryFacts,
  RECOVERY_SCHEMA_VERSION,
  RECOVERY_STATUSES,
  buildMissionReviewRecoveryRecord,
  markRecoveryRetryRequired,
  markRecoveryReconciled,
};