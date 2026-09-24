"use strict";

const {
  createHash,
} =
  require("node:crypto");

const {
  CATALOG_VERSION,
  SOURCE_TYPES,
  POINT_MODES,
} =
  require("./activity-catalog-v1.cjs");

const {
  buildMissionSourceId,
  buildAttendanceSourceId,
  buildGrowthSourceId,
} =
  require("./contribution-source.cjs");

const {
  getContributionRule,
  assertRuleSourceCompatibility,
} =
  require("./contribution-rules-v1.cjs");

const {
  buildContributionLedgerDraft,
} =
  require("./contribution-ledger.cjs");

const {
  canonicalGrowthValidationDocumentId,
  validateGrowthMilestoneFact,
} =
  require("./growth-validation.cjs");

const CANDIDATE_SCHEMA_VERSION =
  "1.2.0";

const CANDIDATE_STATUSES =
  Object.freeze({
    UNCLASSIFIED:
      "UNCLASSIFIED",

    ELIGIBLE_DRAFT:
      "ELIGIBLE_DRAFT",
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
      "INVALID_" +
      fieldName
    );
  }

  return value.trim();
}

function optionalActivityCode(
  value
) {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    return null;
  }

  return value.trim();
}

function assertActivityCatalogVersion(
  value
) {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    throw new Error(
      "ACTIVITY_CATALOG_VERSION_MISSING"
    );
  }

  if (
    value.trim() !==
    CATALOG_VERSION
  ) {
    throw new Error(
      "ACTIVITY_CATALOG_VERSION_MISMATCH"
    );
  }

  return CATALOG_VERSION;
}

function makeCandidateId({
  sourceType,
  sourceId,
}) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        "terra-contribution-candidate",
        CANDIDATE_SCHEMA_VERSION,
        sourceType,
        sourceId,
      ])
    )
    .digest("hex");
}

function buildUnclassifiedCandidate({
  campaignId,
  personId,
  sourceType,
  sourceId,
  occurredAt = null,
  evidenceRef = null,
}) {
  return Object.freeze({
    candidateId:
      makeCandidateId({
        sourceType,
        sourceId,
      }),

    schemaVersion:
      CANDIDATE_SCHEMA_VERSION,

    candidateStatus:
      CANDIDATE_STATUSES
        .UNCLASSIFIED,

    campaignId,

    personId,

    activityCode:
      null,

    sourceType,

    sourceId,

    occurredAt,

    evidenceRef,

    points:
      null,

    scoreDimension:
      null,

    ledgerDraft:
      null,

    classificationRequired:
      true,

    runtimePostingEnabled:
      false,
  });
}

function buildClassifiedCandidate({
  campaignId,
  personId,
  activityCode,
  sourceType,
  sourceId,
  occurredAt = null,
  evidenceRef = null,
}) {
  const activity =
    requireToken(
      activityCode,
      "ACTIVITY_CODE"
    );

  const rule =
    getContributionRule(
      activity
    );

  if (
    rule.pointMode !==
      POINT_MODES.FIXED
  ) {
    throw new Error(
      "NON_FIXED_ACTIVITY_REQUIRES_SPECIALIZED_ADAPTER"
    );
  }

  assertRuleSourceCompatibility({
    rule,
    sourceType,
    scoreDimension:
      rule.scoreDimension,
  });

  const ledgerDraft =
    buildContributionLedgerDraft({
      campaignId,
      personId,

      activityCode:
        activity,

      sourceType,
      sourceId,

      scoreDimension:
        rule.scoreDimension,

      points:
        rule.basePoints,

      occurredAt,
      evidenceRef,
    });

  return Object.freeze({
    candidateId:
      makeCandidateId({
        sourceType,
        sourceId,
      }),

    schemaVersion:
      CANDIDATE_SCHEMA_VERSION,

    candidateStatus:
      CANDIDATE_STATUSES
        .ELIGIBLE_DRAFT,

    campaignId,

    personId,

    activityCode:
      activity,

    sourceType,

    sourceId,

    occurredAt,

    evidenceRef,

    points:
      rule.basePoints,

    scoreDimension:
      rule.scoreDimension,

    ledgerDraft,

    classificationRequired:
      false,

    runtimePostingEnabled:
      false,
  });
}

