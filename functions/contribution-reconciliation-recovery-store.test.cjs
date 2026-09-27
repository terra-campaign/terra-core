"use strict";

process.env.NODE_ENV = "test";

const test = require("node:test");
const assert = require("node:assert/strict");

function makeSnapshot({
  exists,
  data,
}) {
  return {
    exists,
    data:
      () => data,
  };
}

function makeFakeDb({
  existing = null,
} = {}) {
  const calls = {
    collections: [],
    docIds: [],
    gets: [],
    creates: [],
  };

  const db = {
    collection(name) {
      calls.collections.push(name);

      return {
        doc(id) {
          calls.docIds.push(id);

          return {
            id,
            path:
              name + "/" + id,
          };
        },
      };
    },

    async runTransaction(handler) {
      const tx = {
        async get(ref) {
          calls.gets.push(ref.path);

          if (existing) {
            return makeSnapshot({
              exists: true,
              data: existing,
            });
          }

          return makeSnapshot({
            exists: false,
            data: undefined,
          });
        },

        create(ref, record) {
          calls.creates.push({
            path: ref.path,
            record,
          });
        },
      };

      return handler(tx);
    },
  };

  return {
    db,
    calls,
  };
}

function makeRecoveryRecord() {
  const {
    buildMissionReviewRecoveryRecord,
  } = require(
    "./contribution-reconciliation-recovery.cjs"
  );

  return buildMissionReviewRecoveryRecord({
    operationId:
      "mission-review:EVID-100:revision:7",

    campaignId:
      "CAM-001",

    evidenceId:
      "EVID-100",

    missionId:
      "MIS-100",

    reviewId:
      "EVID-100",

    revision:
      7,

    actorUid:
      "REVIEWER-001",

    subjectAccountUid:
      "SUBJECT-001",

    missionFact: {
      campaignId:
        "CAM-001",
      id:
        "MIS-100",
      assignedTo:
        "SUBJECT-001",
    },

    evidenceFact: {
      campaignId:
        "CAM-001",
      id:
        "EVID-100",
      missionId:
        "MIS-100",
      uploadedBy:
        "SUBJECT-001",
    },

    previousReviewFact: {
      status:
        "pending",
    },

    currentReviewFact: {
      status:
        "validated",
    },

    createdAt:
      "SERVER_TIME",
  });
}

test(
  "recovery store creates one deterministic durable record transactionally",
  async () => {
    const {
      RECOVERY_COLLECTION,
      persistRecoveryRecordCore,
    } = require(
      "./contribution-reconciliation-recovery-store.cjs"
    );

    assert.equal(
      RECOVERY_COLLECTION,
      "contributionReconciliation"
    );

    const recovery =
      makeRecoveryRecord();

    const {
      db,
      calls,
    } = makeFakeDb();

    const result =
      await persistRecoveryRecordCore({
        db,
        record:
          recovery,
      });

    assert.equal(
      calls.collections[0],
      RECOVERY_COLLECTION
    );

    assert.equal(
      calls.docIds.length,
      1
    );

    assert.equal(
      calls.gets.length,
      1
    );

    assert.equal(
      calls.creates.length,
      1
    );

    assert.equal(
      calls.creates[0].record,
      recovery
    );

    assert.equal(
      result.ok,
      true
    );

    assert.equal(
      result.alreadyExists,
      false
    );

    assert.equal(
      result.operationId,
      recovery.operationId
    );

    assert.equal(
      result.recoveryId,
      calls.docIds[0]
    );

    assert.ok(
      typeof result.recoveryId ===
        "string" &&
      result.recoveryId.length > 0
    );
  }
);

test(
  "same recovery operation is idempotent and is not created twice",
  async () => {
    const {
      persistRecoveryRecordCore,
    } = require(
      "./contribution-reconciliation-recovery-store.cjs"
    );

    const recovery =
      makeRecoveryRecord();

    const {
      db,
      calls,
    } = makeFakeDb({
      existing:
        recovery,
    });

    const result =
      await persistRecoveryRecordCore({
        db,
        record:
          recovery,
      });

    assert.equal(
      calls.creates.length,
      0
    );

    assert.equal(
      result.ok,
      true
    );

    assert.equal(
      result.alreadyExists,
      true
    );

    assert.equal(
      result.operationId,
      recovery.operationId
    );
  }
);

