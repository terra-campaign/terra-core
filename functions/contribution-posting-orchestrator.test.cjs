"use strict";

process.env.NODE_ENV =
  "test";

const assert =
  require("node:assert/strict");

const {
  test,
} =
  require("node:test");

const {
  CANDIDATE_ACTIVATION_POLICY,
} =
  require(
    "./contribution-candidate-posting-activation.cjs"
  );

const {
  LEDGER_WRITER_POLICY,
} =
  require(
    "./contribution-ledger-writer-policy.cjs"
  );

const {
  ORCHESTRATOR_VERSION,
  ORCHESTRATION_STATUSES,
  inspectPostingReadiness,
  orchestrateContributionPosting,
  _test,
} =
  require(
    "./contribution-posting-orchestrator.cjs"
  );


function candidate() {
  return Object.freeze({
    candidateId:
      "candidate-test-001",

    campaignId:
      "CAM-001",

    personId:
      "PERSON-001",

    candidateStatus:
      "ELIGIBLE_DRAFT",

    runtimePostingEnabled:
      false,
  });
}


function activeRuntime(
  postLedger
) {
  return Object.freeze({
    activationPolicy:
      Object.freeze({
        status:
          "ACTIVE",

        runtimeCandidateActivationEnabled:
          true,

        clientActivationAllowed:
          false,

        candidatePersistenceAllowed:
          false,

        activationScope:
          "SERVER_MEMORY_ONLY",
      }),

    writerPolicy:
      Object.freeze({
        status:
          "ACTIVE",

        runtimePostingEnabled:
          true,

        runtimeScoringEnabled:
          true,

        contributionCandidatePersistenceEnabled:
          false,

        performanceSummaryWriteEnabled:
          false,

        clientWriteAllowed:
          false,

        authenticatedActorRequired:
          true,

        canonicalActorRequired:
          true,
      }),

    postLedger,
  });
}


test(
  "current production posting policies remain inactive",
  () => {
    const readiness =
      inspectPostingReadiness({
        activationPolicy:
          CANDIDATE_ACTIVATION_POLICY,

        writerPolicy:
          LEDGER_WRITER_POLICY,
      });

    assert.equal(
      readiness
        .candidateActivationReady,
      false
    );

    assert.equal(
      readiness
        .ledgerWriterReady,
      false
    );

    assert.equal(
      readiness.policiesReady,
      false
    );

    assert.equal(
      readiness
        .activationPolicyStatus,
      "DEFINED_NOT_ACTIVATED"
    );

    assert.equal(
      readiness
        .writerPolicyStatus,
      "DEFINED_NOT_ACTIVATED"
    );
  }
);


test(
  "production orchestrator blocks before touching database",
  async () => {
    const db =
      new Proxy(
        {},
        {
          get() {
            throw new Error(
              "DATABASE_MUST_NOT_BE_TOUCHED"
            );
          },
        }
      );

    const result =
      await orchestrateContributionPosting({
        db,
        actorUid:
          "ACTOR-UID-001",
        candidate:
          candidate(),
      });

    assert.equal(
      result.status,
      ORCHESTRATION_STATUSES
        .BLOCKED_NOT_ACTIVATED
    );

    assert.equal(
      result.reasonCode,
      "CONTRIBUTION_POSTING_NOT_ACTIVATED"
    );

    assert.equal(
      result.postingAttempted,
      false
    );

    assert.equal(
      result.ledgerWritten,
      false
    );

    assert.equal(
      result.pointsPosted,
      false
    );

    assert.equal(
      result.runtimeScoringActivated,
      false
    );
  }
);