function buildMissionContributionCandidate({
  mission,
  evidence,
  review,
  reviewId,
  canonicalIdentity,
}) {
  if (
    !mission ||
    typeof mission !== "object"
  ) {
    throw new Error(
      "INVALID_MISSION"
    );
  }

  if (
    !evidence ||
    typeof evidence !== "object"
  ) {
    throw new Error(
      "INVALID_MISSION_EVIDENCE"
    );
  }

  if (
    !review ||
    typeof review !== "object"
  ) {
    throw new Error(
      "INVALID_MISSION_REVIEW"
    );
  }

  if (
    !canonicalIdentity ||
    typeof canonicalIdentity !==
      "object"
  ) {
    throw new Error(
      "INVALID_CANONICAL_IDENTITY"
    );
  }

  const canonicalPersonId =
    requireToken(
      canonicalIdentity.personId,
      "PERSON_ID"
    );

  const operationalAccountUid =
    requireToken(
      canonicalIdentity.accountUid,
      "ACCOUNT_UID"
    );

  const campaignId =
    requireToken(
      mission.campaignId,
      "CAMPAIGN_ID"
    );

  const missionId =
    requireToken(
      mission.id ||
      mission.missionId,
      "MISSION_ID"
    );

  const evidenceId =
    requireToken(
      evidence.id ||
      evidence.evidenceId,
      "EVIDENCE_ID"
    );

  const reviewDocumentId =
    requireToken(
      reviewId,
      "REVIEW_ID"
    );

  if (
    evidence.campaignId !==
    campaignId
  ) {
    throw new Error(
      "MISSION_EVIDENCE_CAMPAIGN_MISMATCH"
    );
  }

  if (
    review.campaignId !==
    campaignId
  ) {
    throw new Error(
      "MISSION_REVIEW_CAMPAIGN_MISMATCH"
    );
  }

  if (
    mission.assignedTo !==
    operationalAccountUid
  ) {
    throw new Error(
      "MISSION_ASSIGNEE_MISMATCH"
    );
  }

  if (
    evidence.uploadedBy !==
    operationalAccountUid
  ) {
    throw new Error(
      "MISSION_EVIDENCE_SUBJECT_MISMATCH"
    );
  }

  if (
    review.subjectId !==
    operationalAccountUid
  ) {
    throw new Error(
      "MISSION_REVIEW_SUBJECT_MISMATCH"
    );
  }

  if (
    evidence.assignedTo != null &&
    evidence.assignedTo !==
      operationalAccountUid
  ) {
    throw new Error(
      "MISSION_EVIDENCE_ASSIGNEE_MISMATCH"
    );
  }

  if (
    review.status !==
      "validated"
  ) {
    throw new Error(
      "MISSION_NOT_VALIDATED"
    );
  }

  if (
    review.pendingAppeal ===
      true
  ) {
    throw new Error(
      "MISSION_PENDING_APPEAL"
    );
  }

  if (
    reviewDocumentId !==
    evidenceId
  ) {
    throw new Error(
      "MISSION_REVIEW_DOCUMENT_ID_MISMATCH"
    );
  }

  if (
    review.evidenceId !==
    evidenceId
  ) {
    throw new Error(
      "REVIEW_EVIDENCE_MISMATCH"
    );
  }

  if (
    review.missionId !==
    missionId
  ) {
    throw new Error(
      "MISSION_REVIEW_MISMATCH"
    );
  }

  if (
    evidence.missionId !==
    missionId
  ) {
    throw new Error(
      "MISSION_EVIDENCE_MISMATCH"
    );
  }

  const sourceId =
    buildMissionSourceId({
      missionId,
      personId:
        canonicalPersonId,
    });

  const occurredAt =
    review.updatedAt ??
    review.firstDecisionAt ??
    evidence.updatedAt ??
    evidence.createdAt ??
    mission.updatedAt ??
    null;

  const evidenceRef =
    "missionEvidence/" +
    evidenceId;

  const activityCode =
    optionalActivityCode(
      mission.activityCode
    );

  if (!activityCode) {
    return buildUnclassifiedCandidate({
      campaignId,

      personId:
        canonicalPersonId,

      sourceType:
        SOURCE_TYPES
          .MISSION_VALIDATION,

      sourceId,
      occurredAt,
      evidenceRef,
    });
  }

  assertActivityCatalogVersion(
    mission.activityCatalogVersion
  );

  return buildClassifiedCandidate({
    campaignId,

    personId:
      canonicalPersonId,

    activityCode,

    sourceType:
      SOURCE_TYPES
        .MISSION_VALIDATION,

    sourceId,
    occurredAt,
    evidenceRef,
  });
}

