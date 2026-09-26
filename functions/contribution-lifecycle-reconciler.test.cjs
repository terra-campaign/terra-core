"use strict";

const test =
  require("node:test");

const assert =
  require("node:assert/strict");

test(
  "lifecycle reconciler module exists and exposes transition planner",
  () => {
    const lifecycle =
      require(
        "./contribution-lifecycle-reconciler.cjs"
      );

    assert.equal(
      typeof lifecycle.planContributionLifecycleTransition,
      "function"
    );
  }
);

test(
  "not eligible to eligible requires contribution activation",
  () => {
    const {
      planContributionLifecycleTransition,
    } =
      require(
        "./contribution-lifecycle-reconciler.cjs"
      );

    const result =
      planContributionLifecycleTransition({
        previousContributionResult:{
          status:"NOT_ELIGIBLE"
        },
        currentContributionResult:{
          status:"DERIVED",
          candidate:{
            ledgerDraft:{
              ledgerId:"LEDGER-001"
            }
          }
        }
      });

    assert.equal(
      result.action,
      "ACTIVATE"
    );

    assert.equal(
      result.ledgerId,
      "LEDGER-001"
    );
  }
);

test(
  "eligible to not eligible requires reversal of previous canonical ledger",
  () => {
    const {
      planContributionLifecycleTransition,
    } =
      require(
        "./contribution-lifecycle-reconciler.cjs"
      );

    const result =
      planContributionLifecycleTransition({
        previousContributionResult:{
          status:"DERIVED",
          candidate:{
            ledgerDraft:{
              ledgerId:"LEDGER-001"
            }
          }
        },
        currentContributionResult:{
          status:"NOT_ELIGIBLE"
        }
      });

    assert.equal(
      result.action,
      "REVERSE"
    );

    assert.equal(
      result.ledgerId,
      "LEDGER-001"
    );
  }
);

test(
  "eligible to eligible is a lifecycle no-op",
  () => {
    const {
      planContributionLifecycleTransition,
    } =
      require(
        "./contribution-lifecycle-reconciler.cjs"
      );

    const result =
      planContributionLifecycleTransition({
        previousContributionResult:{
          status:"DERIVED",
          candidate:{
            ledgerDraft:{
              ledgerId:"LEDGER-001"
            }
          }
        },
        currentContributionResult:{
          status:"DERIVED",
          candidate:{
            ledgerDraft:{
              ledgerId:"LEDGER-001"
            }
          }
        }
      });

    assert.equal(
      result.action,
      "NO_OP"
    );
  }
);

test(
  "not eligible to not eligible is a lifecycle no-op",
  () => {
    const {
      planContributionLifecycleTransition,
    } =
      require(
        "./contribution-lifecycle-reconciler.cjs"
      );

    const result =
      planContributionLifecycleTransition({
        previousContributionResult:{
          status:"NOT_ELIGIBLE"
        },
        currentContributionResult:{
          status:"NOT_ELIGIBLE"
        }
      });

    assert.equal(
      result.action,
      "NO_OP"
    );
  }
);


test(
  "activation resolution distinguishes POST REACTIVATE and ALREADY_ACTIVE",
  () => {
    const {
      resolveContributionActivationAction,
    } =
      require(
        "./contribution-lifecycle-reconciler.cjs"
      );

    assert.equal(
      resolveContributionActivationAction({
        ledgerExists:false,
        ledger:null,
      }).action,
      "POST"
    );

    assert.equal(
      resolveContributionActivationAction({
        ledgerExists:true,
        ledger:{
          ledgerStatus:"REVERSED",
          runtimeScoringEnabled:false,
        },
      }).action,
      "REACTIVATE"
    );

    assert.equal(
      resolveContributionActivationAction({
        ledgerExists:true,
        ledger:{
          ledgerStatus:"POSTED",
          runtimeScoringEnabled:true,
        },
      }).action,
      "ALREADY_ACTIVE"
    );
  }
);

