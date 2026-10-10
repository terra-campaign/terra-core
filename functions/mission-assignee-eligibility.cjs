"use strict";

const {
  classifyMissionActivity
} =
  require(
    "./activity-classification.cjs"
  );


// ======================================================
// MAPEO OFICIAL
//
// activityCode de misión
//        ↓
// preferenceKey de territorialMembership
// ======================================================

const MISSION_ACTIVITY_PREFERENCE_MAP =
  Object.freeze({

    TERRITORIAL_BRIGADE:
      "territorial_brigade",

    OPERATIONAL_ACCOMPANIMENT:
      "operational_accompaniment",

    WALL_PAINTING:
      "wall_painting",

    EVENT_SUPPORT_LOGISTICS:
      "event_logistics",

    MATERIAL_DISTRIBUTION:
      "material_distribution",

    DIGITAL_ACTIVITY:
      "digital_activity"

  });


// ======================================================
// ACTIVIDADES QUE EXIGEN CUENTA DIGITAL
// ======================================================

const DIGITAL_ACCOUNT_REQUIRED =
  Object.freeze(
    new Set([
      "DIGITAL_ACTIVITY"
    ])
  );


// ======================================================
// NORMALIZAR / VALIDAR ACTIVIDAD DE MISIÓN
//
// No confiamos únicamente en que la clave exista
// en nuestro mapa.
//
// También debe ser una actividad válida del catálogo
// oficial para MISSION_VALIDATION.
// ======================================================

function canonicalMissionActivityCode(
  activityCode
) {

  if (
    typeof activityCode !==
      "string"
  ) {
    return null;
  }

  const requested =
    activityCode.trim();

  if (!requested) {
    return null;
  }

  try {

    const classification =
      classifyMissionActivity(
        requested
      );

    if (
      !classification ||
      typeof classification
        .activityCode !==
        "string"
    ) {
      return null;
    }

    const canonicalCode =
      classification
        .activityCode;

    if (
      !Object.hasOwn(
        MISSION_ACTIVITY_PREFERENCE_MAP,
        canonicalCode
      )
    ) {
      return null;
    }

    return canonicalCode;

  } catch {

    return null;
  }
}


// ======================================================
// activityCode → preferenceKey
// ======================================================

function preferenceKeyForMissionActivity(
  activityCode
) {

  const canonicalCode =
    canonicalMissionActivityCode(
      activityCode
    );

  if (!canonicalCode) {
    return null;
  }

  return (
    MISSION_ACTIVITY_PREFERENCE_MAP[
      canonicalCode
    ] ||
    null
  );
}


// ======================================================
// ¿LA MISIÓN EXIGE CUENTA DIGITAL?
// ======================================================

function missionRequiresDigitalAccount(
  activityCode
) {

  const canonicalCode =
    canonicalMissionActivityCode(
      activityCode
    );

  if (!canonicalCode) {
    return false;
  }

  return (
    DIGITAL_ACCOUNT_REQUIRED
      .has(
        canonicalCode
      )
  );
}


// ======================================================
// EVALUAR ELEGIBILIDAD OPERACIONAL
//
// Esta función NO determina jerarquía.
//
// La autorización jerárquica pertenece a otra capa.
//
// Aquí únicamente respondemos:
//
// ¿Esta persona es compatible con este tipo de misión?
// ======================================================

function evaluateMissionAssigneeEligibility({
  activityCode,
  activityPreferences,
  hasDigitalAccount
} = {}) {

  const canonicalCode =
    canonicalMissionActivityCode(
      activityCode
    );

  if (!canonicalCode) {

    return Object.freeze({
      eligible:
        false,

      activityCode:
        null,

      preferenceKey:
        null,

      requiresDigitalAccount:
        false,

      reason:
        "unsupported-activity"
    });
  }

  const preferenceKey =
    MISSION_ACTIVITY_PREFERENCE_MAP[
      canonicalCode
    ];

  const requiresDigitalAccount =
    DIGITAL_ACCOUNT_REQUIRED
      .has(
        canonicalCode
      );

  const preferences =
    activityPreferences &&
    typeof activityPreferences ===
      "object" &&
    !Array.isArray(
      activityPreferences
    )
      ? activityPreferences
      : {};

  /*
   * B2 — SEMÁNTICA CANÓNICA TRANSITORIA
   *
   * activityPreferences expresa preferencia de participación.
   * No constituye una aptitud operacional.
   *
   * Mientras Campaign V1 no disponga de un modelo persistido
   * de aptitudes, una preferencia false o ausente NO elimina
   * la elegibilidad.
   */
  const preferenceSelected =
    preferences[
      preferenceKey
    ] === true;

  if (
    requiresDigitalAccount &&
    hasDigitalAccount !== true
  ) {

    return Object.freeze({
      eligible:
        false,

      activityCode:
        canonicalCode,

      preferenceKey,

      preferenceSelected,

      requiresDigitalAccount,

      reason:
        "digital-account-required"
    });
  }

  return Object.freeze({
    eligible:
      true,

    activityCode:
      canonicalCode,

    preferenceKey,

    preferenceSelected,

    requiresDigitalAccount,

    reason:
      "eligible"
  });
}


module.exports = {
  MISSION_ACTIVITY_PREFERENCE_MAP,
  preferenceKeyForMissionActivity,
  missionRequiresDigitalAccount,
  evaluateMissionAssigneeEligibility
};
