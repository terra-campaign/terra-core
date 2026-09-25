"use strict";
const {
  isDeepStrictEqual,
} =
  require(
    "node:util"
  );

const {
  FieldValue,
} =
  require(
    "firebase-admin/firestore"
  );

const {
  resolveCanonicalPersonForAccount,
} =
  require(
    "./person-identity.cjs"
  );

const {
  getContributionRule,
} =
  require(
    "./contribution-rules-v1.cjs"
  );

const {
  LEDGER_STATUSES,
  buildPostableContribution,
} =
  require(
    "./contribution-ledger.cjs"
  );

const {
  LEDGER_COLLECTION,
  AUDIT_COLLECTION,
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

const WRITER_IMPLEMENTATION_VERSION =
  "1.0.0";

const AUDIT_ACTION =
  "POST_CONTRIBUTION_LEDGER";

function requireToken(
  value,
  fieldName
) {
  if (
    typeof value !==
      "string" ||
    !value.trim()
  ) {
    throw new Error(
      "INVALID_" +
      fieldName
    );
  }

  return value.trim();
}

function requireObject(
  value,
  code
) {
  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(value)
  ) {
    throw new Error(code);
  }

  return value;
}

function requireDatabase(
  db
) {
  if (
    !db ||
    typeof db.collection !==
      "function" ||
    typeof db.runTransaction !==
      "function"
  ) {
    throw new Error(
      "INVALID_LEDGER_WRITER_DATABASE"
    );
  }

  return db;
}

function assertWriterPolicyContract(
  policy
) {
  const checked =
    requireObject(
      policy,
      "INVALID_LEDGER_WRITER_POLICY"
    );

  if (
    checked.clientWriteAllowed !==
      false
  ) {
    throw new Error(
      "CLIENT_LEDGER_WRITE_MUST_REMAIN_DISABLED"
    );
  }

  if (
    checked
      .contributionCandidatePersistenceEnabled !==
      false
  ) {
    throw new Error(
      "CANDIDATE_PERSISTENCE_MUST_REMAIN_DISABLED"
    );
  }

  if (
    checked
      .performanceSummaryWriteEnabled !==
      false
  ) {
    throw new Error(
      "PERFORMANCE_SUMMARY_WRITE_MUST_REMAIN_DISABLED"
    );
  }

  if (
    checked.transactionRequired !==
      true ||
    checked
      .deterministicLedgerIdRequired !==
      true ||
    checked.idempotencyRequired !==
      true ||
    checked.auditLogRequired !==
      true ||
    checked.serverTimestampRequired !==
      true ||
    checked.authenticatedActorRequired !==
      true ||
    checked.canonicalActorRequired !==
      true
  ) {
    throw new Error(
      "LEDGER_WRITER_POLICY_CONTRACT_INCOMPLETE"
    );
  }

  if (
    !Array.isArray(
      checked.intendedWriteSet
    ) ||
    checked.intendedWriteSet.length !==
      2 ||
    checked.intendedWriteSet[0] !==
      LEDGER_COLLECTION ||
    checked.intendedWriteSet[1] !==
      AUDIT_COLLECTION
  ) {
    throw new Error(
      "LEDGER_WRITER_WRITE_SET_INVALID"
    );
  }

  return checked;
}

function profileFromSnapshot(
  snapshot
) {
  if (
    !snapshot ||
    snapshot.exists !==
      true ||
    typeof snapshot.data !==
      "function"
  ) {
    return null;
  }

  const profile =
    snapshot.data();

  if (
    !profile ||
    typeof profile !==
      "object" ||
    Array.isArray(profile)
  ) {
    return null;
  }

  return profile;
}

function assertActorProfile({
  profile,
  campaignId,
}) {
  const checked =
    requireObject(
      profile,
      "ACTOR_PROFILE_REQUIRED"
    );

  const campaign =
    requireToken(
      campaignId,
      "CAMPAIGN_ID"
    );

  if (
    checked.active !== true ||
    checked.campaignId !==
      campaign
  ) {
    throw new Error(
      "ACTOR_PROFILE_NOT_AUTHORIZED_FOR_CAMPAIGN"
    );
  }

  return checked;
}

function assertActivationResult(
  result
) {
  const checked =
    requireObject(
      result,
      "INVALID_CANDIDATE_ACTIVATION_RESULT"
    );

  const activation =
    requireObject(
      checked.activation,
      "INVALID_CANDIDATE_ACTIVATION_METADATA"
    );

  if (
    activation.persisted !==
      false ||
    activation.clientAuthorized !==
      false ||
    activation
      .postingAuthorizationRequired !==
      true
  ) {
    throw new Error(
      "INVALID_CANDIDATE_ACTIVATION_BOUNDARY"
    );
  }

  requireObject(
    checked.candidate,
    "ACTIVATED_CANDIDATE_REQUIRED"
  );

  return checked;
}

