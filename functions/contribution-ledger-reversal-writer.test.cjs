"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  REVERSAL_WRITER_IMPLEMENTATION_VERSION,
  reverseContributionLedgerEntry,
  _test,
} = require(
  "./contribution-ledger-reversal-writer.cjs"
);

test(
  "reversal writer exposes only the server boundary",
  () => {
    const writer = require(
      "./contribution-ledger-reversal-writer.cjs"
    );

    assert.equal(
      typeof REVERSAL_WRITER_IMPLEMENTATION_VERSION,
      "string"
    );

    assert.equal(
      typeof reverseContributionLedgerEntry,
      "function"
    );

    assert.equal(
      writer.reverseContributionLedgerEntryCallable,
      undefined
    );
  }
);

test(
  "reversal transition preserves contribution identity and disables scoring",
  () => {
    assert.equal(
      typeof _test.buildReversedLedgerRecord,
      "function"
    );

    const original = Object.freeze({
      ledgerId:
        "LEDGER-001",

      schemaVersion:
        "1.0.0",

      ledgerStatus:
        "POSTED",

      campaignId:
        "CAM-001",

      personId:
        "PER-001",

      activityCode:
        "MISSION_VALIDATED",

      points:
        30,

      scoreDimension:
        "PARTICIPATION",

      sourceType:
        "MISSION",

      sourceId:
        "MISSION-001",

      runtimeScoringEnabled:
        true,

      postedByUserId:
        "ORIGINAL-USER",

      postedByPersonId:
        "ORIGINAL-PERSON",
    });

    const reversed =
      _test.buildReversedLedgerRecord({
        original,

        actorUid:
          "ACTOR-UID-001",

        actorPersonId:
          "ACTOR-PERSON-001",

        reason:
          "MISSION_VALIDATION_REVOKED",

        operationId:
          "MISSION-001:REVISION-002",

        serverNow:
          "SERVER-TIMESTAMP",
      });

    assert.equal(
      reversed.ledgerId,
      original.ledgerId
    );

    assert.equal(
      reversed.campaignId,
      original.campaignId
    );

    assert.equal(
      reversed.personId,
      original.personId
    );

    assert.equal(
      reversed.points,
      original.points
    );

    assert.equal(
      reversed.ledgerStatus,
      "REVERSED"
    );

    assert.equal(
      reversed.runtimeScoringEnabled,
      false
    );

    assert.equal(
      reversed.reversalReason,
      "MISSION_VALIDATION_REVOKED"
    );

    assert.equal(
      reversed.reversalOperationId,
      "MISSION-001:REVISION-002"
    );

    assert.equal(
      reversed.reversedByUserId,
      "ACTOR-UID-001"
    );

    assert.equal(
      reversed.reversedByPersonId,
      "ACTOR-PERSON-001"
    );

    assert.equal(
      reversed.reversedAt,
      "SERVER-TIMESTAMP"
    );
  }
);

test(
  "reversal rejects a ledger that is not POSTED",
  () => {
    assert.equal(
      typeof _test.buildReversedLedgerRecord,
      "function"
    );

    assert.throws(
      () =>
        _test.buildReversedLedgerRecord({
          original: {
            ledgerId:
              "LEDGER-001",

            ledgerStatus:
              "DRAFT_NOT_POSTABLE",

            campaignId:
              "CAM-001",

            personId:
              "PER-001",

            points:
              30,

            runtimeScoringEnabled:
              false,
          },

          actorUid:
            "ACTOR-UID-001",

          actorPersonId:
            "ACTOR-PERSON-001",

          reason:
            "MISSION_VALIDATION_REVOKED",

          operationId:
            "MISSION-001:REVISION-002",

          serverNow:
            "SERVER-TIMESTAMP",
        }),
      /REVERSAL_REQUIRES_POSTED_LEDGER/
    );
  }
);

