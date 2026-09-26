"use strict";

const { isDeepStrictEqual } =
  require("node:util");

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

/*
 * TERRA Campaign
 * Contribution Ledger Reversal Writer
 *
 * Server-only boundary.
 *
 * A reversal preserves the original contribution ledger
 * identity and historical record, but changes its effective
 * scoring state from POSTED to REVERSED.
 *
 * No client callable is exposed.
 * No performance summary is persisted here.
 */

const REVERSAL_WRITER_IMPLEMENTATION_VERSION =
  "1.0.0-foundation";

const LEDGER_STATUS_POSTED =
  "POSTED";

const LEDGER_STATUS_REVERSED =
  "REVERSED";

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

function profileFromSnapshot(
  snapshot
) {
  if (
    !snapshot ||
    snapshot.exists !== true ||
    typeof snapshot.data !== "function"
  ) {
    return null;
  }

  const profile =
    snapshot.data();

  if (
    !profile ||
    typeof profile !== "object" ||
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
    checked.campaignId !== campaign
  ) {
    throw new Error(
      "ACTOR_PROFILE_NOT_AUTHORIZED_FOR_CAMPAIGN"
    );
  }

  return checked;
}


function assertLedgerMatchesCandidateSemanticIdentity({
  existing,
  candidate,
  mismatchCode = "CONTRIBUTION_LEDGER_SEMANTIC_MISMATCH",
  ruleSnapshotMismatchCode = null,
  candidateMismatchCode = null,
}) {
  const stored =
    requireObject(
      existing,
      "INVALID_CONTRIBUTION_LEDGER"
    );

  const currentCandidate =
    requireObject(
      candidate,
      "INVALID_CONTRIBUTION_CANDIDATE"
    );

  const expected =
    requireObject(
      currentCandidate.ledgerDraft,
      "CONTRIBUTION_LEDGER_DRAFT_REQUIRED"
    );

  const identityFields = [
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
    "evidenceRef",
  ];

  for (const field of identityFields) {
    if (stored[field] !== expected[field]) {
      throw new Error(mismatchCode);
    }
  }

  if (
    !isDeepStrictEqual(
      stored.ruleSnapshot ?? null,
      expected.ruleSnapshot ?? null
    )
  ) {
    throw new Error(
      ruleSnapshotMismatchCode ||
        (mismatchCode + ":RULE_SNAPSHOT_MISMATCH")
    );
  }

  if (
    stored.candidateId !==
    currentCandidate.candidateId
  ) {
    throw new Error(
      candidateMismatchCode ||
        (mismatchCode + ":CANDIDATE_MISMATCH")
    );
  }

  return stored;
}

function assertReactivationMatchesCandidate({
  existing,
  candidate,
}) {
  const stored =
    requireObject(
      existing,
      "INVALID_REVERSED_LEDGER"
    );

  if (
    stored.ledgerStatus !==
      LEDGER_STATUS_REVERSED ||
    stored.runtimeScoringEnabled !==
      false
  ) {
    throw new Error(
      "REACTIVATION_REQUIRES_REVERSED_LEDGER"
    );
  }

  return assertLedgerMatchesCandidateSemanticIdentity({
    existing:stored,
    candidate,
    mismatchCode:"REACTIVATION_SEMANTIC_MISMATCH",
    ruleSnapshotMismatchCode:
      "REACTIVATION_SEMANTIC_MISMATCH:" +
      "REACTIVATION_RULE_SNAPSHOT_MISMATCH",
    candidateMismatchCode:
      "REACTIVATION_CANDIDATE_MISMATCH",
  });
}

