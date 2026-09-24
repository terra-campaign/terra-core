"use strict";

const {
  createHash,
} =
  require("node:crypto");

const {
  validateCompletedOnboardingFact,
} =
  require("./onboarding-fact.cjs");

const {
  SOURCE_TYPES,
} =
  require("./activity-catalog-v1.cjs");

const GROWTH_VALIDATION_SCHEMA_VERSION =
  "1.1.0";

const GROWTH_VALIDATION_ID_VERSION =
  "1";

const GROWTH_MILESTONES =
  Object.freeze({
    PERSON_MEMBERSHIP:
      "PERSON_MEMBERSHIP",

    ONBOARDING:
      "ONBOARDING",

    FIRST_VERIFIED_ACTIVITY:
      "FIRST_VERIFIED_ACTIVITY",
  });

const GROWTH_MILESTONE_POINTS =
  Object.freeze({
    [GROWTH_MILESTONES.PERSON_MEMBERSHIP]:
      5,

    [GROWTH_MILESTONES.ONBOARDING]:
      5,

    [GROWTH_MILESTONES.FIRST_VERIFIED_ACTIVITY]:
      8,
  });

const GROWTH_MAX_POINTS =
  Object.values(
    GROWTH_MILESTONE_POINTS
  ).reduce(
    (total, points) =>
      total + points,
    0
  );

const VERIFIED_ACTIVITY_SOURCE_TYPES =
  Object.freeze([
    SOURCE_TYPES.MISSION_VALIDATION,
    SOURCE_TYPES.ATTENDANCE_RECORD,
  ]);

function requireToken(
  value,
  fieldName
) {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    throw new Error(
      "INVALID_" +
      fieldName
    );
  }

  return value.trim();
}

function requireTrue(
  value,
  errorCode
) {
  if (value !== true) {
    throw new Error(
      errorCode
    );
  }

  return true;
}

function requireGrowthMilestone(
  value
) {
  const milestone =
    requireToken(
      value,
      "GROWTH_MILESTONE"
    );

  if (
    !Object.prototype.hasOwnProperty.call(
      GROWTH_MILESTONE_POINTS,
      milestone
    )
  ) {
    throw new Error(
      "UNKNOWN_GROWTH_MILESTONE"
    );
  }

  return milestone;
}

function canonicalGrowthValidationDocumentId({
  campaignId,
  personId,
  introducedByPersonId,
  milestone,
}) {
  const campaign =
    requireToken(
      campaignId,
      "CAMPAIGN_ID"
    );

  const person =
    requireToken(
      personId,
      "PERSON_ID"
    );

  const introducer =
    requireToken(
      introducedByPersonId,
      "INTRODUCED_BY_PERSON_ID"
    );

  const checkedMilestone =
    requireGrowthMilestone(
      milestone
    );

  return createHash("sha256")
    .update(
      JSON.stringify([
        "terra-growth-validation",
        GROWTH_VALIDATION_ID_VERSION,
        campaign,
        person,
        introducer,
        checkedMilestone,
      ])
    )
    .digest("hex");
}

function assertGrowthValidationSetPolicy(
  validations
) {
  if (
    !Array.isArray(validations) ||
    validations.length === 0
  ) {
    throw new Error(
      "INVALID_GROWTH_VALIDATION_SET"
    );
  }

  let campaignId =
    null;

  let subjectPersonId =
    null;

  let introducedByPersonId =
    null;

  let totalPoints =
    0;

  let allValidatedByIntroducer =
    true;

  const seenMilestones =
    new Set();

  for (
    const validation of validations
  ) {
    if (
      !validation ||
      typeof validation !== "object"
    ) {
      throw new Error(
        "INVALID_GROWTH_VALIDATION_SET_ITEM"
      );
    }

    if (
      validation.status !==
      "validated"
    ) {
      throw new Error(
        "GROWTH_VALIDATION_SET_NOT_FINAL"
      );
    }

    const currentCampaignId =
      requireToken(
        validation.campaignId,
        "CAMPAIGN_ID"
      );

    const currentSubjectPersonId =
      requireToken(
        validation.personId,
        "PERSON_ID"
      );

    const currentIntroducerPersonId =
      requireToken(
        validation.introducedByPersonId,
        "INTRODUCED_BY_PERSON_ID"
      );

    const currentValidatorPersonId =
      requireToken(
        validation.validatedByPersonId,
        "GROWTH_VALIDATOR_PERSON_ID"
      );

    const milestone =
      requireGrowthMilestone(
        validation.milestone
      );

    if (
      campaignId === null
    ) {
      campaignId =
        currentCampaignId;

      subjectPersonId =
        currentSubjectPersonId;

      introducedByPersonId =
        currentIntroducerPersonId;
    }

    if (
      campaignId !==
        currentCampaignId ||
      subjectPersonId !==
        currentSubjectPersonId ||
      introducedByPersonId !==
        currentIntroducerPersonId
    ) {
      throw new Error(
        "GROWTH_VALIDATION_SET_CONTEXT_MISMATCH"
      );
    }

    if (
      seenMilestones.has(
        milestone
      )
    ) {
      throw new Error(
        "DUPLICATE_GROWTH_MILESTONE_VALIDATION"
      );
    }

    seenMilestones.add(
      milestone
    );

    totalPoints +=
      GROWTH_MILESTONE_POINTS[
        milestone
      ];

    if (
      currentValidatorPersonId !==
      currentIntroducerPersonId
    ) {
      allValidatedByIntroducer =
        false;
    }
  }

  if (
    totalPoints ===
      GROWTH_MAX_POINTS &&
    allValidatedByIntroducer
  ) {
    throw new Error(
      "GROWTH_FULL_VALUE_CANNOT_BE_SELF_APPROVED"
    );
  }

  return Object.freeze({
    totalPoints,
    allValidatedByIntroducer,
  });
}