function buildAttendanceContributionCandidate({
  attendance,
  attendanceId,
  event,
}) {
  if (
    !attendance ||
    typeof attendance !== "object"
  ) {
    throw new Error(
      "INVALID_ATTENDANCE"
    );
  }

  if (
    !event ||
    typeof event !== "object"
  ) {
    throw new Error(
      "INVALID_EVENT"
    );
  }

  const canonicalPersonId =
    requireToken(
      attendance.personId,
      "PERSON_ID"
    );

  const campaignId =
    requireToken(
      attendance.campaignId,
      "CAMPAIGN_ID"
    );

  const eventId =
    requireToken(
      attendance.eventId,
      "EVENT_ID"
    );

  const eventDocumentId =
    requireToken(
      event.id ||
      event.eventId,
      "EVENT_DOCUMENT_ID"
    );

  const documentId =
    requireToken(
      attendanceId,
      "ATTENDANCE_ID"
    );

  if (
    eventDocumentId !==
    eventId
  ) {
    throw new Error(
      "ATTENDANCE_EVENT_MISMATCH"
    );
  }

  if (
    event.campaignId !==
    campaignId
  ) {
    throw new Error(
      "ATTENDANCE_EVENT_CAMPAIGN_MISMATCH"
    );
  }

  if (
    attendance.attended !==
      true
  ) {
    throw new Error(
      "ATTENDANCE_NOT_CONFIRMED"
    );
  }

  if (
    !attendance.validatedByUserId
  ) {
    throw new Error(
      "ATTENDANCE_VALIDATOR_MISSING"
    );
  }

  const sourceId =
    buildAttendanceSourceId({
      eventId,

      personId:
        canonicalPersonId,
    });

  const expectedAttendanceId =
    createHash("sha256")
      .update(
        JSON.stringify([
          "event-attendance",
          eventId,
          canonicalPersonId,
        ])
      )
      .digest("hex");

  if (
    documentId !==
    expectedAttendanceId
  ) {
    throw new Error(
      "ATTENDANCE_ID_NOT_CANONICAL"
    );
  }

  const occurredAt =
    attendance.checkedInAt ??
    attendance.updatedAt ??
    attendance.createdAt ??
    null;

  const evidenceRef =
    "eventAttendance/" +
    documentId;

  const activityCode =
    optionalActivityCode(
      event.activityCode
    );

  if (!activityCode) {
    return buildUnclassifiedCandidate({
      campaignId,

      personId:
        canonicalPersonId,

      sourceType:
        SOURCE_TYPES
          .ATTENDANCE_RECORD,

      sourceId,
      occurredAt,
      evidenceRef,
    });
  }

  assertActivityCatalogVersion(
    event.activityCatalogVersion
  );

  return buildClassifiedCandidate({
    campaignId,

    personId:
      canonicalPersonId,

    activityCode,

    sourceType:
      SOURCE_TYPES
        .ATTENDANCE_RECORD,

    sourceId,
    occurredAt,
    evidenceRef,
  });
}