test(
  "reversal requires an explicit reason and operation id",
  () => {
    assert.equal(
      typeof _test.buildReversedLedgerRecord,
      "function"
    );

    const original = {
      ledgerId:
        "LEDGER-001",

      ledgerStatus:
        "POSTED",

      campaignId:
        "CAM-001",

      personId:
        "PER-001",

      points:
        30,

      runtimeScoringEnabled:
        true,
    };

    assert.throws(
      () =>
        _test.buildReversedLedgerRecord({
          original,

          actorUid:
            "ACTOR-UID-001",

          actorPersonId:
            "ACTOR-PERSON-001",

          reason:
            "",

          operationId:
            "OP-001",

          serverNow:
            "SERVER-TIMESTAMP",
        }),
      /REVERSAL_REASON_REQUIRED/
    );

    assert.throws(
      () =>
        _test.buildReversedLedgerRecord({
          original,

          actorUid:
            "ACTOR-UID-001",

          actorPersonId:
            "ACTOR-PERSON-001",

          reason:
            "MISSION_VALIDATION_REVOKED",

          operationId:
            "",

          serverNow:
            "SERVER-TIMESTAMP",
        }),
      /REVERSAL_OPERATION_ID_REQUIRED/
    );
  }
);
test(
  "reversal writer exposes transaction core only for tests",
  () => {
    assert.equal(
      typeof _test.reverseContributionLedgerEntryCore,
      "function"
    );
  }
);
test(
  "reversal core enters a database transaction",
  async () => {
    let transactionCalls = 0;

    const db = {
      async runTransaction(callback) {
        transactionCalls += 1;

        const tx = {
          async get() {
            throw new Error(
              "STOP_AFTER_TRANSACTION_ENTRY"
            );
          },
        };

        return callback(tx);
      },

      collection() {
        return {
          doc() {
            return {
              id:
                "FAKE-DOC",
            };
          },
        };
      },
    };

    const runtime = {
      resolveActor:
        async () => {
          throw new Error(
            "UNEXPECTED_RESOLVE_ACTOR"
          );
        },

      serverTimestamp:
        () =>
          "SERVER-TIMESTAMP",
    };

    await assert.rejects(
      () =>
        _test.reverseContributionLedgerEntryCore({
          db,

          actorUid:
            "ACTOR-UID-001",

          ledgerId:
            "LEDGER-001",

          reason:
            "MISSION_VALIDATION_REVOKED",

          operationId:
            "MISSION-001:REVISION-002",

          runtime,
        }),
      /STOP_AFTER_TRANSACTION_ENTRY/
    );

    assert.equal(
      transactionCalls,
      1
    );
  }
);
test(
  "reversal core reads actor and target ledger inside the transaction",
  async () => {
    const reads = [];

    const db = {
      async runTransaction(callback) {
        const tx = {
          async get(ref) {
            reads.push(
              `${ref.collectionName}/${ref.id}`
            );

            if (
              ref.collectionName ===
                "usuarios"
            ) {
              return {
                exists: true,

                data() {
                  return {
                    active: true,
                    campaignId:
                      "CAM-001",
                    personId:
                      "ACTOR-PERSON-001",
                  };
                },
              };
            }

            if (
              ref.collectionName ===
                "contributionLedger"
            ) {
              throw new Error(
                "STOP_AFTER_LEDGER_READ"
              );
            }

            throw new Error(
              "UNEXPECTED_TRANSACTION_READ"
            );
          },
        };

        return callback(tx);
      },

      collection(collectionName) {
        return {
          doc(id) {
            return {
              collectionName,
              id,
            };
          },
        };
      },
    };

    const runtime = {
      resolveActor:
        async () => ({
          personId:
            "ACTOR-PERSON-001",

          accountUid:
            "ACTOR-UID-001",
        }),

      serverTimestamp:
        () =>
          "SERVER-TIMESTAMP",
    };

    await assert.rejects(
      () =>
        _test.reverseContributionLedgerEntryCore({
          db,

          actorUid:
            "ACTOR-UID-001",

          ledgerId:
            "LEDGER-001",

          reason:
            "MISSION_VALIDATION_REVOKED",

          operationId:
            "MISSION-001:REVISION-002",

          runtime,
        }),
      /STOP_AFTER_LEDGER_READ/
    );

    assert.deepEqual(
      reads,
      [
        "usuarios/ACTOR-UID-001",
        "contributionLedger/LEDGER-001",
      ]
    );
  }
);
test(
  "reversal rejects a missing actor profile before ledger mutation",
  async () => {
    let ledgerReads = 0;
    let updateCalls = 0;
    let createCalls = 0;

    const db = {
      async runTransaction(callback) {
        const tx = {
          async get(ref) {
            if (
              ref.collectionName ===
                "usuarios"
            ) {
              return {
                exists: false,

                data() {
                  return undefined;
                },
              };
            }

            if (
              ref.collectionName ===
                "contributionLedger"
            ) {
              ledgerReads += 1;

              return {
                exists: true,

                data() {
                  return {
                    ledgerId:
                      "LEDGER-001",

                    ledgerStatus:
                      "POSTED",

                    campaignId:
                      "CAM-001",

                    personId:
                      "PER-001",

                    points:
                      30,

                    runtimeScoringEnabled:
                      true,
                  };
                },
              };
            }

            throw new Error(
              "UNEXPECTED_TRANSACTION_READ"
            );
          },

          update() {
            updateCalls += 1;
          },

          create() {
            createCalls += 1;
          },
        };

        return callback(tx);
      },

      collection(collectionName) {
        return {
          doc(id) {
            return {
              collectionName,
              id,
            };
          },
        };
      },
    };

    const runtime = {
      resolveActor:
        async () => {
          throw new Error(
            "RESOLVE_ACTOR_MUST_NOT_RUN"
          );
        },

      serverTimestamp:
        () =>
          "SERVER-TIMESTAMP",
    };

    await assert.rejects(
      () =>
        _test.reverseContributionLedgerEntryCore({
          db,

          actorUid:
            "ACTOR-UID-001",

          ledgerId:
            "LEDGER-001",

          reason:
            "MISSION_VALIDATION_REVOKED",

          operationId:
            "MISSION-001:REVISION-002",

          runtime,
        }),
      /ACTOR_PROFILE_REQUIRED/
    );

    assert.equal(
      ledgerReads,
      0
    );

    assert.equal(
      updateCalls,
      0
    );

    assert.equal(
      createCalls,
      0
    );
  }
);
test(
  "reversal rejects an inactive actor for the target ledger campaign",
  async () => {
    let resolveActorCalls = 0;
    let updateCalls = 0;
    let createCalls = 0;

    const db = {
      async runTransaction(callback) {
        const tx = {
          async get(ref) {
            if (
              ref.collectionName ===
                "usuarios"
            ) {
              return {
                exists: true,

                data() {
                  return {
                    active: false,
                    campaignId:
                      "CAM-001",
                    personId:
                      "ACTOR-PERSON-001",
                  };
                },
              };
            }

            if (
              ref.collectionName ===
                "contributionLedger"
            ) {
              return {
                exists: true,

                data() {
                  return {
                    ledgerId:
                      "LEDGER-001",

                    ledgerStatus:
                      "POSTED",

                    campaignId:
                      "CAM-001",

                    personId:
                      "PER-001",

                    points:
                      30,

                    runtimeScoringEnabled:
                      true,
                  };
                },
              };
            }

            throw new Error(
              "UNEXPECTED_TRANSACTION_READ"
            );
          },

          update() {
            updateCalls += 1;
          },

          create() {
            createCalls += 1;
          },
        };

        return callback(tx);
      },

      collection(collectionName) {
        return {
          doc(id) {
            return {
              collectionName,
              id,
            };
          },
        };
      },
    };

    const runtime = {
      resolveActor:
        async () => {
          resolveActorCalls += 1;

          return {
            personId:
              "ACTOR-PERSON-001",

            accountUid:
              "ACTOR-UID-001",
          };
        },

      serverTimestamp:
        () =>
          "SERVER-TIMESTAMP",
    };

    await assert.rejects(
      () =>
        _test.reverseContributionLedgerEntryCore({
          db,

          actorUid:
            "ACTOR-UID-001",

          ledgerId:
            "LEDGER-001",

          reason:
            "MISSION_VALIDATION_REVOKED",

          operationId:
            "MISSION-001:REVISION-002",

          runtime,
        }),
      /ACTOR_PROFILE_NOT_AUTHORIZED_FOR_CAMPAIGN/
    );

    assert.equal(
      resolveActorCalls,
      0
    );

    assert.equal(
      updateCalls,
      0
    );

    assert.equal(
      createCalls,
      0
    );
  }
);
test(
  "reversal rejects canonical actor uid mismatch before mutation",
  async () => {
    let resolveActorCalls = 0;
    let updateCalls = 0;
    let createCalls = 0;

    const db = {
      async runTransaction(callback) {
        const tx = {
          async get(ref) {
            if (
              ref.collectionName ===
                "usuarios"
            ) {
              return {
                exists: true,

                data() {
                  return {
                    active: true,
                    campaignId:
                      "CAM-001",
                    personId:
                      "ACTOR-PERSON-001",
                  };
                },
              };
            }

            if (
              ref.collectionName ===
                "contributionLedger"
            ) {
              return {
                exists: true,

                data() {
                  return {
                    ledgerId:
                      "LEDGER-001",
                    ledgerStatus:
                      "POSTED",
                    campaignId:
                      "CAM-001",
                    personId:
                      "PER-001",
                    points:
                      30,
                    runtimeScoringEnabled:
                      true,
                  };
                },
              };
            }

            throw new Error(
              "UNEXPECTED_TRANSACTION_READ"
            );
          },

          update() {
            updateCalls += 1;
          },

          create() {
            createCalls += 1;
          },
        };

        return callback(tx);
      },

      collection(collectionName) {
        return {
          doc(id) {
            return {
              collectionName,
              id,
            };
          },
        };
      },
    };

    const runtime = {
      resolveActor:
        async ({
          db: receivedDb,
          tx,
          accountUid,
          profile,
          campaignId,
        }) => {
          resolveActorCalls += 1;

          assert.equal(
            receivedDb,
            db
          );

          assert.ok(tx);

          assert.equal(
            accountUid,
            "ACTOR-UID-001"
          );

          assert.equal(
            profile.personId,
            "ACTOR-PERSON-001"
          );

          assert.equal(
            campaignId,
            "CAM-001"
          );

          return {
            personId:
              "ACTOR-PERSON-001",

            accountUid:
              "OTHER-UID-999",
          };
        },

      serverTimestamp:
        () =>
          "SERVER-TIMESTAMP",
    };

    await assert.rejects(
      () =>
        _test.reverseContributionLedgerEntryCore({
          db,

          actorUid:
            "ACTOR-UID-001",

          ledgerId:
            "LEDGER-001",

          reason:
            "MISSION_VALIDATION_REVOKED",

          operationId:
            "MISSION-001:REVISION-002",

          runtime,
        }),
      /CANONICAL_ACTOR_UID_MISMATCH/
    );

    assert.equal(
      resolveActorCalls,
      1
    );

    assert.equal(
      updateCalls,
      0
    );

    assert.equal(
      createCalls,
      0
    );
  }
);
test(
  "reversal core updates a POSTED ledger to REVERSED without changing contribution identity",
  async () => {
    const updates = [];
    let createCalls = 0;

    const originalLedger = {
      ledgerId:
        "LEDGER-001",

      ledgerStatus:
        "POSTED",

      campaignId:
        "CAM-001",

      personId:
        "PER-001",

      points:
        30,

      activityCode:
        "MISSION_VALIDATED",

      sourceType:
        "MISSION",

      sourceId:
        "MISSION-001",

      scoreDimension:
        "PARTICIPATION",

      runtimeScoringEnabled:
        true,

      postedByUserId:
        "ORIGINAL-UID",

      postedByPersonId:
        "ORIGINAL-PERSON",
    };

    const db = {
      async runTransaction(callback) {
        const tx = {
          async get(ref) {
            if (
              ref.collectionName ===
                "usuarios"
            ) {
              return {
                exists: true,

                data() {
                  return {
                    active: true,
                    campaignId:
                      "CAM-001",
                    personId:
                      "ACTOR-PERSON-001",
                  };
                },
              };
            }

            if (
              ref.collectionName ===
                "contributionLedger"
            ) {
              return {
                exists: true,

                data() {
                  return {
                    ...originalLedger,
                  };
                },
              };
            }

            throw new Error(
              "UNEXPECTED_TRANSACTION_READ"
            );
          },

          update(ref, data) {
            updates.push({
              ref,
              data,
            });
          },

          create() {
            createCalls += 1;
          },
        };

        return callback(tx);
      },

      collection(collectionName) {
        return {
          doc(id) {
            return {
              collectionName,
              id,
            };
          },
        };
      },
    };

    const runtime = {
      resolveActor:
        async () => ({
          personId:
            "ACTOR-PERSON-001",

          accountUid:
            "ACTOR-UID-001",
        }),

      serverTimestamp:
        () =>
          "SERVER-TIMESTAMP",
    };

    const result =
      await _test.reverseContributionLedgerEntryCore({
        db,

        actorUid:
          "ACTOR-UID-001",

        ledgerId:
          "LEDGER-001",

        reason:
          "MISSION_VALIDATION_REVOKED",

        operationId:
          "MISSION-001:REVISION-002",

        runtime,
      });

    assert.equal(
      result.ok,
      true
    );

    assert.equal(
      result.alreadyReversed,
      false
    );

    assert.equal(
      updates.length,
      1
    );

    assert.equal(
      updates[0].ref.collectionName,
      "contributionLedger"
    );

    assert.equal(
      updates[0].ref.id,
      "LEDGER-001"
    );

    assert.equal(
      updates[0].data.ledgerId,
      "LEDGER-001"
    );

    assert.equal(
      updates[0].data.campaignId,
      "CAM-001"
    );

    assert.equal(
      updates[0].data.personId,
      "PER-001"
    );

    assert.equal(
      updates[0].data.points,
      30
    );

    assert.equal(
      updates[0].data.ledgerStatus,
      "REVERSED"
    );

    assert.equal(
      updates[0].data.runtimeScoringEnabled,
      false
    );

    assert.equal(
      updates[0].data.reversalReason,
      "MISSION_VALIDATION_REVOKED"
    );

    assert.equal(
      updates[0].data.reversalOperationId,
      "MISSION-001:REVISION-002"
    );

    assert.equal(
      updates[0].data.reversedByUserId,
      "ACTOR-UID-001"
    );

    assert.equal(
      updates[0].data.reversedByPersonId,
      "ACTOR-PERSON-001"
    );

    assert.equal(
      updates[0].data.reversedAt,
      "SERVER-TIMESTAMP"
    );

    assert.equal(
      createCalls,
      1
    );
  }
);
test(
  "reversal core writes an audit record in the same transaction",
  async () => {
    const updates = [];
    const creates = [];

    const originalLedger = {
      ledgerId:
        "LEDGER-001",

      ledgerStatus:
        "POSTED",

      campaignId:
        "CAM-001",

      personId:
        "PER-001",

      points:
        30,

      activityCode:
        "MISSION_VALIDATED",

      sourceType:
        "MISSION",

      sourceId:
        "MISSION-001",

      scoreDimension:
        "PARTICIPATION",

      runtimeScoringEnabled:
        true,
    };

    const db = {
      async runTransaction(callback) {
        const tx = {
          async get(ref) {
            if (
              ref.collectionName ===
                "usuarios"
            ) {
              return {
                exists: true,

                data() {
                  return {
                    active: true,
                    campaignId:
                      "CAM-001",
                    personId:
                      "ACTOR-PERSON-001",
                  };
                },
              };
            }

            if (
              ref.collectionName ===
                "contributionLedger"
            ) {
              return {
                exists: true,

                data() {
                  return {
                    ...originalLedger,
                  };
                },
              };
            }

            throw new Error(
              "UNEXPECTED_TRANSACTION_READ"
            );
          },

          update(ref, data) {
            updates.push({
              ref,
              data,
            });
          },

          create(ref, data) {
            creates.push({
              ref,
              data,
            });
          },
        };

        return callback(tx);
      },

      collection(collectionName) {
        return {
          doc(id) {
            return {
              collectionName,
              id,
            };
          },
        };
      },
    };

    const runtime = {
      resolveActor:
        async () => ({
          personId:
            "ACTOR-PERSON-001",

          accountUid:
            "ACTOR-UID-001",
        }),

      serverTimestamp:
        () =>
          "SERVER-TIMESTAMP",
    };

    const result =
      await _test.reverseContributionLedgerEntryCore({
        db,

        actorUid:
          "ACTOR-UID-001",

        ledgerId:
          "LEDGER-001",

        reason:
          "MISSION_VALIDATION_REVOKED",

        operationId:
          "MISSION-001:REVISION-002",

        runtime,
      });

    assert.equal(
      updates.length,
      1
    );

    assert.equal(
      creates.length,
      1
    );

    assert.equal(
      creates[0].ref.collectionName,
      "logs"
    );

    assert.equal(
      creates[0].data.action,
      "CONTRIBUTION_LEDGER_REVERSED"
    );

    assert.equal(
      creates[0].data.campaignId,
      "CAM-001"
    );

    assert.equal(
      creates[0].data.personId,
      "PER-001"
    );

    assert.equal(
      creates[0].data.contributionLedgerId,
      "LEDGER-001"
    );

    assert.equal(
      creates[0].data.reversalReason,
      "MISSION_VALIDATION_REVOKED"
    );

    assert.equal(
      creates[0].data.reversalOperationId,
      "MISSION-001:REVISION-002"
    );

    assert.equal(
      creates[0].data.actorUserId,
      "ACTOR-UID-001"
    );

    assert.equal(
      creates[0].data.actorPersonId,
      "ACTOR-PERSON-001"
    );

    assert.equal(
      creates[0].data.pointsRemoved,
      30
    );

    assert.equal(
      creates[0].data.performanceSummaryWritten,
      false
    );

    assert.equal(
      creates[0].data.createdAt,
      "SERVER-TIMESTAMP"
    );

    assert.equal(
      result.ok,
      true
    );

    assert.equal(
      result.alreadyReversed,
      false
    );

    assert.equal(
      result.ledgerId,
      "LEDGER-001"
    );

    assert.equal(
      result.pointsRemoved,
      30
    );

    assert.equal(
      result.performanceSummaryWritten,
      false
    );
  }
);
test(
  "reversal is idempotent for the same reversal operation",
  async () => {
    let updateCalls = 0;
    let createCalls = 0;

    const db = {
      async runTransaction(callback) {
        const tx = {
          async get(ref) {
            if (
              ref.collectionName ===
                "usuarios"
            ) {
              return {
                exists: true,

                data() {
                  return {
                    active: true,
                    campaignId:
                      "CAM-001",
                    personId:
                      "ACTOR-PERSON-001",
                  };
                },
              };
            }

            if (
              ref.collectionName ===
                "contributionLedger"
            ) {
              return {
                exists: true,

                data() {
                  return {
                    ledgerId:
                      "LEDGER-001",

                    ledgerStatus:
                      "REVERSED",

                    campaignId:
                      "CAM-001",

                    personId:
                      "PER-001",

                    points:
                      30,

                    activityCode:
                      "MISSION_VALIDATED",

                    sourceType:
                      "MISSION",

                    sourceId:
                      "MISSION-001",

                    scoreDimension:
                      "PARTICIPATION",

                    runtimeScoringEnabled:
                      false,

                    reversalReason:
                      "MISSION_VALIDATION_REVOKED",

                    reversalOperationId:
                      "MISSION-001:REVISION-002",

                    reversedByUserId:
                      "ACTOR-UID-001",

                    reversedByPersonId:
                      "ACTOR-PERSON-001",

                    reversedAt:
                      "EARLIER-SERVER-TIMESTAMP",
                  };
                },
              };
            }

            throw new Error(
              "UNEXPECTED_TRANSACTION_READ"
            );
          },

          update() {
            updateCalls += 1;
          },

          create() {
            createCalls += 1;
          },
        };

        return callback(tx);
      },

      collection(collectionName) {
        return {
          doc(id) {
            return {
              collectionName,
              id,
            };
          },
        };
      },
    };

    const runtime = {
      resolveActor:
        async () => ({
          personId:
            "ACTOR-PERSON-001",

          accountUid:
            "ACTOR-UID-001",
        }),

      serverTimestamp:
        () =>
          "NEW-SERVER-TIMESTAMP",
    };

    const result =
      await _test.reverseContributionLedgerEntryCore({
        db,

        actorUid:
          "ACTOR-UID-001",

        ledgerId:
          "LEDGER-001",

        reason:
          "MISSION_VALIDATION_REVOKED",

        operationId:
          "MISSION-001:REVISION-002",

        runtime,
      });

    assert.equal(
      result.ok,
      true
    );

    assert.equal(
      result.alreadyReversed,
      true
    );

    assert.equal(
      result.ledgerId,
      "LEDGER-001"
    );

    assert.equal(
      result.campaignId,
      "CAM-001"
    );

    assert.equal(
      result.personId,
      "PER-001"
    );

    assert.equal(
      result.pointsRemoved,
      30
    );

    assert.equal(
      result.reversalOperationId,
      "MISSION-001:REVISION-002"
    );

    assert.equal(
      result.performanceSummaryWritten,
      false
    );

    assert.equal(
      updateCalls,
      0
    );

    assert.equal(
      createCalls,
      0
    );
  }
);

