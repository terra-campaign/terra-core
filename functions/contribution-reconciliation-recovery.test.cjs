"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

test(
  "recovery contract is server-side, durable and does not persist contribution candidates",
  () => {
    const {
      RECOVERY_SCHEMA_VERSION,
      RECOVERY_STATUSES,
      buildMissionReviewRecoveryRecord,
    } = require("./contribution-reconciliation-recovery.cjs");

    assert.equal(
      typeof RECOVERY_SCHEMA_VERSION,
      "string"
    );

    assert.deepEqual(
      RECOVERY_STATUSES,
      {
        PENDING: "PENDING",
        RETRY_REQUIRED: "RETRY_REQUIRED",
        RECONCILED: "RECONCILED",
      }
    );

    const record =
      buildMissionReviewRecoveryRecord({
        operationId:
          "mission-review:EVID-001:revision:3",

        campaignId:
          "CAM-001",

        evidenceId:
          "EVID-001",

        missionId:
          "MIS-001",

        reviewId:
          "EVID-001",

        revision:
          3,

        actorUid:
          "REVIEWER-001",

        subjectAccountUid:
          "SUBJECT-001",

        missionFact: {
          campaignId: "CAM-001",
          id: "MIS-001",
          assignedTo: "SUBJECT-001",
          activityCode: "MISSION_VALIDATED",
          activityCatalogVersion: "1.0.0",
          updatedAt: "MISSION_TIME",
        },

        evidenceFact: {
          campaignId: "CAM-001",
          id: "EVID-001",
          missionId: "MIS-001",
          uploadedBy: "SUBJECT-001",
          assignedTo: "SUBJECT-001",
          updatedAt: "EVIDENCE_TIME",
          createdAt: "EVIDENCE_CREATED",
        },

        previousReviewFact: {
          campaignId: "CAM-001",
          evidenceId: "EVID-001",
          missionId: "MIS-001",
          subjectId: "SUBJECT-001",
          status: "pending",
          pendingAppeal: false,
          updatedAt: "PREVIOUS_REVIEW_TIME",
        },

        currentReviewFact: {
          campaignId: "CAM-001",
          evidenceId: "EVID-001",
          missionId: "MIS-001",
          subjectId: "SUBJECT-001",
          status: "validated",
          pendingAppeal: false,
          updatedAt: "CURRENT_REVIEW_TIME",
        },

        createdAt:
          "SERVER_TIME",
      });

    assert.equal(
      record.operationId,
      "mission-review:EVID-001:revision:3"
    );

    assert.equal(
      record.status,
      RECOVERY_STATUSES.PENDING
    );

    assert.equal(
      record.attemptCount,
      0
    );

    assert.equal(
      record.lastError,
      null
    );

    assert.equal(
      record.campaignId,
      "CAM-001"
    );

    assert.equal(
      record.evidenceId,
      "EVID-001"
    );

    assert.equal(
      record.missionId,
      "MIS-001"
    );

    assert.equal(
      record.reviewId,
      "EVID-001"
    );

    assert.equal(
      record.revision,
      3
    );

    assert.equal(
      record.actorUid,
      "REVIEWER-001"
    );

    assert.equal(
      record.subjectAccountUid,
      "SUBJECT-001"
    );

    assert.equal(
      record.contributionCandidate,
      undefined
    );

    assert.equal(
      record.candidate,
      undefined
    );

    assert.equal(
      record.ledgerWritten,
      false
    );

    assert.equal(
      record.pointsPosted,
      false
    );

    assert.equal(
      record.performanceSummaryWritten,
      false
    );

    assert.equal(
      record.serverSideOnly,
      true
    );

    assert.equal(
      record.createdAt,
      "SERVER_TIME"
    );

    assert.equal(
      record.updatedAt,
      "SERVER_TIME"
    );

    assert.equal(
      record.reconciledAt,
      null
    );

    assert.ok(
      Object.isFrozen(record)
    );
  }
);
test(
  "failed reconciliation becomes RETRY_REQUIRED and increments attempt count",
  () => {
    const {
      RECOVERY_STATUSES,
      buildMissionReviewRecoveryRecord,
      markRecoveryRetryRequired,
    } = require("./contribution-reconciliation-recovery.cjs");

    const pending =
      buildMissionReviewRecoveryRecord({
        operationId:
          "mission-review:EVID-002:revision:4",
        campaignId:
          "CAM-001",
        evidenceId:
          "EVID-002",
        missionId:
          "MIS-002",
        reviewId:
          "EVID-002",
        revision:
          4,
        actorUid:
          "REVIEWER-001",
        subjectAccountUid:
          "SUBJECT-001",
        missionFact: {},
        evidenceFact: {},
        previousReviewFact: {},
        currentReviewFact: {},
        createdAt:
          "TIME-1",
      });

    const failed =
      markRecoveryRetryRequired({
        record:
          pending,
        errorCode:
          "CONTRIBUTION_POSTING_FAILED",
        updatedAt:
          "TIME-2",
      });

    assert.equal(
      failed.status,
      RECOVERY_STATUSES.RETRY_REQUIRED
    );

    assert.equal(
      failed.attemptCount,
      1
    );

    assert.equal(
      failed.lastError,
      "CONTRIBUTION_POSTING_FAILED"
    );

    assert.equal(
      failed.updatedAt,
      "TIME-2"
    );

    assert.equal(
      failed.reconciledAt,
      null
    );

    assert.ok(
      Object.isFrozen(failed)
    );

    assert.equal(
      pending.status,
      RECOVERY_STATUSES.PENDING
    );

    assert.equal(
      pending.attemptCount,
      0
    );
  }
);

