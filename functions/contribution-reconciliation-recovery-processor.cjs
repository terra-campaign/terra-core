"use strict";

const {
  RECOVERY_STATUSES,
} =
  require(
    "./contribution-reconciliation-recovery.cjs"
  );

const {
  resolveCanonicalPersonForAccount,
} =
  require(
    "./person-identity.cjs"
  );

const {
  deriveMissionContributionCandidateSafely,
} =
  require(
    "./contribution-verified-fact-bridge.cjs"
  );

const {
  reconcileContributionLifecycle,
} =
  require(
    "./contribution-lifecycle-reconciler.cjs"
  );

const {
  transitionRecoveryToRetryRequired,
  transitionRecoveryToReconciled,
} =
  require(
    "./contribution-reconciliation-recovery-store.cjs"
  );

const RECOVERY_PROCESSOR_VERSION =
  "1.0.0-foundation";

async function processMissionContributionRecoveryCore({
  db,
  record,
  runtime,
}) {
  if (
    !record ||
    typeof record !== "object" ||
    Array.isArray(record)
  ) {
    throw new Error(
      "RECOVERY_RECORD_REQUIRED"
    );
  }

  if (
    record.status ===
    RECOVERY_STATUSES.RECONCILED
  ) {
    throw new Error(
      "RECOVERY_ALREADY_RECONCILED"
    );
  }

  if (
    record.status !==
      RECOVERY_STATUSES.PENDING &&
    record.status !==
      RECOVERY_STATUSES.RETRY_REQUIRED
  ) {
    throw new Error(
      "RECOVERY_STATUS_NOT_PROCESSABLE"
    );
  }

  if (!db) {
    throw new Error(
      "RECOVERY_PROCESSOR_DB_REQUIRED"
    );
  }

  if (
    !runtime ||
    typeof runtime !== "object"
  ) {
    throw new Error(
      "RECOVERY_PROCESSOR_RUNTIME_REQUIRED"
    );
  }

  if (
    typeof runtime.loadSubjectProfile !==
    "function"
  ) {
    throw new Error(
      "RECOVERY_SUBJECT_PROFILE_LOADER_REQUIRED"
    );
  }

  const subjectProfile =
    await runtime.loadSubjectProfile({
      db,

      accountUid:
        record.subjectAccountUid,
    });

  void subjectProfile;

  if (
    typeof runtime.deriveContribution !==
    "function"
  ) {
    throw new Error(
      "RECOVERY_CONTRIBUTION_DERIVER_REQUIRED"
    );
  }

  const previousContributionResult =
    record.previousReviewFact === null
      ? Object.freeze({
          status:
            "NOT_ELIGIBLE",

          stage:
            "HISTORICAL",

          reasonCode:
            "NO_PREVIOUS_MISSION_REVIEW",

          candidate:
            null,
        })
      : await runtime.deriveContribution({
          db,

          mission:
            record.missionFact,

          evidence:
            record.evidenceFact,

          review:
            record.previousReviewFact,

          reviewId:
            record.reviewId,

          subjectProfile,
        });

  const currentContributionResult =
    await runtime.deriveContribution({
      db,

      mission:
        record.missionFact,

      evidence:
        record.evidenceFact,

      review:
        record.currentReviewFact,

      reviewId:
        record.reviewId,

      subjectProfile,
    });

  const bridgeError =
    [
      previousContributionResult,
      currentContributionResult,
    ].find(
      (result) =>
        result &&
        result.status === "ERROR"
    );

  if (bridgeError) {
    const reasonCode =
      typeof bridgeError.reasonCode === "string" &&
      bridgeError.reasonCode.trim()
        ? bridgeError.reasonCode.trim()
        : "UNKNOWN_BRIDGE_ERROR";

    const errorCode =
      `RECOVERY_BRIDGE_ERROR:${reasonCode}`;

    if (
      typeof runtime.markRetryRequired !==
      "function"
    ) {
      throw new Error(
        "RECOVERY_RETRY_REQUIRED_TRANSITION_REQUIRED"
      );
    }

    const updatedAt =
      typeof runtime.now === "function"
        ? runtime.now()
        : undefined;

    await runtime.markRetryRequired({
      db,

      operationId:
        record.operationId,

      errorCode,

      updatedAt,
    });

    throw new Error(
      errorCode
    );
  }

  if (
    typeof runtime.reconcileLifecycle !==
    "function"
  ) {
    throw new Error(
      "RECOVERY_LIFECYCLE_RECONCILER_REQUIRED"
    );
  }

  try {
    await runtime.reconcileLifecycle({
      db,

      actorUid:
        record.actorUid,

      operationId:
        record.operationId,

      previousContributionResult,

      currentContributionResult,
    });
  } catch (error) {
    const errorCode =
      "RECOVERY_LIFECYCLE_ERROR:LIFECYCLE_EXECUTION_FAILED";

    if (
      typeof runtime.markRetryRequired !==
      "function"
    ) {
      throw new Error(
        "RECOVERY_RETRY_REQUIRED_TRANSITION_REQUIRED"
      );
    }

    const updatedAt =
      typeof runtime.now === "function"
        ? runtime.now()
        : undefined;

    await runtime.markRetryRequired({
      db,

      operationId:
        record.operationId,

      errorCode,

      updatedAt,
    });

    throw error;
  }

  if (
    typeof runtime.markReconciled !==
    "function"
  ) {
    throw new Error(
      "RECOVERY_RECONCILED_TRANSITION_REQUIRED"
    );
  }

  const updatedAt =
    typeof runtime.now === "function"
      ? runtime.now()
      : undefined;

  return runtime.markReconciled({
    db,

    operationId:
      record.operationId,

    updatedAt,
  });
}

const productionRuntime =
  Object.freeze({
    async loadSubjectProfile({
      db,
      accountUid,
    }) {
      const snapshot =
        await db
          .collection("usuarios")
          .doc(accountUid)
          .get();

      if (!snapshot.exists) {
        return null;
      }

      return {
        ...snapshot.data(),

        uid:
          snapshot.id,
      };
    },

    async deriveContribution({
      db,
      mission,
      evidence,
      review,
      reviewId,
      subjectProfile,
    }) {
      return deriveMissionContributionCandidateSafely({
        db,
        mission,
        evidence,
        review,
        reviewId,
        subjectProfile,

        resolveCanonicalIdentity:
          resolveCanonicalPersonForAccount,
      });
    },

    async reconcileLifecycle({
      db,
      actorUid,
      operationId,
      previousContributionResult,
      currentContributionResult,
    }) {
      return reconcileContributionLifecycle({
        db,
        actorUid,
        operationId,
        previousContributionResult,
        currentContributionResult,
      });
    },

    async markRetryRequired({
      db,
      operationId,
      errorCode,
      updatedAt,
    }) {
      return transitionRecoveryToRetryRequired({
        db,
        operationId,
        errorCode,
        updatedAt,
      });
    },

    async markReconciled({
      db,
      operationId,
      updatedAt,
    }) {
      return transitionRecoveryToReconciled({
        db,
        operationId,
        updatedAt,
      });
    },

    now() {
      return Date.now();
    },
  });

async function processMissionContributionRecovery({
  db,
  record,
}) {
  return processMissionContributionRecoveryCore({
    db,
    record,

    runtime:
      productionRuntime,
  });
}

module.exports = {
  RECOVERY_PROCESSOR_VERSION,
  processMissionContributionRecovery,

  _test:
    Object.freeze({
      processMissionContributionRecoveryCore,
      productionRuntime,
    }),
};