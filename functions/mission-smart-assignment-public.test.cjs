"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");

const {
  toPublicSmartAssignment
} = require("./mission-smart-assignment-public.cjs");

const campaignId = "CAMP-TEST";
const actorPersonId = "JEFE-TEST";

function internalResult(overrides = {}) {
  return {
    ok: true,
    internalOnly: true,
    activityCode: "ACT-TEST",
    eligible: [{
      personId: "PERSONA-TEST",
      accountUid: "CUENTA-PRIVADA",
      name: "Persona prueba",
      role: "participante",
      municipalityId: "MUN-TEST",
      structureId: "EST-TEST",
      hasDigitalAccount: true,
      preferenceSelected: true,
      secret: "NO_PUBLICAR"
    }],
    ...overrides
  };
}

function convert(result = internalResult(), identity = {}) {
  return toPublicSmartAssignment({
    result,
    campaignId,
    actorPersonId,
    ...identity
  });
}

test("Genera referencia compatible con formula B7", () => {
  const output = convert();

  const expected = createHash("sha256")
    .update(JSON.stringify([
      "mission-assignee",
      campaignId,
      actorPersonId,
      "PERSONA-TEST"
    ]))
    .digest("hex");

  assert.equal(output.eligible[0].assigneeRef, expected);
});

test("No expone identificadores internos", () => {
  const output = convert();
  const candidate = output.eligible[0];

  for (const key of [
    "personId",
    "accountUid",
    "uid",
    "secret"
  ]) {
    assert.equal(Object.hasOwn(candidate, key), false);
  }

  assert.equal(output.internalOnly, undefined);
});

test("Aplica lista blanca de campos publicos", () => {
  const output = convert();
  const keys = Object.keys(output.eligible[0]).sort();

  assert.deepEqual(keys, [
    "assigneeRef",
    "hasDigitalAccount",
    "municipalityId",
    "name",
    "preferenceSelected",
    "role",
    "structureId"
  ].sort());
});

test("Rechaza resultado sin autorizacion interna", () => {
  assert.throws(
    () => convert(internalResult({ internalOnly: false })),
    /invalid-smart-assignment-result/
  );
});

test("Rechaza resultado no exitoso", () => {
  assert.throws(
    () => convert(internalResult({ ok: false })),
    /invalid-smart-assignment-result/
  );
});

test("Rechaza listado de candidatos invalido", () => {
  assert.throws(
    () => convert(internalResult({ eligible: null })),
    /invalid-smart-assignment-result/
  );
});

test("Rechaza identidad del jefe vacia", () => {
  assert.throws(
    () => convert(internalResult(), { actorPersonId: "" }),
    /invalid-smart-assignment-identity/
  );
});

test("Rechaza campana con espacios externos", () => {
  assert.throws(
    () => convert(internalResult(), { campaignId: " CAMP-TEST " }),
    /invalid-smart-assignment-identity/
  );
});

test("Rechaza candidato sin personId", () => {
  assert.throws(
    () => convert(internalResult({
      eligible: [{ name: "Sin identificador" }]
    })),
    /invalid-smart-assignment-candidate/
  );
});

test("Rechaza candidato con personId invalido", () => {
  assert.throws(
    () => convert(internalResult({
      eligible: [{ personId: " PERSONA " }]
    })),
    /invalid-smart-assignment-candidate/
  );
});

test("Acepta persona sin cuenta digital", () => {
  const output = convert(internalResult({
    eligible: [{
      personId: "PERSONA-SIN-CUENTA",
      name: "Participante sin cuenta",
      role: "participante",
      municipalityId: "MUN-TEST",
      structureId: "EST-TEST",
      hasDigitalAccount: false,
      preferenceSelected: false
    }]
  }));

  assert.equal(output.eligible[0].hasDigitalAccount, false);
  assert.equal(output.eligible[0].preferenceSelected, false);
  assert.equal(output.eligible[0].assigneeRef.length, 64);
});

test("Mantiene referencia estable para la misma identidad", () => {
  const first = convert();
  const second = convert();

  assert.equal(
    first.eligible[0].assigneeRef,
    second.eligible[0].assigneeRef
  );
});

test("La referencia cambia al cambiar de jefe", () => {
  const first = convert();
  const second = convert(internalResult(), {
    actorPersonId: "OTRO-JEFE"
  });

  assert.notEqual(
    first.eligible[0].assigneeRef,
    second.eligible[0].assigneeRef
  );
});

test("La referencia cambia al cambiar de campana", () => {
  const first = convert();
  const second = convert(internalResult(), {
    campaignId: "OTRA-CAMPANA"
  });

  assert.notEqual(
    first.eligible[0].assigneeRef,
    second.eligible[0].assigneeRef
  );
});