test(
  "reversal rejects a different operation when ledger is already REVERSED",
  async () => {
    let updateCalls = 0;
    let createCalls = 0;

    const db = {
      async runTransaction(callback) {
        const tx = {
          async get(ref) {
            if (
              ref.collectionName ===
                "usuarios"
            ) {
              return {
                exists: true,

                data() {
                  return {
                    active: true,
                    campaignId:
                      "CAM-001",
                    personId:
                      "ACTOR-PERSON-001",
                  };
                },
              };
            }

            if (
              ref.collectionName ===
                "contributionLedger"
            ) {
              return {
                exists: true,

                data() {
                  return {
                    ledgerId:
                      "LEDGER-001",

                    ledgerStatus:
                      "REVERSED",

                    campaignId:
                      "CAM-001",

                    personId:
                      "PER-001",

                    points:
                      30,

                    activityCode:
                      "MISSION_VALIDATED",

                    sourceType:
                      "MISSION",

                    sourceId:
                      "MISSION-001",

                    scoreDimension:
                      "PARTICIPATION",

                    runtimeScoringEnabled:
                      false,

                    reversalReason:
                      "MISSION_VALIDATION_REVOKED",

                    reversalOperationId:
                      "MISSION-001:REVISION-002",

                    reversedByUserId:
                      "ACTOR-UID-001",

                    reversedByPersonId:
                      "ACTOR-PERSON-001",

                    reversedAt:
                      "EARLIER-SERVER-TIMESTAMP",
                  };
                },
              };
            }

            throw new Error(
              "UNEXPECTED_TRANSACTION_READ"
            );
          },

          update() {
            updateCalls += 1;
          },

          create() {
            createCalls += 1;
          },
        };

        return callback(tx);
      },

      collection(collectionName) {
        return {
          doc(id) {
            return {
              collectionName,
              id,
            };
          },
        };
      },
    };

    const runtime = {
      resolveActor:
        async () => ({
          personId:
            "ACTOR-PERSON-001",

          accountUid:
            "ACTOR-UID-001",
        }),

      serverTimestamp:
        () =>
          "NEW-SERVER-TIMESTAMP",
    };

    await assert.rejects(
      () =>
        _test.reverseContributionLedgerEntryCore({
          db,

          actorUid:
            "ACTOR-UID-001",

          ledgerId:
            "LEDGER-001",

          reason:
            "SECOND_REVERSAL_ATTEMPT",

          operationId:
            "MISSION-001:REVISION-003",

          runtime,
        }),
      /CONTRIBUTION_LEDGER_ALREADY_REVERSED/
    );

    assert.equal(
      updateCalls,
      0
    );

    assert.equal(
      createCalls,
      0
    );
  }
);
test(
  "reversal rejects a ledger whose canonical ledgerId does not match the requested document",
  async () => {
    let resolveActorCalls = 0;
    let updateCalls = 0;
    let createCalls = 0;

    const db = {
      async runTransaction(callback) {
        const tx = {
          async get(ref) {
            if (
              ref.collectionName ===
                "usuarios"
            ) {
              return {
                exists: true,

                data() {
                  return {
                    active: true,
                    campaignId:
                      "CAM-001",
                    personId:
                      "ACTOR-PERSON-001",
                  };
                },
              };
            }

            if (
              ref.collectionName ===
                "contributionLedger"
            ) {
              return {
                exists: true,

                data() {
                  return {
                    ledgerId:
                      "LEDGER-DIFFERENT",

                    ledgerStatus:
                      "POSTED",

                    campaignId:
                      "CAM-001",

                    personId:
                      "PER-001",

                    points:
                      30,

                    activityCode:
                      "MISSION_VALIDATED",

                    sourceType:
                      "MISSION",

                    sourceId:
                      "MISSION-001",

                    scoreDimension:
                      "PARTICIPATION",

                    runtimeScoringEnabled:
                      true,
                  };
                },
              };
            }

            throw new Error(
              "UNEXPECTED_TRANSACTION_READ"
            );
          },

          update() {
            updateCalls += 1;
          },

          create() {
            createCalls += 1;
          },
        };

        return callback(tx);
      },

      collection(collectionName) {
        return {
          doc(id) {
            return {
              collectionName,
              id,
            };
          },
        };
      },
    };

    const runtime = {
      resolveActor:
        async () => {
          resolveActorCalls += 1;

          return {
            personId:
              "ACTOR-PERSON-001",

            accountUid:
              "ACTOR-UID-001",
          };
        },

      serverTimestamp:
        () =>
          "SERVER-TIMESTAMP",
    };

    await assert.rejects(
      () =>
        _test.reverseContributionLedgerEntryCore({
          db,

          actorUid:
            "ACTOR-UID-001",

          ledgerId:
            "LEDGER-001",

          reason:
            "MISSION_VALIDATION_REVOKED",

          operationId:
            "MISSION-001:REVISION-002",

          runtime,
        }),
      /CONTRIBUTION_LEDGER_ID_MISMATCH/
    );

    assert.equal(
      resolveActorCalls,
      0
    );

    assert.equal(
      updateCalls,
      0
    );

    assert.equal(
      createCalls,
      0
    );
  }
);
test(
  "production reversal boundary no longer uses the transaction placeholder",
  async () => {
    const fakeDb = {
      async runTransaction() {
        throw new Error(
          "PRODUCTION_BOUNDARY_REACHED_TRANSACTION"
        );
      },
    };

    await assert.rejects(
      () =>
        reverseContributionLedgerEntry({
          db:
            fakeDb,

          actorUid:
            "ACTOR-UID-001",

          ledgerId:
            "LEDGER-001",

          reason:
            "MISSION_VALIDATION_REVOKED",

          operationId:
            "MISSION-001:REVISION-002",
        }),
      /PRODUCTION_BOUNDARY_REACHED_TRANSACTION/
    );
  }
);
test(
  "reversed ledger can be explicitly reactivated without changing deterministic identity",
  () => {
    assert.equal(
      typeof _test.buildReactivatedLedgerRecord,
      "function"
    );

    const reversed = {
      ledgerId: "LEDGER-REACTIVATE-001",
      campaignId: "CAM-001",
      personId: "PERSON-001",
      points: 12,
      ledgerStatus: "REVERSED",
      runtimeScoringEnabled: false,
      reversalReason: "MISSION_NO_LONGER_ELIGIBLE",
      reversalOperationId: "REVERSAL-001",
      reversedByUserId: "ACTOR-UID-001",
      reversedByPersonId: "PERSON-ACTOR-001",
      reversedAt: "SERVER-TIME-REVERSAL"
    };

    const reactivated =
      _test.buildReactivatedLedgerRecord({
        original: reversed,
        actorUid: "ACTOR-UID-001",
        actorPersonId: "PERSON-ACTOR-001",
        operationId: "REACTIVATION-001",
        serverNow: "SERVER-TIME-REACTIVATION"
      });

    assert.equal(
      reactivated.ledgerId,
      reversed.ledgerId
    );

    assert.equal(
      reactivated.ledgerStatus,
      "POSTED"
    );

    assert.equal(
      reactivated.runtimeScoringEnabled,
      true
    );

    assert.equal(
      reactivated.reactivationOperationId,
      "REACTIVATION-001"
    );

    assert.equal(
      reactivated.reactivatedByUserId,
      "ACTOR-UID-001"
    );

    assert.equal(
      reactivated.reactivatedByPersonId,
      "PERSON-ACTOR-001"
    );

    assert.equal(
      reactivated.reactivatedAt,
      "SERVER-TIME-REACTIVATION"
    );

    assert.equal(
      reactivated.reversalOperationId,
      "REVERSAL-001"
    );

    assert.equal(
      reactivated.reversalReason,
      "MISSION_NO_LONGER_ELIGIBLE"
    );

    assert.equal(
      reactivated.reversedAt,
      "SERVER-TIME-REVERSAL"
    );
  }
);
test(
  "reactivation writer exposes transaction core only for tests",
  () => {
    assert.equal(
      typeof _test.reactivateContributionLedgerEntryCore,
      "function"
    );
  }
);
test(
  "reactivation core updates the same REVERSED ledger back to POSTED",
  async () => {
    const updates = [];
    const creates = [];

    const reversedLedger = {
      ledgerId:
        "LEDGER-REACTIVATE-001",

      ledgerStatus:
        "REVERSED",

      campaignId:
        "CAM-001",

      personId:
        "PER-001",

      points:
        30,

      activityCode:
        "MISSION_VALIDATED",

      sourceType:
        "MISSION",

      sourceId:
        "MISSION-001",

      scoreDimension:
        "PARTICIPATION",

      runtimeScoringEnabled:
        false,

      reversalReason:
        "MISSION_VALIDATION_REVOKED",

      schemaVersion:
        "1.0.0",

      scoreSourceType:
        "MISSION",

      scoreSourceId:
        "MISSION-001",

      ruleId:
        "RULE-001",

      scoreRuleVersion:
        "1.0.0",

      ruleSetVersion:
        "1.0.0",

      ruleSnapshot: {
        ruleId:
          "RULE-001",

        basePoints:
          30,
      },

      evidenceRef:
        "missionEvidence/EVIDENCE-001",

      occurredAt:
        "ORIGINAL-CONTRIBUTION-TIMESTAMP",

      candidateId:
        "CANDIDATE-REACTIVATE-001",

      reversalOperationId:
        "MISSION-001:REVISION-002",

      reversedByUserId:
        "ACTOR-UID-001",

      reversedByPersonId:
        "ACTOR-PERSON-001",

      reversedAt:
        "REVERSAL-TIMESTAMP",
    };

    const db = {
      async runTransaction(callback) {
        const tx = {
          async get(ref) {
            if (
              ref.collectionName ===
                "usuarios"
            ) {
              return {
                exists:
                  true,

                data() {
                  return {
                    active:
                      true,

                    campaignId:
                      "CAM-001",

                    personId:
                      "ACTOR-PERSON-001",
                  };
                },
              };
            }

            if (
              ref.collectionName ===
                "contributionLedger"
            ) {
              return {
                exists:
                  true,

                data() {
                  return {
                    ...reversedLedger,
                  };
                },
              };
            }

            throw new Error(
              "UNEXPECTED_TRANSACTION_READ"
            );
          },

          update(ref, data) {
            updates.push({
              ref,
              data,
            });
          },

          create(ref, data) {
            creates.push({
              ref,
              data,
            });
          },
        };

        return callback(tx);
      },

      collection(collectionName) {
        return {
          doc(id) {
            return {
              collectionName,
              id,
            };
          },
        };
      },
    };

    const runtime = {
      resolveActor:
        async () => ({
          personId:
            "ACTOR-PERSON-001",

          accountUid:
            "ACTOR-UID-001",
        }),

      serverTimestamp:
        () =>
          "REACTIVATION-TIMESTAMP",
    };

    const candidate = {
      candidateId:
        "CANDIDATE-REACTIVATE-001",

      ledgerDraft: {
        ledgerId:
          "LEDGER-REACTIVATE-001",

        schemaVersion:
          "1.0.0",

        campaignId:
          "CAM-001",

        personId:
          "PER-001",

        activityCode:
          "MISSION_VALIDATED",

        points:
          30,

        scoreDimension:
          "PARTICIPATION",

        sourceType:
          "MISSION",

        sourceId:
          "MISSION-001",

        scoreSourceType:
          "MISSION",

        scoreSourceId:
          "MISSION-001",

        ruleId:
          "RULE-001",

        scoreRuleVersion:
          "1.0.0",

        ruleSetVersion:
          "1.0.0",

        ruleSnapshot: {
          ruleId:
            "RULE-001",

          basePoints:
            30,
        },

        evidenceRef:
          "missionEvidence/EVIDENCE-001",

        occurredAt:
          "NEW-REVIEW-TIMESTAMP",
      },
    };

    const result =
      await _test.reactivateContributionLedgerEntryCore({
        db,

        actorUid:
          "ACTOR-UID-001",

        ledgerId:
          "LEDGER-REACTIVATE-001",

        operationId:
          "MISSION-001:REVISION-003",

        candidate,

        runtime,
      });

    assert.equal(
      result.ok,
      true
    );

    assert.equal(
      result.alreadyReactivated,
      false
    );

    assert.equal(
      updates.length,
      1
    );

    assert.equal(
      updates[0].ref.collectionName,
      "contributionLedger"
    );

    assert.equal(
      updates[0].ref.id,
      "LEDGER-REACTIVATE-001"
    );

    assert.equal(
      updates[0].data.ledgerId,
      "LEDGER-REACTIVATE-001"
    );

    assert.equal(
      updates[0].data.ledgerStatus,
      "POSTED"
    );

    assert.equal(
      updates[0].data.runtimeScoringEnabled,
      true
    );

    assert.equal(
      updates[0].data.points,
      30
    );

    assert.equal(
      updates[0].data.reversalOperationId,
      "MISSION-001:REVISION-002"
    );

    assert.equal(
      updates[0].data.reactivationOperationId,
      "MISSION-001:REVISION-003"
    );

    assert.equal(
      updates[0].data.reactivatedByUserId,
      "ACTOR-UID-001"
    );

    assert.equal(
      updates[0].data.reactivatedByPersonId,
      "ACTOR-PERSON-001"
    );

    assert.equal(
      updates[0].data.reactivatedAt,
      "REACTIVATION-TIMESTAMP"
    );

    assert.equal(
      creates.length,
      1
    );

    assert.equal(
      creates[0].ref.collectionName,
      "logs"
    );

    assert.equal(
      creates[0].data.action,
      "CONTRIBUTION_LEDGER_REACTIVATED"
    );

    assert.equal(
      creates[0].data.contributionLedgerId,
      "LEDGER-REACTIVATE-001"
    );

    assert.equal(
      creates[0].data.pointsRestored,
      30
    );

    assert.equal(
      creates[0].data.reactivationOperationId,
      "MISSION-001:REVISION-003"
    );

    assert.equal(
      creates[0].data.contributionLedgerReactivated,
      true
    );

    assert.equal(
      creates[0].data.runtimeScoringEnabled,
      true
    );

    assert.equal(
      creates[0].data.performanceSummaryWritten,
      false
    );

    assert.equal(
      result.ledgerId,
      "LEDGER-REACTIVATE-001"
    );

    assert.equal(
      result.pointsRestored,
      30
    );

    assert.equal(
      result.reactivationOperationId,
      "MISSION-001:REVISION-003"
    );

    assert.equal(
      result.performanceSummaryWritten,
      false
    );
  }
);
function createReactivationPostedFixture({
  reactivationOperationId,
}) {
  const updates = [];
  const creates = [];

  const ledger = {
    ledgerId:
      "LEDGER-REACTIVATE-IDEMPOTENCY-001",

    ledgerStatus:
      "POSTED",

    campaignId:
      "CAM-001",

    personId:
      "PER-001",

    points:
      30,

    activityCode:
      "MISSION_VALIDATED",

    sourceType:
      "MISSION",

    sourceId:
      "MISSION-001",

    scoreDimension:
      "PARTICIPATION",

    schemaVersion:
      "1.0.0",

    scoreSourceType:
      "MISSION",

    scoreSourceId:
      "MISSION-001",

    ruleId:
      "RULE-MISSION-001",

    scoreRuleVersion:
      "1.0.0",

    ruleSetVersion:
      "1.0.0",

    evidenceRef:
      "EVIDENCE-001",

    ruleSnapshot:{
      points:30
    },

    candidateId:
      "CANDIDATE-REACTIVATE-001",

    runtimeScoringEnabled:
      true,

    reversalReason:
      "MISSION_VALIDATION_REVOKED",

    reversalOperationId:
      "MISSION-001:REVISION-002",

    reactivationOperationId,

    reactivatedByUserId:
      "ACTOR-UID-001",

    reactivatedByPersonId:
      "ACTOR-PERSON-001",

    reactivatedAt:
      "REACTIVATION-TIMESTAMP",
  };

  const db = {
    async runTransaction(callback) {
      const tx = {
        async get(ref) {
          if (ref.collectionName === "usuarios") {
            return {
              exists: true,

              data() {
                return {
                  active: true,
                  campaignId: "CAM-001",
                  personId: "ACTOR-PERSON-001",
                };
              },
            };
          }

          if (ref.collectionName === "contributionLedger") {
            return {
              exists: true,

              data() {
                return {
                  ...ledger,
                };
              },
            };
          }

          throw new Error(
            "UNEXPECTED_TRANSACTION_READ"
          );
        },

        update(ref, data) {
          updates.push({
            ref,
            data,
          });
        },

        create(ref, data) {
          creates.push({
            ref,
            data,
          });
        },
      };

      return callback(tx);
    },

    collection(collectionName) {
      return {
        doc(id) {
          return {
            collectionName,
            id,
          };
        },
      };
    },
  };

  const runtime = {
    resolveActor:
      async () => ({
        personId:
          "ACTOR-PERSON-001",

        accountUid:
          "ACTOR-UID-001",
      }),

    serverTimestamp:
      () =>
        "SHOULD-NOT-BE-USED",
  };

  return {
    db,
    runtime,
    updates,
    creates,
  };
}
test(
  "reactivation is idempotent for the same reactivation operation",
  async () => {
    const fixture =
      createReactivationPostedFixture({
        reactivationOperationId:
          "MISSION-001:REVISION-003",
      });

    const result =
      await _test.reactivateContributionLedgerEntryCore({
        db:
          fixture.db,

        actorUid:
          "ACTOR-UID-001",

        ledgerId:
          "LEDGER-REACTIVATE-IDEMPOTENCY-001",

        operationId:
          "MISSION-001:REVISION-003",

        candidate:{
          candidateId:
            "CANDIDATE-REACTIVATE-001",

          ledgerDraft:{
            ledgerId:
              "LEDGER-REACTIVATE-IDEMPOTENCY-001",

            schemaVersion:
              "1.0.0",

            campaignId:
              "CAM-001",

            personId:
              "PER-001",

            activityCode:
              "MISSION_VALIDATED",

            points:
              30,

            scoreDimension:
              "PARTICIPATION",

            sourceType:
              "MISSION",

            sourceId:
              "MISSION-001",

            scoreSourceType:
              "MISSION",

            scoreSourceId:
              "MISSION-001",

            ruleId:
              "RULE-MISSION-001",

            scoreRuleVersion:
              "1.0.0",

            ruleSetVersion:
              "1.0.0",

            evidenceRef:
              "EVIDENCE-001",

            ruleSnapshot:{
              points:30
            }
          }
        },

        runtime:
          fixture.runtime,
      });

    assert.equal(
      result.ok,
      true
    );

    assert.equal(
      result.alreadyReactivated,
      true
    );

    assert.equal(
      result.ledgerId,
      "LEDGER-REACTIVATE-IDEMPOTENCY-001"
    );

    assert.equal(
      result.pointsRestored,
      30
    );

    assert.equal(
      result.reactivationOperationId,
      "MISSION-001:REVISION-003"
    );

    assert.equal(
      result.performanceSummaryWritten,
      false
    );

    assert.equal(
      fixture.updates.length,
      0
    );

    assert.equal(
      fixture.creates.length,
      0
    );
  }
);
test(
  "idempotent reactivation rejects a semantically incompatible candidate",
  async () => {
    const fixture =
      createReactivationPostedFixture({
        reactivationOperationId:
          "MISSION-001:REVISION-003",
      });

    const incompatibleCandidate = {
      candidateId:
        "CANDIDATE-INCOMPATIBLE-001",

      ledgerDraft:{
        ledgerId:
          "LEDGER-REACTIVATE-IDEMPOTENCY-001",

        schemaVersion:"1.0.0",
        campaignId:"CAM-001",

        personId:
          "PERSON-INCOMPATIBLE",

        activityCode:
          "MISSION_VALIDATED",

        points:30,
        scoreDimension:"MISSION",

        sourceType:
          "MISSION_VALIDATION",

        sourceId:
          "mission:MIS-001:person:PERSON-001",

        scoreSourceType:
          "MISSION_VALIDATION",

        scoreSourceId:
          "mission:MIS-001:person:PERSON-001",

        ruleId:
          "RULE-MISSION-001",

        scoreRuleVersion:"1.0.0",
        ruleSetVersion:"1.0.0",

        evidenceRef:
          "EVIDENCE-001",

        ruleSnapshot:{
          points:30
        }
      }
    };

    await assert.rejects(
      () =>
        _test.reactivateContributionLedgerEntryCore({
          db:
            fixture.db,

          actorUid:
            "ACTOR-UID-001",

          ledgerId:
            "LEDGER-REACTIVATE-IDEMPOTENCY-001",

          operationId:
            "MISSION-001:REVISION-003",

          candidate:
            incompatibleCandidate,

          runtime:
            fixture.runtime,
        }),

      /REACTIVATION_SEMANTIC_MISMATCH|REACTIVATION_CANDIDATE_MISMATCH/
    );

    assert.equal(
      fixture.updates.length,
      0
    );

    assert.equal(
      fixture.creates.length,
      0
    );
  }
);

