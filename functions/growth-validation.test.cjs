"use strict";

const test =
  require("node:test");

const assert =
  require("node:assert/strict");

const {
  SOURCE_TYPES,
} =
  require("./activity-catalog-v1.cjs");

const {
  buildMissionSourceId,
  buildAttendanceSourceId,
} =
  require("./contribution-source.cjs");

const {
  GROWTH_MILESTONES,
  GROWTH_MILESTONE_POINTS,
  GROWTH_MAX_POINTS,
  canonicalGrowthValidationDocumentId,
  assertGrowthValidationSetPolicy,
  assertVerifiedOperationalSource,
  validateGrowthMilestoneFact,
} =
  require("./growth-validation.cjs");

test(
  "growth milestones equal 5 + 5 + 8 = 18",
  () => {
    assert.equal(
      GROWTH_MILESTONE_POINTS[
        GROWTH_MILESTONES.PERSON_MEMBERSHIP
      ],
      5
    );

    assert.equal(
      GROWTH_MILESTONE_POINTS[
        GROWTH_MILESTONES.ONBOARDING
      ],
      5
    );

    assert.equal(
      GROWTH_MILESTONE_POINTS[
        GROWTH_MILESTONES.FIRST_VERIFIED_ACTIVITY
      ],
      8
    );

    assert.equal(
      GROWTH_MAX_POINTS,
      18
    );
  }
);

test(
  "growth validation id is deterministic",
  () => {
    const input = {
      campaignId:
        "CAM-001",

      personId:
        "PER-NEW",

      introducedByPersonId:
        "PER-INTRODUCER",

      milestone:
        GROWTH_MILESTONES.PERSON_MEMBERSHIP,
    };

    assert.equal(
      canonicalGrowthValidationDocumentId(
        input
      ),
      canonicalGrowthValidationDocumentId(
        input
      )
    );
  }
);

test(
  "one isolated milestone may be validated by introducer",
  () => {
    const result =
      assertGrowthValidationSetPolicy([
        {
          campaignId:
            "CAM-001",

          personId:
            "PER-NEW",

          introducedByPersonId:
            "PER-INTRODUCER",

          validatedByPersonId:
            "PER-INTRODUCER",

          status:
            "validated",

          milestone:
            GROWTH_MILESTONES
              .PERSON_MEMBERSHIP,
        },
      ]);

    assert.equal(
      result.totalPoints,
      5
    );

    assert.equal(
      result.allValidatedByIntroducer,
      true
    );
  }
);

test(
  "full 18 cannot be entirely self approved by introducer",
  () => {
    const make =
      milestone => ({
        campaignId:
          "CAM-001",

        personId:
          "PER-NEW",

        introducedByPersonId:
          "PER-INTRODUCER",

        validatedByPersonId:
          "PER-INTRODUCER",

        status:
          "validated",

        milestone,
      });

    assert.throws(
      () =>
        assertGrowthValidationSetPolicy([
          make(
            GROWTH_MILESTONES
              .PERSON_MEMBERSHIP
          ),

          make(
            GROWTH_MILESTONES
              .ONBOARDING
          ),

          make(
            GROWTH_MILESTONES
              .FIRST_VERIFIED_ACTIVITY
          ),
        ]),
      /GROWTH_FULL_VALUE_CANNOT_BE_SELF_APPROVED/
    );
  }
);

test(
  "full 18 is valid when not solely self approved",
  () => {
    const result =
      assertGrowthValidationSetPolicy([
        {
          campaignId:
            "CAM-001",

          personId:
            "PER-NEW",

          introducedByPersonId:
            "PER-INTRODUCER",

          validatedByPersonId:
            "PER-INTRODUCER",

          status:
            "validated",

          milestone:
            GROWTH_MILESTONES
              .PERSON_MEMBERSHIP,
        },

        {
          campaignId:
            "CAM-001",

          personId:
            "PER-NEW",

          introducedByPersonId:
            "PER-INTRODUCER",

          validatedByPersonId:
            "PER-VALIDATOR",

          status:
            "validated",

          milestone:
            GROWTH_MILESTONES
              .ONBOARDING,
        },

        {
          campaignId:
            "CAM-001",

          personId:
            "PER-NEW",

          introducedByPersonId:
            "PER-INTRODUCER",

          validatedByPersonId:
            "PER-INTRODUCER",

          status:
            "validated",

          milestone:
            GROWTH_MILESTONES
              .FIRST_VERIFIED_ACTIVITY,
        },
      ]);

    assert.equal(
      result.totalPoints,
      18
    );

    assert.equal(
      result.allValidatedByIntroducer,
      false
    );
  }
);

test(
  "fake verified source type is rejected",
  () => {
    assert.throws(
      () =>
        assertVerifiedOperationalSource({
          sourceType:
            "NOT_A_REAL_SOURCE_TYPE",

          sourceId:
            "anything",

          personId:
            "PER-NEW",
        }),
      /GROWTH_VERIFIED_ACTIVITY_SOURCE_TYPE_NOT_ALLOWED/
    );
  }
);

test(
  "mission source must belong to incorporated person",
  () => {
    const valid =
      buildMissionSourceId({
        missionId:
          "MIS-001",

        personId:
          "PER-NEW",
      });

    assert.equal(
      assertVerifiedOperationalSource({
        sourceType:
          SOURCE_TYPES.MISSION_VALIDATION,

        sourceId:
          valid,

        personId:
          "PER-NEW",
      }),
      true
    );

    const foreign =
      buildMissionSourceId({
        missionId:
          "MIS-001",

        personId:
          "PER-OTHER",
      });

    assert.throws(
      () =>
        assertVerifiedOperationalSource({
          sourceType:
            SOURCE_TYPES.MISSION_VALIDATION,

          sourceId:
            foreign,

          personId:
            "PER-NEW",
        }),
      /GROWTH_VERIFIED_ACTIVITY_SOURCE_ID_INVALID/
    );
  }
);

test(
  "attendance source can verify first activity",
  () => {
    const sourceId =
      buildAttendanceSourceId({
        eventId:
          "EVT-001",

        personId:
          "PER-NEW",
      });

    const result =
      validateGrowthMilestoneFact({
        milestone:
          GROWTH_MILESTONES.FIRST_VERIFIED_ACTIVITY,

        personId:
          "PER-NEW",

        firstVerifiedActivity:
          true,

        verifiedActivitySourceType:
          SOURCE_TYPES.ATTENDANCE_RECORD,

        verifiedActivitySourceId:
          sourceId,
      });

    assert.equal(
      result.points,
      8
    );
  }
);

test(
  "person membership milestone requires both facts",
  () => {
    const result =
      validateGrowthMilestoneFact({
        milestone:
          GROWTH_MILESTONES.PERSON_MEMBERSHIP,

        personUnique:
          true,

        membershipCorrect:
          true,
      });

    assert.equal(
      result.points,
      5
    );
  }
);

test(
  "onboarding milestone requires completion",
  () => {
    const result =
      validateGrowthMilestoneFact({
        milestone:
          GROWTH_MILESTONES.ONBOARDING,

        onboardingCompleted:
          true,
      });

    assert.equal(
      result.points,
      5
    );

    assert.throws(
      () =>
        validateGrowthMilestoneFact({
          milestone:
            GROWTH_MILESTONES.ONBOARDING,

          onboardingCompleted:
            false,
        }),
      /GROWTH_ONBOARDING_NOT_COMPLETED/
    );
  }
);
