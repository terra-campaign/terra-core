"use strict";

const test =
  require("node:test");

const assert =
  require("node:assert/strict");

const {
  CATALOG_VERSION,
  SOURCE_TYPES,
  POINT_MODES,
} =
  require("./activity-catalog-v1.cjs");

const {
  buildMissionSourceId,
  buildAttendanceSourceId,
} =
  require("./contribution-source.cjs");

const {
  GROWTH_MILESTONES,
  canonicalGrowthValidationDocumentId,
} =
  require("./growth-validation.cjs");

const {
  buildGrowthContributionCandidate,
} =
  require("./contribution-candidate.cjs");

function growthInput(
  overrides = {}
) {
  const fact = {
    campaignId:
      "CAM-001",

    personId:
      "PER-NEW",

    introducedByPersonId:
      "PER-INTRODUCER",

    status:
      "validated",

    validatedByPersonId:
      "PER-VALIDATOR",

    activityCatalogVersion:
      CATALOG_VERSION,

    milestone:
      GROWTH_MILESTONES.PERSON_MEMBERSHIP,

    personUnique:
      true,

    membershipCorrect:
      true,

    ...overrides,
  };

  const id =
    canonicalGrowthValidationDocumentId({
      campaignId:
        fact.campaignId,

      personId:
        fact.personId,

      introducedByPersonId:
        fact.introducedByPersonId,

      milestone:
        fact.milestone,
    });

  return {
    growthValidationId:
      id,

    growthValidation: {
      ...fact,
      id,
    },
  };
}

test(
  "person membership derives 5 points for introducer",
  () => {
    const candidate =
      buildGrowthContributionCandidate(
        growthInput()
      );

    assert.equal(
      candidate.personId,
      "PER-INTRODUCER"
    );

    assert.equal(
      candidate.points,
      5
    );

    assert.equal(
      candidate.activityCode,
      "ORGANIZATIONAL_GROWTH"
    );

    assert.equal(
      candidate.runtimePostingEnabled,
      false
    );
  }
);

test(
  "onboarding derives 5 points",
  () => {
    const candidate =
      buildGrowthContributionCandidate(
        growthInput({
          milestone:
            GROWTH_MILESTONES.ONBOARDING,

          onboardingCompleted:
            true,

          personUnique:
            undefined,

          membershipCorrect:
            undefined,
        })
      );

    assert.equal(
      candidate.points,
      5
    );
  }
);

test(
  "verified mission activity derives 8 points",
  () => {
    const sourceId =
      buildMissionSourceId({
        missionId:
          "MIS-001",

        personId:
          "PER-NEW",
      });

    const candidate =
      buildGrowthContributionCandidate(
        growthInput({
          milestone:
            GROWTH_MILESTONES.FIRST_VERIFIED_ACTIVITY,

          personUnique:
            undefined,

          membershipCorrect:
            undefined,

          firstVerifiedActivity:
            true,

          verifiedActivitySourceType:
            SOURCE_TYPES.MISSION_VALIDATION,

          verifiedActivitySourceId:
            sourceId,
        })
      );

    assert.equal(
      candidate.points,
      8
    );
  }
);

test(
  "growth draft remains maximum and non postable",
  () => {
    const candidate =
      buildGrowthContributionCandidate(
        growthInput()
      );

    assert.equal(
      candidate.ledgerDraft.ruleSnapshot.pointMode,
      POINT_MODES.MAXIMUM
    );

    assert.equal(
      candidate.ledgerDraft.ruleSnapshot.basePoints,
      18
    );

    assert.equal(
      candidate.ledgerDraft.ledgerStatus,
      "DRAFT_NOT_POSTABLE"
    );
  }
);

test(
  "single milestone may carry introducer as validator",
  () => {
    const candidate =
      buildGrowthContributionCandidate(
        growthInput({
          validatedByPersonId:
            "PER-INTRODUCER",
        })
      );

    assert.equal(
      candidate.points,
      5
    );

    assert.equal(
      candidate.runtimePostingEnabled,
      false
    );
  }
);

test(
  "arbitrary validation id is rejected",
  () => {
    const input =
      growthInput();

    input.growthValidationId =
      "ARBITRARY-ID";

    assert.throws(
      () =>
        buildGrowthContributionCandidate(
          input
        ),
      /GROWTH_VALIDATION_ID_NOT_CANONICAL/
    );
  }
);

test(
  "fake first activity source is rejected",
  () => {
    assert.throws(
      () =>
        buildGrowthContributionCandidate(
          growthInput({
            milestone:
              GROWTH_MILESTONES.FIRST_VERIFIED_ACTIVITY,

            personUnique:
              undefined,

            membershipCorrect:
              undefined,

            firstVerifiedActivity:
              true,

            verifiedActivitySourceType:
              "NOT_A_REAL_SOURCE_TYPE",

            verifiedActivitySourceId:
              "anything-at-all",
          })
        ),
      /GROWTH_VERIFIED_ACTIVITY_SOURCE_TYPE_NOT_ALLOWED/
    );
  }
);

test(
  "foreign person first activity source is rejected",
  () => {
    const sourceId =
      buildMissionSourceId({
        missionId:
          "MIS-001",

        personId:
          "PER-OTHER",
      });

    assert.throws(
      () =>
        buildGrowthContributionCandidate(
          growthInput({
            milestone:
              GROWTH_MILESTONES.FIRST_VERIFIED_ACTIVITY,

            personUnique:
              undefined,

            membershipCorrect:
              undefined,

            firstVerifiedActivity:
              true,

            verifiedActivitySourceType:
              SOURCE_TYPES.MISSION_VALIDATION,

            verifiedActivitySourceId:
              sourceId,
          })
        ),
      /GROWTH_VERIFIED_ACTIVITY_SOURCE_ID_INVALID/
    );
  }
);

test(
  "same logical milestone produces stable identity",
  () => {
    const first =
      buildGrowthContributionCandidate(
        growthInput()
      );

    const second =
      buildGrowthContributionCandidate(
        growthInput()
      );

    assert.equal(
      first.sourceId,
      second.sourceId
    );

    assert.equal(
      first.candidateId,
      second.candidateId
    );
  }
);

test(
  "three canonical milestones total 18",
  () => {
    const identity =
      buildGrowthContributionCandidate(
        growthInput()
      );

    const onboarding =
      buildGrowthContributionCandidate(
        growthInput({
          milestone:
            GROWTH_MILESTONES.ONBOARDING,

          onboardingCompleted:
            true,

          personUnique:
            undefined,

          membershipCorrect:
            undefined,
        })
      );

    const sourceId =
      buildAttendanceSourceId({
        eventId:
          "EVT-001",

        personId:
          "PER-NEW",
      });

    const activity =
      buildGrowthContributionCandidate(
        growthInput({
          milestone:
            GROWTH_MILESTONES.FIRST_VERIFIED_ACTIVITY,

          personUnique:
            undefined,

          membershipCorrect:
            undefined,

          firstVerifiedActivity:
            true,

          verifiedActivitySourceType:
            SOURCE_TYPES.ATTENDANCE_RECORD,

          verifiedActivitySourceId:
            sourceId,
        })
      );

    assert.equal(
      identity.points +
      onboarding.points +
      activity.points,
      18
    );
  }
);