test(
  "successful reconciliation becomes RECONCILED and clears the previous error",
  () => {
    const {
      RECOVERY_STATUSES,
      buildMissionReviewRecoveryRecord,
      markRecoveryRetryRequired,
      markRecoveryReconciled,
    } = require("./contribution-reconciliation-recovery.cjs");

    const pending =
      buildMissionReviewRecoveryRecord({
        operationId:
          "mission-review:EVID-003:revision:5",
        campaignId:
          "CAM-001",
        evidenceId:
          "EVID-003",
        missionId:
          "MIS-003",
        reviewId:
          "EVID-003",
        revision:
          5,
        actorUid:
          "REVIEWER-001",
        subjectAccountUid:
          "SUBJECT-001",
        missionFact: {},
        evidenceFact: {},
        previousReviewFact: {},
        currentReviewFact: {},
        createdAt:
          "TIME-1",
      });

    const failed =
      markRecoveryRetryRequired({
        record:
          pending,
        errorCode:
          "TEMPORARY_RECONCILIATION_FAILURE",
        updatedAt:
          "TIME-2",
      });

    const reconciled =
      markRecoveryReconciled({
        record:
          failed,
        updatedAt:
          "TIME-3",
      });

    assert.equal(
      reconciled.status,
      RECOVERY_STATUSES.RECONCILED
    );

    assert.equal(
      reconciled.attemptCount,
      2
    );

    assert.equal(
      reconciled.lastError,
      null
    );

    assert.equal(
      reconciled.updatedAt,
      "TIME-3"
    );

    assert.equal(
      reconciled.reconciledAt,
      "TIME-3"
    );

    assert.equal(
      reconciled.ledgerWritten,
      false
    );

    assert.equal(
      reconciled.performanceSummaryWritten,
      false
    );

    assert.ok(
      Object.isFrozen(reconciled)
    );
  }
);
test(
  "mission recovery fact projection keeps only fields required to rederive contribution",
  () => {
    const {
      projectMissionContributionRecoveryFacts,
    } = require(
      "./contribution-reconciliation-recovery.cjs"
    );

    const result =
      projectMissionContributionRecoveryFacts({
        mission: {
          id:
            "MISSION-001",

          campaignId:
            "CAM-001",

          assignedTo:
            "USER-001",

          activityCode:
            "MISSION_VALIDATED",

          activityCatalogVersion:
            "1.0.0",

          updatedAt:
            100,

          title:
            "MUST_NOT_PERSIST",

          description:
            "MUST_NOT_PERSIST",
        },

        evidence: {
          id:
            "EVIDENCE-001",

          evidenceId:
            "EVIDENCE-001",

          campaignId:
            "CAM-001",

          missionId:
            "MISSION-001",

          uploadedBy:
            "USER-001",

          assignedTo:
            "USER-001",

          updatedAt:
            200,

          createdAt:
            150,

          description:
            "MUST_NOT_PERSIST",

          imagePath:
            "MUST_NOT_PERSIST",
        },

        previousReview: {
          campaignId:
            "CAM-001",

          missionId:
            "MISSION-001",

          evidenceId:
            "EVIDENCE-001",

          subjectId:
            "USER-001",

          status:
            "pending",

          pendingAppeal:
            false,

          updatedAt:
            250,

          firstDecisionAt:
            240,

          reason:
            "MUST_NOT_PERSIST",
        },

        currentReview: {
          campaignId:
            "CAM-001",

          missionId:
            "MISSION-001",

          evidenceId:
            "EVIDENCE-001",

          subjectId:
            "USER-001",

          status:
            "validated",

          pendingAppeal:
            false,

          updatedAt:
            300,

          firstDecisionAt:
            240,

          reason:
            "MUST_NOT_PERSIST",
        },

        reviewId:
          "EVIDENCE-001",
      });

    assert.deepEqual(
      result,
      {
        mission: {
          id:
            "MISSION-001",

          campaignId:
            "CAM-001",

          assignedTo:
            "USER-001",

          activityCode:
            "MISSION_VALIDATED",

          activityCatalogVersion:
            "1.0.0",

          updatedAt:
            100,
        },

        evidence: {
          id:
            "EVIDENCE-001",

          evidenceId:
            "EVIDENCE-001",

          campaignId:
            "CAM-001",

          missionId:
            "MISSION-001",

          uploadedBy:
            "USER-001",

          assignedTo:
            "USER-001",

          updatedAt:
            200,

          createdAt:
            150,
        },

        previousReview: {
          campaignId:
            "CAM-001",

          missionId:
            "MISSION-001",

          evidenceId:
            "EVIDENCE-001",

          subjectId:
            "USER-001",

          status:
            "pending",

          pendingAppeal:
            false,

          updatedAt:
            250,

          firstDecisionAt:
            240,
        },

        currentReview: {
          campaignId:
            "CAM-001",

          missionId:
            "MISSION-001",

          evidenceId:
            "EVIDENCE-001",

          subjectId:
            "USER-001",

          status:
            "validated",

          pendingAppeal:
            false,

          updatedAt:
            300,

          firstDecisionAt:
            240,
        },

        reviewId:
          "EVIDENCE-001",
      }
    );

    assert.equal(
      Object.hasOwn(
        result,
        "subjectProfile"
      ),
      false
    );

    assert.equal(
      Object.hasOwn(
        result,
        "canonicalIdentity"
      ),
      false
    );

    assert.equal(
      Object.hasOwn(
        result,
        "candidate"
      ),
      false
    );

    assert.equal(
      Object.hasOwn(
        result,
        "contributionCandidate"
      ),
      false
    );
  }
);