test(
  "activation resolution rejects inconsistent ledger lifecycle states",
  () => {
    const {
      resolveContributionActivationAction,
    } =
      require(
        "./contribution-lifecycle-reconciler.cjs"
      );

    assert.throws(
      () =>
        resolveContributionActivationAction({
          ledgerExists:true,
          ledger:{
            ledgerStatus:"POSTED",
            runtimeScoringEnabled:false,
          },
        }),
      /CONTRIBUTION_LEDGER_LIFECYCLE_STATE_INVALID/
    );

    assert.throws(
      () =>
        resolveContributionActivationAction({
          ledgerExists:true,
          ledger:{
            ledgerStatus:"REVERSED",
            runtimeScoringEnabled:true,
          },
        }),
      /CONTRIBUTION_LEDGER_LIFECYCLE_STATE_INVALID/
    );
  }
);


test(
  "lifecycle executor performs POST for a newly eligible contribution without ledger",
  async () => {
    const {
      _test,
    } =
      require(
        "./contribution-lifecycle-reconciler.cjs"
      );

    let posted = 0;
    let reactivated = 0;
    let reversed = 0;

    const candidate = {
      ledgerDraft:{
        ledgerId:"LEDGER-POST-001"
      }
    };

    const result =
      await _test
        .reconcileContributionLifecycleCore({
          db:{},
          actorUid:"ACTOR-001",
          operationId:"OP-001",

          previousContributionResult:{
            status:"NOT_ELIGIBLE"
          },

          currentContributionResult:{
            status:"DERIVED",
            candidate,
          },

          runtime:{
            readLedger:
              async () => ({
                exists:false,
                ledger:null,
              }),

            postContribution:
              async ({ candidate:received }) => {
                posted++;
                assert.equal(
                  received,
                  candidate
                );

                return {
                  ok:true,
                  ledgerId:
                    "LEDGER-POST-001",
                };
              },

            reactivateContribution:
              async () => {
                reactivated++;
              },

            reverseContribution:
              async () => {
                reversed++;
              },
          },
        });

    assert.equal(posted, 1);
    assert.equal(reactivated, 0);
    assert.equal(reversed, 0);
    assert.equal(result.action, "POST");
  }
);

test(
  "lifecycle executor performs REACTIVATE for a reversed canonical ledger",
  async () => {
    const {
      _test,
    } =
      require(
        "./contribution-lifecycle-reconciler.cjs"
      );

    let posted = 0;
    let reactivated = 0;

    const candidate = {
      ledgerDraft:{
        ledgerId:"LEDGER-REACTIVATE-001"
      }
    };

    const result =
      await _test
        .reconcileContributionLifecycleCore({
          db:{},
          actorUid:"ACTOR-001",
          operationId:"OP-002",

          previousContributionResult:{
            status:"NOT_ELIGIBLE"
          },

          currentContributionResult:{
            status:"DERIVED",
            candidate,
          },

          runtime:{
            readLedger:
              async () => ({
                exists:true,
                ledger:{
                  ledgerStatus:"REVERSED",
                  runtimeScoringEnabled:false,
                },
              }),

            postContribution:
              async () => {
                posted++;
              },

            reactivateContribution:
              async ({
                ledgerId,
                candidate:received,
              }) => {
                reactivated++;

                assert.equal(
                  ledgerId,
                  "LEDGER-REACTIVATE-001"
                );

                assert.equal(
                  received,
                  candidate
                );

                return {
                  ok:true,
                  ledgerId,
                };
              },

            reverseContribution:
              async () => {},
          },
        });

    assert.equal(posted, 0);
    assert.equal(reactivated, 1);
    assert.equal(
      result.action,
      "REACTIVATE"
    );
  }
);

