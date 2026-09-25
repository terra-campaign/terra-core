"use strict";

const assert =
  require("node:assert/strict");

const {
  test,
} =
  require("node:test");

const {
  LEDGER_WRITER_POLICY_VERSION,
  LEDGER_WRITER_STATUS,
  LEDGER_COLLECTION,
  AUDIT_COLLECTION,
  LEDGER_WRITER_POLICY,
  assertLedgerWriterPolicyInactive,
} =
  require(
    "./contribution-ledger-writer-policy.cjs"
  );

test(
  "ledger writer policy is versioned and inactive",
  () => {
    assert.equal(
      LEDGER_WRITER_POLICY_VERSION,
      "1.0.0"
    );

    assert.equal(
      LEDGER_WRITER_STATUS,
      "DEFINED_NOT_ACTIVATED"
    );

    assert.equal(
      LEDGER_WRITER_POLICY.status,
      "DEFINED_NOT_ACTIVATED"
    );

    assert.equal(
      assertLedgerWriterPolicyInactive(),
      true
    );
  }
);

test(
  "canonical future write set is ledger plus audit only",
  () => {
    assert.equal(
      LEDGER_COLLECTION,
      "contributionLedger"
    );

    assert.equal(
      AUDIT_COLLECTION,
      "logs"
    );

    assert.deepEqual(
      LEDGER_WRITER_POLICY
        .intendedWriteSet,
      [
        "contributionLedger",
        "logs",
      ]
    );

    assert.equal(
      Object.isFrozen(
        LEDGER_WRITER_POLICY
          .intendedWriteSet
      ),
      true
    );
  }
);

test(
  "runtime posting and scoring remain disabled",
  () => {
    assert.equal(
      LEDGER_WRITER_POLICY
        .runtimePostingEnabled,
      false
    );

    assert.equal(
      LEDGER_WRITER_POLICY
        .runtimeScoringEnabled,
      false
    );

    assert.equal(
      LEDGER_WRITER_POLICY
        .contributionCandidatePersistenceEnabled,
      false
    );

    assert.equal(
      LEDGER_WRITER_POLICY
        .performanceSummaryWriteEnabled,
      false
    );
  }
);

test(
  "future writer requires authenticated canonical server actor",
  () => {
    assert.equal(
      LEDGER_WRITER_POLICY
        .authenticatedActorRequired,
      true
    );

    assert.equal(
      LEDGER_WRITER_POLICY
        .canonicalActorRequired,
      true
    );

    assert.equal(
      LEDGER_WRITER_POLICY
        .clientWriteAllowed,
      false
    );
  }
);

test(
  "future writer requires atomic idempotent audited persistence",
  () => {
    assert.equal(
      LEDGER_WRITER_POLICY
        .transactionRequired,
      true
    );

    assert.equal(
      LEDGER_WRITER_POLICY
        .deterministicLedgerIdRequired,
      true
    );

    assert.equal(
      LEDGER_WRITER_POLICY
        .idempotencyRequired,
      true
    );

    assert.equal(
      LEDGER_WRITER_POLICY
        .auditLogRequired,
      true
    );

    assert.equal(
      LEDGER_WRITER_POLICY
        .serverTimestampRequired,
      true
    );
  }
);

test(
  "future writer preserves reversal support",
  () => {
    assert.equal(
      LEDGER_WRITER_POLICY
        .reversalSupportRequired,
      true
    );
  }
);

test(
  "activation requires explicit rule and writer gates",
  () => {
    assert.deepEqual(
      LEDGER_WRITER_POLICY
        .activationRequirements,
      [
        "RULE_STATUS_ACTIVE",
        "RULE_RUNTIME_SCORING_ENABLED",
        "EXPLICIT_WRITER_ACTIVATION",
      ]
    );

    assert.equal(
      Object.isFrozen(
        LEDGER_WRITER_POLICY
          .activationRequirements
      ),
      true
    );
  }
);

test(
  "writer policy object is immutable",
  () => {
    assert.equal(
      Object.isFrozen(
        LEDGER_WRITER_POLICY
      ),
      true
    );
  }
);