test(
  "mission recovery projection preserves absent previous review as null",
  () => {
    const {
      projectMissionContributionRecoveryFacts,
    } = require(
      "./contribution-reconciliation-recovery.cjs"
    );

    const result =
      projectMissionContributionRecoveryFacts({
        mission: {
          id:
            "MISSION-002",

          campaignId:
            "CAM-001",

          assignedTo:
            "USER-002",
        },

        evidence: {
          id:
            "EVIDENCE-002",

          evidenceId:
            "EVIDENCE-002",

          campaignId:
            "CAM-001",

          missionId:
            "MISSION-002",

          uploadedBy:
            "USER-002",
        },

        previousReview:
          null,

        currentReview: {
          campaignId:
            "CAM-001",

          missionId:
            "MISSION-002",

          evidenceId:
            "EVIDENCE-002",

          subjectId:
            "USER-002",

          status:
            "validated",

          pendingAppeal:
            false,

          updatedAt:
            500,

          firstDecisionAt:
            500,
        },

        reviewId:
          "EVIDENCE-002",
      });

    assert.equal(
      result.previousReview,
      null
    );

    assert.equal(
      result.mission.activityCode,
      undefined
    );

    assert.equal(
      result.mission.activityCatalogVersion,
      undefined
    );
  }
);