test(
  "reactivation rejects a different operation when ledger is already POSTED",
  async () => {
    const fixture =
      createReactivationPostedFixture({
        reactivationOperationId:
          "MISSION-001:REVISION-003",
      });

    await assert.rejects(
      () =>
        _test.reactivateContributionLedgerEntryCore({
          db:
            fixture.db,

          actorUid:
            "ACTOR-UID-001",

          ledgerId:
            "LEDGER-REACTIVATE-IDEMPOTENCY-001",

          operationId:
            "MISSION-001:REVISION-004",

          runtime:
            fixture.runtime,
        }),

      /CONTRIBUTION_LEDGER_ALREADY_POSTED/
    );

    assert.equal(
      fixture.updates.length,
      0
    );

    assert.equal(
      fixture.creates.length,
      0
    );
  }
);
test(
  "reactivation semantic guard is exposed only for tests",
  () => {
    assert.equal(
      typeof _test.assertReactivationMatchesCandidate,
      "function"
    );
  }
);

test(
  "reactivation semantic guard allows a newer occurredAt for the same canonical contribution",
  () => {
    const stored = {
      ledgerId: "LEDGER-001",
      schemaVersion: "1",
      ledgerStatus: "REVERSED",
      campaignId: "CAM-001",
      personId: "PER-001",
      activityCode: "MISSION_VALIDATED",
      points: 30,
      scoreDimension: "PARTICIPATION",
      sourceType: "MISSION_VALIDATION",
      sourceId: "mission:MISSION-001:person:PER-001",
      scoreSourceType: "MISSION_VALIDATION",
      scoreSourceId: "mission:MISSION-001:person:PER-001",
      ruleId: "RULE-001",
      scoreRuleVersion: "1",
      ruleSetVersion: "1.0.0",
      ruleSnapshot: {
        ruleId: "RULE-001"
      },
      evidenceRef: "missionEvidence/EVIDENCE-001",
      occurredAt: "2026-09-20T10:00:00.000Z",
      runtimeScoringEnabled: false,
      candidateId: "CANDIDATE-001"
    };

    const candidate = {
      candidateId: "CANDIDATE-001",

      ledgerDraft: {
        ledgerId: "LEDGER-001",
        schemaVersion: "1",
        campaignId: "CAM-001",
        personId: "PER-001",
        activityCode: "MISSION_VALIDATED",
        points: 30,
        scoreDimension: "PARTICIPATION",
        sourceType: "MISSION_VALIDATION",
        sourceId: "mission:MISSION-001:person:PER-001",
        scoreSourceType: "MISSION_VALIDATION",
        scoreSourceId: "mission:MISSION-001:person:PER-001",
        ruleId: "RULE-001",
        scoreRuleVersion: "1",
        ruleSetVersion: "1.0.0",
        ruleSnapshot: {
          ruleId: "RULE-001"
        },
        evidenceRef: "missionEvidence/EVIDENCE-001",

        occurredAt:
          "2026-09-26T12:00:00.000Z"
      }
    };

    const result =
      _test.assertReactivationMatchesCandidate({
        existing: stored,
        candidate
      });

    assert.equal(
      result,
      stored
    );
  }
);


