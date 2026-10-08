"use strict";

const assert =
  require("node:assert/strict");

const {
  canResolveGeneralOrganizationalScope,
  buildGeneralOrganizationalScopeMembers
} =
  require("./event-general-scope.cjs")._test;

const leader = {
  uid: "LEADER-1",
  active: true,
  role: "lider_principal",
  campaignId: "CAM-001"
};

const coordinator = {
  uid: "COORD-1",
  active: true,
  role: "coordinador_municipal",
  campaignId: "CAM-001",
  municipalityId: "MUN-001"
};

const chief = {
  uid: "CHIEF-1",
  active: true,
  role: "jefe_estructura",
  campaignId: "CAM-001",
  municipalityId: "MUN-001",
  structureId: "EST-001"
};

function eventFor(profile, scopeType) {
  return {
    id: `EVENT-${scopeType}`,
    active: true,
    attendanceRequired: true,
    campaignId: profile.campaignId,
    createdBy: profile.uid,
    operationalOwnerId: profile.uid,
    scopeMode: "organizational",
    scopeType,

    scopeMunicipalityId:
      scopeType === "municipality" ||
      scopeType === "structure"
        ? profile.municipalityId
        : "",

    scopeStructureId:
      scopeType === "structure"
        ? profile.structureId
        : ""
  };
}

function scopeFor(profile, scopeType) {
  return {
    id: `EVENT-${scopeType}`,
    active: true,
    campaignId: profile.campaignId,
    scopeMode: "organizational",
    scopeType,

    municipalityId:
      scopeType === "municipality" ||
      scopeType === "structure"
        ? profile.municipalityId
        : "",

    structureId:
      scopeType === "structure"
        ? profile.structureId
        : ""
  };
}

for (
  const [profile, scopeType] of [
    [leader, "campaign"],
    [coordinator, "municipality"],
    [chief, "structure"]
  ]
) {
  assert.equal(
    canResolveGeneralOrganizationalScope({
      profile,
      event: eventFor(
        profile,
        scopeType
      ),
      scope: scopeFor(
        profile,
        scopeType
      )
    }),
    true,
    `${profile.role} debe resolver scope ${scopeType}.`
  );
}

assert.equal(
  canResolveGeneralOrganizationalScope({
    profile: {
      ...coordinator,
      role: "integrante"
    },
    event: eventFor(
      coordinator,
      "municipality"
    ),
    scope: scopeFor(
      coordinator,
      "municipality"
    )
  }),
  false,
  "integrante no debe resolver alcance general."
);

assert.equal(
  canResolveGeneralOrganizationalScope({
    profile: chief,
    event: eventFor(
      chief,
      "structure"
    ),
    scope: {
      ...scopeFor(
        chief,
        "structure"
      ),
      structureId: "EST-999"
    }
  }),
  false,
  "El jefe no puede resolver otra estructura."
);

const memberships = [
  {
    id: "MEM-1",
    personId: "PER-1",
    accountUid: "UID-1",
    active: true,
    campaignId: "CAM-001",
    municipalityId: "MUN-001",
    structureId: "EST-001",
    role: "participante"
  },
  {
    id: "MEM-2",
    personId: "PER-2",
    accountUid: null,
    active: true,
    campaignId: "CAM-001",
    municipalityId: "MUN-001",
    structureId: "EST-002",
    role: "colaborador_base"
  },
  {
    id: "MEM-3",
    personId: "PER-3",
    accountUid: "UID-3",
    active: true,
    campaignId: "CAM-001",
    municipalityId: "MUN-002",
    structureId: "EST-003",
    role: "integrante"
  },
  {
    id: "MEM-4",
    personId: "PER-4",
    accountUid: "UID-4",
    active: true,
    campaignId: "CAM-999",
    municipalityId: "MUN-001",
    structureId: "EST-001",
    role: "participante"
  }
];

const persons = [
  {
    personId: "PER-1",
    active: true,
    campaignId: "CAM-001",
    accountUid: "UID-1",
    name: "Persona 1"
  },
  {
    personId: "PER-2",
    active: true,
    campaignId: "CAM-001",
    accountUid: null,
    name: "Persona 2"
  },
  {
    personId: "PER-3",
    active: true,
    campaignId: "CAM-001",
    accountUid: "UID-3",
    name: "Persona 3"
  },
  {
    personId: "PER-4",
    active: true,
    campaignId: "CAM-999",
    accountUid: "UID-4",
    name: "Persona 4"
  }
];

const campaignMembers =
  buildGeneralOrganizationalScopeMembers({
    event: eventFor(
      leader,
      "campaign"
    ),
    scope: scopeFor(
      leader,
      "campaign"
    ),
    memberships,
    persons
  });

assert.equal(
  campaignMembers.length,
  3,
  "Campaign debe incluir toda la campana activa."
);

const municipalityMembers =
  buildGeneralOrganizationalScopeMembers({
    event: eventFor(
      coordinator,
      "municipality"
    ),
    scope: scopeFor(
      coordinator,
      "municipality"
    ),
    memberships,
    persons
  });

assert.equal(
  municipalityMembers.length,
  2,
  "Municipality debe limitar al municipio."
);

const structureMembers =
  buildGeneralOrganizationalScopeMembers({
    event: eventFor(
      chief,
      "structure"
    ),
    scope: scopeFor(
      chief,
      "structure"
    ),
    memberships,
    persons
  });

assert.equal(
  structureMembers.length,
  1,
  "Structure debe limitar a la estructura."
);

assert.equal(
  structureMembers[0].personId,
  "PER-1"
);

assert.equal(
  municipalityMembers.some(
    member =>
      member.personId === "PER-2" &&
      member.hasDigitalAccount === false
  ),
  true,
  "El universo debe conservar personas sin cuenta digital."
);

assert.equal(
  campaignMembers.every(
    member =>
      member.scopeType === "campaign"
  ),
  true
);

assert.equal(
  municipalityMembers.every(
    member =>
      member.scopeType === "municipality"
  ),
  true
);

assert.equal(
  structureMembers.every(
    member =>
      member.scopeType === "structure"
  ),
  true
);

console.log(
  "OK: organizational event scope tests passed."
);