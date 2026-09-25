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
  buildMissionContributionCandidate,
} =
  require(
    "./contribution-candidate.cjs"
  );

const {
  getContributionRule,
  RULE_STATUSES,
} =
  require(
    "./contribution-rules-v1.cjs"
  );

const {
  LEDGER_STATUSES,
} =
  require(
    "./contribution-ledger.cjs"
  );

const {
  LEDGER_WRITER_POLICY,
} =
  require(
    "./contribution-ledger-writer-policy.cjs"
  );

const {
  CANDIDATE_ACTIVATION_POLICY,
  activateContributionCandidateForPosting,
} =
  require(
    "./contribution-candidate-posting-activation.cjs"
  );

const {
  AUTHORIZATION_STATUS,
  assertContributionPostingAuthorized,
} =
  require(
    "./contribution-posting-authorization.cjs"
  );

const writer =
  require(
    "./contribution-ledger-writer.cjs"
  );

function canonicalCandidate() {
  return buildMissionContributionCandidate({
    mission: {
      id:
        "MISSION-WRITER-001",

      campaignId:
        "CAM-001",

      assignedTo:
        "UID-SUBJECT-001",

      activityCode:
        "TERRITORIAL_BRIGADE",

      activityCatalogVersion:
        "1.0.0",
    },

    evidence: {
      id:
        "EVIDENCE-WRITER-001",

      missionId:
        "MISSION-WRITER-001",

      campaignId:
        "CAM-001",

      uploadedBy:
        "UID-SUBJECT-001",

      evidenceURL:
        "https://example.test/writer-evidence",

      createdAt:
        "2026-09-25T12:00:00.000Z",
    },

    review: {
      missionId:
        "MISSION-WRITER-001",

      campaignId:
        "CAM-001",

      evidenceId:
        "EVIDENCE-WRITER-001",

      subjectId:
        "UID-SUBJECT-001",

      status:
        "validated",

      pendingAppeal:
        false,
    },

    reviewId:
      "EVIDENCE-WRITER-001",

    canonicalIdentity: {
      accountUid:
        "UID-SUBJECT-001",

      personId:
        "PERSON-SUBJECT-001",

      campaignId:
        "CAM-001",
    },
  });
}

function activeActivationPolicy() {
  return Object.freeze({
    ...CANDIDATE_ACTIVATION_POLICY,

    status:
      "ACTIVE",

    runtimeCandidateActivationEnabled:
      true,
  });
}

function activeRuleFor(
  candidate
) {
  const current =
    getContributionRule(
      candidate.activityCode
    );

  return Object.freeze({
    ...current,

    status:
      RULE_STATUSES.ACTIVE,

    runtimeScoringEnabled:
      true,
  });
}

function activeWriterPolicy() {
  return Object.freeze({
    ...LEDGER_WRITER_POLICY,

    status:
      "ACTIVE",

    runtimePostingEnabled:
      true,

    runtimeScoringEnabled:
      true,
  });
}

function postableFromActivatedCandidate(
  activatedCandidate
) {
  return Object.freeze({
    ...activatedCandidate.ledgerDraft,

    ledgerStatus:
      LEDGER_STATUSES.POSTED,

    runtimeScoringEnabled:
      true,
  });
}

function createRuntime({
  actorPersonId =
    "PERSON-ACTOR-001",

  actorAccountUid =
    null,
} = {}) {
  const ruleCache =
    new Map();

  return {
    activationPolicy:
      activeActivationPolicy(),

    writerPolicy:
      activeWriterPolicy(),

    activateCandidate:
      activateContributionCandidateForPosting,

    getRule(
      activityCode
    ) {
      if (
        !ruleCache.has(
          activityCode
        )
      ) {
        const probeCandidate =
          canonicalCandidate();

        ruleCache.set(
          activityCode,
          activeRuleFor(
            probeCandidate
          )
        );
      }

      return ruleCache.get(
        activityCode
      );
    },

    authorizePosting({
      candidate,
      rule,
      policy,
    }) {
      const result =
        assertContributionPostingAuthorized({
          candidate,
          rule,
          policy,
        });

      assert.equal(
        result.authorizationStatus,
        AUTHORIZATION_STATUS.AUTHORIZED
      );

      return result;
    },

    buildPostable:
      postableFromActivatedCandidate,

    async resolveActor({
      accountUid,
    }) {
      return {
        personId:
          actorPersonId,

        accountUid:
          actorAccountUid ||
          accountUid,

        person: {
          active:
            true,

          campaignId:
            "CAM-001",
        },
      };
    },

    serverTimestamp() {
      return Object.freeze({
        __serverTimestamp:
          true,
      });
    },
  };
}