function assertAuthorizationDescriptor(
  authorization
) {
  const checked =
    requireObject(
      authorization,
      "INVALID_POSTING_AUTHORIZATION"
    );

  if (
    checked.authorizationStatus !==
      AUTHORIZATION_STATUS
        .AUTHORIZED
  ) {
    throw new Error(
      "CONTRIBUTION_POSTING_NOT_AUTHORIZED"
    );
  }

  return checked;
}

function buildPostableFromCandidate(
  candidate
) {
  const checked =
    requireObject(
      candidate,
      "INVALID_ACTIVATED_CANDIDATE"
    );

  const draft =
    requireObject(
      checked.ledgerDraft,
      "CANDIDATE_LEDGER_DRAFT_REQUIRED"
    );

  return buildPostableContribution({
    campaignId:
      draft.campaignId,

    personId:
      draft.personId,

    activityCode:
      draft.activityCode,

    sourceType:
      draft.sourceType,

    sourceId:
      draft.sourceId,

    scoreDimension:
      draft.scoreDimension,

    points:
      draft.points,

    occurredAt:
      draft.occurredAt,

    evidenceRef:
      draft.evidenceRef,
  });
}

function assertPostableMatchesAuthorization({
  postable,
  authorization,
  candidate,
}) {
  const ledger =
    requireObject(
      postable,
      "INVALID_POSTABLE_LEDGER"
    );

  const auth =
    assertAuthorizationDescriptor(
      authorization
    );

  const checkedCandidate =
    requireObject(
      candidate,
      "INVALID_ACTIVATED_CANDIDATE"
    );

  if (
    ledger.ledgerStatus !==
      LEDGER_STATUSES.POSTED ||
    ledger.runtimeScoringEnabled !==
      true
  ) {
    throw new Error(
      "POSTABLE_LEDGER_NOT_POSTED"
    );
  }

  const comparisons = [
    [
      ledger.ledgerId,
      auth.ledgerId,
    ],
    [
      ledger.campaignId,
      auth.campaignId,
    ],
    [
      ledger.personId,
      auth.personId,
    ],
    [
      ledger.activityCode,
      auth.activityCode,
    ],
    [
      ledger.sourceType,
      auth.sourceType,
    ],
    [
      ledger.sourceId,
      auth.sourceId,
    ],
    [
      ledger.scoreDimension,
      auth.scoreDimension,
    ],
    [
      ledger.points,
      auth.points,
    ],
    [
      ledger.ruleId,
      auth.ruleId,
    ],
    [
      ledger.scoreRuleVersion,
      auth.ruleVersion,
    ],
    [
      ledger.ruleSetVersion,
      auth.ruleSetVersion,
    ],
    [
      checkedCandidate.candidateId,
      auth.candidateId,
    ],
  ];

  for (
    const [
      actual,
      expected,
    ] of comparisons
  ) {
    if (actual !== expected) {
      throw new Error(
        "POSTABLE_LEDGER_AUTHORIZATION_MISMATCH"
      );
    }
  }

  return ledger;
}

function semanticValueEqual(
  actual,
  expected
) {
  if (actual === expected) {
    return true;
  }

  if (
    actual &&
    typeof actual ===
      "object" &&
    typeof actual.isEqual ===
      "function"
  ) {
    try {
      if (
        actual.isEqual(
          expected
        ) === true
      ) {
        return true;
      }
    }
    catch {
      /*
       * Fall through to the symmetric/deep comparison.
       */
    }
  }

  if (
    expected &&
    typeof expected ===
      "object" &&
    typeof expected.isEqual ===
      "function"
  ) {
    try {
      if (
        expected.isEqual(
          actual
        ) === true
      ) {
        return true;
      }
    }
    catch {
      /*
       * Fall through to deep comparison.
       */
    }
  }

  return isDeepStrictEqual(
    actual,
    expected
  );
}

function assertReusableExistingLedger({
  existing,
  expected,
  candidateId,
}) {
  const stored =
    requireObject(
      existing,
      "INVALID_EXISTING_LEDGER"
    );

  const wanted =
    requireObject(
      expected,
      "INVALID_EXPECTED_LEDGER"
    );

  const fields = [
    "ledgerId",
    "schemaVersion",
    "ledgerStatus",
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
    "runtimeScoringEnabled",
  ];

  for (
    const field of fields
  ) {
    if (
      stored[field] !==
        wanted[field]
    ) {
      throw new Error(
        "EXISTING_LEDGER_IDEMPOTENCY_CONFLICT"
      );
    }
  }

  const semanticFields = [
    "ruleSnapshot",
    "evidenceRef",
    "occurredAt",
  ];

  for (
    const field of semanticFields
  ) {
    if (
      !semanticValueEqual(
        stored[field],
        wanted[field]
      )
    ) {
      throw new Error(
        "EXISTING_LEDGER_IDEMPOTENCY_CONFLICT"
      );
    }
  }
  if (
    stored.candidateId !==
      candidateId
  ) {
    throw new Error(
      "EXISTING_LEDGER_CANDIDATE_CONFLICT"
    );
  }

  return stored;
}