test(
  "reactivation semantic guard treats ruleSnapshot key order as semantically equal",
  () => {
    const stored = {
      ledgerId:"LEDGER-RULE-ORDER-001",
      schemaVersion:"1",
      ledgerStatus:"REVERSED",
      campaignId:"CAM-001",
      personId:"PER-001",
      activityCode:"MISSION_VALIDATED",
      points:30,
      scoreDimension:"PARTICIPATION",
      sourceType:"MISSION_VALIDATION",
      sourceId:"mission:MISSION-001:person:PER-001",
      scoreSourceType:"MISSION_VALIDATION",
      scoreSourceId:"mission:MISSION-001:person:PER-001",
      ruleId:"RULE-001",
      scoreRuleVersion:"1",
      ruleSetVersion:"1.0.0",
      evidenceRef:"missionEvidence/EVIDENCE-001",
      runtimeScoringEnabled:false,
      candidateId:"CANDIDATE-001",

      ruleSnapshot:{
        ruleId:"RULE-001",
        points:30,
        dimension:"PARTICIPATION"
      }
    };

    const candidate = {
      candidateId:"CANDIDATE-001",

      ledgerDraft:{
        ledgerId:"LEDGER-RULE-ORDER-001",
        schemaVersion:"1",
        campaignId:"CAM-001",
        personId:"PER-001",
        activityCode:"MISSION_VALIDATED",
        points:30,
        scoreDimension:"PARTICIPATION",
        sourceType:"MISSION_VALIDATION",
        sourceId:"mission:MISSION-001:person:PER-001",
        scoreSourceType:"MISSION_VALIDATION",
        scoreSourceId:"mission:MISSION-001:person:PER-001",
        ruleId:"RULE-001",
        scoreRuleVersion:"1",
        ruleSetVersion:"1.0.0",
        evidenceRef:"missionEvidence/EVIDENCE-001",

        ruleSnapshot:{
          dimension:"PARTICIPATION",
          points:30,
          ruleId:"RULE-001"
        }
      }
    };

    const result =
      _test.assertReactivationMatchesCandidate({
        existing:stored,
        candidate
      });

    assert.equal(
      result,
      stored
    );
  }
);