function createFakeDatabase({
  existingDocuments,
} = {}) {
  const documents =
    new Map(
      existingDocuments ||
      []
    );

  let autoId = 0;
  let transactionCalls = 0;
  let createCalls = 0;

  const createdCollections =
    [];

  function buildReference(
    collection,
    id
  ) {
    return Object.freeze({
      collection,
      id,

      key:
        collection +
        "/" +
        id,
    });
  }

  const db = {
    collection(
      collection
    ) {
      return {
        doc(id) {
          const resolved =
            id ||
            (
              "AUTO-" +
              String(
                ++autoId
              )
            );

          return buildReference(
            collection,
            resolved
          );
        },
      };
    },

    async runTransaction(
      callback
    ) {
      transactionCalls += 1;

      const tx = {
        async get(
          reference
        ) {
          if (
            reference.collection ===
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
                };
              },
            };
          }

          if (
            documents.has(
              reference.key
            )
          ) {
            return {
              exists:
                true,

              data() {
                return documents.get(
                  reference.key
                );
              },
            };
          }

          return {
            exists:
              false,

            data() {
              return undefined;
            },
          };
        },

        create(
          reference,
          data
        ) {
          createCalls += 1;

          createdCollections.push(
            reference.collection
          );

          if (
            documents.has(
              reference.key
            )
          ) {
            throw new Error(
              "DUPLICATE_CREATE"
            );
          }

          documents.set(
            reference.key,
            data
          );
        },
      };

      return callback(tx);
    },
  };

  return {
    db,
    documents,

    get transactionCalls() {
      return transactionCalls;
    },

    get createCalls() {
      return createCalls;
    },

    get createdCollections() {
      return [
        ...createdCollections,
      ];
    },
  };
}

function documentsByCollection(
  database,
  collection
) {
  return [
    ...database.documents.entries(),
  ]
    .filter(
      ([key]) =>
        key.startsWith(
          collection +
          "/"
        )
    )
    .map(
      ([, value]) =>
        value
    );
}

test(
  "production writer remains blocked before any database access",
  async () => {
    const candidate =
      canonicalCandidate();

    let databaseCalls = 0;

    const db = {
      collection() {
        databaseCalls += 1;

        throw new Error(
          "DATABASE_MUST_NOT_BE_TOUCHED"
        );
      },

      async runTransaction() {
        databaseCalls += 1;

        throw new Error(
          "DATABASE_MUST_NOT_BE_TOUCHED"
        );
      },
    };

    await assert.rejects(
      () =>
        writer
          .postContributionLedgerEntry({
            db,

            actorUid:
              "ACTOR-UID-001",

            candidate,
          }),

      /CANDIDATE_ACTIVATION_POLICY_NOT_ACTIVE/
    );

    assert.equal(
      databaseCalls,
      0
    );

    assert.equal(
      candidate.runtimePostingEnabled,
      false
    );
  }
);

test(
  "test seam is available only in test environment",
  () => {
    assert.equal(
      typeof writer._test
        .postContributionLedgerEntryCore,
      "function"
    );

    assert.equal(
      typeof writer
        .postContributionLedgerEntry,
      "function"
    );
  }
);