test(
  "deterministic recovery id cannot be reused for another operational identity",
  async () => {
    const {
      persistRecoveryRecordCore,
    } = require(
      "./contribution-reconciliation-recovery-store.cjs"
    );

    const recovery =
      makeRecoveryRecord();

    const conflicting = {
      ...recovery,

      missionId:
        "MIS-DIFFERENT",
    };

    const {
      db,
      calls,
    } = makeFakeDb({
      existing:
        conflicting,
    });

    await assert.rejects(
      () =>
        persistRecoveryRecordCore({
          db,
          record:
            recovery,
        }),
      {
        message:
          "RECOVERY_OPERATION_CONFLICT",
      }
    );

    assert.equal(
      calls.creates.length,
      0
    );
  }
);

test(
  "recovery store does not accept persisted contribution candidates",
  async () => {
    const {
      persistRecoveryRecordCore,
    } = require(
      "./contribution-reconciliation-recovery-store.cjs"
    );

    const recovery = {
      ...makeRecoveryRecord(),

      contributionCandidate: {
        candidateId:
          "FORBIDDEN",
      },
    };

    const {
      db,
      calls,
    } = makeFakeDb();

    await assert.rejects(
      () =>
        persistRecoveryRecordCore({
          db,
          record:
            recovery,
        }),
      {
        message:
          "RECOVERY_CANDIDATE_PERSISTENCE_FORBIDDEN",
      }
    );

    assert.equal(
      calls.creates.length,
      0
    );
  }
);
test(
  "recovery pending can be attached to an existing authoritative transaction",
  () => {
    const {
      RECOVERY_COLLECTION,
      createRecoveryRecordInTransaction,
    } = require(
      "./contribution-reconciliation-recovery-store.cjs"
    );

    const recovery =
      makeRecoveryRecord();

    const calls = {
      collections: [],
      docIds: [],
      creates: [],
    };

    const db = {
      collection(name) {
        calls.collections.push(name);

        return {
          doc(id) {
            calls.docIds.push(id);

            return {
              id,
              path:
                name + "/" + id,
            };
          },
        };
      },
    };

    const tx = {
      create(ref, record) {
        calls.creates.push({
          path: ref.path,
          record,
        });
      },
    };

    const result =
      createRecoveryRecordInTransaction({
        db,
        tx,
        record:
          recovery,
      });

    assert.equal(
      calls.collections.length,
      1
    );

    assert.equal(
      calls.collections[0],
      RECOVERY_COLLECTION
    );

    assert.equal(
      calls.docIds.length,
      1
    );

    assert.equal(
      calls.creates.length,
      1
    );

    assert.equal(
      calls.creates[0].record,
      recovery
    );

    assert.equal(
      result.ok,
      true
    );

    assert.equal(
      result.recoveryId,
      calls.docIds[0]
    );

    assert.equal(
      result.operationId,
      recovery.operationId
    );

    assert.equal(
      result.status,
      "PENDING"
    );

    assert.equal(
      result.recoveryRecordPersisted,
      true
    );

    assert.equal(
      result.contributionCandidatePersisted,
      false
    );

    assert.equal(
      result.performanceSummaryWritten,
      false
    );
  }
);

test(
  "existing transaction recovery boundary rejects non-PENDING records",
  () => {
    const {
      createRecoveryRecordInTransaction,
    } = require(
      "./contribution-reconciliation-recovery-store.cjs"
    );

    const recovery = {
      ...makeRecoveryRecord(),

      status:
        "RETRY_REQUIRED",
    };

    const db = {
      collection() {
        return {
          doc(id) {
            return {
              id,
              path:
                "contributionReconciliation/" +
                id,
            };
          },
        };
      },
    };

    const tx = {
      create() {
        throw new Error(
          "CREATE_MUST_NOT_BE_REACHED"
        );
      },
    };

    assert.throws(
      () =>
        createRecoveryRecordInTransaction({
          db,
          tx,
          record:
            recovery,
        }),
      {
        message:
          "RECOVERY_TRANSACTION_CREATE_REQUIRES_PENDING",
      }
    );
  }
);

