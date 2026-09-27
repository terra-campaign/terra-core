"use strict";

const crypto =
  require("node:crypto");

const {
  isDeepStrictEqual,
} =
  require("node:util");

const {
  RECOVERY_SCHEMA_VERSION,
  RECOVERY_STATUSES,
  markRecoveryRetryRequired,
  markRecoveryReconciled,
} =
  require(
    "./contribution-reconciliation-recovery.cjs"
  );

const RECOVERY_COLLECTION =
  "contributionReconciliation";

const RECOVERY_STORE_VERSION =
  "1.0.0-foundation";

function requireToken(
  value,
  errorCode
) {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    throw new Error(
      errorCode
    );
  }

  return value.trim();
}

function requireObject(
  value,
  errorCode
) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new Error(
      errorCode
    );
  }

  return value;
}

function makeRecoveryId(
  operationId
) {
  const checkedOperationId =
    requireToken(
      operationId,
      "RECOVERY_OPERATION_ID_REQUIRED"
    );

  return crypto
    .createHash("sha256")
    .update(
      checkedOperationId,
      "utf8"
    )
    .digest("hex");
}

function assertNoCandidatePersistence(
  record
) {
  if (
    Object.prototype.hasOwnProperty.call(
      record,
      "contributionCandidate"
    ) ||
    Object.prototype.hasOwnProperty.call(
      record,
      "candidate"
    )
  ) {
    throw new Error(
      "RECOVERY_CANDIDATE_PERSISTENCE_FORBIDDEN"
    );
  }
}

function assertRecoveryRecordContract(
  record
) {
  const checked =
    requireObject(
      record,
      "RECOVERY_RECORD_REQUIRED"
    );

  assertNoCandidatePersistence(
    checked
  );

  if (
    checked.schemaVersion !==
    RECOVERY_SCHEMA_VERSION
  ) {
    throw new Error(
      "RECOVERY_SCHEMA_VERSION_MISMATCH"
    );
  }

  requireToken(
    checked.operationId,
    "RECOVERY_OPERATION_ID_REQUIRED"
  );

  requireToken(
    checked.campaignId,
    "RECOVERY_CAMPAIGN_ID_REQUIRED"
  );

  requireToken(
    checked.evidenceId,
    "RECOVERY_EVIDENCE_ID_REQUIRED"
  );

  requireToken(
    checked.missionId,
    "RECOVERY_MISSION_ID_REQUIRED"
  );

  requireToken(
    checked.reviewId,
    "RECOVERY_REVIEW_ID_REQUIRED"
  );

  requireToken(
    checked.actorUid,
    "RECOVERY_ACTOR_UID_REQUIRED"
  );

  requireToken(
    checked.subjectAccountUid,
    "RECOVERY_SUBJECT_UID_REQUIRED"
  );

  if (
    !Number.isInteger(
      checked.revision
    ) ||
    checked.revision < 1
  ) {
    throw new Error(
      "RECOVERY_REVISION_INVALID"
    );
  }

  if (
    !Object.values(
      RECOVERY_STATUSES
    ).includes(
      checked.status
    )
  ) {
    throw new Error(
      "RECOVERY_STATUS_INVALID"
    );
  }

  if (
    checked.serverSideOnly !==
    true
  ) {
    throw new Error(
      "RECOVERY_SERVER_SIDE_ONLY_REQUIRED"
    );
  }

  return checked;
}

function recoveryOperationalIdentity(
  record
) {
  return {
    schemaVersion:
      record.schemaVersion,

    operationId:
      record.operationId,

    campaignId:
      record.campaignId,

    evidenceId:
      record.evidenceId,

    missionId:
      record.missionId,

    reviewId:
      record.reviewId,

    revision:
      record.revision,

    actorUid:
      record.actorUid,

    subjectAccountUid:
      record.subjectAccountUid,

    missionFact:
      record.missionFact,

    evidenceFact:
      record.evidenceFact,

    previousReviewFact:
      record.previousReviewFact,

    currentReviewFact:
      record.currentReviewFact,
  };
}

function sameOperationalIdentity(
  left,
  right
) {
  const a =
    recoveryOperationalIdentity(
      left
    );

  const b =
    recoveryOperationalIdentity(
      right
    );

  return (
    a.schemaVersion ===
      b.schemaVersion &&
    a.operationId ===
      b.operationId &&
    a.campaignId ===
      b.campaignId &&
    a.evidenceId ===
      b.evidenceId &&
    a.missionId ===
      b.missionId &&
    a.reviewId ===
      b.reviewId &&
    a.revision ===
      b.revision &&
    a.actorUid ===
      b.actorUid &&
    a.subjectAccountUid ===
      b.subjectAccountUid &&
    isDeepStrictEqual(
      a.missionFact,
      b.missionFact
    ) &&
    isDeepStrictEqual(
      a.evidenceFact,
      b.evidenceFact
    ) &&
    isDeepStrictEqual(
      a.previousReviewFact,
      b.previousReviewFact
    ) &&
    isDeepStrictEqual(
      a.currentReviewFact,
      b.currentReviewFact
    )
  );
}