test(
  "synthetic active gates create exactly one ledger and one audit record",
  async () => {
    const candidate =
      canonicalCandidate();

    const database =
      createFakeDatabase();

    const result =
      await writer._test
        .postContributionLedgerEntryCore({
          db:
            database.db,

          actorUid:
            "ACTOR-UID-001",

          candidate,

          runtime:
            createRuntime(),
        });

    assert.equal(
      result.ok,
      true
    );

    assert.equal(
      result.alreadyPosted,
      false
    );

    assert.equal(
      database.transactionCalls,
      1
    );

    assert.equal(
      database.createCalls,
      2
    );

    assert.deepEqual(
      database.createdCollections,
      [
        "contributionLedger",
        "logs",
      ]
    );

    const ledgerDocuments =
      documentsByCollection(
        database,
        "contributionLedger"
      );

    const auditDocuments =
      documentsByCollection(
        database,
        "logs"
      );

    assert.equal(
      ledgerDocuments.length,
      1
    );

    assert.equal(
      auditDocuments.length,
      1
    );

    const ledger =
      ledgerDocuments[0];

    const audit =
      auditDocuments[0];

    assert.equal(
      ledger.ledgerStatus,
      LEDGER_STATUSES.POSTED
    );

    assert.equal(
      ledger.runtimeScoringEnabled,
      true
    );

    assert.equal(
      ledger.candidateId,
      candidate.candidateId
    );

    assert.equal(
      ledger.postedByUserId,
      "ACTOR-UID-001"
    );

    assert.equal(
      ledger.postedByPersonId,
      "PERSON-ACTOR-001"
    );

    assert.deepEqual(
      ledger.postedAt,
      {
        __serverTimestamp:
          true,
      }
    );

    assert.equal(
      audit.action,
      "POST_CONTRIBUTION_LEDGER"
    );

    assert.equal(
      audit.contributionLedgerId,
      ledger.ledgerId
    );

    assert.equal(
      audit.contributionCandidateId,
      candidate.candidateId
    );

    assert.equal(
      audit.postedByPersonId,
      "PERSON-ACTOR-001"
    );

    assert.equal(
      audit.contributionCandidatePersisted,
      false
    );

    assert.equal(
      audit.performanceSummaryWritten,
      false
    );

    assert.equal(
      audit.contributionLedgerWritten,
      true
    );

    assert.equal(
      audit.pointsPosted,
      true
    );

    assert.equal(
      candidate.runtimePostingEnabled,
      false
    );
  }
);

test(
  "deterministic ledger id makes a second post idempotent without another audit write",
  async () => {
    const candidate =
      canonicalCandidate();

    const database =
      createFakeDatabase();

    const runtime =
      createRuntime();

    const first =
      await writer._test
        .postContributionLedgerEntryCore({
          db:
            database.db,

          actorUid:
            "ACTOR-UID-001",

          candidate,

          runtime,
        });

    const createsAfterFirst =
      database.createCalls;

    const second =
      await writer._test
        .postContributionLedgerEntryCore({
          db:
            database.db,

          actorUid:
            "ACTOR-UID-001",

          candidate,

          runtime,
        });

    assert.equal(
      first.alreadyPosted,
      false
    );

    assert.equal(
      second.alreadyPosted,
      true
    );

    assert.equal(
      second.ledgerId,
      first.ledgerId
    );

    assert.equal(
      database.transactionCalls,
      2
    );

    assert.equal(
      createsAfterFirst,
      2
    );

    assert.equal(
      database.createCalls,
      2
    );

    assert.equal(
      documentsByCollection(
        database,
        "contributionLedger"
      ).length,
      1
    );

    assert.equal(
      documentsByCollection(
        database,
        "logs"
      ).length,
      1
    );
  }
);

test(
  "existing deterministic ledger with conflicting candidate is rejected",
  async () => {
    const candidate =
      canonicalCandidate();

    const database =
      createFakeDatabase();

    const runtime =
      createRuntime();

    const first =
      await writer._test
        .postContributionLedgerEntryCore({
          db:
            database.db,

          actorUid:
            "ACTOR-UID-001",

          candidate,

          runtime,
        });

    const key =
      "contributionLedger/" +
      first.ledgerId;

    const stored =
      database.documents.get(
        key
      );

    database.documents.set(
      key,
      {
        ...stored,

        candidateId:
          "DIFFERENT-CANDIDATE",
      }
    );

    const createsBefore =
      database.createCalls;

    await assert.rejects(
      () =>
        writer._test
          .postContributionLedgerEntryCore({
            db:
              database.db,

            actorUid:
              "ACTOR-UID-001",

            candidate,

            runtime,
          }),

      /EXISTING_LEDGER_CANDIDATE_CONFLICT/
    );

    assert.equal(
      database.createCalls,
      createsBefore
    );
  }
);

