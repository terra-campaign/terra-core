"use strict";

const test =
  require("node:test");

const assert =
  require("node:assert/strict");

test(
  "recovery processor exposes only the server processing boundary",
  () => {
    const processor =
      require(
        "./contribution-reconciliation-recovery-processor.cjs"
      );

    assert.equal(
      typeof processor
        .processMissionContributionRecovery,
      "function"
    );

    assert.equal(
      typeof processor._test
        ?.processMissionContributionRecoveryCore,
      "function"
    );

    assert.equal(
      typeof processor._test
        ?.productionRuntime,
      "object"
    );

    assert.equal(
      typeof processor._test
        ?.productionRuntime
        ?.loadSubjectProfile,
      "function"
    );

    assert.equal(
      typeof processor._test
        ?.productionRuntime
        ?.deriveContribution,
      "function"
    );

    assert.equal(
      typeof processor._test
        ?.productionRuntime
        ?.reconcileLifecycle,
      "function"
    );

    assert.equal(
      typeof processor._test
        ?.productionRuntime
        ?.markRetryRequired,
      "function"
    );

    assert.equal(
      typeof processor._test
        ?.productionRuntime
        ?.markReconciled,
      "function"
    );

    assert.equal(
      typeof processor._test
        ?.productionRuntime
        ?.now,
      "function"
    );
  }
);

