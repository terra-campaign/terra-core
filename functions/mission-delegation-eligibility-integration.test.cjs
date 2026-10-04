"use strict";

const assert =
  require("node:assert/strict");

const fs =
  require("node:fs");

const path =
  require("node:path");

const file =
  path.join(
    __dirname,
    "mission-delegation.cjs"
  );

const source =
  fs.readFileSync(
    file,
    "utf8"
  );


// ======================================================
// IMPORTS OBLIGATORIOS
// ======================================================

assert.match(
  source,
  /resolveCanonicalPersonForAccount/
);

assert.match(
  source,
  /canonicalMembershipDocumentId/
);

assert.match(
  source,
  /membershipMatchesSubject/
);

assert.match(
  source,
  /evaluateMissionAssigneeEligibility/
);


// ======================================================
// ACTIVIDAD EFECTIVA
//
// Nueva misión:
// fields.activityCode
//
// Delegación:
// parent.content.activityCode
// ======================================================

assert.match(
  source,
  /const effectiveActivityCode\s*=\s*parent\s*\?\s*parent\.content\?\.activityCode\s*:\s*fields\?\.activityCode/
);


// ======================================================
// ORDEN DE SEGURIDAD
// ======================================================

const hierarchyIndex =
  source.indexOf(
    "targetAllowed(p,target.data())"
  );

const identityIndex =
  source.indexOf(
    "await resolveCanonicalPersonForAccount"
  );

const membershipIdIndex =
  source.indexOf(
    "canonicalMembershipDocumentId("
  );

const membershipReadIndex =
  source.indexOf(
    "'territorialMemberships'",
    membershipIdIndex
  );

const membershipValidationIndex =
  source.indexOf(
    "membershipMatchesSubject({"
  );

const eligibilityIndex =
  source.indexOf(
    "evaluateMissionAssigneeEligibility({"
  );

const contentIndex =
  source.indexOf(
    "const content = parent ? parent.content : fields;"
  );

const firstWriteIndex =
  source.indexOf(
    "tx.create("
  );


for (
  const [
    label,
    index
  ] of [
    ["hierarchy", hierarchyIndex],
    ["identity", identityIndex],
    ["membershipId", membershipIdIndex],
    ["membershipRead", membershipReadIndex],
    ["membershipValidation", membershipValidationIndex],
    ["eligibility", eligibilityIndex],
    ["content", contentIndex],
    ["firstWrite", firstWriteIndex]
  ]
) {

  assert.ok(
    index >= 0,
    `${label} debe existir`
  );
}


assert.ok(
  hierarchyIndex <
    identityIndex,
  "La jerarquía debe validarse antes de resolver identidad."
);

assert.ok(
  identityIndex <
    membershipIdIndex,
  "La identidad debe resolverse antes de calcular membershipId."
);

assert.ok(
  membershipIdIndex <
    membershipReadIndex,
  "membershipId debe calcularse antes de leer la membresía."
);

assert.ok(
  membershipReadIndex <
    membershipValidationIndex,
  "La membresía debe leerse antes de validarse."
);

assert.ok(
  membershipValidationIndex <
    eligibilityIndex,
  "La membresía debe validarse antes de evaluar elegibilidad."
);

assert.ok(
  eligibilityIndex <
    contentIndex,
  "La elegibilidad debe resolverse antes de construir la asignación."
);

assert.ok(
  eligibilityIndex <
    firstWriteIndex,
  "Ninguna escritura puede ocurrir antes de validar elegibilidad."
);


// ======================================================
// PREFERENCIAS DE MEMBRESIA
// ======================================================

assert.match(
  source,
  /activityPreferences:\s*targetMembership\s*\.activityPreferences/
);


// ======================================================
// CAPACIDAD DIGITAL
// ======================================================

assert.match(
  source,
  /hasDigitalAccount:\s*Boolean\(\s*targetIdentity\.accountUid\s*\)/
);


// ======================================================
// RECHAZOS EXPLICITOS
// ======================================================

assert.match(
  source,
  /activity-not-selected/
);

assert.match(
  source,
  /digital-account-required/
);


// ======================================================
// NO INFERIR ACTIVIDAD HISTORICA
// ======================================================

assert.match(
  source,
  /La misión no tiene un tipo de actividad operativo válido/
);


// ======================================================
// TEST FUNCIONAL DEL MOTOR
// ======================================================

const {
  evaluateMissionAssigneeEligibility
} =
  require(
    "./mission-assignee-eligibility.cjs"
  );


assert.equal(
  evaluateMissionAssigneeEligibility({
    activityCode:
      "DIGITAL_ACTIVITY",

    activityPreferences: {
      digital_activity:
        true
    },

    hasDigitalAccount:
      false
  }).eligible,
  false
);


assert.equal(
  evaluateMissionAssigneeEligibility({
    activityCode:
      "TERRITORIAL_BRIGADE",

    activityPreferences: {
      territorial_brigade:
        true
    },

    hasDigitalAccount:
      false
  }).eligible,
  true
);


console.log(
  "OK: mission delegation eligibility integration passed."
);