function buildReversedLedgerRecord({
  original,
  actorUid,
  actorPersonId,
  reason,
  operationId,
  serverNow,
}) {
  const source =
    requireObject(
      original,
      "INVALID_ORIGINAL_LEDGER"
    );

  if (
    source.ledgerStatus !==
      LEDGER_STATUS_POSTED ||
    source.runtimeScoringEnabled !==
      true
  ) {
    throw new Error(
      "REVERSAL_REQUIRES_POSTED_LEDGER"
    );
  }

  requireToken(
    source.ledgerId,
    "ORIGINAL_LEDGER_ID_REQUIRED"
  );

  requireToken(
    source.campaignId,
    "ORIGINAL_CAMPAIGN_ID_REQUIRED"
  );

  requireToken(
    source.personId,
    "ORIGINAL_PERSON_ID_REQUIRED"
  );

  if (
    !Number.isInteger(
      source.points
    ) ||
    source.points <= 0
  ) {
    throw new Error(
      "INVALID_ORIGINAL_LEDGER_POINTS"
    );
  }

  const uid =
    requireToken(
      actorUid,
      "REVERSAL_ACTOR_UID_REQUIRED"
    );

  const person =
    requireToken(
      actorPersonId,
      "REVERSAL_ACTOR_PERSON_ID_REQUIRED"
    );

  const reversalReason =
    requireToken(
      reason,
      "REVERSAL_REASON_REQUIRED"
    );

  const reversalOperationId =
    requireToken(
      operationId,
      "REVERSAL_OPERATION_ID_REQUIRED"
    );

  if (
    serverNow === undefined ||
    serverNow === null
  ) {
    throw new Error(
      "REVERSAL_SERVER_TIMESTAMP_REQUIRED"
    );
  }

  return Object.freeze({
    ...source,

    ledgerStatus:
      LEDGER_STATUS_REVERSED,

    runtimeScoringEnabled:
      false,

    reversalReason,

    reversalOperationId,

    reversedByUserId:
      uid,

    reversedByPersonId:
      person,

    reversedAt:
      serverNow,

    reversalWriterImplementationVersion:
      REVERSAL_WRITER_IMPLEMENTATION_VERSION,
  });
}