function snapshotData(
  snapshot
) {
  if (
    !snapshot ||
    snapshot.exists !== true ||
    typeof snapshot.data !==
      "function"
  ) {
    return null;
  }

  return snapshot.data();
}

async function persistRecoveryRecordCore({
  db,
  record,
}) {
  const database =
    requireObject(
      db,
      "RECOVERY_DATABASE_REQUIRED"
    );

  if (
    typeof database.runTransaction !==
    "function"
  ) {
    throw new Error(
      "RECOVERY_TRANSACTION_REQUIRED"
    );
  }

  if (
    typeof database.collection !==
    "function"
  ) {
    throw new Error(
      "RECOVERY_COLLECTION_API_REQUIRED"
    );
  }

  const checkedRecord =
    assertRecoveryRecordContract(
      record
    );

  const recoveryId =
    makeRecoveryId(
      checkedRecord.operationId
    );

  const recoveryRef =
    database
      .collection(
        RECOVERY_COLLECTION
      )
      .doc(
        recoveryId
      );

  return database.runTransaction(
    async tx => {
      if (
        !tx ||
        typeof tx.get !==
          "function" ||
        typeof tx.create !==
          "function"
      ) {
        throw new Error(
          "RECOVERY_TRANSACTION_CONTRACT_INVALID"
        );
      }

      const existingSnapshot =
        await tx.get(
          recoveryRef
        );

      const existing =
        snapshotData(
          existingSnapshot
        );

      if (existing) {
        assertNoCandidatePersistence(
          existing
        );

        if (
          !sameOperationalIdentity(
            existing,
            checkedRecord
          )
        ) {
          throw new Error(
            "RECOVERY_OPERATION_CONFLICT"
          );
        }

        return Object.freeze({
          ok:
            true,

          alreadyExists:
            true,

          recoveryId,

          operationId:
            checkedRecord.operationId,

          status:
            existing.status || null,

          recoveryRecordPersisted:
            true,

          contributionCandidatePersisted:
            false,

          performanceSummaryWritten:
            false,
        });
      }

      tx.create(
        recoveryRef,
        checkedRecord
      );

      return Object.freeze({
        ok:
          true,

        alreadyExists:
          false,

        recoveryId,

        operationId:
          checkedRecord.operationId,

        status:
          checkedRecord.status,

        recoveryRecordPersisted:
          true,

        contributionCandidatePersisted:
          false,

        performanceSummaryWritten:
          false,
      });
    }
  );
}