test(
  "reactivation semantic guard rejects a different person evidence or source",
  () => {
    const stored = {
      ledgerId: "LEDGER-001",
      schemaVersion: "1",
      ledgerStatus: "REVERSED",
      campaignId: "CAM-001",
      personId: "PER-001",
      activityCode: "MISSION_VALIDATED",
      points: 30,
      scoreDimension: "PARTICIPATION",
      sourceType: "MISSION_VALIDATION",
      sourceId: "mission:MISSION-001:person:PER-001",
      scoreSourceType: "MISSION_VALIDATION",
      scoreSourceId: "mission:MISSION-001:person:PER-001",
      ruleId: "RULE-001",
      scoreRuleVersion: "1",
      ruleSetVersion: "1.0.0",
      evidenceRef: "missionEvidence/EVIDENCE-001",
      occurredAt: "2026-09-20T10:00:00.000Z",
      runtimeScoringEnabled: false,
      candidateId: "CANDIDATE-001"
    };

    const makeCandidate =
      (changes = {}) => ({
        candidateId:
          "CANDIDATE-001",

        ledgerDraft: {
          ledgerId:
            "LEDGER-001",

          schemaVersion:
            "1",

          campaignId:
            "CAM-001",

          personId:
            "PER-001",

          activityCode:
            "MISSION_VALIDATED",

          points:
            30,

          scoreDimension:
            "PARTICIPATION",

          sourceType:
            "MISSION_VALIDATION",

          sourceId:
            "mission:MISSION-001:person:PER-001",

          scoreSourceType:
            "MISSION_VALIDATION",

          scoreSourceId:
            "mission:MISSION-001:person:PER-001",

          ruleId:
            "RULE-001",

          scoreRuleVersion:
            "1",

          ruleSetVersion:
            "1.0.0",

          evidenceRef:
            "missionEvidence/EVIDENCE-001",

          occurredAt:
            "2026-09-26T12:00:00.000Z",

          ...changes
        }
      });

    const invalidCandidates = [
      makeCandidate({
        personId:
          "PER-999"
      }),

      makeCandidate({
        evidenceRef:
          "missionEvidence/EVIDENCE-999"
      }),

      makeCandidate({
        sourceId:
          "mission:MISSION-999:person:PER-001"
      })
    ];

    for (
      const candidate of invalidCandidates
    ) {
      assert.throws(
        () =>
          _test.assertReactivationMatchesCandidate({
            existing: stored,
            candidate
          }),
        /REACTIVATION_SEMANTIC_MISMATCH/
      );
    }
  }
);