function buildReactivatedLedgerRecord({
  original,
  actorUid,
  actorPersonId,
  operationId,
  serverNow,
}) {
  const source =
    requireObject(
      original,
      "INVALID_REVERSED_LEDGER"
    );

  if (
    source.ledgerStatus !==
      LEDGER_STATUS_REVERSED ||
    source.runtimeScoringEnabled !==
      false
  ) {
    throw new Error(
      "REACTIVATION_REQUIRES_REVERSED_LEDGER"
    );
  }

  requireToken(
    source.ledgerId,
    "REACTIVATION_LEDGER_ID_REQUIRED"
  );

  requireToken(
    source.campaignId,
    "REACTIVATION_CAMPAIGN_ID_REQUIRED"
  );

  requireToken(
    source.personId,
    "REACTIVATION_PERSON_ID_REQUIRED"
  );

  if (
    !Number.isInteger(source.points) ||
    source.points <= 0
  ) {
    throw new Error(
      "INVALID_REACTIVATION_LEDGER_POINTS"
    );
  }

  requireToken(
    source.reversalOperationId,
    "REACTIVATION_REQUIRES_REVERSAL_OPERATION"
  );

  const uid =
    requireToken(
      actorUid,
      "REACTIVATION_ACTOR_UID_REQUIRED"
    );

  const person =
    requireToken(
      actorPersonId,
      "REACTIVATION_ACTOR_PERSON_ID_REQUIRED"
    );

  const reactivationOperationId =
    requireToken(
      operationId,
      "REACTIVATION_OPERATION_ID_REQUIRED"
    );

  if (
    serverNow === undefined ||
    serverNow === null
  ) {
    throw new Error(
      "REACTIVATION_SERVER_TIMESTAMP_REQUIRED"
    );
  }

  return Object.freeze({
    ...source,

    ledgerStatus:
      LEDGER_STATUS_POSTED,

    runtimeScoringEnabled:
      true,

    reactivationOperationId,

    reactivatedByUserId:
      uid,

    reactivatedByPersonId:
      person,

    reactivatedAt:
      serverNow,

    reactivationWriterImplementationVersion:
      REVERSAL_WRITER_IMPLEMENTATION_VERSION,
  });
}
async function reverseContributionLedgerEntryCore({
  db,
  actorUid,
  ledgerId,
  reason,
  operationId,
  runtime,
}) {
  const database =
    requireObject(
      db,
      "REVERSAL_DATABASE_REQUIRED"
    );

  if (
    typeof database.runTransaction !==
      "function"
  ) {
    throw new Error(
      "REVERSAL_TRANSACTION_REQUIRED"
    );
  }

  const uid =
    requireToken(
      actorUid,
      "REVERSAL_ACTOR_UID_REQUIRED"
    );

  requireToken(
    ledgerId,
    "REVERSAL_LEDGER_ID_REQUIRED"
  );

  requireToken(
    reason,
    "REVERSAL_REASON_REQUIRED"
  );

  requireToken(
    operationId,
    "REVERSAL_OPERATION_ID_REQUIRED"
  );

  requireObject(
    runtime,
    "REVERSAL_RUNTIME_REQUIRED"
  );

  return database.runTransaction(
    async tx => {
      if (
        !tx ||
        typeof tx.get !==
          "function"
      ) {
        throw new Error(
          "REVERSAL_TRANSACTION_GET_REQUIRED"
        );
      }

      const actorRef =
        database
          .collection("usuarios")
          .doc(uid);

      /*
       * Authoritative transactional reads.
       *
       * Both actor and target ledger are read inside
       * the same Firestore transaction before any
       * reversal mutation is permitted.
       */
      const actorProfile =
        profileFromSnapshot(
          await tx.get(
            actorRef
          )
        );

      requireObject(
        actorProfile,
        "ACTOR_PROFILE_REQUIRED"
      );

      const ledgerRef =
        database
          .collection(
            "contributionLedger"
          )
          .doc(
            ledgerId
          );

      const ledgerSnapshot =
        await tx.get(
          ledgerRef
        );

      if (
        !ledgerSnapshot ||
        ledgerSnapshot.exists !== true ||
        typeof ledgerSnapshot.data !==
          "function"
      ) {
        throw new Error(
          "REVERSAL_LEDGER_NOT_FOUND"
        );
      }

      const originalLedger =
        requireObject(
          ledgerSnapshot.data(),
          "INVALID_ORIGINAL_LEDGER"
        );

      const originalLedgerId =
        requireToken(
          originalLedger.ledgerId,
          "ORIGINAL_LEDGER_ID"
        );

      if (
        originalLedgerId !==
          ledgerId
      ) {
        throw new Error(
          "CONTRIBUTION_LEDGER_ID_MISMATCH"
        );
      }

      assertActorProfile({
        profile:
          actorProfile,

        campaignId:
          originalLedger.campaignId,
      });

      const checkedRuntime =
        requireObject(
          runtime,
          "REVERSAL_RUNTIME_REQUIRED"
        );

      if (
        typeof checkedRuntime.resolveActor !==
          "function"
      ) {
        throw new Error(
          "REVERSAL_RESOLVE_ACTOR_REQUIRED"
        );
      }

      const actorIdentity =
        await checkedRuntime.resolveActor({
          db:
            database,

          tx,

          accountUid:
            uid,

          profile:
            actorProfile,

          campaignId:
            originalLedger.campaignId,
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

      if (
        originalLedger.ledgerStatus ===
          LEDGER_STATUS_REVERSED &&
        originalLedger.reversalOperationId ===
          operationId
      ) {
        return Object.freeze({
          ok:
            true,

          alreadyReversed:
            true,

          ledgerId:
            requireToken(
              originalLedger.ledgerId,
              "ORIGINAL_LEDGER_ID"
            ),

          campaignId:
            requireToken(
              originalLedger.campaignId,
              "ORIGINAL_CAMPAIGN_ID"
            ),

          personId:
            requireToken(
              originalLedger.personId,
              "ORIGINAL_PERSON_ID"
            ),

          pointsRemoved:
            originalLedger.points,

          reversalOperationId:
            operationId,

          performanceSummaryWritten:
            false,
        });
      }

      if (
        originalLedger.ledgerStatus ===
          LEDGER_STATUS_REVERSED
      ) {
        throw new Error(
          "CONTRIBUTION_LEDGER_ALREADY_REVERSED"
        );
      }

      if (
        typeof tx.update !==
          "function"
      ) {
        throw new Error(
          "REVERSAL_TRANSACTION_UPDATE_REQUIRED"
        );
      }

      if (
        typeof checkedRuntime.serverTimestamp !==
          "function"
      ) {
        throw new Error(
          "REVERSAL_SERVER_TIMESTAMP_REQUIRED"
        );
      }

      const reversedLedger =
        buildReversedLedgerRecord({
          original:
            originalLedger,

          actorUid:
            uid,

          actorPersonId,

          reason,

          operationId,

          serverNow:
            checkedRuntime.serverTimestamp(),
        });

      if (
        typeof tx.create !==
          "function"
      ) {
        throw new Error(
          "REVERSAL_TRANSACTION_CREATE_REQUIRED"
        );
      }

      tx.update(
        ledgerRef,
        reversedLedger
      );

      const auditId =
        [
          "contribution-ledger-reversal",
          ledgerId,
          operationId,
        ]
          .map(
            value =>
              encodeURIComponent(
                String(value)
              )
          )
          .join("__");

      const auditRef =
        database
          .collection(
            "logs"
          )
          .doc(
            auditId
          );

      const auditRecord =
        Object.freeze({
          action:
            "CONTRIBUTION_LEDGER_REVERSED",

          campaignId:
            reversedLedger.campaignId,

          personId:
            reversedLedger.personId,

          contributionLedgerId:
            reversedLedger.ledgerId,

          activityCode:
            reversedLedger.activityCode ||
            null,

          sourceType:
            reversedLedger.sourceType ||
            null,

          sourceId:
            reversedLedger.sourceId ||
            null,

          scoreDimension:
            reversedLedger.scoreDimension ||
            null,

          pointsRemoved:
            reversedLedger.points,

          reversalReason:
            reversedLedger.reversalReason,

          reversalOperationId:
            reversedLedger.reversalOperationId,

          actorUserId:
            uid,

          actorPersonId,

          reversalWriterImplementationVersion:
            REVERSAL_WRITER_IMPLEMENTATION_VERSION,

          contributionLedgerReversed:
            true,

          runtimeScoringDisabled:
            true,

          performanceSummaryWritten:
            false,

          createdAt:
            reversedLedger.reversedAt,
        });

      tx.create(
        auditRef,
        auditRecord
      );

      return Object.freeze({
        ok:
          true,

        alreadyReversed:
          false,

        ledgerId:
          reversedLedger.ledgerId,

        campaignId:
          reversedLedger.campaignId,

        personId:
          reversedLedger.personId,

        pointsRemoved:
          reversedLedger.points,

        reversalOperationId:
          reversedLedger.reversalOperationId,

        performanceSummaryWritten:
          false,
      });
    }
  );
}

async function reactivateContributionLedgerEntryCore({
  db,
  actorUid,
  ledgerId,
  operationId,
  candidate,
  runtime,
}) {
  const database =
    requireObject(
      db,
      "REACTIVATION_DATABASE_REQUIRED"
    );

  if (
    typeof database.runTransaction !==
      "function"
  ) {
    throw new Error(
      "REACTIVATION_TRANSACTION_REQUIRED"
    );
  }

  const uid =
    requireToken(
      actorUid,
      "REACTIVATION_ACTOR_UID_REQUIRED"
    );

  requireToken(
    ledgerId,
    "REACTIVATION_LEDGER_ID_REQUIRED"
  );

  requireToken(
    operationId,
    "REACTIVATION_OPERATION_ID_REQUIRED"
  );

  const checkedRuntime =
    requireObject(
      runtime,
      "REACTIVATION_RUNTIME_REQUIRED"
    );

  return database.runTransaction(
    async tx => {
      if (
        !tx ||
        typeof tx.get !==
          "function"
      ) {
        throw new Error(
          "REACTIVATION_TRANSACTION_GET_REQUIRED"
        );
      }

      const actorRef =
        database
          .collection("usuarios")
          .doc(uid);

      const actorProfile =
        profileFromSnapshot(
          await tx.get(actorRef)
        );

      requireObject(
        actorProfile,
        "ACTOR_PROFILE_REQUIRED"
      );

      const ledgerRef =
        database
          .collection(
            "contributionLedger"
          )
          .doc(ledgerId);

      const ledgerSnapshot =
        await tx.get(
          ledgerRef
        );

      if (
        !ledgerSnapshot ||
        ledgerSnapshot.exists !== true ||
        typeof ledgerSnapshot.data !==
          "function"
      ) {
        throw new Error(
          "REACTIVATION_LEDGER_NOT_FOUND"
        );
      }

      const originalLedger =
        requireObject(
          ledgerSnapshot.data(),
          "INVALID_ORIGINAL_LEDGER"
        );

      const originalLedgerId =
        requireToken(
          originalLedger.ledgerId,
          "ORIGINAL_LEDGER_ID"
        );

      if (
        originalLedgerId !==
          ledgerId
      ) {
        throw new Error(
          "CONTRIBUTION_LEDGER_ID_MISMATCH"
        );
      }

      assertActorProfile({
        profile:
          actorProfile,

        campaignId:
          originalLedger.campaignId,
      });

      if (
        typeof checkedRuntime.resolveActor !==
          "function"
      ) {
        throw new Error(
          "REACTIVATION_RESOLVE_ACTOR_REQUIRED"
        );
      }

      const actorIdentity =
        await checkedRuntime.resolveActor({
          db:
            database,

          tx,

          accountUid:
            uid,

          profile:
            actorProfile,

          campaignId:
            originalLedger.campaignId,
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

      /*
       * Idempotent retry:
       * this exact reactivation already succeeded.
       */
      if (
        originalLedger.ledgerStatus ===
          LEDGER_STATUS_POSTED &&
        originalLedger.runtimeScoringEnabled ===
          true &&
        originalLedger.reactivationOperationId ===
          operationId
      ) {
        const canonicalCandidate =
          requireObject(
            candidate,
            "REACTIVATION_CANDIDATE_REQUIRED"
          );

        assertLedgerMatchesCandidateSemanticIdentity({
          existing:
            originalLedger,

          candidate:
            canonicalCandidate,

          mismatchCode:
            "REACTIVATION_SEMANTIC_MISMATCH",

          ruleSnapshotMismatchCode:
            "REACTIVATION_SEMANTIC_MISMATCH:" +
            "REACTIVATION_RULE_SNAPSHOT_MISMATCH",

          candidateMismatchCode:
            "REACTIVATION_CANDIDATE_MISMATCH",
        });

        return Object.freeze({
          ok:
            true,

          alreadyReactivated:
            true,

          ledgerId:
            originalLedgerId,

          campaignId:
            requireToken(
              originalLedger.campaignId,
              "ORIGINAL_CAMPAIGN_ID"
            ),

          personId:
            requireToken(
              originalLedger.personId,
              "ORIGINAL_PERSON_ID"
            ),

          pointsRestored:
            originalLedger.points,

          reactivationOperationId:
            operationId,

          performanceSummaryWritten:
            false,
        });
      }

      /*
       * A POSTED ledger that was not produced by this
       * exact reactivation operation is not a valid
       * reactivation target.
       */
      if (
        originalLedger.ledgerStatus ===
          LEDGER_STATUS_POSTED
      ) {
        throw new Error(
          "CONTRIBUTION_LEDGER_ALREADY_POSTED"
        );
      }

      if (
        originalLedger.ledgerStatus !==
          LEDGER_STATUS_REVERSED ||
        originalLedger.runtimeScoringEnabled !==
          false
      ) {
        throw new Error(
          "REACTIVATION_REQUIRES_REVERSED_LEDGER"
        );
      }

      const canonicalCandidate =
        requireObject(
          candidate,
          "REACTIVATION_CANDIDATE_REQUIRED"
        );

      assertReactivationMatchesCandidate({
        existing:
          originalLedger,

        candidate:
          canonicalCandidate,
      });

      if (
        typeof checkedRuntime.serverTimestamp !==
          "function"
      ) {
        throw new Error(
          "REACTIVATION_SERVER_TIMESTAMP_REQUIRED"
        );
      }

      if (
        typeof tx.update !==
          "function"
      ) {
        throw new Error(
          "REACTIVATION_TRANSACTION_UPDATE_REQUIRED"
        );
      }

      if (
        typeof tx.create !==
          "function"
      ) {
        throw new Error(
          "REACTIVATION_TRANSACTION_CREATE_REQUIRED"
        );
      }

      const serverNow =
        checkedRuntime.serverTimestamp();

      const reactivatedLedger =
        buildReactivatedLedgerRecord({
          original:
            originalLedger,

          actorUid:
            uid,

          actorPersonId,

          operationId,

          serverNow,
        });

      const auditId =
        [
          "contribution-ledger-reactivation",
          ledgerId,
          operationId,
        ]
          .map(value =>
            encodeURIComponent(
              String(value)
            )
          )
          .join("__");

      const auditRef =
        database
          .collection("logs")
          .doc(auditId);

      const audit =
        Object.freeze({
          action:
            "CONTRIBUTION_LEDGER_REACTIVATED",

          contributionLedgerId:
            ledgerId,

          campaignId:
            requireToken(
              originalLedger.campaignId,
              "ORIGINAL_CAMPAIGN_ID"
            ),

          personId:
            requireToken(
              originalLedger.personId,
              "ORIGINAL_PERSON_ID"
            ),

          pointsRestored:
            originalLedger.points,

          reactivationOperationId:
            operationId,

          previousReversalOperationId:
            requireToken(
              originalLedger.reversalOperationId,
              "ORIGINAL_REVERSAL_OPERATION_ID"
            ),

          actorUid:
            uid,

          actorPersonId,

          contributionLedgerReactivated:
            true,

          runtimeScoringEnabled:
            true,

          performanceSummaryWritten:
            false,

          createdAt:
            serverNow,

          implementationVersion:
            REVERSAL_WRITER_IMPLEMENTATION_VERSION,
        });

      tx.update(
        ledgerRef,
        reactivatedLedger
      );

      tx.create(
        auditRef,
        audit
      );

      return Object.freeze({
        ok:
          true,

        alreadyReactivated:
          false,

        ledgerId:
          reactivatedLedger.ledgerId,

        campaignId:
          reactivatedLedger.campaignId,

        personId:
          reactivatedLedger.personId,

        pointsRestored:
          reactivatedLedger.points,

        reactivationOperationId:
          operationId,

        performanceSummaryWritten:
          false,
      });
    }
  );
}

async function confirmActiveContributionLedgerEntry({
  db,
  actorUid,
  ledgerId,
  candidate,
}) {
  const database =
    requireObject(
      db,
      "ACTIVE_CONFIRMATION_DATABASE_REQUIRED"
    );

  if (
    typeof database.runTransaction !==
      "function"
  ) {
    throw new Error(
      "ACTIVE_CONFIRMATION_TRANSACTION_REQUIRED"
    );
  }

  const uid =
    requireToken(
      actorUid,
      "ACTIVE_CONFIRMATION_ACTOR_UID_REQUIRED"
    );

  const checkedLedgerId =
    requireToken(
      ledgerId,
      "ACTIVE_CONFIRMATION_LEDGER_ID_REQUIRED"
    );

  const canonicalCandidate =
    requireObject(
      candidate,
      "ACTIVE_CONFIRMATION_CANDIDATE_REQUIRED"
    );

  return database.runTransaction(
    async tx => {
      if (
        !tx ||
        typeof tx.get !==
          "function"
      ) {
        throw new Error(
          "ACTIVE_CONFIRMATION_TRANSACTION_GET_REQUIRED"
        );
      }

      const actorRef =
        database
          .collection("usuarios")
          .doc(uid);

      const actorProfile =
        profileFromSnapshot(
          await tx.get(actorRef)
        );

      requireObject(
        actorProfile,
        "ACTOR_PROFILE_REQUIRED"
      );

      const ledgerRef =
        database
          .collection(
            "contributionLedger"
          )
          .doc(
            checkedLedgerId
          );

      const ledgerSnapshot =
        await tx.get(
          ledgerRef
        );

      if (
        !ledgerSnapshot ||
        ledgerSnapshot.exists !== true ||
        typeof ledgerSnapshot.data !==
          "function"
      ) {
        throw new Error(
          "CONTRIBUTION_LEDGER_NO_LONGER_ACTIVE"
        );
      }

      const currentLedger =
        requireObject(
          ledgerSnapshot.data(),
          "INVALID_CONTRIBUTION_LEDGER"
        );

      const currentLedgerId =
        requireToken(
          currentLedger.ledgerId,
          "ORIGINAL_LEDGER_ID"
        );

      if (
        currentLedgerId !==
          checkedLedgerId
      ) {
        throw new Error(
          "CONTRIBUTION_LEDGER_ID_MISMATCH"
        );
      }

      assertActorProfile({
        profile:
          actorProfile,

        campaignId:
          currentLedger.campaignId,
      });

      const actorIdentity =
        await resolveCanonicalPersonForAccount({
          db:
            database,

          tx,

          accountUid:
            uid,

          profile:
            actorProfile,

          campaignId:
            currentLedger.campaignId,
        });

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

      if (
        currentLedger.ledgerStatus !==
          LEDGER_STATUS_POSTED ||
        currentLedger.runtimeScoringEnabled !==
          true
      ) {
        throw new Error(
          "CONTRIBUTION_LEDGER_NO_LONGER_ACTIVE"
        );
      }

      assertLedgerMatchesCandidateSemanticIdentity({
        existing:
          currentLedger,

        candidate:
          canonicalCandidate,

        mismatchCode:
          "CONTRIBUTION_LEDGER_SEMANTIC_MISMATCH",
      });

      return Object.freeze({
        ok:
          true,

        active:
          true,

        ledgerId:
          currentLedgerId,

        campaignId:
          requireToken(
            currentLedger.campaignId,
            "ORIGINAL_CAMPAIGN_ID"
          ),

        personId:
          requireToken(
            currentLedger.personId,
            "ORIGINAL_PERSON_ID"
          ),
      });
    }
  );
}

async function reverseContributionLedgerEntry({
  db,
  actorUid,
  ledgerId,
  reason,
  operationId,
}) {
  return reverseContributionLedgerEntryCore({
    db,
    actorUid,
    ledgerId,
    reason,
    operationId,

    runtime:
      Object.freeze({
        resolveActor:
          resolveCanonicalPersonForAccount,

        serverTimestamp:
          () =>
            FieldValue
              .serverTimestamp(),
      }),
  });
}

async function reactivateContributionLedgerEntry({
  db,
  actorUid,
  ledgerId,
  operationId,
  candidate,
}) {
  return reactivateContributionLedgerEntryCore({
    db,
    actorUid,
    ledgerId,
    operationId,
    candidate,

    runtime:
      Object.freeze({
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
  REVERSAL_WRITER_IMPLEMENTATION_VERSION,
  reverseContributionLedgerEntry,
  reactivateContributionLedgerEntry,
  confirmActiveContributionLedgerEntry,
  assertLedgerMatchesCandidateSemanticIdentity,

  _test:
    Object.freeze({
      buildReversedLedgerRecord,
      buildReactivatedLedgerRecord,
      assertReactivationMatchesCandidate,
      assertLedgerMatchesCandidateSemanticIdentity,

      ...(
        process.env.NODE_ENV ===
          "test" ||
        Boolean(
          process.env.NODE_TEST_CONTEXT
        )
          ? {
              reverseContributionLedgerEntryCore,
              reactivateContributionLedgerEntryCore,
            }
          : {}
      ),
    }),
};