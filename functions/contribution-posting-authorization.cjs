"use strict";

const {
  CANDIDATE_STATUSES,
} =
  require(
    "./contribution-candidate.cjs"
  );

const {
  LEDGER_STATUSES,
} =
  require(
    "./contribution-ledger.cjs"
  );

const {
  RULE_STATUSES,
} =
  require(
    "./contribution-rules-v1.cjs"
  );

const AUTHORIZATION_SCHEMA_VERSION =
  "1.0.0";

const AUTHORIZATION_STATUS =
  Object.freeze({
    AUTHORIZED:
      "AUTHORIZED",

    BLOCKED:
      "BLOCKED",
  });

function requireObject(
  value,
  code
) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new Error(code);
  }

  return value;
}

function assertSame(
  actual,
  expected,
  code
) {
  if (actual !== expected) {
    throw new Error(code);
  }
}

function assertCandidateLedgerConsistency({
  candidate,
  ledgerDraft,
}) {
  assertSame(
    ledgerDraft.campaignId,
    candidate.campaignId,
    "CANDIDATE_LEDGER_CAMPAIGN_MISMATCH"
  );

  assertSame(
    ledgerDraft.personId,
    candidate.personId,
    "CANDIDATE_LEDGER_PERSON_MISMATCH"
  );

  assertSame(
    ledgerDraft.activityCode,
    candidate.activityCode,
    "CANDIDATE_LEDGER_ACTIVITY_MISMATCH"
  );

  assertSame(
    ledgerDraft.sourceType,
    candidate.sourceType,
    "CANDIDATE_LEDGER_SOURCE_TYPE_MISMATCH"
  );

  assertSame(
    ledgerDraft.sourceId,
    candidate.sourceId,
    "CANDIDATE_LEDGER_SOURCE_ID_MISMATCH"
  );

  assertSame(
    ledgerDraft.scoreDimension,
    candidate.scoreDimension,
    "CANDIDATE_LEDGER_SCORE_DIMENSION_MISMATCH"
  );

  assertSame(
    ledgerDraft.points,
    candidate.points,
    "CANDIDATE_LEDGER_POINTS_MISMATCH"
  );

  assertSame(
    ledgerDraft.occurredAt,
    candidate.occurredAt,
    "CANDIDATE_LEDGER_OCCURRED_AT_MISMATCH"
  );

  assertSame(
    ledgerDraft.evidenceRef,
    candidate.evidenceRef,
    "CANDIDATE_LEDGER_EVIDENCE_REF_MISMATCH"
  );

  return true;
}

function assertRuleConsistency({
  candidate,
  ledgerDraft,
  rule,
}) {
  assertSame(
    rule.activityCode,
    candidate.activityCode,
    "CANDIDATE_RULE_ACTIVITY_MISMATCH"
  );

  assertSame(
    rule.sourceType,
    candidate.sourceType,
    "CANDIDATE_RULE_SOURCE_TYPE_MISMATCH"
  );

  assertSame(
    rule.scoreDimension,
    candidate.scoreDimension,
    "CANDIDATE_RULE_SCORE_DIMENSION_MISMATCH"
  );

  assertSame(
    ledgerDraft.ruleId,
    rule.ruleId,
    "LEDGER_RULE_ID_MISMATCH"
  );

  assertSame(
    ledgerDraft.scoreRuleVersion,
    rule.ruleVersion,
    "LEDGER_RULE_VERSION_MISMATCH"
  );

  assertSame(
    ledgerDraft.ruleSetVersion,
    rule.ruleSetVersion,
    "LEDGER_RULE_SET_VERSION_MISMATCH"
  );

  return true;
}