test(
  "reactivation semantic guard rejects candidate or scoring rule changes",
  () => {
    const stored = {
      ledgerId: "LEDGER-001",
      schemaVersion: "1",
      ledgerStatus: "REVERSED",
      campaignId: "CAM-001",
      personId: "PER-001",
      activityCode: "MISSION_VALIDATED",
      points: 30,
      scoreDimension: "PARTICIPATION",
      sourceType: "MISSION_VALIDATION",
      sourceId: "mission:MISSION-001:person:PER-001",
      scoreSourceType: "MISSION_VALIDATION",
      scoreSourceId: "mission:MISSION-001:person:PER-001",
      ruleId: "RULE-001",
      scoreRuleVersion: "1",
      ruleSetVersion: "1.0.0",
      evidenceRef: "missionEvidence/EVIDENCE-001",
      runtimeScoringEnabled: false,
      candidateId: "CANDIDATE-001"
    };

    const makeCandidate =
      ({
        candidateId = "CANDIDATE-001",
        changes = {}
      } = {}) => ({
        candidateId,

        ledgerDraft: {
          ledgerId: "LEDGER-001",
          schemaVersion: "1",
          campaignId: "CAM-001",
          personId: "PER-001",
          activityCode: "MISSION_VALIDATED",
          points: 30,
          scoreDimension: "PARTICIPATION",
          sourceType: "MISSION_VALIDATION",
          sourceId: "mission:MISSION-001:person:PER-001",
          scoreSourceType: "MISSION_VALIDATION",
          scoreSourceId: "mission:MISSION-001:person:PER-001",
          ruleId: "RULE-001",
          scoreRuleVersion: "1",
          ruleSetVersion: "1.0.0",
          evidenceRef: "missionEvidence/EVIDENCE-001",
          occurredAt: "2026-09-26T12:00:00.000Z",

          ...changes
        }
      });

    assert.throws(
      () =>
        _test.assertReactivationMatchesCandidate({
          existing: stored,
          candidate:
            makeCandidate({
              candidateId: "CANDIDATE-999"
            })
        }),
      /REACTIVATION_CANDIDATE_MISMATCH/
    );

    const invalidRules = [
      {
        ruleId: "RULE-999"
      },
      {
        scoreRuleVersion: "2"
      },
      {
        ruleSetVersion: "2.0.0"
      },
      {
        points: 99
      },
      {
        scoreDimension: "GROWTH"
      }
    ];

    for (const changes of invalidRules) {
      assert.throws(
        () =>
          _test.assertReactivationMatchesCandidate({
            existing: stored,
            candidate:
              makeCandidate({
                changes
              })
          }),
        /REACTIVATION_SEMANTIC_MISMATCH/
      );
    }
  }
);