function buildGrowthContributionCandidate({
  growthValidation,
  growthValidationId,
}) {
  if (
    !growthValidation ||
    typeof growthValidation !== "object"
  ) {
    throw new Error(
      "INVALID_GROWTH_VALIDATION"
    );
  }

  const campaignId =
    requireToken(
      growthValidation.campaignId,
      "CAMPAIGN_ID"
    );

  const subjectPersonId =
    requireToken(
      growthValidation.personId,
      "GROWTH_SUBJECT_PERSON_ID"
    );

  const contributorPersonId =
    requireToken(
      growthValidation.introducedByPersonId,
      "INTRODUCED_BY_PERSON_ID"
    );

  if (
    subjectPersonId ===
    contributorPersonId
  ) {
    throw new Error(
      "GROWTH_SELF_ATTRIBUTION_NOT_ALLOWED"
    );
  }

  if (
    growthValidation.status !==
    "validated"
  ) {
    throw new Error(
      "GROWTH_VALIDATION_NOT_FINAL"
    );
  }

  requireToken(
    growthValidation.validatedByPersonId,
    "GROWTH_VALIDATOR_PERSON_ID"
  );

  assertActivityCatalogVersion(
    growthValidation.activityCatalogVersion
  );

  const milestone =
    validateGrowthMilestoneFact(
      growthValidation
    );

  const canonicalValidationId =
    canonicalGrowthValidationDocumentId({
      campaignId,

      personId:
        subjectPersonId,

      introducedByPersonId:
        contributorPersonId,

      milestone:
        milestone.milestone,
    });

  const validationDocumentId =
    requireToken(
      growthValidationId,
      "GROWTH_VALIDATION_ID"
    );

  if (
    validationDocumentId !==
    canonicalValidationId
  ) {
    throw new Error(
      "GROWTH_VALIDATION_ID_NOT_CANONICAL"
    );
  }

  const embeddedValidationId =
    growthValidation.id ||
    growthValidation.growthValidationId ||
    null;

  if (
    embeddedValidationId != null &&
    requireToken(
      embeddedValidationId,
      "EMBEDDED_GROWTH_VALIDATION_ID"
    ) !== validationDocumentId
  ) {
    throw new Error(
      "GROWTH_VALIDATION_DOCUMENT_ID_MISMATCH"
    );
  }

  const activityCode =
    "ORGANIZATIONAL_GROWTH";

  const rule =
    getContributionRule(
      activityCode
    );

  if (
    rule.pointMode !==
    POINT_MODES.MAXIMUM
  ) {
    throw new Error(
      "GROWTH_RULE_MUST_BE_MAXIMUM"
    );
  }

  assertRuleSourceCompatibility({
    rule,

    sourceType:
      SOURCE_TYPES.GROWTH_VALIDATION,

    scoreDimension:
      rule.scoreDimension,
  });

  const sourceId =
    buildGrowthSourceId({
      growthValidationId:
        validationDocumentId,

      personId:
        contributorPersonId,
    });

  const occurredAt =
    growthValidation.validatedAt ??
    growthValidation.updatedAt ??
    growthValidation.createdAt ??
    null;

  const evidenceRef =
    "growthValidations/" +
    validationDocumentId;

  const ledgerDraft =
    buildContributionLedgerDraft({
      campaignId,

      personId:
        contributorPersonId,

      activityCode,

      sourceType:
        SOURCE_TYPES.GROWTH_VALIDATION,

      sourceId,

      scoreDimension:
        rule.scoreDimension,

      points:
        milestone.points,

      occurredAt,
      evidenceRef,
    });

  return Object.freeze({
    candidateId:
      makeCandidateId({
        sourceType:
          SOURCE_TYPES.GROWTH_VALIDATION,

        sourceId,
      }),

    schemaVersion:
      CANDIDATE_SCHEMA_VERSION,

    candidateStatus:
      CANDIDATE_STATUSES.ELIGIBLE_DRAFT,

    campaignId,

    personId:
      contributorPersonId,

    activityCode,

    sourceType:
      SOURCE_TYPES.GROWTH_VALIDATION,

    sourceId,
    occurredAt,
    evidenceRef,

    points:
      milestone.points,

    scoreDimension:
      rule.scoreDimension,

    ledgerDraft,

    classificationRequired:
      false,

    runtimePostingEnabled:
      false,
  });
}

module.exports = {
  CANDIDATE_SCHEMA_VERSION,
  CANDIDATE_STATUSES,
  buildMissionContributionCandidate,
  buildAttendanceContributionCandidate,
  buildGrowthContributionCandidate,
};
