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

function activationFixture() {
  const candidate =
    canonicalMissionCandidate();

  const activeCandidate =
    Object.freeze({
      ...candidate,

      runtimePostingEnabled:
        true,
    });

  const currentRule =
    getContributionRule(
      activeCandidate.activityCode
    );

  const activeRule =
    Object.freeze({
      ...currentRule,

      status:
        RULE_STATUSES.ACTIVE,

      runtimeScoringEnabled:
        true,
    });

  const activePolicy =
    Object.freeze({
      ...LEDGER_WRITER_POLICY,

      status:
        "ACTIVE",

      runtimePostingEnabled:
        true,

      runtimeScoringEnabled:
        true,
    });

  return {
    candidate:
      activeCandidate,

    rule:
      activeRule,

    policy:
      activePolicy,
  };
}

test(
  "current canonical candidate is blocked by candidate runtime gate",
  () => {
    const candidate =
      canonicalMissionCandidate();

    const rule =
      getContributionRule(
        candidate.activityCode
      );

    assert.throws(
      () =>
        assertContributionPostingAuthorized({
          candidate,
          rule,
          policy:
            LEDGER_WRITER_POLICY,
        }),

      /CANDIDATE_RUNTIME_POSTING_DISABLED/
    );
  }
);

test(
  "candidate activation alone remains blocked by inactive rule",
  () => {
    const fixture =
      activationFixture();

    const currentRule =
      getContributionRule(
        fixture
          .candidate
          .activityCode
      );

    assert.throws(
      () =>
        assertContributionPostingAuthorized({
          candidate:
            fixture.candidate,

          rule:
            currentRule,

          policy:
            fixture.policy,
        }),

      /CONTRIBUTION_RULE_NOT_ACTIVE/
    );
  }
);

test(
  "candidate and rule activation remain blocked by inactive policy",
  () => {
    const fixture =
      activationFixture();

    assert.throws(
      () =>
        assertContributionPostingAuthorized({
          candidate:
            fixture.candidate,

          rule:
            fixture.rule,

          policy:
            LEDGER_WRITER_POLICY,
        }),

      /LEDGER_WRITER_POLICY_NOT_ACTIVE/
    );
  }
);

test(
  "all three explicit gates can authorize a pure descriptor",
  () => {
    const fixture =
      activationFixture();

    const result =
      assertContributionPostingAuthorized(
        fixture
      );

    assert.equal(
      result.authorizationStatus,
      AUTHORIZATION_STATUS.AUTHORIZED
    );

    assert.equal(
      result.candidateId,
      fixture
        .candidate
        .candidateId
    );

    assert.equal(
      result.ledgerId,
      fixture
        .candidate
        .ledgerDraft
        .ledgerId
    );

    assert.equal(
      result.personId,
      fixture
        .candidate
        .personId
    );

    assert.equal(
      result.points,
      fixture
        .candidate
        .points
    );

    assert.equal(
      Object.isFrozen(result),
      true
    );
  }
);

test(
  "candidate and ledger identity mismatch is rejected",
  () => {
    const fixture =
      activationFixture();

    const badCandidate = {
      ...fixture.candidate,

      personId:
        "PERSON-OTHER",
    };

    assert.throws(
      () =>
        assertContributionPostingAuthorized({
          candidate:
            badCandidate,

          rule:
            fixture.rule,

          policy:
            fixture.policy,
        }),

      /CANDIDATE_LEDGER_PERSON_MISMATCH/
    );
  }
);

test(
  "candidate and rule mismatch is rejected",
  () => {
    const fixture =
      activationFixture();

    const badRule =
      Object.freeze({
        ...fixture.rule,

        sourceType:
          "ATTENDANCE_RECORD",
      });

    assert.throws(
      () =>
        assertContributionPostingAuthorized({
          candidate:
            fixture.candidate,

          rule:
            badRule,

          policy:
            fixture.policy,
        }),

      /CANDIDATE_RULE_SOURCE_TYPE_MISMATCH/
    );
  }
);

test(
  "ledger draft cannot already have runtime scoring enabled",
  () => {
    const fixture =
      activationFixture();

    const badCandidate = {
      ...fixture.candidate,

      ledgerDraft:
        {
          ...fixture
            .candidate
            .ledgerDraft,

          runtimeScoringEnabled:
            true,
        },
    };

    assert.throws(
      () =>
        assertContributionPostingAuthorized({
          candidate:
            badCandidate,

          rule:
            fixture.rule,

          policy:
            fixture.policy,
        }),

      /CANDIDATE_LEDGER_ALREADY_SCORING/
    );
  }
);

test(
  "client ledger writes must remain disabled even after server activation",
  () => {
    const fixture =
      activationFixture();

    const unsafePolicy =
      Object.freeze({
        ...fixture.policy,

        clientWriteAllowed:
          true,
      });

    assert.throws(
      () =>
        assertContributionPostingAuthorized({
          candidate:
            fixture.candidate,

          rule:
            fixture.rule,

          policy:
            unsafePolicy,
        }),

      /CLIENT_LEDGER_WRITE_MUST_REMAIN_DISABLED/
    );
  }
);