test(
  "existing transaction recovery boundary still forbids candidate persistence",
  () => {
    const {
      createRecoveryRecordInTransaction,
    } = require(
      "./contribution-reconciliation-recovery-store.cjs"
    );

    const recovery = {
      ...makeRecoveryRecord(),

      candidate: {
        candidateId:
          "FORBIDDEN",
      },
    };

    const db = {
      collection() {
        return {
          doc(id) {
            return {
              id,
              path:
                "contributionReconciliation/" +
                id,
            };
          },
        };
      },
    };

    const tx = {
      create() {
        throw new Error(
          "CREATE_MUST_NOT_BE_REACHED"
        );
      },
    };

    assert.throws(
      () =>
        createRecoveryRecordInTransaction({
          db,
          tx,
          record:
            recovery,
        }),
      {
        message:
          "RECOVERY_CANDIDATE_PERSISTENCE_FORBIDDEN",
      }
    );
  }
);
test(
  "same recovery operation rejects different immutable source facts",
  async () => {
    const {
      persistRecoveryRecordCore,
    } = require(
      "./contribution-reconciliation-recovery-store.cjs"
    );

    const original =
      makeRecoveryRecord();

    const changed =
      Object.freeze({
        ...original,
        currentReviewFact:
          Object.freeze({
            ...original.currentReviewFact,
            status:
              original.currentReviewFact.status === "validated"
                ? "rejected"
                : "validated",
          }),
      });

    const firstDb =
      makeFakeDb();

    const first =
      await persistRecoveryRecordCore({
        db: firstDb.db,
        record: original,
      });

    assert.equal(
      first.alreadyExists,
      false
    );

    const retryDb =
      makeFakeDb({
        existing: original,
      });

    await assert.rejects(
      () =>
        persistRecoveryRecordCore({
          db: retryDb.db,
          record: changed,
        }),
      /RECOVERY_OPERATION_CONFLICT/
    );
  }
);
test(
  "recovery store transactionally persists RETRY_REQUIRED from current durable state",
  async () => {
    const {
      makeRecoveryId,
      transitionRecoveryToRetryRequired,
    } = require(
      "./contribution-reconciliation-recovery-store.cjs"
    );

    assert.equal(
      typeof transitionRecoveryToRetryRequired,
      "function"
    );

    const recovery =
      makeRecoveryRecord();

    const calls = {
      gets: [],
      updates: [],
    };

    const recoveryId =
      makeRecoveryId(
        recovery.operationId
      );

    const db = {
      collection(name) {
        assert.equal(
          name,
          "contributionReconciliation"
        );

        return {
          doc(id) {
            assert.equal(
              id,
              recoveryId
            );

            return {
              id,
              path:
                "contributionReconciliation/" +
                id,
            };
          },
        };
      },

      async runTransaction(handler) {
        const tx = {
          async get(ref) {
            calls.gets.push(
              ref.path
            );

            return {
              exists:
                true,

              data() {
                return recovery;
              },
            };
          },

          update(ref, data) {
            calls.updates.push({
              path:
                ref.path,

              data,
            });
          },
        };

        return handler(tx);
      },
    };

    const result =
      await transitionRecoveryToRetryRequired({
        db,

        operationId:
          recovery.operationId,

        errorCode:
          "RECOVERY_BRIDGE_ERROR:IDENTITY_RESOLUTION_FAILED",

        updatedAt:
          "SERVER_TIME_2",
      });

    assert.equal(
      calls.gets.length,
      1
    );

    assert.equal(
      calls.updates.length,
      1
    );

    assert.equal(
      calls.updates[0].data.status,
      "RETRY_REQUIRED"
    );

    assert.equal(
      calls.updates[0].data.attemptCount,
      recovery.attemptCount + 1
    );

    assert.equal(
      calls.updates[0].data.lastError,
      "RECOVERY_BRIDGE_ERROR:IDENTITY_RESOLUTION_FAILED"
    );

    assert.equal(
      calls.updates[0].data.updatedAt,
      "SERVER_TIME_2"
    );

    assert.equal(
      calls.updates[0].data.reconciledAt,
      null
    );

    assert.equal(
      result.status,
      "RETRY_REQUIRED"
    );

    assert.equal(
      result.attemptCount,
      recovery.attemptCount + 1
    );
  }
);
test(
  "RETRY_REQUIRED transition rejects a missing durable recovery",
  async () => {
    const {
      transitionRecoveryToRetryRequired,
    } = require(
      "./contribution-reconciliation-recovery-store.cjs"
    );

    const recovery =
      makeRecoveryRecord();

    let updateCalls = 0;

    const db = {
      collection() {
        return {
          doc(id) {
            return {
              id,
              path:
                "contributionReconciliation/" +
                id,
            };
          },
        };
      },

      async runTransaction(handler) {
        return handler({
          async get() {
            return {
              exists:
                false,

              data() {
                return undefined;
              },
            };
          },

          update() {
            updateCalls += 1;
          },
        });
      },
    };

    await assert.rejects(
      () =>
        transitionRecoveryToRetryRequired({
          db,

          operationId:
            recovery.operationId,

          errorCode:
            "TEST_FAILURE",

          updatedAt:
            "SERVER_TIME_3",
        }),

      /RECOVERY_RECORD_NOT_FOUND/
    );

    assert.equal(
      updateCalls,
      0
    );
  }
);