test(
  "reactivation core rejects a semantically incompatible canonical candidate before mutation",
  async () => {
    let updateCount = 0;
    let createCount = 0;

    const originalLedger = {
      ledgerId: "LEDGER-001",
      schemaVersion: "1",
      ledgerStatus: "REVERSED",
      campaignId: "CAM-001",
      personId: "PER-001",
      activityCode: "MISSION_VALIDATED",
      points: 30,
      scoreDimension: "PARTICIPATION",
      sourceType: "MISSION_VALIDATION",
      sourceId: "mission:MISSION-001:person:PER-001",
      scoreSourceType: "MISSION_VALIDATION",
      scoreSourceId: "mission:MISSION-001:person:PER-001",
      ruleId: "RULE-001",
      scoreRuleVersion: "1",
      ruleSetVersion: "1.0.0",
      evidenceRef: "missionEvidence/EVIDENCE-001",
      occurredAt: "2026-09-20T10:00:00.000Z",
      runtimeScoringEnabled: false,
      candidateId: "CANDIDATE-001",
      reversalOperationId: "MISSION-001:REVISION-002"
    };

    const db = {
      collection(name) {
        return {
          doc(id) {
            return {
              collectionName: name,
              id
            };
          }
        };
      },

      async runTransaction(callback) {
        const tx = {
          async get(ref) {
            if (
              ref.collectionName === "usuarios"
            ) {
              return {
                exists: true,
                data() {
                  return {
                    active: true,
                    campaignId: "CAM-001",
                    personId: "ACTOR-PERSON-001"
                  };
                }
              };
            }

            if (
              ref.collectionName ===
                "contributionLedger"
            ) {
              return {
                exists: true,
                data() {
                  return originalLedger;
                }
              };
            }

            throw new Error(
              "UNEXPECTED_TRANSACTION_READ"
            );
          },

          update() {
            updateCount += 1;
          },

          create() {
            createCount += 1;
          }
        };

        return callback(tx);
      }
    };

    const candidate = {
      candidateId: "CANDIDATE-001",

      ledgerDraft: {
        ledgerId: "LEDGER-001",
        schemaVersion: "1",
        campaignId: "CAM-001",

        personId:
          "PER-DIFFERENT",

        activityCode: "MISSION_VALIDATED",
        points: 30,
        scoreDimension: "PARTICIPATION",
        sourceType: "MISSION_VALIDATION",
        sourceId:
          "mission:MISSION-001:person:PER-001",
        scoreSourceType: "MISSION_VALIDATION",
        scoreSourceId:
          "mission:MISSION-001:person:PER-001",
        ruleId: "RULE-001",
        scoreRuleVersion: "1",
        ruleSetVersion: "1.0.0",
        evidenceRef:
          "missionEvidence/EVIDENCE-001",
        occurredAt:
          "2026-09-26T12:00:00.000Z"
      }
    };

    await assert.rejects(
      () =>
        _test.reactivateContributionLedgerEntryCore({
          db,
          actorUid: "ACTOR-UID-001",
          ledgerId: "LEDGER-001",
          operationId:
            "MISSION-001:REVISION-003",
          candidate,

          runtime: {
            async resolveActor() {
              return {
                personId:
                  "ACTOR-PERSON-001",

                accountUid:
                  "ACTOR-UID-001"
              };
            },

            serverTimestamp() {
              return "SERVER-TIMESTAMP";
            }
          }
        }),
      /REACTIVATION_SEMANTIC_MISMATCH/
    );

    assert.equal(
      updateCount,
      0
    );

    assert.equal(
      createCount,
      0
    );
  }
);


test(
  "reactivation semantic guard rejects ruleSnapshot drift",
  () => {
    const existing = {
      ledgerId:
        "LEDGER-SNAPSHOT-001",

      schemaVersion:
        "1.0.0",

      ledgerStatus:
        "REVERSED",

      campaignId:
        "CAM-001",

      personId:
        "PER-001",

      activityCode:
        "MISSION_VALIDATED",

      points:
        30,

      scoreDimension:
        "PARTICIPATION",

      sourceType:
        "MISSION",

      sourceId:
        "MISSION-001",

      scoreSourceType:
        "MISSION",

      scoreSourceId:
        "MISSION-001",

      ruleId:
        "RULE-001",

      scoreRuleVersion:
        "1.0.0",

      ruleSetVersion:
        "1.0.0",

      ruleSnapshot: {
        ruleId:
          "RULE-001",

        basePoints:
          30,

        criteria: [
          "MISSION_VALIDATED",
          "NO_PENDING_APPEAL",
        ],
      },

      evidenceRef:
        "missionEvidence/EVIDENCE-001",

      occurredAt:
        "2026-09-20T10:00:00.000Z",

      runtimeScoringEnabled:
        false,

      candidateId:
        "CANDIDATE-SNAPSHOT-001",

      reversalOperationId:
        "MISSION-001:REVISION-002",
    };

    const candidate = {
      candidateId:
        "CANDIDATE-SNAPSHOT-001",

      ledgerDraft: {
        ledgerId:
          "LEDGER-SNAPSHOT-001",

        schemaVersion:
          "1.0.0",

        campaignId:
          "CAM-001",

        personId:
          "PER-001",

        activityCode:
          "MISSION_VALIDATED",

        points:
          30,

        scoreDimension:
          "PARTICIPATION",

        sourceType:
          "MISSION",

        sourceId:
          "MISSION-001",

        scoreSourceType:
          "MISSION",

        scoreSourceId:
          "MISSION-001",

        ruleId:
          "RULE-001",

        scoreRuleVersion:
          "1.0.0",

        ruleSetVersion:
          "1.0.0",

        ruleSnapshot: {
          ruleId:
            "RULE-001",

          basePoints:
            30,

          criteria: [
            "MISSION_VALIDATED",
            "NO_PENDING_APPEAL",
            "CANONICAL_PERSON_RESOLVED",
          ],
        },

        evidenceRef:
          "missionEvidence/EVIDENCE-001",

        occurredAt:
          "2026-09-26T12:00:00.000Z",
      },
    };

    assert.throws(
      () =>
        _test.assertReactivationMatchesCandidate({
          existing,
          candidate,
        }),

      /REACTIVATION_SEMANTIC_MISMATCH/
    );
  }
);


test(
  "public reactivation writer is exposed for production",
  () => {
    const modulePath =
      require.resolve(
        "./contribution-ledger-reversal-writer.cjs"
      );

    delete require.cache[modulePath];

    const productionModule =
      require(
        "./contribution-ledger-reversal-writer.cjs"
      );

    assert.equal(
      typeof productionModule
        .reactivateContributionLedgerEntry,
      "function"
    );
  }
);


test(
  "public reactivation boundary forwards the canonical candidate",
  () => {
    const fsLocal =
      require("node:fs");

    const writerSource =
      fsLocal.readFileSync(
        "contribution-ledger-reversal-writer.cjs",
        "utf8"
      );

    const start =
      writerSource.indexOf(
        "async function reactivateContributionLedgerEntry({"
      );

    const end =
      writerSource.indexOf(
        "module.exports = {",
        start
      );

    assert.notEqual(
      start,
      -1,
      "public reactivation wrapper must exist"
    );

    assert.notEqual(
      end,
      -1,
      "module export boundary must follow wrapper"
    );

    const boundary =
      writerSource.slice(
        start,
        end
      );

    assert.match(
      boundary,
      /candidate/
    );

    assert.match(
      boundary,
      /reactivateContributionLedgerEntryCore/
    );

    assert.match(
      boundary,
      /resolveCanonicalPersonForAccount/
    );

    assert.match(
      boundary,
      /FieldValue[\s\S]*serverTimestamp/
    );
  }
);
