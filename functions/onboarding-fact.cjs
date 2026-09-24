"use strict";

const {
  createHash,
} =
  require("node:crypto");

const ONBOARDING_FACT_SCHEMA_VERSION =
  "1.0.0";

const ONBOARDING_FACT_ID_VERSION =
  "1";

const ONBOARDING_PROGRAM_VERSION =
  "1.0.0";

const ONBOARDING_STATUSES =
  Object.freeze({
    COMPLETED:
      "completed",
  });

const ONBOARDING_DELIVERY_MODES =
  Object.freeze({
    SELF_SERVICE:
      "SELF_SERVICE",

    ASSISTED:
      "ASSISTED",
  });

const ONBOARDING_CRITERIA =
  Object.freeze([
    "responsibleKnown",
    "structureKnown",
    "localityKnown",
    "responsibilitiesUnderstood",
    "optionalActivitiesExplained",
    "preferenceCommitmentDistinctionUnderstood",
    "performanceEvaluationExplained",
    "helpAvailable",
  ]);

function requireToken(
  value,
  label
) {
  if (
    typeof value !==
      "string" ||
    value.trim() ===
      ""
  ) {
    throw new Error(
      label +
      "_REQUIRED"
    );
  }

  return value.trim();
}

function requireObject(
  value,
  code
) {
  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(
      value
    )
  ) {
    throw new Error(
      code
    );
  }

  return value;
}

function canonicalOnboardingFactDocumentId({
  campaignId,
  personId,
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

  return createHash(
    "sha256"
  )
    .update(
      JSON.stringify([
        "terra-onboarding-fact",
        ONBOARDING_FACT_ID_VERSION,
        campaign,
        person,
      ])
    )
    .digest(
      "hex"
    );
}

function validateDeliveryMode(
  value
) {
  const mode =
    requireToken(
      value,
      "ONBOARDING_DELIVERY_MODE"
    );

  if (
    !Object.values(
      ONBOARDING_DELIVERY_MODES
    ).includes(
      mode
    )
  ) {
    throw new Error(
      "INVALID_ONBOARDING_DELIVERY_MODE"
    );
  }

  return mode;
}

function validateCriteria(
  criteria
) {
  requireObject(
    criteria,
    "INVALID_ONBOARDING_CRITERIA"
  );

  const normalized =
    {};

  for (
    const criterion of
      ONBOARDING_CRITERIA
  ) {
    if (
      criteria[
        criterion
      ] !== true
    ) {
      throw new Error(
        "ONBOARDING_CRITERION_NOT_COMPLETED:" +
        criterion
      );
    }

    normalized[
      criterion
    ] =
      true;
  }

  return Object.freeze(
    normalized
  );
}

function validateCompletedOnboardingFact({
  onboardingFactId,
  onboardingFact,
}) {
  const fact =
    requireObject(
      onboardingFact,
      "INVALID_ONBOARDING_FACT"
    );

  const campaignId =
    requireToken(
      fact.campaignId,
      "CAMPAIGN_ID"
    );

  const personId =
    requireToken(
      fact.personId,
      "PERSON_ID"
    );

  const completedByPersonId =
    requireToken(
      fact.completedByPersonId,
      "COMPLETED_BY_PERSON_ID"
    );

  const status =
    requireToken(
      fact.status,
      "ONBOARDING_STATUS"
    );

  if (
    status !==
    ONBOARDING_STATUSES
      .COMPLETED
  ) {
    throw new Error(
      "ONBOARDING_NOT_COMPLETED"
    );
  }

  const deliveryMode =
    validateDeliveryMode(
      fact.deliveryMode
    );

  const programVersion =
    requireToken(
      fact.programVersion,
      "ONBOARDING_PROGRAM_VERSION"
    );

  if (
    programVersion !==
    ONBOARDING_PROGRAM_VERSION
  ) {
    throw new Error(
      "ONBOARDING_PROGRAM_VERSION_MISMATCH"
    );
  }

  if (
    fact.completedAt ===
      null ||
    fact.completedAt ===
      undefined
  ) {
    throw new Error(
      "ONBOARDING_COMPLETED_AT_REQUIRED"
    );
  }

  const criteria =
    validateCriteria(
      fact.criteria
    );

  const canonicalId =
    canonicalOnboardingFactDocumentId({
      campaignId,
      personId,
    });

  const suppliedId =
    requireToken(
      onboardingFactId,
      "ONBOARDING_FACT_ID"
    );

  if (
    suppliedId !==
    canonicalId
  ) {
    throw new Error(
      "ONBOARDING_FACT_ID_NOT_CANONICAL"
    );
  }

  if (
    fact.id !==
      undefined &&
    fact.id !==
      null &&
    requireToken(
      fact.id,
      "ONBOARDING_FACT_EMBEDDED_ID"
    ) !==
      canonicalId
  ) {
    throw new Error(
      "ONBOARDING_FACT_EMBEDDED_ID_MISMATCH"
    );
  }

  return Object.freeze({
    schemaVersion:
      ONBOARDING_FACT_SCHEMA_VERSION,

    id:
      canonicalId,

    campaignId,

    personId,

    completedByPersonId,

    status,

    deliveryMode,

    programVersion,

    completedAt:
      fact.completedAt,

    criteria,

    runtimeScoringEnabled:
      false,
  });
}

module.exports = {
  ONBOARDING_FACT_SCHEMA_VERSION,
  ONBOARDING_FACT_ID_VERSION,
  ONBOARDING_PROGRAM_VERSION,
  ONBOARDING_STATUSES,
  ONBOARDING_DELIVERY_MODES,
  ONBOARDING_CRITERIA,
  canonicalOnboardingFactDocumentId,
  validateCompletedOnboardingFact,
};
