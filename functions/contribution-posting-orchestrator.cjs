"use strict";

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
  postContributionLedgerEntry,
} =
  require(
    "./contribution-ledger-writer.cjs"
  );


const ORCHESTRATOR_VERSION =
  "1.0.0";

const ORCHESTRATION_STATUSES =
  Object.freeze({
    BLOCKED_NOT_ACTIVATED:
      "BLOCKED_NOT_ACTIVATED",

    POSTED:
      "POSTED",
  });


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


function requireToken(
  value,
  code
) {
  if (
    typeof value !==
      "string" ||
    !value.trim()
  ) {
    throw new Error(code);
  }

  return value.trim();
}


function safeToken(
  value
) {
  return (
    typeof value ===
      "string" &&
    value.trim()
  )
    ? value.trim()
    : null;
}


function inspectPostingReadiness({
  activationPolicy,
  writerPolicy,
}) {
  const activation =
    requireObject(
      activationPolicy,
      "ACTIVATION_POLICY_REQUIRED"
    );

  const writer =
    requireObject(
      writerPolicy,
      "WRITER_POLICY_REQUIRED"
    );

  const candidateActivationReady =
    activation.status ===
      "ACTIVE" &&
    activation
      .runtimeCandidateActivationEnabled ===
      true &&
    activation
      .clientActivationAllowed ===
      false &&
    activation
      .candidatePersistenceAllowed ===
      false &&
    activation.activationScope ===
      "SERVER_MEMORY_ONLY";

  const ledgerWriterReady =
    writer.status ===
      "ACTIVE" &&
    writer.runtimePostingEnabled ===
      true &&
    writer.runtimeScoringEnabled ===
      true &&
    writer
      .contributionCandidatePersistenceEnabled ===
      false &&
    writer
      .performanceSummaryWriteEnabled ===
      false &&
    writer.clientWriteAllowed ===
      false &&
    writer.authenticatedActorRequired ===
      true &&
    writer.canonicalActorRequired ===
      true;

  return Object.freeze({
    candidateActivationReady,
    ledgerWriterReady,

    policiesReady:
      candidateActivationReady &&
      ledgerWriterReady,

    activationPolicyStatus:
      safeToken(
        activation.status
      ),

    writerPolicyStatus:
      safeToken(
        writer.status
      ),
  });
}


function blockedResult({
  actorUid,
  candidate,
  readiness,
}) {
  return Object.freeze({
    orchestratorVersion:
      ORCHESTRATOR_VERSION,

    status:
      ORCHESTRATION_STATUSES
        .BLOCKED_NOT_ACTIVATED,

    reasonCode:
      "CONTRIBUTION_POSTING_NOT_ACTIVATED",

    actorUid,

    candidateId:
      safeToken(
        candidate.candidateId
      ),

    campaignId:
      safeToken(
        candidate.campaignId
      ),

    personId:
      safeToken(
        candidate.personId
      ),

    readiness,

    postingAttempted:
      false,

    contributionCandidatePersisted:
      false,

    ledgerWritten:
      false,

    pointsPosted:
      false,

    performanceSummaryWritten:
      false,

    runtimeScoringActivated:
      false,
  });
}


function postedResult({
  actorUid,
  candidate,
  readiness,
  posting,
}) {
  const result =
    requireObject(
      posting,
      "INVALID_LEDGER_POST_RESULT"
    );

  if (result.ok !== true) {
    throw new Error(
      "LEDGER_POST_NOT_CONFIRMED"
    );
  }

  return Object.freeze({
    orchestratorVersion:
      ORCHESTRATOR_VERSION,

    status:
      ORCHESTRATION_STATUSES
        .POSTED,

    reasonCode:
      null,

    actorUid,

    candidateId:
      safeToken(
        candidate.candidateId
      ),

    campaignId:
      safeToken(
        result.campaignId
      ),

    personId:
      safeToken(
        result.personId
      ),

    ledgerId:
      safeToken(
        result.ledgerId
      ),

    points:
      Number.isFinite(
        result.points
      )
        ? result.points
        : null,

    postedByPersonId:
      safeToken(
        result.postedByPersonId
      ),

    alreadyPosted:
      result.alreadyPosted ===
        true,

    readiness,

    postingAttempted:
      true,

    contributionCandidatePersisted:
      false,

    ledgerWritten:
      true,

    pointsPosted:
      true,

    performanceSummaryWritten:
      false,

    runtimeScoringActivated:
      true,
  });
}


async function orchestrateContributionPostingCore({
  db,
  actorUid,
  candidate,
  runtime,
}) {
  const uid =
    requireToken(
      actorUid,
      "ACTOR_UID_REQUIRED"
    );

  const checkedCandidate =
    requireObject(
      candidate,
      "CONTRIBUTION_CANDIDATE_REQUIRED"
    );

  const checkedRuntime =
    requireObject(
      runtime,
      "POSTING_RUNTIME_REQUIRED"
    );

  if (
    typeof checkedRuntime
      .postLedger !==
    "function"
  ) {
    throw new Error(
      "POSTING_LEDGER_WRITER_REQUIRED"
    );
  }

  const readiness =
    inspectPostingReadiness({
      activationPolicy:
        checkedRuntime
          .activationPolicy,

      writerPolicy:
        checkedRuntime
          .writerPolicy,
    });

  /*
   * BUILD-124 B4-B2B17 security boundary:
   *
   * Do not call the ledger writer while the official
   * activation policies remain inactive.
   *
   * This guarantees that introducing the orchestrator
   * cannot itself activate scoring or create ledger data.
   */
  if (!readiness.policiesReady) {
    return blockedResult({
      actorUid:
        uid,

      candidate:
        checkedCandidate,

      readiness,
    });
  }

  const posting =
    await checkedRuntime
      .postLedger({
        db,
        actorUid:
          uid,
        candidate:
          checkedCandidate,
      });

  return postedResult({
    actorUid:
      uid,

    candidate:
      checkedCandidate,

    readiness,

    posting,
  });
}


async function orchestrateContributionPosting({
  db,
  actorUid,
  candidate,
}) {
  /*
   * Production callers cannot inject activation policies,
   * writer policies or an alternate ledger writer.
   */
  return orchestrateContributionPostingCore({
    db,
    actorUid,
    candidate,

    runtime:
      Object.freeze({
        activationPolicy:
          CANDIDATE_ACTIVATION_POLICY,

        writerPolicy:
          LEDGER_WRITER_POLICY,

        postLedger:
          postContributionLedgerEntry,
      }),
  });
}


module.exports = {
  ORCHESTRATOR_VERSION,
  ORCHESTRATION_STATUSES,
  inspectPostingReadiness,
  orchestrateContributionPosting,

  _test:
    Object.freeze({
      requireObject,
      requireToken,
      safeToken,
      blockedResult,
      postedResult,

      ...(
        process.env.NODE_ENV ===
          "test"
          ? {
              orchestrateContributionPostingCore,
            }
          : {}
      ),
    }),
};