function assertVerifiedOperationalSource({
  sourceType,
  sourceId,
  personId,
}) {
  const checkedType =
    requireToken(
      sourceType,
      "VERIFIED_ACTIVITY_SOURCE_TYPE"
    );

  const checkedSourceId =
    requireToken(
      sourceId,
      "VERIFIED_ACTIVITY_SOURCE_ID"
    );

  const subjectPersonId =
    requireToken(
      personId,
      "PERSON_ID"
    );

  if (
    !VERIFIED_ACTIVITY_SOURCE_TYPES.includes(
      checkedType
    )
  ) {
    throw new Error(
      "GROWTH_VERIFIED_ACTIVITY_SOURCE_TYPE_NOT_ALLOWED"
    );
  }

  let requiredPrefix =
    null;

  if (
    checkedType ===
    SOURCE_TYPES.MISSION_VALIDATION
  ) {
    requiredPrefix =
      "mission:";
  }

  if (
    checkedType ===
    SOURCE_TYPES.ATTENDANCE_RECORD
  ) {
    requiredPrefix =
      "event-attendance:";
  }

  const requiredSuffix =
    ":person:" +
    subjectPersonId;

  const hasPayload =
    checkedSourceId.length >
    (
      requiredPrefix.length +
      requiredSuffix.length
    );

  if (
    !checkedSourceId.startsWith(
      requiredPrefix
    ) ||
    !checkedSourceId.endsWith(
      requiredSuffix
    ) ||
    !hasPayload
  ) {
    throw new Error(
      "GROWTH_VERIFIED_ACTIVITY_SOURCE_ID_INVALID"
    );
  }

  return true;
}

function validateGrowthMilestoneFact(
  growthValidation
) {
  if (
    !growthValidation ||
    typeof growthValidation !== "object"
  ) {
    throw new Error(
      "INVALID_GROWTH_VALIDATION"
    );
  }

  const milestone =
    requireGrowthMilestone(
      growthValidation.milestone
    );

  if (
    milestone ===
    GROWTH_MILESTONES.PERSON_MEMBERSHIP
  ) {
    requireTrue(
      growthValidation.personUnique,
      "GROWTH_PERSON_NOT_UNIQUE"
    );

    requireTrue(
      growthValidation.membershipCorrect,
      "GROWTH_MEMBERSHIP_NOT_CONFIRMED"
    );
  }

  if (
    milestone ===
    GROWTH_MILESTONES.ONBOARDING
  ) {
    if (
      typeof growthValidation.onboardingFactId !==
        "string" ||
      growthValidation.onboardingFactId.trim() ===
        "" ||
      !growthValidation.onboardingFact ||
      typeof growthValidation.onboardingFact !==
        "object"
    ) {
      throw new Error(
        "GROWTH_ONBOARDING_NOT_COMPLETED"
      );
    }

    const growthCampaignId =
      requireToken(
        growthValidation.campaignId,
        "CAMPAIGN_ID"
      );

    const growthPersonId =
      requireToken(
        growthValidation.personId,
        "PERSON_ID"
      );

    const onboardingFact =
      validateCompletedOnboardingFact({
        onboardingFactId:
          growthValidation.onboardingFactId,

        onboardingFact:
          growthValidation.onboardingFact,
      });

    if (
      onboardingFact.campaignId !==
        growthCampaignId ||
      onboardingFact.personId !==
        growthPersonId
    ) {
      throw new Error(
        "GROWTH_ONBOARDING_FACT_SUBJECT_MISMATCH"
      );
    }
  }

  if (
    milestone ===
    GROWTH_MILESTONES.FIRST_VERIFIED_ACTIVITY
  ) {
    requireTrue(
      growthValidation.firstVerifiedActivity,
      "GROWTH_FIRST_ACTIVITY_NOT_VERIFIED"
    );

    assertVerifiedOperationalSource({
      sourceType:
        growthValidation.verifiedActivitySourceType,

      sourceId:
        growthValidation.verifiedActivitySourceId,

      personId:
        growthValidation.personId,
    });
  }

  return Object.freeze({
    schemaVersion:
      GROWTH_VALIDATION_SCHEMA_VERSION,

    milestone,

    points:
      GROWTH_MILESTONE_POINTS[
        milestone
      ],
  });
}

module.exports = {
  GROWTH_VALIDATION_SCHEMA_VERSION,
  GROWTH_VALIDATION_ID_VERSION,
  GROWTH_MILESTONES,
  GROWTH_MILESTONE_POINTS,
  GROWTH_MAX_POINTS,
  VERIFIED_ACTIVITY_SOURCE_TYPES,
  canonicalGrowthValidationDocumentId,
  assertGrowthValidationSetPolicy,
  assertVerifiedOperationalSource,
  validateGrowthMilestoneFact,
};
