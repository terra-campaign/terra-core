"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  discoverSmartAssignmentCandidates: discover
} = require("./mission-smart-assignment-discovery.cjs");

const {
  canonicalMembershipDocumentId: membershipId
} = require("./territorial-membership-id.cjs");

const CAMPAIGN = "CAM-B8-TEST";

function member(personId, role, parentPersonId, ancestors, extra = {}) {
  return {
    membershipId: membershipId(CAMPAIGN, personId),
    personId,
    campaignId: CAMPAIGN,
    municipalityId: "MUN-B8",
    structureId: "EST-B8",
    active: true,
    role,
    parentPersonId,
    ancestorPersonIds: ancestors,
    accountUid: null,
    ...extra
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

function candidate(membership, lineage, personExtra = {}) {
  return {
    membership,
    lineage,
    person: {
      personId: membership.personId,
      campaignId: CAMPAIGN,
      active: true,
      name: "Persona " + membership.personId,
      accountUid: null,
      ...personExtra
    }
  };
}

const base = {
  campaignId: CAMPAIGN,
  actorMembership: jefe,
  activityCode: "MATERIAL_DISTRIBUTION",
  complete: true
};

const valid = candidate(
  participante,
  [participante, integrante, jefe]
);

function check(name, overrides, expectedOk, expectedCount) {
  test(name, () => {
    const result = discover({...base, ...overrides});

    assert.equal(result.ok, expectedOk, result.reason);
    assert.equal(result.eligible.length, expectedCount);
  });
}

check("Descendiente directo", {
  candidates: [candidate(integrante, [integrante, jefe])]
}, true, 1);

check("Participante sin cuenta digital", {
  candidates: [valid]
}, true, 1);

check("Colaborador descendiente", {
  candidates: [candidate(
    colaborador,
    [colaborador, participante, integrante, jefe]
  )]
}, true, 1);

check("Apoyo territorial descendiente", {
  candidates: [candidate(
    apoyo,
    [apoyo, colaborador, participante, integrante, jefe]
  )]
}, true, 1);

check("Cadena incorrecta", {
  candidates: [candidate(participante, [participante, jefe])]
}, true, 0);

check("Campana incorrecta", {
  candidates: [candidate(
    participante,
    [participante, integrante, jefe],
    {campaignId: "OTRA-CAMPANA"}
  )]
}, true, 0);

check("Persona inactiva", {
  candidates: [candidate(
    participante,
    [participante, integrante, jefe],
    {active: false}
  )]
}, true, 0);

check("Identidad digital contradictoria", {
  candidates: [candidate(
    member("P", "participante", "I", ["I", "J", "C"], {
      accountUid: "UID-1"
    }),
    [
      member("P", "participante", "I", ["I", "J", "C"], {
        accountUid: "UID-1"
      }),
      integrante,
      jefe
    ],
    {accountUid: "UID-2"}
  )]
}, true, 0);

check("Actividad digital sin cuenta", {
  activityCode: "DIGITAL_ACTIVITY",
  candidates: [valid]
}, true, 0);

check("Actividad digital con cuenta", {
  activityCode: "DIGITAL_ACTIVITY",
  candidates: [candidate(
    member("P", "participante", "I", ["I", "J", "C"], {
      accountUid: "UID-P"
    }),
    [
      member("P", "participante", "I", ["I", "J", "C"], {
        accountUid: "UID-P"
      }),
      integrante,
      jefe
    ],
    {accountUid: "UID-P"}
  )]
}, true, 1);

check("Actividad desconocida", {
  activityCode: "ACTIVIDAD_INEXISTENTE",
  candidates: [valid]
}, true, 0);

check("Duplicados identicos", {
  candidates: [valid, valid]
}, true, 1);

check("Duplicados contradictorios", {
  candidates: [
    valid,
    candidate(participante, [participante, integrante, jefe], {
      name: "Nombre contradictorio"
    })
  ]
}, false, 0);

const reordered = {
  person: Object.fromEntries(
    Object.entries(valid.person).reverse()
  ),
  lineage: valid.lineage.map(item =>
    Object.fromEntries(Object.entries(item).reverse())
  ),
  membership: Object.fromEntries(
    Object.entries(valid.membership).reverse()
  )
};

check("Orden de propiedades diferente", {
  candidates: [valid, reordered]
}, true, 1);

check("Coleccion incompleta", {
  candidates: [valid],
  complete: false
}, false, 0);

check("Completitud no declarada", {
  candidates: [valid],
  complete: undefined
}, false, 0);

check("Coleccion completa", {
  candidates: [valid],
  complete: true
}, true, 1);

check("Conjunto de candidatos invalido", {
  candidates: null
}, false, 0);
test("Rechaza duplicados contradictorios sin depender del orden", () => {
  const validCandidate = valid;

  const invalidMembership = {
    ...participante,
    active: false
  };

  const invalidCandidate = {
    membership: invalidMembership,
    lineage: [
      invalidMembership,
      integrante,
      jefe
    ],
    person: {...valid.person}
  };

  for (const candidates of [
    [validCandidate, invalidCandidate],
    [invalidCandidate, validCandidate]
  ]) {
    const result = discover({
      ...base,
      candidates
    });

    assert.equal(result.ok, false);
    assert.equal(result.reason, "conflicting-candidate-identity");
    assert.deepEqual(result.eligible, []);
  }
});

test("Acepta duplicados validos identicos una sola vez", () => {
  const result = discover({
    ...base,
    candidates: [valid, valid]
  });

  assert.equal(result.ok, true);
  assert.equal(result.eligible.length, 1);
});

test("Rechaza duplicados con identidad digital contradictoria", () => {
  const first = {
    ...valid,
    membership: {
      ...participante,
      accountUid: "UID-1"
    },
    lineage: [
      {...participante, accountUid: "UID-1"},
      integrante,
      jefe
    ],
    person: {
      ...valid.person,
      accountUid: "UID-1"
    }
  };

  const second = {
    ...first,
    membership: {
      ...first.membership,
      accountUid: "UID-2"
    },
    lineage: [
      {...first.lineage[0], accountUid: "UID-2"},
      integrante,
      jefe
    ],
    person: {
      ...first.person,
      accountUid: "UID-2"
    }
  };

  const result = discover({
    ...base,
    candidates: [first, second]
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "conflicting-candidate-identity");
  assert.deepEqual(result.eligible, []);
});