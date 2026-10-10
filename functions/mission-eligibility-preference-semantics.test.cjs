"use strict";

const assert =
  require("node:assert/strict");

const {
  evaluateMissionAssigneeEligibility
} =
  require(
    "./mission-assignee-eligibility.cjs"
  );

// ======================================================
// B2 - PREFERENCIA NO ES APTITUD
//
// Mientras Campaign V1 no tenga modelo persistido
// de aptitudes:
//
// - preferencia true puede ser señal positiva;
// - preferencia false NO descalifica;
// - preferencia ausente NO descalifica;
// - actividad desconocida sigue fail closed;
// - DIGITAL_ACTIVITY sigue exigiendo cuenta digital.
// ======================================================

// ------------------------------------------------------
// Preferencia explícitamente FALSE:
// no debe convertirse en "no apto".
// ------------------------------------------------------

{
  const result =
    evaluateMissionAssigneeEligibility({
      activityCode:
        "WALL_PAINTING",

      activityPreferences: {
        wall_painting:
          false
      },

      hasDigitalAccount:
        false
    });

  assert.equal(
    result.eligible,
    true,
    "Una preferencia false no puede sustituir una falta de aptitud."
  );

  assert.equal(
    result.reason,
    "eligible",
    "La persona debe seguir siendo candidata operacional."
  );
}

// ------------------------------------------------------
// Preferencias ausentes:
// una persona accountless no debe quedar excluida
// solo porque no pudo completar onboarding digital.
// ------------------------------------------------------

{
  const result =
    evaluateMissionAssigneeEligibility({
      activityCode:
        "MATERIAL_DISTRIBUTION",

      activityPreferences:
        null,

      hasDigitalAccount:
        false
    });

  assert.equal(
    result.eligible,
    true,
    "La ausencia de preferencias no debe eliminar elegibilidad."
  );
}

// ------------------------------------------------------
// Legado eventos_mitines:
// no es preferencia canónica, pero tampoco debe
// bloquear una actividad válida no digital.
// ------------------------------------------------------

{
  const result =
    evaluateMissionAssigneeEligibility({
      activityCode:
        "EVENT_SUPPORT_LOGISTICS",

      activityPreferences: {
        eventos_mitines:
          true
      },

      hasDigitalAccount:
        false
    });

  assert.equal(
    result.eligible,
    true,
    "Un registro legado no debe dejar permanentemente fuera a una persona accountless."
  );
}

// ------------------------------------------------------
// DIGITAL_ACTIVITY:
// continúa requiriendo cuenta digital.
// ------------------------------------------------------

{
  const result =
    evaluateMissionAssigneeEligibility({
      activityCode:
        "DIGITAL_ACTIVITY",

      activityPreferences: {
        digital_activity:
          true
      },

      hasDigitalAccount:
        false
    });

  assert.equal(
    result.eligible,
    false
  );

  assert.equal(
    result.reason,
    "digital-account-required"
  );
}

// ------------------------------------------------------
// Actividad desconocida:
// sigue fail closed.
// ------------------------------------------------------

{
  const result =
    evaluateMissionAssigneeEligibility({
      activityCode:
        "NO_EXISTE",

      activityPreferences:
        null,

      hasDigitalAccount:
        false
    });

  assert.equal(
    result.eligible,
    false
  );

  assert.equal(
    result.reason,
    "unsupported-activity"
  );
}

console.log(
  "OK: mission eligibility preference semantics contract passed."
);