test(
  "pending recovery loads the current subject profile before contribution derivation",
  async () => {
    const {
      _test,
    } =
      require(
        "./contribution-reconciliation-recovery-processor.cjs"
      );

    const record = {
      schemaVersion:
        "1.0.0-foundation",

      operationId:
        "mission-review:E-1:revision:1",

      status:
        "PENDING",

      campaignId:
        "CAM-001",

      evidenceId:
        "E-1",

      missionId:
        "M-1",

      reviewId:
        "E-1",

      revision:
        1,

      actorUid:
        "reviewer-1",

      subjectAccountUid:
        "subject-1",

      missionFact: {
        id:
          "M-1",

        missionId:
          "M-1",

        campaignId:
          "CAM-001",

        assignedTo:
          "subject-1",
      },

      evidenceFact: {
        id:
          "E-1",

        evidenceId:
          "E-1",

        campaignId:
          "CAM-001",

        missionId:
          "M-1",

        uploadedBy:
          "subject-1",
      },

      previousReviewFact:
        null,

      currentReviewFact: {
        campaignId:
          "CAM-001",

        evidenceId:
          "E-1",

        missionId:
          "M-1",

        subjectId:
          "subject-1",

        status:
          "validated",

        pendingAppeal:
          false,
      },

      attemptCount:
        0,

      lastError:
        null,

      createdAt:
        1,

      updatedAt:
        1,

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
    };

    const calls = [];

    await assert.rejects(
      () =>
        _test
          .processMissionContributionRecoveryCore({
            db: {
              marker:
                "fake-db",
            },

            record,

            runtime: {
              async loadSubjectProfile({
                db,
                accountUid,
              }) {
                calls.push({
                  step:
                    "loadSubjectProfile",

                  db,
                  accountUid,
                });

                throw new Error(
                  "STOP_AFTER_PROFILE_LOAD"
                );
              },

              async deriveContribution() {
                calls.push({
                  step:
                    "deriveContribution",
                });

                throw new Error(
                  "DERIVATION_MUST_NOT_RUN"
                );
              },

              async reconcileLifecycle() {
                calls.push({
                  step:
                    "reconcileLifecycle",
                });

                throw new Error(
                  "LIFECYCLE_MUST_NOT_RUN"
                );
              },

              async persistTransition() {
                calls.push({
                  step:
                    "persistTransition",
                });

                throw new Error(
                  "PERSIST_MUST_NOT_RUN"
                );
              },

              now() {
                return 2;
              },
            },
          }),

      /STOP_AFTER_PROFILE_LOAD/
    );

    assert.equal(
      calls.length,
      1
    );

    assert.equal(
      calls[0].step,
      "loadSubjectProfile"
    );

    assert.equal(
      calls[0].accountUid,
      "subject-1"
    );

    assert.equal(
      calls[0].db.marker,
      "fake-db"
    );
  }
);
test(
  "pending recovery derives previous and current contribution from durable source facts",
  async () => {
    const {
      _test,
    } =
      require(
        "./contribution-reconciliation-recovery-processor.cjs"
      );

    const record = {
      schemaVersion:
        "1.0.0-foundation",

      operationId:
        "mission-review:E-2:revision:2",

      status:
        "PENDING",

      campaignId:
        "CAM-001",

      evidenceId:
        "E-2",

      missionId:
        "M-2",

      reviewId:
        "E-2",

      revision:
        2,

      actorUid:
        "reviewer-1",

      subjectAccountUid:
        "subject-1",

      missionFact: {
        id:
          "M-2",

        missionId:
          "M-2",

        campaignId:
          "CAM-001",

        assignedTo:
          "subject-1",
      },

      evidenceFact: {
        id:
          "E-2",

        evidenceId:
          "E-2",

        campaignId:
          "CAM-001",

        missionId:
          "M-2",

        uploadedBy:
          "subject-1",
      },

      previousReviewFact: {
        campaignId:
          "CAM-001",

        evidenceId:
          "E-2",

        missionId:
          "M-2",

        subjectId:
          "subject-1",

        status:
          "pending",

        pendingAppeal:
          false,
      },

      currentReviewFact: {
        campaignId:
          "CAM-001",

        evidenceId:
          "E-2",

        missionId:
          "M-2",

        subjectId:
          "subject-1",

        status:
          "validated",

        pendingAppeal:
          false,
      },

      attemptCount:
        0,

      lastError:
        null,

      createdAt:
        1,

      updatedAt:
        1,

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
    };

    const subjectProfile = {
      uid:
        "subject-1",

      active:
        true,

      campaignId:
        "CAM-001",

      personId:
        "PERSON-1",
    };

    const derivations = [];

    await assert.rejects(
      () =>
        _test
          .processMissionContributionRecoveryCore({
            db: {
              marker:
                "fake-db",
            },

            record,

            runtime: {
              async loadSubjectProfile() {
                return subjectProfile;
              },

              async deriveContribution(args) {
                derivations.push(args);

                if (
                  derivations.length === 1
                ) {
                  return {
                    status:
                      "NOT_ELIGIBLE",

                    stage:
                      "ELIGIBILITY",

                    reasonCode:
                      "MISSION_NOT_VALIDATED",

                    candidate:
                      null,
                  };
                }

                throw new Error(
                  "STOP_AFTER_CURRENT_DERIVATION"
                );
              },

              async reconcileLifecycle() {
                throw new Error(
                  "LIFECYCLE_MUST_NOT_RUN"
                );
              },

              async markRetryRequired(args) {
                retryRequiredCalls += 1;
                retryRequiredArgs = args;

                return {
                  ...record,

                  status:
                    "RETRY_REQUIRED",

                  attemptCount:
                    1,

                  lastError:
                    "RECOVERY_BRIDGE_ERROR:IDENTITY_RESOLUTION_FAILED",

                  updatedAt:
                    2,
                };
              },

              now() {
                return 2;
              },
            },
          }),

      /STOP_AFTER_CURRENT_DERIVATION/
    );

    assert.equal(
      derivations.length,
      2
    );

    const previous =
      derivations[0];

    const current =
      derivations[1];

    assert.equal(
      previous.db.marker,
      "fake-db"
    );

    assert.equal(
      previous.mission,
      record.missionFact
    );

    assert.equal(
      previous.evidence,
      record.evidenceFact
    );

    assert.equal(
      previous.review,
      record.previousReviewFact
    );

    assert.equal(
      previous.reviewId,
      "E-2"
    );

    assert.equal(
      previous.subjectProfile,
      subjectProfile
    );

    assert.equal(
      current.mission,
      record.missionFact
    );

    assert.equal(
      current.evidence,
      record.evidenceFact
    );

    assert.equal(
      current.review,
      record.currentReviewFact
    );

    assert.equal(
      current.reviewId,
      "E-2"
    );

    assert.equal(
      current.subjectProfile,
      subjectProfile
    );
  }
);
test(
  "first mission review treats absent previous review as historical NOT_ELIGIBLE without calling the bridge for it",
  async () => {
    const {
      _test,
    } =
      require(
        "./contribution-reconciliation-recovery-processor.cjs"
      );

    const record = {
      schemaVersion:
        "1.0.0-foundation",

      operationId:
        "mission-review:E-FIRST:revision:1",

      status:
        "PENDING",

      campaignId:
        "CAM-001",

      evidenceId:
        "E-FIRST",

      missionId:
        "M-FIRST",

      reviewId:
        "E-FIRST",

      revision:
        1,

      actorUid:
        "reviewer-1",

      subjectAccountUid:
        "subject-1",

      missionFact: {
        id:
          "M-FIRST",

        missionId:
          "M-FIRST",

        campaignId:
          "CAM-001",

        assignedTo:
          "subject-1",
      },

      evidenceFact: {
        id:
          "E-FIRST",

        evidenceId:
          "E-FIRST",

        campaignId:
          "CAM-001",

        missionId:
          "M-FIRST",

        uploadedBy:
          "subject-1",
      },

      previousReviewFact:
        null,

      currentReviewFact: {
        campaignId:
          "CAM-001",

        evidenceId:
          "E-FIRST",

        missionId:
          "M-FIRST",

        subjectId:
          "subject-1",

        status:
          "validated",

        pendingAppeal:
          false,
      },

      attemptCount:
        0,

      lastError:
        null,

      createdAt:
        1,

      updatedAt:
        1,

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
    };

    const bridgeCalls = [];

    await assert.rejects(
      () =>
        _test
          .processMissionContributionRecoveryCore({
            db: {
              marker:
                "fake-db",
            },

            record,

            runtime: {
              async loadSubjectProfile() {
                return {
                  uid:
                    "subject-1",

                  active:
                    true,

                  campaignId:
                    "CAM-001",

                  personId:
                    "PERSON-1",
                };
              },

              async deriveContribution(args) {
                bridgeCalls.push(args);

                assert.equal(
                  args.review,
                  record.currentReviewFact
                );

                throw new Error(
                  "STOP_AFTER_CURRENT_ONLY"
                );
              },

              async reconcileLifecycle() {
                throw new Error(
                  "LIFECYCLE_MUST_NOT_RUN"
                );
              },

              async markRetryRequired(args) {
                retryRequiredCalls += 1;
                retryRequiredArgs = args;

                return {
                  ...record,

                  status:
                    "RETRY_REQUIRED",

                  attemptCount:
                    1,

                  lastError:
                    "RECOVERY_BRIDGE_ERROR:IDENTITY_RESOLUTION_FAILED",

                  updatedAt:
                    2,
                };
              },

              now() {
                return 2;
              },
            },
          }),

      /STOP_AFTER_CURRENT_ONLY/
    );

    assert.equal(
      bridgeCalls.length,
      1
    );

    assert.equal(
      bridgeCalls[0].review,
      record.currentReviewFact
    );
  }
);
test(
  "bridge ERROR stops recovery before lifecycle reconciliation",
  async () => {
    const {
      _test,
    } =
      require(
        "./contribution-reconciliation-recovery-processor.cjs"
      );

    const record = {
      schemaVersion:
        "1.0.0-foundation",

      operationId:
        "mission-review:E-ERROR:revision:1",

      status:
        "PENDING",

      campaignId:
        "CAM-001",

      evidenceId:
        "E-ERROR",

      missionId:
        "M-ERROR",

      reviewId:
        "E-ERROR",

      revision:
        1,

      actorUid:
        "reviewer-1",

      subjectAccountUid:
        "subject-1",

      missionFact: {
        id:
          "M-ERROR",

        missionId:
          "M-ERROR",

        campaignId:
          "CAM-001",

        assignedTo:
          "subject-1",
      },

      evidenceFact: {
        id:
          "E-ERROR",

        evidenceId:
          "E-ERROR",

        campaignId:
          "CAM-001",

        missionId:
          "M-ERROR",

        uploadedBy:
          "subject-1",
      },

      previousReviewFact:
        null,

      currentReviewFact: {
        campaignId:
          "CAM-001",

        evidenceId:
          "E-ERROR",

        missionId:
          "M-ERROR",

        subjectId:
          "subject-1",

        status:
          "validated",

        pendingAppeal:
          false,
      },

      attemptCount:
        0,

      lastError:
        null,

      createdAt:
        1,

      updatedAt:
        1,

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
    };

    let lifecycleCalls = 0;
    let retryRequiredCalls = 0;
    let retryRequiredArgs = null;

    await assert.rejects(
      () =>
        _test
          .processMissionContributionRecoveryCore({
            db: {
              marker:
                "fake-db",
            },

            record,

            runtime: {
              async loadSubjectProfile() {
                return {
                  uid:
                    "subject-1",

                  active:
                    true,

                  campaignId:
                    "CAM-001",

                  personId:
                    "PERSON-1",
                };
              },

              async deriveContribution() {
                return {
                  status:
                    "ERROR",

                  stage:
                    "IDENTITY",

                  reasonCode:
                    "IDENTITY_RESOLUTION_FAILED",

                  candidate:
                    null,
                };
              },

              async reconcileLifecycle() {
                lifecycleCalls += 1;

                throw new Error(
                  "LIFECYCLE_MUST_NOT_RUN"
                );
              },

              async markRetryRequired(args) {
                retryRequiredCalls += 1;
                retryRequiredArgs = args;

                return {
                  ...record,

                  status:
                    "RETRY_REQUIRED",

                  attemptCount:
                    1,

                  lastError:
                    "RECOVERY_BRIDGE_ERROR:IDENTITY_RESOLUTION_FAILED",

                  updatedAt:
                    2,
                };
              },

              now() {
                return 2;
              },
            },
          }),

      /RECOVERY_BRIDGE_ERROR:IDENTITY_RESOLUTION_FAILED/
    );

    assert.equal(
      lifecycleCalls,
      0
    );

    assert.equal(
      retryRequiredCalls,
      1
    );

    assert.ok(
      retryRequiredArgs
    );

    assert.equal(
      retryRequiredArgs.operationId,
      record.operationId
    );

    assert.equal(
      retryRequiredArgs.errorCode,
      "RECOVERY_BRIDGE_ERROR:IDENTITY_RESOLUTION_FAILED"
    );

    assert.equal(
      retryRequiredArgs.updatedAt,
      2
    );
  }
);
test(
  "recovery processor refuses an already reconciled record",
  async () => {
    const {
      _test,
    } =
      require(
        "./contribution-reconciliation-recovery-processor.cjs"
      );

    const record = {
      schemaVersion:
        "1.0.0-foundation",

      operationId:
        "mission-review:E-1:revision:1",

      status:
        "RECONCILED",

      campaignId:
        "CAM-001",

      evidenceId:
        "E-1",

      missionId:
        "M-1",

      reviewId:
        "E-1",

      revision:
        1,

      actorUid:
        "reviewer-1",

      subjectAccountUid:
        "subject-1",

      missionFact: {
        id:
          "M-1",

        missionId:
          "M-1",

        campaignId:
          "CAM-001",

        assignedTo:
          "subject-1",
      },

      evidenceFact: {
        id:
          "E-1",

        evidenceId:
          "E-1",

        campaignId:
          "CAM-001",

        missionId:
          "M-1",

        uploadedBy:
          "subject-1",
      },

      previousReviewFact:
        null,

      currentReviewFact: {
        campaignId:
          "CAM-001",

        evidenceId:
          "E-1",

        missionId:
          "M-1",

        subjectId:
          "subject-1",

        status:
          "validated",

        pendingAppeal:
          false,
      },

      attemptCount:
        1,

      lastError:
        null,

      createdAt:
        1,

      updatedAt:
        2,

      reconciledAt:
        2,

      serverSideOnly:
        true,

      ledgerWritten:
        false,

      pointsPosted:
        false,

      performanceSummaryWritten:
        false,
    };

    let runtimeTouched =
      false;

    await assert.rejects(
      () =>
        _test
          .processMissionContributionRecoveryCore({
            db: {},
            record,

            runtime: {
              async loadSubjectProfile() {
                runtimeTouched =
                  true;

                return {};
              },

              async deriveContribution() {
                runtimeTouched =
                  true;

                return {};
              },

              async reconcileLifecycle() {
                runtimeTouched =
                  true;

                return {};
              },

              async persistTransition() {
                runtimeTouched =
                  true;

                return {};
              },

              now() {
                return 3;
              },
            },
          }),

      /RECOVERY_ALREADY_RECONCILED/
    );

    assert.equal(
      runtimeTouched,
      false
    );
  }
);
test(
  "successful recovery reconciliation executes lifecycle and persists RECONCILED",
  async () => {
    const {
      _test,
    } = require(
      "./contribution-reconciliation-recovery-processor.cjs"
    );

    const {
      processMissionContributionRecoveryCore,
    } = _test;

    const record = {
      schemaVersion:
        "1.0.0-foundation",

      operationId:
        "mission-review:E-SUCCESS:revision:1",

      status:
        "PENDING",

      campaignId:
        "CAM-001",

      evidenceId:
        "E-SUCCESS",

      missionId:
        "M-SUCCESS",

      reviewId:
        "E-SUCCESS",

      revision:
        1,

      actorUid:
        "reviewer-1",

      subjectAccountUid:
        "subject-1",

      missionFact: {
        id:
          "M-SUCCESS",

        missionId:
          "M-SUCCESS",

        campaignId:
          "CAM-001",

        assignedTo:
          "subject-1",
      },

      evidenceFact: {
        id:
          "E-SUCCESS",

        evidenceId:
          "E-SUCCESS",

        campaignId:
          "CAM-001",

        missionId:
          "M-SUCCESS",

        uploadedBy:
          "subject-1",
      },

      previousReviewFact:
        null,

      currentReviewFact: {
        campaignId:
          "CAM-001",

        evidenceId:
          "E-SUCCESS",

        missionId:
          "M-SUCCESS",

        subjectId:
          "subject-1",

        status:
          "validated",

        pendingAppeal:
          false,
      },

      attemptCount:
        0,

      lastError:
        null,

      createdAt:
        1,

      updatedAt:
        1,

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
    };

    const subjectProfile = {
      uid:
        record.subjectAccountUid,

      active:
        true,

      campaignId:
        record.campaignId,
    };

    const currentResult =
      Object.freeze({
        status:
          "DERIVED",

        candidate:
          Object.freeze({
            candidateId:
              "candidate-1",
          }),

        ledgerDraft:
          Object.freeze({
            ledgerId:
              "ledger-1",
          }),

        ledgerId:
          "ledger-1",
      });

    const calls = {
      profile:
        0,

      derivation:
        0,

      lifecycle:
        0,

      reconciled:
        0,

      markReconciledArgs:
        null,
    };

    const runtime = {
      async loadSubjectProfile({
        db,
        accountUid,
      }) {
        assert.ok(db);

        assert.equal(
          accountUid,
          record.subjectAccountUid
        );

        calls.profile += 1;

        return subjectProfile;
      },

      async deriveContribution({
        db,
        mission,
        evidence,
        review,
        reviewId,
        subjectProfile:
          receivedProfile,
      }) {
        assert.ok(db);

        assert.equal(
          mission,
          record.missionFact
        );

        assert.equal(
          evidence,
          record.evidenceFact
        );

        assert.equal(
          review,
          record.currentReviewFact
        );

        assert.equal(
          reviewId,
          record.reviewId
        );

        assert.equal(
          receivedProfile,
          subjectProfile
        );

        calls.derivation += 1;

        return currentResult;
      },

      async reconcileLifecycle() {
        calls.lifecycle += 1;

        return Object.freeze({
          action:
            "POST",

          ledgerId:
            "LEDGER-E2E-001",

          result:
            Object.freeze({
              ledgerWritten:
                true,

              pointsPosted:
                true,

              performanceSummaryWritten:
                false,
            }),
        });
      },

      async markReconciled(args) {
        calls.reconciled += 1;

        calls.markReconciledArgs =
          args;

        return Object.freeze({
          ...record,

          status:
            "RECONCILED",

          attemptCount:
            1,

          lastError:
            null,

          updatedAt:
            2,

          reconciledAt:
            2,
        });
      },

      now() {
        return 2;
      },
    };

    const result =
      await processMissionContributionRecoveryCore({
        db: {
          marker:
            "fake-db",
        },

        record,

        runtime,
      });

    assert.equal(
      calls.profile,
      1
    );

    assert.equal(
      calls.derivation,
      1
    );

    assert.equal(
      calls.lifecycle,
      1
    );

    assert.equal(
      calls.reconciled,
      1
    );

    assert.equal(
      calls.markReconciledArgs.observability.ledgerWritten,
      true
    );

    assert.equal(
      calls.markReconciledArgs.observability.pointsPosted,
      true
    );

    assert.equal(
      calls.markReconciledArgs.observability.performanceSummaryWritten,
      false
    );

    assert.equal(
      Object.prototype.hasOwnProperty.call(
        calls.markReconciledArgs,
        "lifecycleResult"
      ),
      false
    );

    assert.equal(
      result.status,
      "RECONCILED"
    );

    assert.equal(
      result.attemptCount,
      1
    );

    assert.equal(
      result.lastError,
      null
    );

    assert.equal(
      result.reconciledAt,
      2
    );
  }
);

