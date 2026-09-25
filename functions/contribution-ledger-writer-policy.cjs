"use strict";

const LEDGER_WRITER_POLICY_VERSION =
  "1.0.0";

const LEDGER_WRITER_STATUS =
  "DEFINED_NOT_ACTIVATED";

const LEDGER_COLLECTION =
  "contributionLedger";

const AUDIT_COLLECTION =
  "logs";

const LEDGER_WRITER_POLICY =
  Object.freeze({
    policyVersion:
      LEDGER_WRITER_POLICY_VERSION,

    status:
      LEDGER_WRITER_STATUS,

    ledgerCollection:
      LEDGER_COLLECTION,

    auditCollection:
      AUDIT_COLLECTION,

    runtimePostingEnabled:
      false,

    runtimeScoringEnabled:
      false,

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

    transactionRequired:
      true,

    deterministicLedgerIdRequired:
      true,

    idempotencyRequired:
      true,

    auditLogRequired:
      true,

    serverTimestampRequired:
      true,

    reversalSupportRequired:
      true,

    intendedWriteSet:
      Object.freeze([
        LEDGER_COLLECTION,
        AUDIT_COLLECTION,
      ]),

    activationRequirements:
      Object.freeze([
        "RULE_STATUS_ACTIVE",
        "RULE_RUNTIME_SCORING_ENABLED",
        "EXPLICIT_WRITER_ACTIVATION",
      ]),
  });

function assertLedgerWriterPolicyInactive() {
  if (
    LEDGER_WRITER_POLICY.status !==
      "DEFINED_NOT_ACTIVATED"
  ) {
    throw new Error(
      "LEDGER_WRITER_POLICY_ALREADY_ACTIVE"
    );
  }

  if (
    LEDGER_WRITER_POLICY
      .runtimePostingEnabled !== false
  ) {
    throw new Error(
      "LEDGER_RUNTIME_POSTING_ALREADY_ENABLED"
    );
  }

  if (
    LEDGER_WRITER_POLICY
      .runtimeScoringEnabled !== false
  ) {
    throw new Error(
      "LEDGER_RUNTIME_SCORING_ALREADY_ENABLED"
    );
  }

  if (
    LEDGER_WRITER_POLICY
      .contributionCandidatePersistenceEnabled !==
      false
  ) {
    throw new Error(
      "CANDIDATE_PERSISTENCE_ALREADY_ENABLED"
    );
  }

  if (
    LEDGER_WRITER_POLICY
      .performanceSummaryWriteEnabled !== false
  ) {
    throw new Error(
      "PERFORMANCE_SUMMARY_WRITE_ALREADY_ENABLED"
    );
  }

  return true;
}

module.exports = {
  LEDGER_WRITER_POLICY_VERSION,
  LEDGER_WRITER_STATUS,
  LEDGER_COLLECTION,
  AUDIT_COLLECTION,
  LEDGER_WRITER_POLICY,
  assertLedgerWriterPolicyInactive,
};