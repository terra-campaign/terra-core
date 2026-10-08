"use strict";

const assert =
  require("node:assert/strict");

const {
  EVENT_CREATE_ROLES,
  canCreateEvent
} =
  require("./event-delegation.cjs")._test;

assert.deepEqual(
  [...EVENT_CREATE_ROLES].sort(),
  [
    "coordinador_municipal",
    "jefe_estructura",
    "lider_principal"
  ]
);

const base = {
  active: true,
  campaignId: "CAM-001"
};

assert.equal(
  canCreateEvent({
    ...base,
    uid: "LEADER",
    role: "lider_principal"
  }),
  true,
  "lider_principal debe poder crear eventos."
);

assert.equal(
  canCreateEvent({
    ...base,
    uid: "COORD",
    role: "coordinador_municipal",
    municipalityId: "MUN-001"
  }),
  true,
  "coordinador_municipal debe poder crear eventos."
);

assert.equal(
  canCreateEvent({
    ...base,
    uid: "CHIEF",
    role: "jefe_estructura",
    municipalityId: "MUN-001",
    structureId: "EST-001"
  }),
  true,
  "jefe_estructura debe poder crear eventos."
);

for (
  const role of [
    "admin",
    "integrante",
    "participante",
    "colaborador_base",
    "apoyo_territorial"
  ]
) {
  assert.equal(
    canCreateEvent({
      ...base,
      uid: `USER-${role}`,
      role,
      municipalityId: "MUN-001",
      structureId: "EST-001"
    }),
    false,
    `${role} no debe poder crear eventos nuevos.`
  );
}

assert.equal(
  canCreateEvent({
    ...base,
    uid: "INACTIVE",
    role: "lider_principal",
    active: false
  }),
  false,
  "Un creador inactivo no debe poder crear eventos."
);

assert.equal(
  canCreateEvent({
    active: true,
    uid: "NO-CAMPAIGN",
    role: "lider_principal"
  }),
  false,
  "La creacion requiere campaignId."
);

assert.equal(
  canCreateEvent({
    ...base,
    uid: "COORD-NO-MUN",
    role: "coordinador_municipal"
  }),
  false,
  "El coordinador requiere municipalityId."
);

assert.equal(
  canCreateEvent({
    ...base,
    uid: "CHIEF-NO-STRUCTURE",
    role: "jefe_estructura",
    municipalityId: "MUN-001"
  }),
  false,
  "El jefe de estructura requiere structureId."
);

console.log(
  "OK: event creation policy tests passed."
);