function buildLedgerRecord({
  postable,
  candidateId,
  actorUid,
  actorPersonId,
  authorization,
  activation,
  serverNow,
}) {
  return {
    ...postable,

    candidateId,

    postedByUserId:
      actorUid,

    postedByPersonId:
      actorPersonId,

    postedAt:
      serverNow,

    writerImplementationVersion:
      WRITER_IMPLEMENTATION_VERSION,

    writerPolicyVersion:
      authorization.policyVersion,

    activationPolicyVersion:
      activation.policyVersion,
  };
}

function buildAuditRecord({
  ledgerRecord,
  actorUid,
  actorPersonId,
  authorization,
  activation,
  serverNow,
}) {
  return {
    action:
      AUDIT_ACTION,

    campaignId:
      ledgerRecord.campaignId,

    personId:
      ledgerRecord.personId,

    contributionLedgerId:
      ledgerRecord.ledgerId,

    contributionCandidateId:
      ledgerRecord.candidateId,

    activityCode:
      ledgerRecord.activityCode,

    sourceType:
      ledgerRecord.sourceType,

    sourceId:
      ledgerRecord.sourceId,

    scoreDimension:
      ledgerRecord.scoreDimension,

    points:
      ledgerRecord.points,

    ruleId:
      ledgerRecord.ruleId,

    ruleVersion:
      ledgerRecord.scoreRuleVersion,

    ruleSetVersion:
      ledgerRecord.ruleSetVersion,

    postedByUserId:
      actorUid,

    postedByPersonId:
      actorPersonId,

    writerImplementationVersion:
      WRITER_IMPLEMENTATION_VERSION,

    writerPolicyVersion:
      authorization.policyVersion,

    activationPolicyVersion:
      activation.policyVersion,

    contributionCandidatePersisted:
      false,

    performanceSummaryWritten:
      false,

    contributionLedgerWritten:
      true,

    pointsPosted:
      true,

    createdAt:
      serverNow,
  };
}

