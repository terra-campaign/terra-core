"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  toPublicSmartAssignment
} = require("./mission-smart-assignment-public.cjs");

const base = {
  personId: "PERSONA-TEST",
  name: "Persona prueba",
  role: "participante",
  municipalityId: "MUN-TEST",
  structureId: "EST-TEST",
  hasDigitalAccount: false,
  preferenceSelected: false
};

function convert(eligible) {
  return toPublicSmartAssignment({
    campaignId: "CAMP-TEST",
    actorPersonId: "JEFE-TEST",
    result: {
      ok: true,
      internalOnly: true,
      activityCode: "ACT-TEST",
      eligible
    }
  });
}

test("Rechaza candidatos duplicados", () => {
  assert.throws(
    () => convert([{...base}, {...base}]),
    /duplicate-smart-assignment-candidate/
  );
});

test("Rechaza nombre de tipo objeto", () => {
  assert.throws(
    () => convert([{...base, name: {dato: "invalido"}}]),
    /invalid-smart-assignment-candidate/
  );
});

test("Rechaza rol ausente", () => {
  assert.throws(
    () => convert([{...base, role: undefined}]),
    /invalid-smart-assignment-candidate/
  );
});

test("Conserva candidato valido", () => {
  const output = convert([{...base}]);

  assert.equal(output.eligible.length, 1);
  assert.equal(output.eligible[0].assigneeRef.length, 64);
  assert.equal("personId" in output.eligible[0], false);
  assert.equal("accountUid" in output.eligible[0], false);
});