test(
  "RETRY_REQUIRED transition refuses a RECONCILED recovery",
  async () => {
    const {
      transitionRecoveryToRetryRequired,
    } = require(
      "./contribution-reconciliation-recovery-store.cjs"
    );

    const recovery = {
      ...makeRecoveryRecord(),

      status:
        "RECONCILED",

      attemptCount:
        1,

      lastError:
        null,

      updatedAt:
        "SERVER_TIME_2",

      reconciledAt:
        "SERVER_TIME_2",
    };

    let updateCalls = 0;

    const db = {
      collection() {
        return {
          doc(id) {
            return {
              id,
              path:
                "contributionReconciliation/" +
                id,
            };
          },
        };
      },

      async runTransaction(handler) {
        return handler({
          async get() {
            return {
              exists:
                true,

              data() {
                return recovery;
              },
            };
          },

          update() {
            updateCalls += 1;
          },
        });
      },
    };

    await assert.rejects(
      () =>
        transitionRecoveryToRetryRequired({
          db,

          operationId:
            recovery.operationId,

          errorCode:
            "LATE_FAILURE",

          updatedAt:
            "SERVER_TIME_3",
        }),

      /RECONCILED_RECOVERY_CANNOT_REQUIRE_RETRY/
    );

    assert.equal(
      updateCalls,
      0
    );
  }
);
test(
  "recovery store transactionally persists RECONCILED from current durable state",
  async () => {
    const {
      makeRecoveryId,
      transitionRecoveryToReconciled,
    } = require(
      "./contribution-reconciliation-recovery-store.cjs"
    );

    assert.equal(
      typeof transitionRecoveryToReconciled,
      "function"
    );

    const recovery = {
      ...makeRecoveryRecord(),

      status:
        "RETRY_REQUIRED",

      attemptCount:
        1,

      lastError:
        "PREVIOUS_FAILURE",

      updatedAt:
        "SERVER_TIME_2",

      reconciledAt:
        null,
    };

    const calls = {
      gets: [],
      updates: [],
    };

    const recoveryId =
      makeRecoveryId(
        recovery.operationId
      );

    const db = {
      collection(name) {
        assert.equal(
          name,
          "contributionReconciliation"
        );

        return {
          doc(id) {
            assert.equal(
              id,
              recoveryId
            );

            return {
              id,
              path:
                "contributionReconciliation/" +
                id,
            };
          },
        };
      },

      async runTransaction(handler) {
        return handler({
          async get(ref) {
            calls.gets.push(
              ref.path
            );

            return {
              exists:
                true,

              data() {
                return recovery;
              },
            };
          },

          update(ref, data) {
            calls.updates.push({
              path:
                ref.path,

              data,
            });
          },
        });
      },
    };

    const result =
      await transitionRecoveryToReconciled({
        db,

        operationId:
          recovery.operationId,

        observability:
          Object.freeze({
            ledgerWritten:
              true,

            pointsPosted:
              true,

            performanceSummaryWritten:
              false,
          }),

        updatedAt:
          "SERVER_TIME_3",
      });

    assert.equal(
      calls.gets.length,
      1
    );

    assert.equal(
      calls.updates.length,
      1
    );

    assert.equal(
      calls.updates[0].data.status,
      "RECONCILED"
    );

    assert.equal(
      calls.updates[0].data.attemptCount,
      2
    );

    assert.equal(
      calls.updates[0].data.lastError,
      null
    );

    assert.equal(
      calls.updates[0].data.updatedAt,
      "SERVER_TIME_3"
    );

    assert.equal(
      calls.updates[0].data.reconciledAt,
      "SERVER_TIME_3"
    );

    assert.equal(
      calls.updates[0].data.ledgerWritten,
      true
    );

    assert.equal(
      calls.updates[0].data.pointsPosted,
      true
    );

    assert.equal(
      calls.updates[0].data.performanceSummaryWritten,
      false
    );

    assert.equal(
      result.ledgerWritten,
      true
    );

    assert.equal(
      result.pointsPosted,
      true
    );

    assert.equal(
      result.performanceSummaryWritten,
      false
    );

    assert.equal(
      result.status,
      "RECONCILED"
    );

    assert.equal(
      result.attemptCount,
      2
    );

    assert.equal(
      result.lastError,
      null
    );
  }
);
test(
  "RECONCILED transition rejects a missing durable recovery",
  async () => {
    const {
      transitionRecoveryToReconciled,
    } = require(
      "./contribution-reconciliation-recovery-store.cjs"
    );

    const recovery =
      makeRecoveryRecord();

    let updateCalls = 0;

    const db = {
      collection() {
        return {
          doc(id) {
            return {
              id,
              path:
                "contributionReconciliation/" +
                id,
            };
          },
        };
      },

      async runTransaction(handler) {
        return handler({
          async get() {
            return {
              exists:
                false,

              data() {
                return undefined;
              },
            };
          },

          update() {
            updateCalls += 1;
          },
        });
      },
    };

    await assert.rejects(
      () =>
        transitionRecoveryToReconciled({
          db,

          operationId:
            recovery.operationId,

          updatedAt:
            "SERVER_TIME_4",
        }),

      /RECOVERY_RECORD_NOT_FOUND/
    );

    assert.equal(
      updateCalls,
      0
    );
  }
);