test(
  "lifecycle executor does not repost an already active contribution",
  async () => {
    const {
      _test,
    } =
      require(
        "./contribution-lifecycle-reconciler.cjs"
      );

    let posted = 0;
    let reactivated = 0;

    const ledgerId =
      "LEDGER-ACTIVE-001";

    const candidate = {
      candidateId:"CANDIDATE-ACTIVE-001",
      ledgerDraft:{
        ledgerId,
        schemaVersion:"1.0.0",
        campaignId:"CAM-001",
        personId:"PERSON-001",
        activityCode:"MISSION_VALIDATED",
        points:10,
        scoreDimension:"MISSION",
        sourceType:"MISSION_VALIDATION",
        sourceId:
          "mission:MIS-001:person:PERSON-001",
        scoreSourceType:
          "MISSION_VALIDATION",
        scoreSourceId:
          "mission:MIS-001:person:PERSON-001",
        ruleId:"RULE-MISSION-001",
        scoreRuleVersion:"1.0.0",
        ruleSetVersion:"1.0.0",
        evidenceRef:"EVIDENCE-001",
        ruleSnapshot:{
          points:10
        }
      }
    };

    const activeLedger = {
      ledgerId,
      ledgerStatus:"POSTED",
      runtimeScoringEnabled:true,
      schemaVersion:"1.0.0",
      campaignId:"CAM-001",
      personId:"PERSON-001",
      activityCode:"MISSION_VALIDATED",
      points:10,
      scoreDimension:"MISSION",
      sourceType:"MISSION_VALIDATION",
      sourceId:
        "mission:MIS-001:person:PERSON-001",
      scoreSourceType:
        "MISSION_VALIDATION",
      scoreSourceId:
        "mission:MIS-001:person:PERSON-001",
      ruleId:"RULE-MISSION-001",
      scoreRuleVersion:"1.0.0",
      ruleSetVersion:"1.0.0",
      evidenceRef:"EVIDENCE-001",
      ruleSnapshot:{
        points:10
      },
      candidateId:"CANDIDATE-ACTIVE-001"
    };

    const result =
      await _test
        .reconcileContributionLifecycleCore({
          db:{},
          actorUid:"ACTOR-001",
          operationId:"OP-003",

          previousContributionResult:{
            status:"NOT_ELIGIBLE"
          },

          currentContributionResult:{
            status:"DERIVED",
            candidate,
          },

          runtime:{
            readLedger:
              async () => ({
                exists:true,
                ledger:activeLedger,
              }),

            postContribution:
              async () => {
                posted++;
              },

            reactivateContribution:
              async () => {
                reactivated++;
              },

            reverseContribution:
              async () => {},

            confirmActiveContribution:
              async ({
                ledgerId:
                  receivedLedgerId,
                candidate:
                  receivedCandidate,
              }) => {
                assert.equal(
                  receivedLedgerId,
                  ledgerId
                );

                assert.equal(
                  receivedCandidate,
                  candidate
                );

                return Object.freeze({
                  ok:true,
                  active:true,
                  ledgerId,
                  campaignId:"CAM-001",
                  personId:"PERSON-001",
                });
              },
          },
        });

    assert.equal(posted, 0);
    assert.equal(reactivated, 0);

    assert.equal(
      result.action,
      "ALREADY_ACTIVE"
    );
  }
);

test(
  "lifecycle executor reverses the previous canonical contribution when eligibility is lost",
  async () => {
    const {
      _test,
    } =
      require(
        "./contribution-lifecycle-reconciler.cjs"
      );

    let reversed = 0;

    const result =
      await _test
        .reconcileContributionLifecycleCore({
          db:{},
          actorUid:"ACTOR-001",
          operationId:"OP-004",

          previousContributionResult:{
            status:"DERIVED",
            candidate:{
              ledgerDraft:{
                ledgerId:
                  "LEDGER-REVERSE-001"
              }
            },
          },

          currentContributionResult:{
            status:"NOT_ELIGIBLE"
          },

          runtime:{
            readLedger:
              async () => {
                throw new Error(
                  "READ_NOT_EXPECTED"
                );
              },

            postContribution:
              async () => {
                throw new Error(
                  "POST_NOT_EXPECTED"
                );
              },

            reactivateContribution:
              async () => {
                throw new Error(
                  "REACTIVATE_NOT_EXPECTED"
                );
              },

            reverseContribution:
              async ({
                ledgerId,
                operationId,
              }) => {
                reversed++;

                assert.equal(
                  ledgerId,
                  "LEDGER-REVERSE-001"
                );

                assert.equal(
                  operationId,
                  "OP-004"
                );

                return {
                  ok:true,
                  ledgerId,
                };
              },
          },
        });

    assert.equal(reversed, 1);
    assert.equal(
      result.action,
      "REVERSE"
    );
  }
);

