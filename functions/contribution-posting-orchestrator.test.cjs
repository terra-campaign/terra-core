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
  "current production posting policies are active server-side",
  () => {
    const readiness =
      inspectPostingReadiness({
        activationPolicy:
          CANDIDATE_ACTIVATION_POLICY,

        writerPolicy:
          LEDGER_WRITER_POLICY,
      });

    assert.equal(
      readiness.candidateActivationReady,
      true
    );

    assert.equal(
      readiness.ledgerWriterReady,
      true
    );

    assert.equal(
      readiness.policiesReady,
      true
    );

    assert.equal(
      readiness.activationPolicyStatus,
      "ACTIVE"
    );

    assert.equal(
      readiness.writerPolicyStatus,
      "ACTIVE"
    );
  }
);

test(
  "production orchestrator reaches official writer when policies are active",
  async () => {
    await assert.rejects(
      () =>
        orchestrateContributionPosting({
          db:
            null,

          actorUid:
            "ACTOR-UID-001",

          candidate:
            candidate(),
        }),

      /INVALID_LEDGER_WRITER_DATABASE/
    );
  }
);

test(
  "active production path does not manufacture a blocked non-persistence result",
  async () => {
    await assert.rejects(
      () =>
        orchestrateContributionPosting({
          db:
            null,

          actorUid:
            "ACTOR-UID-001",

          candidate:
            candidate(),
        }),

      /INVALID_LEDGER_WRITER_DATABASE/
    );
  }
);

test(
  "production caller cannot inject policies or alternate writer",
  async () => {
    let alternateWriterCalled =
      false;

    await assert.rejects(
      () =>
        orchestrateContributionPosting({
          db:
            null,

          actorUid:
            "ACTOR-UID-001",

          candidate:
            candidate(),

          activationPolicy:
            {
              status:
                "INJECTED_POLICY",
            },

          writerPolicy:
            {
              status:
                "INJECTED_POLICY",
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
        }),

      /INVALID_LEDGER_WRITER_DATABASE/
    );

    assert.equal(
      alternateWriterCalled,
      false
    );

    const readiness =
      inspectPostingReadiness({
        activationPolicy:
          CANDIDATE_ACTIVATION_POLICY,

        writerPolicy:
          LEDGER_WRITER_POLICY,
      });

    assert.equal(
      readiness.policiesReady,
      true
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