"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  evaluateSmartAssignmentDescendant: evaluate
} = require("./mission-smart-assignment-policy.cjs");

const {
  canonicalMembershipDocumentId
} = require("./territorial-membership-id.cjs");

const CAMPAIGN = "CAM-B8-TEST";

function member(personId, role, parentPersonId, ancestors = []) {
  return {
    membershipId: canonicalMembershipDocumentId(CAMPAIGN, personId),
    personId,
    campaignId: CAMPAIGN,
    municipalityId: "MUN-B8",
    structureId: "EST-B8",
    active: true,
    role,
    parentPersonId,
    ancestorPersonIds: ancestors,
    accountUid: null
  };
}

const jefe = member("J", "jefe_estructura", "C", ["C"]);
const integrante = member("I", "integrante", "J", ["J", "C"]);
const participante = member("P", "participante", "I", ["I", "J", "C"]);
const colaborador = member(
  "B", "colaborador_base", "P", ["P", "I", "J", "C"]
);
const apoyo = member(
  "A", "apoyo_territorial", "B", ["B", "P", "I", "J", "C"]
);

function input(lineage = [apoyo, colaborador, participante, integrante, jefe]) {
  return {
    campaignId: CAMPAIGN,
    actorMembership: lineage[lineage.length - 1],
    targetMembership: lineage[0],
    lineage
  };
}

function expectAuthorization(name, params, expected) {
  test(name, () => {
    const result = evaluate(params);
    assert.equal(result.authorized, expected, result.reason);
  });
}

expectAuthorization(
  "Autoriza integrante directo sin cuenta digital",
  input([integrante, jefe]),
  true
);

expectAuthorization(
  "Autoriza participante descendiente",
  input([participante, integrante, jefe]),
  true
);

expectAuthorization(
  "Autoriza colaborador descendiente",
  input([colaborador, participante, integrante, jefe]),
  true
);

expectAuthorization(
  "Autoriza apoyo territorial descendiente",
  input(),
  true
);

expectAuthorization(
  "Rechaza ancestros desordenados",
  input([
    {...participante, ancestorPersonIds: ["J", "I", "C"]},
    integrante,
    jefe
  ]),
  false
);

expectAuthorization(
  "Rechaza ancestro omitido",
  input([
    {...participante, ancestorPersonIds: ["I"]},
    integrante,
    jefe
  ]),
  false
);

expectAuthorization(
  "Rechaza ancestros duplicados",
  input([
    {...participante, ancestorPersonIds: ["I", "J", "J", "C"]},
    integrante,
    jefe
  ]),
  false
);

expectAuthorization(
  "Rechaza padre jerarquico incorrecto",
  input([
    {...participante, parentPersonId: "OTRO"},
    integrante,
    jefe
  ]),
  false
);

expectAuthorization(
  "Rechaza estructura ajena",
  input([
    {...participante, structureId: "EST-AJENA"},
    integrante,
    jefe
  ]),
  false
);

expectAuthorization(
  "Rechaza campana ajena",
  input([
    {...participante, campaignId: "CAM-AJENA"},
    integrante,
    jefe
  ]),
  false
);

expectAuthorization(
  "Rechaza membresia inactiva",
  input([
    {...participante, active: false},
    integrante,
    jefe
  ]),
  false
);

expectAuthorization(
  "Rechaza identidad repetida en la cadena",
  input([participante, participante, jefe]),
  false
);

expectAuthorization(
  "Rechaza rol externo inconsistente",
  {
    ...input([participante, integrante, jefe]),
    targetMembership: {...participante, role: "apoyo_territorial"}
  },
  false
);

expectAuthorization(
  "Rechaza padre externo inconsistente",
  {
    ...input([participante, integrante, jefe]),
    targetMembership: {...participante, parentPersonId: "OTRO"}
  },
  false
);

expectAuthorization(
  "Rechaza responsable externo inconsistente",
  {
    ...input([participante, integrante, jefe]),
    actorMembership: {...jefe, parentPersonId: "OTRO"}
  },
  false
);

expectAuthorization(
  "Rechaza actor con rol diferente a jefe",
  {
    ...input([participante, integrante, jefe]),
    actorMembership: {...jefe, role: "coordinador_municipal"}
  },
  false
);

expectAuthorization(
  "Rechaza membresia sin identificador canonico",
  input([
    {...participante, membershipId: "ID-INCORRECTO"},
    integrante,
    jefe
  ]),
  false
);