test(
  "canonical actor account uid mismatch is rejected before ledger writes",
  async () => {
    const candidate =
      canonicalCandidate();

    const database =
      createFakeDatabase();

    const runtime =
      createRuntime({
        actorAccountUid:
          "DIFFERENT-ACTOR-UID",
      });

    await assert.rejects(
      () =>
        writer._test
          .postContributionLedgerEntryCore({
            db:
              database.db,

            actorUid:
              "ACTOR-UID-001",

            candidate,

            runtime,
          }),

      /CANONICAL_ACTOR_UID_MISMATCH/
    );

    assert.equal(
      database.createCalls,
      0
    );

    assert.equal(
      documentsByCollection(
        database,
        "contributionLedger"
      ).length,
      0
    );

    assert.equal(
      documentsByCollection(
        database,
        "logs"
      ).length,
      0
    );
  }
);

test(
  "writer policy contract rejects client write permission",
  () => {
    assert.throws(
      () =>
        writer._test
          .assertWriterPolicyContract({
            ...activeWriterPolicy(),

            clientWriteAllowed:
              true,
          }),

      /CLIENT_LEDGER_WRITE_MUST_REMAIN_DISABLED/
    );
  }
);

test(
  "writer policy contract rejects candidate persistence",
  () => {
    assert.throws(
      () =>
        writer._test
          .assertWriterPolicyContract({
            ...activeWriterPolicy(),

            contributionCandidatePersistenceEnabled:
              true,
          }),

      /CANDIDATE_PERSISTENCE_MUST_REMAIN_DISABLED/
    );
  }
);

test(
  "writer policy contract rejects performance summary writes",
  () => {
    assert.throws(
      () =>
        writer._test
          .assertWriterPolicyContract({
            ...activeWriterPolicy(),

            performanceSummaryWriteEnabled:
              true,
          }),

      /PERFORMANCE_SUMMARY_WRITE_MUST_REMAIN_DISABLED/
    );
  }
);
test(
  "existing ledger reuse requires immutable semantic equality",
  () => {
    function timestampLike(
      seconds,
      nanoseconds
    ) {
      return {
        seconds,
        nanoseconds,

        isEqual(other) {
          return Boolean(
            other &&
            other.seconds ===
              seconds &&
            other.nanoseconds ===
              nanoseconds
          );
        },
      };
    }

    const existing = {
      ledgerId:
        "LEDGER-SEMANTIC-001",

      schemaVersion:
        "1.0.0",

      ledgerStatus:
        LEDGER_STATUSES.POSTED,

      campaignId:
        "CAM-001",

      personId:
        "PERSON-001",

      activityCode:
        "TERRITORIAL_BRIGADE",

      points:
        12,

      scoreDimension:
        "OPERATIONAL",

      sourceType:
        "MISSION",

      sourceId:
        "MISSION-001:person:PERSON-001",

      scoreSourceType:
        "MISSION",

      scoreSourceId:
        "MISSION-001:person:PERSON-001",

      ruleId:
        "RULE-001",

      scoreRuleVersion:
        "1.0.0",

      ruleSetVersion:
        "1.0.0",

      runtimeScoringEnabled:
        true,

      ruleSnapshot: {
        ruleId:
          "RULE-001",

        basePoints:
          12,
      },

      evidenceRef:
        "missionReviews/EVIDENCE-001",

      occurredAt:
        timestampLike(
          100,
          25
        ),

      candidateId:
        "CANDIDATE-001",
    };

    const equivalent = {
      ...existing,

      ruleSnapshot: {
        ...existing.ruleSnapshot,
      },

      occurredAt:
        timestampLike(
          100,
          25
        ),
    };

    assert.doesNotThrow(
      () =>
        writer._test
          .assertReusableExistingLedger({
            existing,

            expected:
              equivalent,

            candidateId:
              "CANDIDATE-001",
          })
    );

    const conflicts = [
      {
        ...equivalent,

        ruleSnapshot: {
          ...equivalent.ruleSnapshot,

          basePoints:
            13,
        },
      },

      {
        ...equivalent,

        evidenceRef:
          "missionReviews/DIFFERENT",
      },

      {
        ...equivalent,

        occurredAt:
          timestampLike(
            101,
            25
          ),
      },
    ];

    for (
      const expected of conflicts
    ) {
      assert.throws(
        () =>
          writer._test
            .assertReusableExistingLedger({
              existing,

              expected,

              candidateId:
                "CANDIDATE-001",
            }),

        /EXISTING_LEDGER_IDEMPOTENCY_CONFLICT/
      );
    }
  }
);