test(
  "lifecycle failure persists RETRY_REQUIRED and does not mark recovery RECONCILED",
  async () => {
    const {
      _test,
    } = require(
      "./contribution-reconciliation-recovery-processor.cjs"
    );

    const {
      processMissionContributionRecoveryCore,
    } = _test;

    const record = {
      schemaVersion:
        "1.0.0-foundation",

      operationId:
        "mission-review:E-LIFECYCLE-ERROR:revision:1",

      status:
        "PENDING",

      campaignId:
        "CAM-001",

      evidenceId:
        "E-LIFECYCLE-ERROR",

      missionId:
        "M-LIFECYCLE-ERROR",

      reviewId:
        "E-LIFECYCLE-ERROR",

      revision:
        1,

      actorUid:
        "reviewer-1",

      subjectAccountUid:
        "subject-1",

      missionFact: {
        id:
          "M-LIFECYCLE-ERROR",

        missionId:
          "M-LIFECYCLE-ERROR",

        campaignId:
          "CAM-001",

        assignedTo:
          "subject-1",
      },

      evidenceFact: {
        id:
          "E-LIFECYCLE-ERROR",

        evidenceId:
          "E-LIFECYCLE-ERROR",

        campaignId:
          "CAM-001",

        missionId:
          "M-LIFECYCLE-ERROR",

        uploadedBy:
          "subject-1",
      },

      previousReviewFact:
        null,

      currentReviewFact: {
        campaignId:
          "CAM-001",

        evidenceId:
          "E-LIFECYCLE-ERROR",

        missionId:
          "M-LIFECYCLE-ERROR",

        subjectId:
          "subject-1",

        status:
          "validated",

        pendingAppeal:
          false,
      },

      attemptCount:
        0,

      lastError:
        null,

      createdAt:
        1,

      updatedAt:
        1,

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
    };

    const currentResult =
      Object.freeze({
        status:
          "DERIVED",

        candidate:
          Object.freeze({
            candidateId:
              "candidate-lifecycle-error",
          }),

        ledgerDraft:
          Object.freeze({
            ledgerId:
              "ledger-lifecycle-error",
          }),

        ledgerId:
          "ledger-lifecycle-error",
      });

    let lifecycleCalls = 0;
    let retryRequiredCalls = 0;
    let reconciledCalls = 0;
    let retryRequiredArgs = null;

    const runtime = {
      async loadSubjectProfile() {
        return {
          uid:
            record.subjectAccountUid,

          active:
            true,

          campaignId:
            record.campaignId,
        };
      },

      async deriveContribution() {
        return currentResult;
      },

      async reconcileLifecycle() {
        lifecycleCalls += 1;

        throw new Error(
          "SIMULATED_LIFECYCLE_FAILURE"
        );
      },

      async markRetryRequired(args) {
        retryRequiredCalls += 1;
        retryRequiredArgs = args;

        return {
          ...record,

          status:
            "RETRY_REQUIRED",

          attemptCount:
            1,

          lastError:
            "RECOVERY_LIFECYCLE_ERROR:LIFECYCLE_EXECUTION_FAILED",

          updatedAt:
            2,
        };
      },

      async markReconciled() {
        reconciledCalls += 1;

        throw new Error(
          "RECONCILED_MUST_NOT_RUN"
        );
      },

      now() {
        return 2;
      },
    };

    await assert.rejects(
      () =>
        processMissionContributionRecoveryCore({
          db: {
            marker:
              "fake-db",
          },

          record,

          runtime,
        }),

      /SIMULATED_LIFECYCLE_FAILURE/
    );

    assert.equal(
      lifecycleCalls,
      1
    );

    assert.equal(
      retryRequiredCalls,
      1
    );

    assert.equal(
      reconciledCalls,
      0
    );

    assert.ok(
      retryRequiredArgs
    );

    assert.equal(
      retryRequiredArgs.operationId,
      record.operationId
    );

    assert.equal(
      retryRequiredArgs.errorCode,
      "RECOVERY_LIFECYCLE_ERROR:LIFECYCLE_EXECUTION_FAILED"
    );

    assert.equal(
      retryRequiredArgs.updatedAt,
      2
    );
  }
);