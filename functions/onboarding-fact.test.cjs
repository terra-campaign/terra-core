"use strict";

const test =
  require(
    "node:test"
  );

const assert =
  require(
    "node:assert/strict"
  );

const {
  ONBOARDING_FACT_SCHEMA_VERSION,
  ONBOARDING_PROGRAM_VERSION,
  ONBOARDING_STATUSES,
  ONBOARDING_DELIVERY_MODES,
  ONBOARDING_CRITERIA,
  canonicalOnboardingFactDocumentId,
  validateCompletedOnboardingFact,
} =
  require(
    "./onboarding-fact.cjs"
  );

function allCriteria() {
  return Object.fromEntries(
    ONBOARDING_CRITERIA.map(
      criterion => [
        criterion,
        true,
      ]
    )
  );
}

function fact({
  campaignId =
    "CAM-001",

  personId =
    "PER-001",

  completedByPersonId =
    "PER-RESPONSIBLE",

  deliveryMode =
    ONBOARDING_DELIVERY_MODES
      .ASSISTED,

  criteria =
    allCriteria(),

  status =
    ONBOARDING_STATUSES
      .COMPLETED,

  programVersion =
    ONBOARDING_PROGRAM_VERSION,

  completedAt =
    "2026-09-24T00:00:00.000Z",
} = {}) {
  const id =
    canonicalOnboardingFactDocumentId({
      campaignId,
      personId,
    });

  return {
    id,

    onboardingFact: {
      id,
      campaignId,
      personId,
      completedByPersonId,
      deliveryMode,
      criteria,
      status,
      programVersion,
      completedAt,
    },
  };
}

test(
  "canonical onboarding fact id is deterministic",
  () => {
    const a =
      canonicalOnboardingFactDocumentId({
        campaignId:
          "CAM-001",

        personId:
          "PER-001",
      });

    const b =
      canonicalOnboardingFactDocumentId({
        campaignId:
          "CAM-001",

        personId:
          "PER-001",
      });

    assert.equal(
      a,
      b
    );

    assert.match(
      a,
      /^[a-f0-9]{64}$/
    );
  }
);

test(
  "canonical onboarding identity changes with campaign or person",
  () => {
    const base =
      canonicalOnboardingFactDocumentId({
        campaignId:
          "CAM-001",

        personId:
          "PER-001",
      });

    const otherCampaign =
      canonicalOnboardingFactDocumentId({
        campaignId:
          "CAM-002",

        personId:
          "PER-001",
      });

    const otherPerson =
      canonicalOnboardingFactDocumentId({
        campaignId:
          "CAM-001",

        personId:
          "PER-002",
      });

    assert.notEqual(
      base,
      otherCampaign
    );

    assert.notEqual(
      base,
      otherPerson
    );
  }
);

test(
  "completed assisted onboarding fact validates",
  () => {
    const input =
      fact();

    const result =
      validateCompletedOnboardingFact({
        onboardingFactId:
          input.id,

        onboardingFact:
          input.onboardingFact,
      });

    assert.equal(
      result.schemaVersion,
      ONBOARDING_FACT_SCHEMA_VERSION
    );

    assert.equal(
      result.status,
      "completed"
    );

    assert.equal(
      result.deliveryMode,
      "ASSISTED"
    );

    assert.equal(
      result.runtimeScoringEnabled,
      false
    );

    assert.equal(
      Object.keys(
        result.criteria
      ).length,
      8
    );
  }
);

test(
  "self service onboarding is valid",
  () => {
    const input =
      fact({
        personId:
          "PER-SELF",

        completedByPersonId:
          "PER-SELF",

        deliveryMode:
          ONBOARDING_DELIVERY_MODES
            .SELF_SERVICE,
      });

    const result =
      validateCompletedOnboardingFact({
        onboardingFactId:
          input.id,

        onboardingFact:
          input.onboardingFact,
      });

    assert.equal(
      result.personId,
      "PER-SELF"
    );

    assert.equal(
      result.completedByPersonId,
      "PER-SELF"
    );

    assert.equal(
      result.deliveryMode,
      "SELF_SERVICE"
    );
  }
);

test(
  "assisted onboarding can be completed by another person",
  () => {
    const input =
      fact({
        personId:
          "PER-NO-DIGITAL",

        completedByPersonId:
          "PER-RESPONSIBLE",

        deliveryMode:
          ONBOARDING_DELIVERY_MODES
            .ASSISTED,
      });

    const result =
      validateCompletedOnboardingFact({
        onboardingFactId:
          input.id,

        onboardingFact:
          input.onboardingFact,
      });

    assert.equal(
      result.personId,
      "PER-NO-DIGITAL"
    );

    assert.equal(
      result.completedByPersonId,
      "PER-RESPONSIBLE"
    );
  }
);

test(
  "incomplete criterion rejects onboarding completion",
  () => {
    const criteria =
      allCriteria();

    criteria.helpAvailable =
      false;

    const input =
      fact({
        criteria,
      });

    assert.throws(
      () =>
        validateCompletedOnboardingFact({
          onboardingFactId:
            input.id,

          onboardingFact:
            input.onboardingFact,
        }),
      /ONBOARDING_CRITERION_NOT_COMPLETED:helpAvailable/
    );
  }
);

test(
  "non completed status is rejected",
  () => {
    const input =
      fact({
        status:
          "in_progress",
      });

    assert.throws(
      () =>
        validateCompletedOnboardingFact({
          onboardingFactId:
            input.id,

          onboardingFact:
            input.onboardingFact,
        }),
      /ONBOARDING_NOT_COMPLETED/
    );
  }
);

test(
  "arbitrary onboarding fact id is rejected",
  () => {
    const input =
      fact();

    assert.throws(
      () =>
        validateCompletedOnboardingFact({
          onboardingFactId:
            "ARBITRARY-ID",

          onboardingFact:
            input.onboardingFact,
        }),
      /ONBOARDING_FACT_ID_NOT_CANONICAL/
    );
  }
);

test(
  "foreign embedded onboarding fact id is rejected",
  () => {
    const input =
      fact();

    assert.throws(
      () =>
        validateCompletedOnboardingFact({
          onboardingFactId:
            input.id,

          onboardingFact: {
            ...input.onboardingFact,

            id:
              "FOREIGN-ID",
          },
        }),
      /ONBOARDING_FACT_EMBEDDED_ID_MISMATCH/
    );
  }
);

test(
  "unknown delivery mode is rejected",
  () => {
    const input =
      fact({
        deliveryMode:
          "MAGIC_MODE",
      });

    assert.throws(
      () =>
        validateCompletedOnboardingFact({
          onboardingFactId:
            input.id,

          onboardingFact:
            input.onboardingFact,
        }),
      /INVALID_ONBOARDING_DELIVERY_MODE/
    );
  }
);

test(
  "completedAt is required",
  () => {
    const input =
      fact({
        completedAt:
          null,
      });

    assert.throws(
      () =>
        validateCompletedOnboardingFact({
          onboardingFactId:
            input.id,

          onboardingFact:
            input.onboardingFact,
        }),
      /ONBOARDING_COMPLETED_AT_REQUIRED/
    );
  }
);

test(
  "program version is explicit and guarded",
  () => {
    const input =
      fact({
        programVersion:
          "999",
      });

    assert.throws(
      () =>
        validateCompletedOnboardingFact({
          onboardingFactId:
            input.id,

          onboardingFact:
            input.onboardingFact,
        }),
      /ONBOARDING_PROGRAM_VERSION_MISMATCH/
    );
  }
);
