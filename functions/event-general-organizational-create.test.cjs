"use strict";

const assert =
  require("node:assert/strict");

const {
  expectedGeneralEventScopeForRole,
  canCreateGeneralOrganizationalEvent,
  buildGeneralOrganizationalScopeDescriptor,
  buildGeneralOrganizationalEvent
} =
  require("./event-general.cjs")._test;

const leader = {
  uid: "LEADER-001",
  active: true,
  role: "lider_principal",
  campaignId: "CAM-001",
  name: "Leader"
};

const coordinator = {
  uid: "COORD-001",
  active: true,
  role: "coordinador_municipal",
  campaignId: "CAM-001",
  municipalityId: "MUN-001",
  municipalityName: "Compostela",
  name: "Coordinator"
};

const chief = {
  uid: "CHIEF-001",
  active: true,
  role: "jefe_estructura",
  campaignId: "CAM-001",
  municipalityId: "MUN-001",
  municipalityName: "Compostela",
  structureId: "EST-001",
  structureName: "Estructura 1",
  name: "Chief"
};

assert.equal(
  expectedGeneralEventScopeForRole(
    "lider_principal"
  ),
  "campaign"
);

assert.equal(
  expectedGeneralEventScopeForRole(
    "coordinador_municipal"
  ),
  "municipality"
);

assert.equal(
  expectedGeneralEventScopeForRole(
    "jefe_estructura"
  ),
  "structure"
);

for (
  const profile of [
    leader,
    coordinator,
    chief
  ]
) {
  assert.equal(
    canCreateGeneralOrganizationalEvent(
      profile
    ),
    true,
    `${profile.role} debe poder crear eventos generales.`
  );
}

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
    canCreateGeneralOrganizationalEvent({
      uid: `USER-${role}`,
      active: true,
      role,
      campaignId: "CAM-001",
      municipalityId: "MUN-001",
      structureId: "EST-001"
    }),
    false,
    `${role} no debe crear eventos generales.`
  );
}

assert.equal(
  canCreateGeneralOrganizationalEvent({
    ...coordinator,
    municipalityId: ""
  }),
  false,
  "Coordinador requiere municipalityId."
);

assert.equal(
  canCreateGeneralOrganizationalEvent({
    ...chief,
    structureId: ""
  }),
  false,
  "Jefe de estructura requiere structureId."
);

const leaderScope =
  buildGeneralOrganizationalScopeDescriptor(
    leader
  );

assert.deepEqual(
  leaderScope,
  {
    scopeType: "campaign"
  }
);

const coordinatorScope =
  buildGeneralOrganizationalScopeDescriptor(
    coordinator
  );

assert.deepEqual(
  coordinatorScope,
  {
    scopeType: "municipality",
    municipalityId: "MUN-001",
    municipalityName: "Compostela"
  }
);

const chiefScope =
  buildGeneralOrganizationalScopeDescriptor(
    chief
  );

assert.deepEqual(
  chiefScope,
  {
    scopeType: "structure",
    municipalityId: "MUN-001",
    municipalityName: "Compostela",
    structureId: "EST-001",
    structureName: "Estructura 1"
  }
);

const baseEventInput = {
  eventId: "EVENT-001",
  title: "Evento prueba",
  description: "",
  venue: "Plaza",
  locality: "",
  startsAt: "2030-01-01T18:00:00.000Z",
  endsAt: "2030-01-01T20:00:00.000Z",
  recordMode: "production",
  confirmationLeadMinutes: 60,
  activityCode: "EVENT_GENERAL_ATTENDANCE",
  activityCatalogVersion: "1"
};

for (
  const [
    profile,
    expectedScopeType
  ] of [
    [leader, "campaign"],
    [coordinator, "municipality"],
    [chief, "structure"]
  ]
) {
  const event =
    buildGeneralOrganizationalEvent({
      profile,
      ...baseEventInput
    });

  assert.equal(
    event.campaignId,
    "CAM-001"
  );

  assert.equal(
    event.scopeMode,
    "organizational"
  );

  assert.equal(
    event.scopeType,
    expectedScopeType
  );

  assert.equal(
    event.createdBy,
    profile.uid
  );

  assert.equal(
    event.operationalOwnerId,
    profile.uid
  );
}

const leaderEvent =
  buildGeneralOrganizationalEvent({
    profile: leader,
    ...baseEventInput
  });

assert.equal(
  leaderEvent.scopeMunicipalityId,
  undefined
);

assert.equal(
  leaderEvent.scopeStructureId,
  undefined
);

const coordinatorEvent =
  buildGeneralOrganizationalEvent({
    profile: coordinator,
    ...baseEventInput
  });

assert.equal(
  coordinatorEvent.scopeMunicipalityId,
  "MUN-001"
);

assert.equal(
  coordinatorEvent.scopeStructureId,
  undefined
);

const chiefEvent =
  buildGeneralOrganizationalEvent({
    profile: chief,
    ...baseEventInput
  });

assert.equal(
  chiefEvent.scopeMunicipalityId,
  "MUN-001"
);

assert.equal(
  chiefEvent.scopeStructureId,
  "EST-001"
);

console.log(
  "OK: general organizational event creation tests passed."
);