test(
  "lifecycle executor performs no persistence for unchanged eligibility",
  async () => {
    const {
      _test,
    } =
      require(
        "./contribution-lifecycle-reconciler.cjs"
      );

    let calls = 0;

    const unexpected =
      async () => {
        calls++;
        throw new Error(
          "PERSISTENCE_NOT_EXPECTED"
        );
      };

    const result =
      await _test
        .reconcileContributionLifecycleCore({
          db:{},
          actorUid:"ACTOR-001",
          operationId:"OP-005",

          previousContributionResult:{
            status:"DERIVED",
            candidate:{
              ledgerDraft:{
                ledgerId:"LEDGER-001"
              }
            },
          },

          currentContributionResult:{
            status:"DERIVED",
            candidate:{
              ledgerDraft:{
                ledgerId:"LEDGER-001"
              }
            },
          },

          runtime:{
            readLedger:unexpected,
            postContribution:unexpected,
            reactivateContribution:unexpected,
            reverseContribution:unexpected,
          },
        });

    assert.equal(calls, 0);
    assert.equal(
      result.action,
      "NO_OP"
    );
  }
);


test(
  "production lifecycle reconciler exposes official server boundary",
  () => {
    const moduleUnderTest =
      require(
        "./contribution-lifecycle-reconciler.cjs"
      );

    assert.equal(
      typeof moduleUnderTest
        .reconcileContributionLifecycle,
      "function"
    );
  }
);

test(
  "production lifecycle reconciler is wired only to official contribution boundaries",
  () => {
    const fs = require("node:fs");

    const productionSource =
      fs.readFileSync(
        "functions/contribution-lifecycle-reconciler.cjs",
        "utf8"
      );

    assert.equal(
      productionSource.includes(
        "orchestrateContributionPosting"
      ),
      true
    );

    assert.equal(
      productionSource.includes(
        "reverseContributionLedgerEntry"
      ),
      true
    );

    assert.equal(
      productionSource.includes(
        "reactivateContributionLedgerEntry"
      ),
      true
    );

    assert.equal(
      productionSource.includes(
        'collection("contributionLedger")'
      ) ||
      productionSource.includes(
        "collection('contributionLedger')"
      ),
      true
    );

    assert.equal(
      productionSource.includes(
        ".create(ledgerRef"
      ),
      false
    );

    assert.equal(
      productionSource.includes(
        ".update(ledgerRef"
      ),
      false
    );
  }
);



test(
  "ALREADY_ACTIVE requires atomic confirmation of the current ledger state",
  async () => {
    const {
      _test,
    } =
      require(
        "./contribution-lifecycle-reconciler.cjs"
      );

    const ledgerId =
      "LEDGER-ACTIVE-RACE-001";

    const candidate = {
      candidateId:
        "CANDIDATE-ACTIVE-RACE-001",

      ledgerDraft:{
        ledgerId,
        schemaVersion:"1.0.0",
        campaignId:"CAM-001",
        personId:"PERSON-001",
        activityCode:"MISSION_VALIDATED",
        points:10,
        scoreDimension:"MISSION",
        sourceType:"MISSION_VALIDATION",

        sourceId:
          "mission:MIS-RACE-001:person:PERSON-001",

        scoreSourceType:
          "MISSION_VALIDATION",

        scoreSourceId:
          "mission:MIS-RACE-001:person:PERSON-001",

        ruleId:"RULE-MISSION-001",
        scoreRuleVersion:"1.0.0",
        ruleSetVersion:"1.0.0",
        evidenceRef:"EVIDENCE-RACE-001",

        ruleSnapshot:{
          points:10
        }
      }
    };

    const stalePostedLedger = {
      ...candidate.ledgerDraft,

      ledgerStatus:"POSTED",
      runtimeScoringEnabled:true,

      candidateId:
        candidate.candidateId,
    };

    let confirmations = 0;

    await assert.rejects(
      () =>
        _test
          .reconcileContributionLifecycleCore({
            db:{},
            actorUid:"ACTOR-001",
            operationId:"OP-RACE-001",

            previousContributionResult:{
              status:"NOT_ELIGIBLE"
            },

            currentContributionResult:{
              status:"DERIVED",
              candidate,
            },

            runtime:{
              readLedger:
                async () => ({
                  exists:true,
                  ledger:
                    stalePostedLedger,
                }),

              postContribution:
                async () => {
                  throw new Error(
                    "POST_MUST_NOT_RUN"
                  );
                },

              reactivateContribution:
                async () => {
                  throw new Error(
                    "REACTIVATE_MUST_NOT_RUN"
                  );
                },

              reverseContribution:
                async () => {
                  throw new Error(
                    "REVERSE_MUST_NOT_RUN"
                  );
                },

              confirmActiveContribution:
                async ({
                  ledgerId:
                    receivedLedgerId,

                  candidate:
                    receivedCandidate,
                }) => {
                  confirmations++;

                  assert.equal(
                    receivedLedgerId,
                    ledgerId
                  );

                  assert.equal(
                    receivedCandidate,
                    candidate
                  );

                  throw new Error(
                    "CONTRIBUTION_LEDGER_NO_LONGER_ACTIVE"
                  );
                },
            },
          }),

      /CONTRIBUTION_LEDGER_NO_LONGER_ACTIVE/
    );

    assert.equal(
      confirmations,
      1
    );
  }
);