function assertContributionPostingAuthorized({
  candidate,
  rule,
  policy,
}) {
  const checkedCandidate =
    requireObject(
      candidate,
      "INVALID_CONTRIBUTION_CANDIDATE"
    );

  const checkedRule =
    requireObject(
      rule,
      "INVALID_CONTRIBUTION_RULE"
    );

  const checkedPolicy =
    requireObject(
      policy,
      "INVALID_LEDGER_WRITER_POLICY"
    );

  if (
    checkedCandidate.candidateStatus !==
      CANDIDATE_STATUSES.ELIGIBLE_DRAFT
  ) {
    throw new Error(
      "CONTRIBUTION_CANDIDATE_NOT_ELIGIBLE"
    );
  }

  if (
    checkedCandidate.classificationRequired !==
      false
  ) {
    throw new Error(
      "CONTRIBUTION_CLASSIFICATION_INCOMPLETE"
    );
  }

  if (
    checkedCandidate.runtimePostingEnabled !==
      true
  ) {
    throw new Error(
      "CANDIDATE_RUNTIME_POSTING_DISABLED"
    );
  }

  const ledgerDraft =
    requireObject(
      checkedCandidate.ledgerDraft,
      "CANDIDATE_LEDGER_DRAFT_REQUIRED"
    );

  if (
    ledgerDraft.ledgerStatus !==
      LEDGER_STATUSES.DRAFT_NOT_POSTABLE
  ) {
    throw new Error(
      "INVALID_CANDIDATE_LEDGER_STATUS"
    );
  }

  if (
    ledgerDraft.runtimeScoringEnabled !==
      false
  ) {
    throw new Error(
      "CANDIDATE_LEDGER_ALREADY_SCORING"
    );
  }

  assertCandidateLedgerConsistency({
    candidate:
      checkedCandidate,

    ledgerDraft,
  });

  assertRuleConsistency({
    candidate:
      checkedCandidate,

    ledgerDraft,

    rule:
      checkedRule,
  });

  if (
    checkedRule.status !==
      RULE_STATUSES.ACTIVE
  ) {
    throw new Error(
      "CONTRIBUTION_RULE_NOT_ACTIVE"
    );
  }

  if (
    checkedRule.runtimeScoringEnabled !==
      true
  ) {
    throw new Error(
      "RULE_RUNTIME_SCORING_DISABLED"
    );
  }

  if (
    checkedPolicy.status !==
      "ACTIVE"
  ) {
    throw new Error(
      "LEDGER_WRITER_POLICY_NOT_ACTIVE"
    );
  }

  if (
    checkedPolicy.runtimePostingEnabled !==
      true
  ) {
    throw new Error(
      "LEDGER_RUNTIME_POSTING_DISABLED"
    );
  }

  if (
    checkedPolicy.runtimeScoringEnabled !==
      true
  ) {
    throw new Error(
      "LEDGER_RUNTIME_SCORING_DISABLED"
    );
  }

  if (
    checkedPolicy.clientWriteAllowed !==
      false
  ) {
    throw new Error(
      "CLIENT_LEDGER_WRITE_MUST_REMAIN_DISABLED"
    );
  }

  return Object.freeze({
    schemaVersion:
      AUTHORIZATION_SCHEMA_VERSION,

    authorizationStatus:
      AUTHORIZATION_STATUS.AUTHORIZED,

    candidateId:
      checkedCandidate.candidateId,

    ledgerId:
      ledgerDraft.ledgerId,

    campaignId:
      checkedCandidate.campaignId,

    personId:
      checkedCandidate.personId,

    activityCode:
      checkedCandidate.activityCode,

    sourceType:
      checkedCandidate.sourceType,

    sourceId:
      checkedCandidate.sourceId,

    scoreDimension:
      checkedCandidate.scoreDimension,

    points:
      checkedCandidate.points,

    ruleId:
      checkedRule.ruleId,

    ruleVersion:
      checkedRule.ruleVersion,

    ruleSetVersion:
      checkedRule.ruleSetVersion,

    policyVersion:
      checkedPolicy.policyVersion,
  });
}

module.exports = {
  AUTHORIZATION_SCHEMA_VERSION,
  AUTHORIZATION_STATUS,
  assertCandidateLedgerConsistency,
  assertRuleConsistency,
  assertContributionPostingAuthorized,
};