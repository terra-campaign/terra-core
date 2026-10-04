"use strict";

/**
 * TERRA CAMPAIGN
 * BUILD-126
 *
 * PERFORMANCE MEMBERSHIP ELIGIBILITY
 *
 * Determina si una membresía territorial puede considerarse
 * dentro del ámbito temporal de un capítulo operacional.
 *
 * IMPORTANTE:
 * - No escribe Firestore.
 * - No modifica memberships.
 * - No calcula scoring.
 * - No calcula calificación.
 * - No persiste Performance.
 */

const ELIGIBILITY_VERSION =
  "1.0.0";

const ELIGIBILITY_STATUS =
  "DEFINED_NOT_ACTIVATED";

const ELIGIBILITY_SCOPE =
  "OPERATIONAL_PERIOD_MEMBERSHIP_ELIGIBILITY";


function requireToken(
  value,
  label
) {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    throw new Error(
      "INVALID_" + label
    );
  }

  return value.trim();
}


function requireDate(
  value,
  label
) {
  const token =
    requireToken(
      value,
      label
    );

  const date =
    new Date(
      token
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    throw new Error(
      "INVALID_" + label
    );
  }

  return date;
}


/**
 * Una membership es elegible para el capítulo cuando:
 *
 * 1. pertenece a la misma campaña;
 * 2. tiene createdAt válido;
 * 3. fue creada antes del final del capítulo.
 *
 * La fecha de inicio NO excluye a una membership creada
 * durante el propio capítulo.
 */
function evaluateMembershipEligibility({
  membership,
  period
}) {

  if (
    !membership ||
    typeof membership !== "object"
  ) {
    throw new Error(
      "INVALID_MEMBERSHIP"
    );
  }

  if (
    !period ||
    typeof period !== "object"
  ) {
    throw new Error(
      "INVALID_OPERATIONAL_PERIOD"
    );
  }

  const membershipCampaignId =
    requireToken(
      membership.campaignId,
      "MEMBERSHIP_CAMPAIGN_ID"
    );

  const periodCampaignId =
    requireToken(
      period.campaignId,
      "PERIOD_CAMPAIGN_ID"
    );

  const periodStart =
    requireDate(
      period.startDate,
      "PERIOD_START_DATE"
    );

  const periodEnd =
    requireDate(
      period.endDate,
      "PERIOD_END_DATE"
    );

  if (
    periodEnd <=
    periodStart
  ) {
    throw new Error(
      "INVALID_OPERATIONAL_PERIOD"
    );
  }

  if (
    membershipCampaignId !==
    periodCampaignId
  ) {
    return Object.freeze({
      eligible:
        false,

      reason:
        "CAMPAIGN_MISMATCH"
    });
  }

  const createdAt =
    requireDate(
      membership.createdAt,
      "MEMBERSHIP_CREATED_AT"
    );

  const eligible =
    createdAt <
    periodEnd;

  return Object.freeze({
    eligible,

    reason:
      eligible
        ? "MEMBERSHIP_WITHIN_PERIOD_SCOPE"
        : "MEMBERSHIP_CREATED_AFTER_PERIOD",

    campaignId:
      periodCampaignId,

    periodId:
      requireToken(
        period.periodId,
        "PERIOD_ID"
      ),

    membershipId:
      requireToken(
        membership.membershipId ||
        membership.id,
        "MEMBERSHIP_ID"
      ),

    membershipCreatedAt:
      createdAt.toISOString(),

    periodStart:
      periodStart.toISOString(),

    periodEnd:
      periodEnd.toISOString()
  });
}


const PERFORMANCE_MEMBERSHIP_ELIGIBILITY_POLICY =
  Object.freeze({
    version:
      ELIGIBILITY_VERSION,

    status:
      ELIGIBILITY_STATUS,

    scope:
      ELIGIBILITY_SCOPE,

    firestoreWrites:
      false,

    scoringActivated:
      false,

    persistenceEnabled:
      false
  });


module.exports = {
  ELIGIBILITY_VERSION,

  ELIGIBILITY_STATUS,

  ELIGIBILITY_SCOPE,

  PERFORMANCE_MEMBERSHIP_ELIGIBILITY_POLICY,

  evaluateMembershipEligibility
};