test(
  "blocked result preserves non-persistence guarantees",
  async () => {
    const result =
      await orchestrateContributionPosting({
        db:
          null,

        actorUid:
          "ACTOR-UID-001",

        candidate:
          candidate(),
      });

    assert.equal(
      result.orchestratorVersion,
      ORCHESTRATOR_VERSION
    );

    assert.equal(
      result.candidateId,
      "candidate-test-001"
    );

    assert.equal(
      result.campaignId,
      "CAM-001"
    );

    assert.equal(
      result.personId,
      "PERSON-001"
    );

    assert.equal(
      result
        .contributionCandidatePersisted,
      false
    );

    assert.equal(
      result
        .performanceSummaryWritten,
      false
    );
  }
);


test(
  "production caller cannot inject active policies or alternate writer",
  async () => {
    let alternateWriterCalled =
      false;

    const result =
      await orchestrateContributionPosting({
        db:
          null,

        actorUid:
          "ACTOR-UID-001",

        candidate:
          candidate(),

        activationPolicy:
          {
            status:
              "ACTIVE",

            runtimeCandidateActivationEnabled:
              true,
          },

        writerPolicy:
          {
            status:
              "ACTIVE",

            runtimePostingEnabled:
              true,

            runtimeScoringEnabled:
              true,
          },

        postLedger:
          async () => {
            alternateWriterCalled =
              true;

            return {
              ok:
                true,
            };
          },
      });

    assert.equal(
      alternateWriterCalled,
      false
    );

    assert.equal(
      result.status,
      ORCHESTRATION_STATUSES
        .BLOCKED_NOT_ACTIVATED
    );
  }
);


test(
  "actor uid is mandatory even while posting is inactive",
  async () => {
    await assert.rejects(
      () =>
        orchestrateContributionPosting({
          db:
            null,

          actorUid:
            "   ",

          candidate:
            candidate(),
        }),
      /ACTOR_UID_REQUIRED/
    );
  }
);


test(
  "candidate object is mandatory even while posting is inactive",
  async () => {
    await assert.rejects(
      () =>
        orchestrateContributionPosting({
          db:
            null,

          actorUid:
            "ACTOR-UID-001",

          candidate:
            null,
        }),
      /CONTRIBUTION_CANDIDATE_REQUIRED/
    );
  }
);


test(
  "test-only active core delegates exactly once to ledger writer",
  async () => {
    let calls =
      0;

    const fakeDb =
      {
        marker:
          "DB",
      };

    const fakeCandidate =
      candidate();

    const result =
      await _test
        .orchestrateContributionPostingCore({
          db:
            fakeDb,

          actorUid:
            "ACTOR-UID-001",

          candidate:
            fakeCandidate,

          runtime:
            activeRuntime(
              async ({
                db,
                actorUid,
                candidate,
              }) => {
                calls +=
                  1;

                assert.equal(
                  db,
                  fakeDb
                );

                assert.equal(
                  actorUid,
                  "ACTOR-UID-001"
                );

                assert.equal(
                  candidate,
                  fakeCandidate
                );

                return {
                  ok:
                    true,

                  alreadyPosted:
                    false,

                  ledgerId:
                    "LEDGER-001",

                  campaignId:
                    "CAM-001",

                  personId:
                    "PERSON-001",

                  points:
                    30,

                  postedByPersonId:
                    "ACTOR-PERSON-001",
                };
              }
            ),
        });

    assert.equal(
      calls,
      1
    );

    assert.equal(
      result.status,
      ORCHESTRATION_STATUSES.POSTED
    );

    assert.equal(
      result.postingAttempted,
      true
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
      result.runtimeScoringActivated,
      true
    );

    assert.equal(
      result.ledgerId,
      "LEDGER-001"
    );
  }
);


test(
  "test-only active core does not hide ledger writer failures",
  async () => {
    await assert.rejects(
      () =>
        _test
          .orchestrateContributionPostingCore({
            db:
              {},

            actorUid:
              "ACTOR-UID-001",

            candidate:
              candidate(),

            runtime:
              activeRuntime(
                async () => {
                  throw new Error(
                    "SIMULATED_LEDGER_FAILURE"
                  );
                }
              ),
          }),
      /SIMULATED_LEDGER_FAILURE/
    );
  }
);