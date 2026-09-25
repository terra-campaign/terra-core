"use strict";

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
  LEDGER_WRITER_POLICY,
} =
  require(
    "./contribution-ledger-writer-policy.cjs"
  );

const {
  AUTHORIZATION_STATUS,
  assertContributionPostingAuthorized,
} =
  require(
    "./contribution-posting-authorization.cjs"
  );

const {
  CANDIDATE_ACTIVATION_POLICY,
  assertCandidateActivationPolicyInactive,
  activateContributionCandidateForPosting,
} =
  require(
    "./contribution-candidate-posting-activation.cjs"
  );

function canonicalMissionCandidate() {
  const mission = {
    id:
      "MISSION-001",

    campaignId:
      "CAM-001",

    assignedTo:
      "UID-001",

    activityCode:
      "TERRITORIAL_BRIGADE",

    activityCatalogVersion:
      "1.0.0",
  };

  const evidence = {
    id:
      "EVIDENCE-001",

    missionId:
      "MISSION-001",

    campaignId:
      "CAM-001",

    uploadedBy:
      "UID-001",

    evidenceURL:
      "https://example.test/evidence",

    createdAt:
      "2026-09-25T12:00:00.000Z",
  };

  const review = {
    missionId:
      "MISSION-001",

    campaignId:
      "CAM-001",

    evidenceId:
      "EVIDENCE-001",

    subjectId:
      "UID-001",

    status:
      "validated",

    pendingAppeal:
      false,
  };

  const canonicalIdentity = {
    accountUid:
      "UID-001",

    personId:
      "PERSON-001",

    campaignId:
      "CAM-001",
  };

  return buildMissionContributionCandidate({
    mission,
    evidence,
    review,
    reviewId:
      "EVIDENCE-001",

    canonicalIdentity,
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
  const rule =
    getContributionRule(
      candidate.activityCode
    );

  return Object.freeze({
    ...rule,

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

test(
  "production candidate activation policy remains inactive",
  () => {
    assert.equal(
      assertCandidateActivationPolicyInactive(),
      true
    );

    assert.equal(
      CANDIDATE_ACTIVATION_POLICY
        .runtimeCandidateActivationEnabled,
      false
    );

    assert.equal(
      CANDIDATE_ACTIVATION_POLICY
        .clientActivationAllowed,
      false
    );

    assert.equal(
      CANDIDATE_ACTIVATION_POLICY
        .candidatePersistenceAllowed,
      false
    );
  }
);

test(
  "canonical candidate is blocked by inactive activation policy",
  () => {
    const candidate =
      canonicalMissionCandidate();

    assert.throws(
      () =>
        activateContributionCandidateForPosting({
          candidate,
        }),

      /CANDIDATE_ACTIVATION_POLICY_NOT_ACTIVE/
    );
  }
);

test(
  "activation creates a new frozen runtime view without mutating canonical candidate",
  () => {
    const candidate =
      canonicalMissionCandidate();

    const result =
      activateContributionCandidateForPosting({
        candidate,

        activationPolicy:
          activeActivationPolicy(),
      });

    assert.notEqual(
      result.candidate,
      candidate
    );

    assert.equal(
      candidate.runtimePostingEnabled,
      false
    );

    assert.equal(
      result.candidate.runtimePostingEnabled,
      true
    );

    assert.equal(
      result.candidate.candidateId,
      candidate.candidateId
    );

    assert.equal(
      result.candidate.ledgerDraft,
      candidate.ledgerDraft
    );

    assert.equal(
      result.candidate
        .ledgerDraft
        .runtimeScoringEnabled,
      false
    );

    assert.equal(
      Object.isFrozen(
        result.candidate
      ),
      true
    );

    assert.equal(
      Object.isFrozen(
        result.activation
      ),
      true
    );

    assert.equal(
      result.activation.persisted,
      false
    );
  }
);

test(
  "already runtime-enabled candidate cannot be activated again",
  () => {
    const canonical =
      canonicalMissionCandidate();

    const alreadyEnabled =
      Object.freeze({
        ...canonical,

        runtimePostingEnabled:
          true,
      });

    assert.throws(
      () =>
        activateContributionCandidateForPosting({
          candidate:
            alreadyEnabled,

          activationPolicy:
            activeActivationPolicy(),
        }),

      /CONTRIBUTION_CANDIDATE_NOT_LOCKED/
    );
  }
);

test(
  "client activation permission is always rejected",
  () => {
    const candidate =
      canonicalMissionCandidate();

    const unsafePolicy =
      Object.freeze({
        ...activeActivationPolicy(),

        clientActivationAllowed:
          true,
      });

    assert.throws(
      () =>
        activateContributionCandidateForPosting({
          candidate,

          activationPolicy:
            unsafePolicy,
        }),

      /CLIENT_CANDIDATE_ACTIVATION_MUST_REMAIN_DISABLED/
    );
  }
);

test(
  "activated candidate persistence permission is rejected",
  () => {
    const candidate =
      canonicalMissionCandidate();

    const unsafePolicy =
      Object.freeze({
        ...activeActivationPolicy(),

        candidatePersistenceAllowed:
          true,
      });

    assert.throws(
      () =>
        activateContributionCandidateForPosting({
          candidate,

          activationPolicy:
            unsafePolicy,
        }),

      /ACTIVATED_CANDIDATE_PERSISTENCE_MUST_REMAIN_DISABLED/
    );
  }
);

test(
  "noncanonical unfrozen candidate cannot cross activation boundary",
  () => {
    const canonical =
      canonicalMissionCandidate();

    const mutableClone = {
      ...canonical,
    };

    assert.throws(
      () =>
        activateContributionCandidateForPosting({
          candidate:
            mutableClone,

          activationPolicy:
            activeActivationPolicy(),
        }),

      /CONTRIBUTION_CANDIDATE_NOT_CANONICAL_FROZEN/
    );
  }
);

test(
  "activated candidate still requires posting authorization gate",
  () => {
    const canonical =
      canonicalMissionCandidate();

    const activated =
      activateContributionCandidateForPosting({
        candidate:
          canonical,

        activationPolicy:
          activeActivationPolicy(),
      });

    assert.throws(
      () =>
        assertContributionPostingAuthorized({
          candidate:
            activated.candidate,

          rule:
            getContributionRule(
              canonical.activityCode
            ),

          policy:
            LEDGER_WRITER_POLICY,
        }),

      /CONTRIBUTION_RULE_NOT_ACTIVE/
    );
  }
);

test(
  "synthetic full activation can cross gate without activating production constants",
  () => {
    const canonical =
      canonicalMissionCandidate();

    const activated =
      activateContributionCandidateForPosting({
        candidate:
          canonical,

        activationPolicy:
          activeActivationPolicy(),
      });

    const authorization =
      assertContributionPostingAuthorized({
        candidate:
          activated.candidate,

        rule:
          activeRuleFor(
            canonical
          ),

        policy:
          activeWriterPolicy(),
      });

    assert.equal(
      authorization.authorizationStatus,
      AUTHORIZATION_STATUS.AUTHORIZED
    );

    assert.equal(
      authorization.candidateId,
      canonical.candidateId
    );

    assert.equal(
      canonical.runtimePostingEnabled,
      false
    );

    assert.equal(
      CANDIDATE_ACTIVATION_POLICY
        .runtimeCandidateActivationEnabled,
      false
    );

    assert.equal(
      LEDGER_WRITER_POLICY
        .runtimePostingEnabled,
      false
    );

    assert.equal(
      getContributionRule(
        canonical.activityCode
      ).runtimeScoringEnabled,
      false
    );
  }
);

test(
  "activation policy is immutable",
  () => {
    assert.equal(
      Object.isFrozen(
        CANDIDATE_ACTIVATION_POLICY
      ),
      true
    );

    assert.throws(
      () => {
        CANDIDATE_ACTIVATION_POLICY
          .runtimeCandidateActivationEnabled =
          true;
      },

      TypeError
    );
  }
);