test("ALREADY_ACTIVE requires semantic identity with the canonical candidate", async () => {
  const { _test } =
    require("./contribution-lifecycle-reconciler.cjs");

  const ledgerId = "LEDGER-ACTIVE-SEMANTIC-001";

  const candidate = {
    candidateId:"CANDIDATE-001",
    ledgerDraft:{
      ledgerId,
      schemaVersion:"1.0.0",
      campaignId:"CAM-001",
      personId:"PERSON-001",
      activityCode:"MISSION_VALIDATED",
      points:10,
      scoreDimension:"MISSION",
      sourceType:"MISSION_VALIDATION",
      sourceId:"mission:MIS-001:person:PERSON-001",
      scoreSourceType:"MISSION_VALIDATION",
      scoreSourceId:"mission:MIS-001:person:PERSON-001",
      ruleId:"RULE-MISSION-001",
      scoreRuleVersion:"1.0.0",
      ruleSetVersion:"1.0.0",
      evidenceRef:"EVIDENCE-001",
      ruleSnapshot:{
        points:10
      }
    }
  };

  const mismatchedLedger = {
    ledgerId,
    ledgerStatus:"POSTED",
    runtimeScoringEnabled:true,
    schemaVersion:"1.0.0",
    campaignId:"CAM-001",
    personId:"PERSON-OTHER",
    activityCode:"MISSION_VALIDATED",
    points:10,
    scoreDimension:"MISSION",
    sourceType:"MISSION_VALIDATION",
    sourceId:"mission:MIS-001:person:PERSON-001",
    scoreSourceType:"MISSION_VALIDATION",
    scoreSourceId:"mission:MIS-001:person:PERSON-001",
    ruleId:"RULE-MISSION-001",
    scoreRuleVersion:"1.0.0",
    ruleSetVersion:"1.0.0",
    evidenceRef:"EVIDENCE-001",
    ruleSnapshot:{
      points:10
    },
    candidateId:"CANDIDATE-001"
  };

  await assert.rejects(
    () =>
      _test.reconcileContributionLifecycleCore({
        db:{},
        actorUid:"ACTOR-001",
        operationId:"OP-001",
        previousContributionResult:{
          status:"NOT_DERIVED"
        },
        currentContributionResult:{
          status:"DERIVED",
          candidate
        },
        runtime:{
          readLedger:async () => ({
            exists:true,
            ledger:mismatchedLedger
          }),
          postContribution:async () => {
            throw new Error("POST_MUST_NOT_RUN");
          },
          reactivateContribution:async () => {
            throw new Error("REACTIVATE_MUST_NOT_RUN");
          },
          reverseContribution:async () => {
            throw new Error("REVERSE_MUST_NOT_RUN");
          },
          confirmActiveContribution:
            async ({
              candidate:
                receivedCandidate
            }) => {
              assert.equal(
                receivedCandidate,
                candidate
              );

              const expected =
                receivedCandidate.ledgerDraft;

              const scalarFields = [
                "ledgerId",
                "schemaVersion",
                "campaignId",
                "personId",
                "activityCode",
                "points",
                "scoreDimension",
                "sourceType",
                "sourceId",
                "scoreSourceType",
                "scoreSourceId",
                "ruleId",
                "scoreRuleVersion",
                "ruleSetVersion",
                "evidenceRef"
              ];

              const mismatch =
                scalarFields.some(
                  field =>
                    mismatchedLedger[field] !==
                    expected[field]
                );

              if (mismatch) {
                throw new Error(
                  "CONTRIBUTION_LEDGER_SEMANTIC_MISMATCH"
                );
              }

              throw new Error(
                "SEMANTIC_TEST_EXPECTED_MISMATCH"
              );
            }
        }
      }),
    /CONTRIBUTION_LEDGER_SEMANTIC_MISMATCH/
  );
});