function createRecoveryRecordInTransaction({
  db,
  tx,
  record,
}) {
  const database =
    requireObject(
      db,
      "RECOVERY_DATABASE_REQUIRED"
    );

  if (
    typeof database.collection !==
    "function"
  ) {
    throw new Error(
      "RECOVERY_COLLECTION_API_REQUIRED"
    );
  }

  const transaction =
    requireObject(
      tx,
      "RECOVERY_EXISTING_TRANSACTION_REQUIRED"
    );

  if (
    typeof transaction.create !==
    "function"
  ) {
    throw new Error(
      "RECOVERY_TRANSACTION_CREATE_REQUIRED"
    );
  }

  const checkedRecord =
    assertRecoveryRecordContract(
      record
    );

  if (
    checkedRecord.status !==
    RECOVERY_STATUSES.PENDING
  ) {
    throw new Error(
      "RECOVERY_TRANSACTION_CREATE_REQUIRES_PENDING"
    );
  }

  const recoveryId =
    makeRecoveryId(
      checkedRecord.operationId
    );

  const recoveryRef =
    database
      .collection(
        RECOVERY_COLLECTION
      )
      .doc(
        recoveryId
      );

  transaction.create(
    recoveryRef,
    checkedRecord
  );

  return Object.freeze({
    ok:
      true,

    recoveryId,

    operationId:
      checkedRecord.operationId,

    status:
      checkedRecord.status,

    recoveryRecordPersisted:
      true,

    contributionCandidatePersisted:
      false,

    performanceSummaryWritten:
      false,
  });
}
async function transitionRecoveryToRetryRequired({
  db,
  operationId,
  errorCode,
  updatedAt,
}) {
  const database =
    requireObject(
      db,
      "RECOVERY_DATABASE_REQUIRED"
    );

  if (
    typeof database.runTransaction !==
    "function"
  ) {
    throw new Error(
      "RECOVERY_TRANSACTION_REQUIRED"
    );
  }

  if (
    typeof database.collection !==
    "function"
  ) {
    throw new Error(
      "RECOVERY_COLLECTION_API_REQUIRED"
    );
  }

  const checkedOperationId =
    requireToken(
      operationId,
      "RECOVERY_OPERATION_ID_REQUIRED"
    );

  const recoveryId =
    makeRecoveryId(
      checkedOperationId
    );

  const recoveryRef =
    database
      .collection(
        RECOVERY_COLLECTION
      )
      .doc(
        recoveryId
      );

  return database.runTransaction(
    async tx => {
      if (
        !tx ||
        typeof tx.get !== "function" ||
        typeof tx.update !== "function"
      ) {
        throw new Error(
          "RECOVERY_TRANSITION_TRANSACTION_CONTRACT_INVALID"
        );
      }

      const snapshot =
        await tx.get(
          recoveryRef
        );

      const current =
        snapshotData(
          snapshot
        );

      if (!current) {
        throw new Error(
          "RECOVERY_RECORD_NOT_FOUND"
        );
      }

      assertRecoveryRecordContract(
        current
      );

      if (
        current.operationId !==
        checkedOperationId
      ) {
        throw new Error(
          "RECOVERY_OPERATION_CONFLICT"
        );
      }

      const transitioned =
        markRecoveryRetryRequired({
          record:
            current,

          errorCode,

          updatedAt,
        });

      assertRecoveryRecordContract(
        transitioned
      );

      tx.update(
        recoveryRef,
        transitioned
      );

      return transitioned;
    }
  );
}
async function transitionRecoveryToReconciled({
  db,
  operationId,
  updatedAt,
}) {
  const database =
    requireObject(
      db,
      "RECOVERY_DATABASE_REQUIRED"
    );

  if (
    typeof database.runTransaction !==
    "function"
  ) {
    throw new Error(
      "RECOVERY_TRANSACTION_REQUIRED"
    );
  }

  if (
    typeof database.collection !==
    "function"
  ) {
    throw new Error(
      "RECOVERY_COLLECTION_API_REQUIRED"
    );
  }

  const checkedOperationId =
    requireToken(
      operationId,
      "RECOVERY_OPERATION_ID_REQUIRED"
    );

  const recoveryId =
    makeRecoveryId(
      checkedOperationId
    );

  const recoveryRef =
    database
      .collection(
        RECOVERY_COLLECTION
      )
      .doc(
        recoveryId
      );

  return database.runTransaction(
    async tx => {
      if (
        !tx ||
        typeof tx.get !== "function" ||
        typeof tx.update !== "function"
      ) {
        throw new Error(
          "RECOVERY_TRANSITION_TRANSACTION_CONTRACT_INVALID"
        );
      }

      const snapshot =
        await tx.get(
          recoveryRef
        );

      const current =
        snapshotData(
          snapshot
        );

      if (!current) {
        throw new Error(
          "RECOVERY_RECORD_NOT_FOUND"
        );
      }

      assertRecoveryRecordContract(
        current
      );

      if (
        current.operationId !==
        checkedOperationId
      ) {
        throw new Error(
          "RECOVERY_OPERATION_CONFLICT"
        );
      }

      if (
        current.status ===
        RECOVERY_STATUSES.RECONCILED
      ) {
        return current;
      }

      const transitioned =
        markRecoveryReconciled({
          record:
            current,

          updatedAt,
        });

      assertRecoveryRecordContract(
        transitioned
      );

      tx.update(
        recoveryRef,
        transitioned
      );

      return transitioned;
    }
  );
}
async function listProcessableRecoveryRecords({
  db,
  limit = 25,
}) {
  const database =
    requireObject(
      db,
      "RECOVERY_DATABASE_REQUIRED"
    );

  if (
    typeof database.collection !==
    "function"
  ) {
    throw new Error(
      "RECOVERY_COLLECTION_API_REQUIRED"
    );
  }

  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100
  ) {
    throw new Error(
      "RECOVERY_LIST_LIMIT_INVALID"
    );
  }

  const snapshot =
    await database
      .collection(
        RECOVERY_COLLECTION
      )
      .where(
        "status",
        "in",
        [
          RECOVERY_STATUSES.PENDING,
          RECOVERY_STATUSES.RETRY_REQUIRED,
        ]
      )
      .orderBy(
        "updatedAt",
        "asc"
      )
      .limit(limit)
      .get();

  const docs =
    snapshot &&
    Array.isArray(snapshot.docs)
      ? snapshot.docs
      : [];

  return docs.map(
    documentSnapshot =>
      Object.freeze({
        recoveryId:
          documentSnapshot.id,

        record:
          documentSnapshot.data(),
      })
  );
}
module.exports = {
  RECOVERY_COLLECTION,
  RECOVERY_STORE_VERSION,
  makeRecoveryId,
  createRecoveryRecordInTransaction,
  persistRecoveryRecordCore,
  transitionRecoveryToRetryRequired,
  transitionRecoveryToReconciled,
  listProcessableRecoveryRecords,
};