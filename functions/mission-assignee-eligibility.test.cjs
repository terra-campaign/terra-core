"use strict";

const assert =
  require("node:assert/strict");

const {
  preferenceKeyForMissionActivity,
  missionRequiresDigitalAccount,
  evaluateMissionAssigneeEligibility
} =
  require(
    "./mission-assignee-eligibility.cjs"
  );


// ======================================================
// MAPEO CANONICO
// ======================================================

assert.equal(
  preferenceKeyForMissionActivity(
    "TERRITORIAL_BRIGADE"
  ),
  "territorial_brigade"
);

assert.equal(
  preferenceKeyForMissionActivity(
    "OPERATIONAL_ACCOMPANIMENT"
  ),
  "operational_accompaniment"
);

assert.equal(
  preferenceKeyForMissionActivity(
    "WALL_PAINTING"
  ),
  "wall_painting"
);

assert.equal(
  preferenceKeyForMissionActivity(
    "EVENT_SUPPORT_LOGISTICS"
  ),
  "event_logistics"
);

assert.equal(
  preferenceKeyForMissionActivity(
    "MATERIAL_DISTRIBUTION"
  ),
  "material_distribution"
);

assert.equal(
  preferenceKeyForMissionActivity(
    "DIGITAL_ACTIVITY"
  ),
  "digital_activity"
);


// ======================================================
// FAIL CLOSED
// ======================================================

assert.equal(
  preferenceKeyForMissionActivity(
    "UNKNOWN_ACTIVITY"
  ),
  null
);

assert.equal(
  preferenceKeyForMissionActivity(
    ""
  ),
  null
);

assert.equal(
  preferenceKeyForMissionActivity(
    null
  ),
  null
);


// ======================================================
// REQUISITO DE CUENTA DIGITAL
// ======================================================

assert.equal(
  missionRequiresDigitalAccount(
    "DIGITAL_ACTIVITY"
  ),
  true
);

assert.equal(
  missionRequiresDigitalAccount(
    "TERRITORIAL_BRIGADE"
  ),
  false
);

assert.equal(
  missionRequiresDigitalAccount(
    "EVENT_SUPPORT_LOGISTICS"
  ),
  false
);


// ======================================================
// ELEGIBLE POR PREFERENCIA
// ======================================================

{
  const result =
    evaluateMissionAssigneeEligibility({
      activityCode:
        "TERRITORIAL_BRIGADE",

      activityPreferences: {
        territorial_brigade: true
      },

      hasDigitalAccount:
        false
    });

  assert.equal(
    result.eligible,
    true
  );

  assert.equal(
    result.preferenceKey,
    "territorial_brigade"
  );

  assert.equal(
    result.reason,
    "eligible"
  );
}


// ======================================================
// PREFERENCIA NO SELECCIONADA
// ======================================================

{
  const result =
    evaluateMissionAssigneeEligibility({
      activityCode:
        "WALL_PAINTING",

      activityPreferences: {
        wall_painting: false
      },

      hasDigitalAccount:
        true
    });

  assert.equal(
    result.eligible,
    false
  );

  assert.equal(
    result.reason,
    "activity-not-selected"
  );
}


// ======================================================
// PREFERENCIAS AUSENTES
// ======================================================

{
  const result =
    evaluateMissionAssigneeEligibility({
      activityCode:
        "MATERIAL_DISTRIBUTION",

      activityPreferences:
        null,

      hasDigitalAccount:
        true
    });

  assert.equal(
    result.eligible,
    false
  );

  assert.equal(
    result.reason,
    "activity-not-selected"
  );
}


// ======================================================
// DIGITAL: CON CUENTA
// ======================================================

{
  const result =
    evaluateMissionAssigneeEligibility({
      activityCode:
        "DIGITAL_ACTIVITY",

      activityPreferences: {
        digital_activity: true
      },

      hasDigitalAccount:
        true
    });

  assert.equal(
    result.eligible,
    true
  );

  assert.equal(
    result.reason,
    "eligible"
  );
}


// ======================================================
// DIGITAL: SIN CUENTA
// ======================================================

{
  const result =
    evaluateMissionAssigneeEligibility({
      activityCode:
        "DIGITAL_ACTIVITY",

      activityPreferences: {
        digital_activity: true
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


// ======================================================
// CODIGO DESCONOCIDO
// ======================================================

{
  const result =
    evaluateMissionAssigneeEligibility({
      activityCode:
        "NO_EXISTE",

      activityPreferences: {
        territorial_brigade: true,
        digital_activity: true
      },

      hasDigitalAccount:
        true
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


// ======================================================
// LOGISTICA
// ======================================================

{
  const result =
    evaluateMissionAssigneeEligibility({
      activityCode:
        "EVENT_SUPPORT_LOGISTICS",

      activityPreferences: {
        event_logistics: true
      },

      hasDigitalAccount:
        false
    });

  assert.equal(
    result.eligible,
    true
  );
}


console.log(
  "OK: mission assignee eligibility contract passed."
);