async function postContributionLedgerEntryCore({
  db,
  actorUid,
  candidate,
  runtime,
}) {
  const database =
    requireDatabase(db);

  const uid =
    requireToken(
      actorUid,
      "ACTOR_UID"
    );

  const runtimeContract =
    requireObject(
      runtime,
      "INVALID_LEDGER_WRITER_RUNTIME"
    );

  const {
    activationPolicy,
    writerPolicy,
    activateCandidate,
    getRule,
    authorizePosting,
    buildPostable,
    resolveActor,
    serverTimestamp,
  } =
    runtimeContract;

  const requiredRuntimeFunctions = [
    activateCandidate,
    getRule,
    authorizePosting,
    buildPostable,
    resolveActor,
    serverTimestamp,
  ];

  if (
    requiredRuntimeFunctions.some(
      fn =>
        typeof fn !==
          "function"
    )
  ) {
    throw new Error(
      "INVALID_LEDGER_WRITER_RUNTIME_FUNCTION"
    );
  }

  const policy =
    assertWriterPolicyContract(
      writerPolicy
    );

  /*
   * SECURITY BOUNDARY:
   * Production callers cannot inject an activation policy,
   * writer policy, rule or pre-activated candidate.
   *
   * The canonical candidate must cross the production
   * activation boundary here, in server memory.
   *
   * Today this call intentionally throws because
   * CANDIDATE_ACTIVATION_POLICY is DEFINED_NOT_ACTIVATED.
   */
  const activationResult =
    assertActivationResult(
      activateCandidate({
        candidate,
        activationPolicy,
      })
    );

  const activatedCandidate =
    activationResult.candidate;

  /*
   * Resolve the current canonical rule server-side.
   * A client cannot supply a synthetic rule.
   */
  const rule =
    getRule(
      activatedCandidate.activityCode
    );

  const authorization =
    assertAuthorizationDescriptor(
      authorizePosting({
        candidate:
          activatedCandidate,

        rule,

        policy,
      })
    );

  /*
   * buildPostableContribution resolves the production
   * rule again and requires it to be ACTIVE with
   * runtimeScoringEnabled=true.
   */
  const postable =
    assertPostableMatchesAuthorization({
      postable:
        buildPostable(
          activatedCandidate
        ),

      authorization,

      candidate:
        activatedCandidate,
    });

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
          "INVALID_LEDGER_WRITER_TRANSACTION"
        );
      }

      const actorProfileRef =
        database
          .collection(
            "usuarios"
          )
          .doc(uid);

      const actorProfile =
        profileFromSnapshot(
          await tx.get(
            actorProfileRef
          )
        );

      assertActorProfile({
        profile:
          actorProfile,

        campaignId:
          postable.campaignId,
      });

      const actorIdentity =
        await resolveActor({
          db:
            database,

          tx,

          accountUid:
            uid,

          profile:
            actorProfile,

          campaignId:
            postable.campaignId,
        });

      const actorPersonId =
        requireToken(
          actorIdentity &&
            actorIdentity.personId,
          "ACTOR_PERSON_ID"
        );

      const resolvedAccountUid =
        requireToken(
          actorIdentity &&
            actorIdentity.accountUid,
          "RESOLVED_ACTOR_UID"
        );

      if (
        resolvedAccountUid !==
          uid
      ) {
        throw new Error(
          "CANONICAL_ACTOR_UID_MISMATCH"
        );
      }

      const ledgerRef =
        database
          .collection(
            LEDGER_COLLECTION
          )
          .doc(
            postable.ledgerId
          );

      const existingSnapshot =
        await tx.get(
          ledgerRef
        );

      if (
        existingSnapshot &&
        existingSnapshot.exists ===
          true
      ) {
        const existing =
          assertReusableExistingLedger({
            existing:
              existingSnapshot.data(),

            expected:
              postable,

            candidateId:
              activatedCandidate
                .candidateId,
          });

        return {
          ok:
            true,

          alreadyPosted:
            true,

          ledgerId:
            existing.ledgerId,

          campaignId:
            existing.campaignId,

          personId:
            existing.personId,

          points:
            existing.points,

          postedByPersonId:
            existing.postedByPersonId ||
            null,

          contributionCandidatePersisted:
            false,

          performanceSummaryWritten:
            false,
        };
      }

      const serverNow =
        serverTimestamp();

      const ledgerRecord =
        buildLedgerRecord({
          postable,

          candidateId:
            activatedCandidate
              .candidateId,

          actorUid:
            uid,

          actorPersonId,

          authorization,

          activation:
            activationResult.activation,

          serverNow,
        });

      const auditRef =
        database
          .collection(
            AUDIT_COLLECTION
          )
          .doc();

      const auditRecord =
        buildAuditRecord({
          ledgerRecord,

          actorUid:
            uid,

          actorPersonId,

          authorization,

          activation:
            activationResult.activation,

          serverNow,
        });

      /*
       * Canonical write set:
       * 1. contributionLedger/{ledgerId}
       * 2. logs/{auditId}
       *
       * No candidate persistence.
       * No performance summary write.
       */
      tx.create(
        ledgerRef,
        ledgerRecord
      );

      tx.create(
        auditRef,
        auditRecord
      );

      return {
        ok:
          true,

        alreadyPosted:
          false,

        ledgerId:
          ledgerRecord.ledgerId,

        campaignId:
          ledgerRecord.campaignId,

        personId:
          ledgerRecord.personId,

        points:
          ledgerRecord.points,

        postedByPersonId:
          actorPersonId,

        contributionCandidatePersisted:
          false,

        performanceSummaryWritten:
          false,
      };
    }
  );
}

async function postContributionLedgerEntry({
  db,
  actorUid,
  candidate,
}) {
  return postContributionLedgerEntryCore({
    db,
    actorUid,
    candidate,

    runtime:
      Object.freeze({
        activationPolicy:
          CANDIDATE_ACTIVATION_POLICY,

        writerPolicy:
          LEDGER_WRITER_POLICY,

        activateCandidate:
          activateContributionCandidateForPosting,

        getRule:
          getContributionRule,

        authorizePosting:
          assertContributionPostingAuthorized,

        buildPostable:
          buildPostableFromCandidate,

        resolveActor:
          resolveCanonicalPersonForAccount,

        serverTimestamp:
          () =>
            FieldValue
              .serverTimestamp(),
      }),
  });
}

module.exports = {
  WRITER_IMPLEMENTATION_VERSION,
  AUDIT_ACTION,
  postContributionLedgerEntry,

  _test:
    Object.freeze({
      assertWriterPolicyContract,
      assertActorProfile,
      assertActivationResult,
      assertAuthorizationDescriptor,
      assertPostableMatchesAuthorization,
      assertReusableExistingLedger,
      buildLedgerRecord,
      buildAuditRecord,

      ...(
        process.env.NODE_ENV ===
          "test"
          ? {
              postContributionLedgerEntryCore,
            }
          : {}
      ),
    }),
};