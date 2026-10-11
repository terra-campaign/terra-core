"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  canonicalMembershipDocumentId
} = require("./territorial-membership-id.cjs");

const {
  loadSmartAssignmentLineage: load
} = require("./mission-smart-assignment-lineage.cjs");

const campaignId = "CAM-B83";
const municipalityId = "MUN-1";
const structureId = "EST-1";

function member(personId, role, parentPersonId, ancestorPersonIds) {
  return {
    membershipId: canonicalMembershipDocumentId(campaignId, personId),
    campaignId,
    personId,
    role,
    parentPersonId,
    ancestorPersonIds,
    municipalityId,
    structureId,
    active: true,
    accountUid: null
  };
}

const jefe = member("J", "jefe_estructura", "C", ["C"]);
const integrante = member("I", "integrante", "J", ["J", "C"]);
const participante = member("P", "participante", "I", ["I", "J", "C"]);
const colaborador = member("B", "colaborador_base", "P", ["P", "I", "J", "C"]);
const apoyo = member("A", "apoyo_territorial", "B", ["B", "P", "I", "J", "C"]);

function fakeDb(memberships) {
  const records = new Map(memberships.map(m => [m.membershipId, m]));

  return {
    collection(name) {
      assert.equal(name, "territorialMemberships");
      return {
        doc(id) {
          return {
            async get() {
              const item = records.get(id);
              return {
                id,
                exists: Boolean(item),
                data: () => item
              };
            }
          };
        }
      };
    }
  };
}

const full = [jefe, integrante, participante, colaborador, apoyo];

async function run(target, records = full, actor = jefe) {
  return load({
    db: fakeDb(records),
    campaignId,
    actorMembership: actor,
    targetMembership: target
  });
}

test("Autoriza integrante directo", async () => {
  const result = await run(integrante);
  assert.equal(result.authorized, true);
  assert.deepEqual(result.lineage.map(m => m.personId), ["I", "J"]);
});

test("Autoriza participante descendiente", async () => {
  const result = await run(participante);
  assert.equal(result.authorized, true);
  assert.deepEqual(result.lineage.map(m => m.personId), ["P", "I", "J"]);
});

test("Autoriza colaborador de base", async () => {
  const result = await run(colaborador);
  assert.equal(result.authorized, true);
  assert.equal(result.lineage.length, 4);
});

test("Autoriza apoyo territorial", async () => {
  const result = await run(apoyo);
  assert.equal(result.authorized, true);
  assert.equal(result.lineage.length, 5);
});

test("Rechaza padre inexistente", async () => {
  const result = await run(participante, [jefe, participante]);
  assert.equal(result.authorized, false);
  assert.equal(result.reason, "missing-lineage-membership");
});

test("Rechaza ciclo jerarquico", async () => {
  const cyclic = {...participante, parentPersonId: "P"};
  const result = await run(cyclic, [jefe, integrante, cyclic]);
  assert.equal(result.authorized, false);
  assert.equal(result.reason, "cyclic-lineage");
});

test("Rechaza cambio de estructura", async () => {
  const foreign = {...participante, structureId: "EST-OTRA"};
  const result = await run(foreign, [jefe, integrante, foreign]);
  assert.equal(result.authorized, false);
  assert.deepEqual(result.lineage, []);
});

test("Rechaza membresia inactiva", async () => {
  const inactive = {...participante, active: false};
  const result = await run(inactive, [jefe, integrante, inactive]);
  assert.equal(result.authorized, false);
  assert.equal(result.reason, "invalid-lineage-membership");
});

test("Rechaza ancestros manipulados", async () => {
  const manipulated = {
    ...participante,
    ancestorPersonIds: ["J", "I", "C"]
  };
  const result = await run(manipulated, [jefe, integrante, manipulated]);
  assert.equal(result.authorized, false);
  assert.equal(result.reason, "invalid-ancestry");
});

test("Rechaza candidato que no pertenece al jefe", async () => {
  const other = member("X", "integrante", "OTRO", ["OTRO"]);
  const result = await run(other, [jefe, other]);
  assert.equal(result.authorized, false);
  assert.equal(result.reason, "missing-lineage-membership");
});

test("Rechaza candidato y actor identicos", async () => {
  const result = await run(jefe);
  assert.equal(result.authorized, false);
  assert.equal(result.reason, "invalid-lineage-request");
});

test("Rechaza contradiccion entre consulta y membresia canonica", async () => {
  const consultaOriginal = {...participante};
  const canonicaActual = {...participante, structureId: "EST-OTRA"};

  const result = await run(
    consultaOriginal,
    [jefe, integrante, canonicaActual]
  );

  assert.equal(result.authorized, false);
  assert.equal(result.reason, "membership-query-mismatch");
  assert.deepEqual(result.lineage, []);
});

test("Rechaza contradiccion entre jefe recibido y jefe canonico", async () => {
  const jefeConsultado = {...jefe, structureId: "EST-1"};
  const jefeCanonico = {...jefe, structureId: "EST-OTRA"};

  const result = await run(
    integrante,
    [jefeCanonico, integrante],
    jefeConsultado
  );

  assert.equal(result.authorized, false);
  assert.deepEqual(result.lineage, []);
});