test(
  "RECONCILED transition is idempotent when durable recovery is already RECONCILED",
  async () => {
    const {
      transitionRecoveryToReconciled,
    } = require(
      "./contribution-reconciliation-recovery-store.cjs"
    );

    const recovery = {
      ...makeRecoveryRecord(),

      status:
        "RECONCILED",

      attemptCount:
        1,

      lastError:
        null,

      updatedAt:
        "SERVER_TIME_3",

      reconciledAt:
        "SERVER_TIME_3",
    };

    let updateCalls = 0;

    const db = {
      collection() {
        return {
          doc(id) {
            return {
              id,
              path:
                "contributionReconciliation/" +
                id,
            };
          },
        };
      },

      async runTransaction(handler) {
        return handler({
          async get() {
            return {
              exists:
                true,

              data() {
                return recovery;
              },
            };
          },

          update() {
            updateCalls += 1;
          },
        });
      },
    };

    const result =
      await transitionRecoveryToReconciled({
        db,

        operationId:
          recovery.operationId,

        updatedAt:
          "SERVER_TIME_4",
      });

    assert.equal(
      updateCalls,
      0
    );

    assert.deepEqual(
      result,
      recovery
    );

    assert.equal(
      result.attemptCount,
      1
    );

    assert.equal(
      result.updatedAt,
      "SERVER_TIME_3"
    );

    assert.equal(
      result.reconciledAt,
      "SERVER_TIME_3"
    );
  }
);