"use strict";

const {
  CANDIDATE_SCHEMA_VERSION,
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

const CANDIDATE_ACTIVATION_POLICY_VERSION =
  "1.0.0";

const CANDIDATE_ACTIVATION_POLICY_STATUS =
  "DEFINED_NOT_ACTIVATED";

const CANDIDATE_ACTIVATION_POLICY =
  Object.freeze({
    policyVersion:
      CANDIDATE_ACTIVATION_POLICY_VERSION,

    status:
      CANDIDATE_ACTIVATION_POLICY_STATUS,

    runtimeCandidateActivationEnabled:
      false,

    clientActivationAllowed:
      false,

    candidatePersistenceAllowed:
      false,

    activationScope:
      "SERVER_MEMORY_ONLY",

    canonicalEligibleDraftRequired:
      true,

    postingAuthorizationRequired:
      true,
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

function assertCanonicalLockedCandidate(
  candidate
) {
  const checkedCandidate =
    requireObject(
      candidate,
      "INVALID_CONTRIBUTION_CANDIDATE"
    );

  if (
    Object.isFrozen(
      checkedCandidate
    ) !== true
  ) {
    throw new Error(
      "CONTRIBUTION_CANDIDATE_NOT_CANONICAL_FROZEN"
    );
  }

  if (
    checkedCandidate.schemaVersion !==
      CANDIDATE_SCHEMA_VERSION
  ) {
    throw new Error(
      "CONTRIBUTION_CANDIDATE_SCHEMA_MISMATCH"
    );
  }

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
      false
  ) {
    throw new Error(
      "CONTRIBUTION_CANDIDATE_NOT_LOCKED"
    );
  }

  const ledgerDraft =
    requireObject(
      checkedCandidate.ledgerDraft,
      "CANDIDATE_LEDGER_DRAFT_REQUIRED"
    );

  if (
    Object.isFrozen(
      ledgerDraft
    ) !== true
  ) {
    throw new Error(
      "CANDIDATE_LEDGER_DRAFT_NOT_FROZEN"
    );
  }

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

  return checkedCandidate;
}

function assertCandidateActivationPolicyCanActivate(
  activationPolicy
) {
  const policy =
    requireObject(
      activationPolicy,
      "INVALID_CANDIDATE_ACTIVATION_POLICY"
    );

  if (
    policy.status !==
      "ACTIVE"
  ) {
    throw new Error(
      "CANDIDATE_ACTIVATION_POLICY_NOT_ACTIVE"
    );
  }

  if (
    policy.runtimeCandidateActivationEnabled !==
      true
  ) {
    throw new Error(
      "CANDIDATE_RUNTIME_ACTIVATION_DISABLED"
    );
  }

  if (
    policy.clientActivationAllowed !==
      false
  ) {
    throw new Error(
      "CLIENT_CANDIDATE_ACTIVATION_MUST_REMAIN_DISABLED"
    );
  }

  if (
    policy.candidatePersistenceAllowed !==
      false
  ) {
    throw new Error(
      "ACTIVATED_CANDIDATE_PERSISTENCE_MUST_REMAIN_DISABLED"
    );
  }

  if (
    policy.activationScope !==
      "SERVER_MEMORY_ONLY"
  ) {
    throw new Error(
      "INVALID_CANDIDATE_ACTIVATION_SCOPE"
    );
  }

  if (
    policy.canonicalEligibleDraftRequired !==
      true
  ) {
    throw new Error(
      "CANONICAL_ELIGIBLE_DRAFT_REQUIREMENT_DISABLED"
    );
  }

  if (
    policy.postingAuthorizationRequired !==
      true
  ) {
    throw new Error(
      "POSTING_AUTHORIZATION_REQUIREMENT_DISABLED"
    );
  }

  return policy;
}

function activateContributionCandidateForPosting({
  candidate,
  activationPolicy =
    CANDIDATE_ACTIVATION_POLICY,
}) {
  const checkedCandidate =
    assertCanonicalLockedCandidate(
      candidate
    );

  const checkedPolicy =
    assertCandidateActivationPolicyCanActivate(
      activationPolicy
    );

  const activatedCandidate =
    Object.freeze({
      ...checkedCandidate,

      runtimePostingEnabled:
        true,
  });

  if (
    checkedCandidate.runtimePostingEnabled !==
      false
  ) {
    throw new Error(
      "ORIGINAL_CANDIDATE_MUTATED"
    );
  }

  if (
    activatedCandidate.ledgerDraft !==
      checkedCandidate.ledgerDraft
  ) {
    throw new Error(
      "LEDGER_DRAFT_IDENTITY_CHANGED"
    );
  }

  return Object.freeze({
    candidate:
      activatedCandidate,

    activation:
      Object.freeze({
        policyVersion:
          checkedPolicy.policyVersion,

        activationScope:
          checkedPolicy.activationScope,

        persisted:
          false,

        clientAuthorized:
          false,

        postingAuthorizationRequired:
          true,
      }),
  });
}

function assertCandidateActivationPolicyInactive() {
  if (
    CANDIDATE_ACTIVATION_POLICY.status !==
      "DEFINED_NOT_ACTIVATED"
  ) {
    throw new Error(
      "CANDIDATE_ACTIVATION_POLICY_ALREADY_ACTIVE"
    );
  }

  if (
    CANDIDATE_ACTIVATION_POLICY
      .runtimeCandidateActivationEnabled !==
      false
  ) {
    throw new Error(
      "CANDIDATE_RUNTIME_ACTIVATION_ALREADY_ENABLED"
    );
  }

  if (
    CANDIDATE_ACTIVATION_POLICY
      .clientActivationAllowed !==
      false
  ) {
    throw new Error(
      "CLIENT_CANDIDATE_ACTIVATION_ALREADY_ENABLED"
    );
  }

  if (
    CANDIDATE_ACTIVATION_POLICY
      .candidatePersistenceAllowed !==
      false
  ) {
    throw new Error(
      "CANDIDATE_PERSISTENCE_ALREADY_ENABLED"
    );
  }

  return true;
}

module.exports = {
  CANDIDATE_ACTIVATION_POLICY_VERSION,
  CANDIDATE_ACTIVATION_POLICY_STATUS,
  CANDIDATE_ACTIVATION_POLICY,
  assertCanonicalLockedCandidate,
  assertCandidateActivationPolicyCanActivate,
  activateContributionCandidateForPosting,
  assertCandidateActivationPolicyInactive,
};