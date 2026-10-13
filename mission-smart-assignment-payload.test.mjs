"use strict";

import test from "node:test";
import assert from "node:assert/strict";
import {buildSmartAssignmentPayload} from "./mission-smart-assignment-payload.mjs";

const A = "a".repeat(64);
const B = "b".repeat(64);
const NOW = Date.parse("2026-10-12T12:00:00.000Z");

function valid(overrides = {}) {
  return {
    requestId: "b8-test-001",
    assigneeRefs: [B, A],
    activityCode: "ACT-TEST",
    title: "Mision de prueba",
    description: "Descripcion de prueba",
    locality: "Compostela",
    missionDate: "2026-10-13",
    deadlineAt: "2026-10-13T12:00:00.000Z",
    ...overrides
  };
}

function build(input, options = {}) {
  return buildSmartAssignmentPayload(
    input,
    {nowMs: NOW, ...options}
  );
}

test("01 - Construye solicitud valida con ocho campos", () => {
  const result = build(valid());

  assert.deepEqual(Object.keys(result), [
    "requestId",
    "assigneeRefs",
    "activityCode",
    "title",
    "description",
    "locality",
    "missionDate",
    "deadlineAt"
  ]);

  assert.deepEqual(result.assigneeRefs, [A, B]);
});

test("02 - No modifica el arreglo original", () => {
  const input = valid();
  const original = [...input.assigneeRefs];

  build(input);

  assert.deepEqual(input.assigneeRefs, original);
});

test("03 - Rechaza referencias invalidas y duplicadas", () => {
  const cases = [
    [],
    Array(51).fill(A),
    [A, A],
    ["a".repeat(63)],
    ["A".repeat(64)],
    [A + " "],
    [null]
  ];

  for (const refs of cases) {
    assert.throws(
      () => build(valid({assigneeRefs: refs})),
      /seleccion de integrantes invalida/
    );
  }
});

test("04 - Prohibe mezclar seleccion B7 con B8", () => {
  assert.throws(
    () => build(valid(), {directAssigneeRefs: [A]}),
    /desmarca los destinatarios/
  );
});

test("05 - Rechaza campos ajenos al contrato B8", () => {
  for (const field of [
    "parentMissionId",
    "campaignId",
    "actorPersonId"
  ]) {
    assert.throws(
      () => build(valid({[field]: "valor"})),
      /campos no permitidos/
    );
  }
});

test("06 - Valida identificador de solicitud", () => {
  for (const requestId of ["", " id", "id/123", "x".repeat(129)]) {
    assert.throws(
      () => build(valid({requestId})),
      /identificador de solicitud invalido/
    );
  }
});

test("07 - Valida actividad y titulo obligatorios", () => {
  for (const activityCode of ["", " ", "x".repeat(101)]) {
    assert.throws(
      () => build(valid({activityCode})),
      /actividad no valido/
    );
  }

  for (const title of ["", " ", "x".repeat(151)]) {
    assert.throws(
      () => build(valid({title})),
      /titulo no valido/
    );
  }
});

test("08 - Respeta limites de descripcion y localidad", () => {
  assert.throws(
    () => build(valid({description: "x".repeat(1501)})),
    /descripcion no valido/
  );

  assert.throws(
    () => build(valid({locality: "x".repeat(121)})),
    /localidad no valido/
  );

  assert.equal(
    build(valid({description: "x".repeat(1500)})).description.length,
    1500
  );
});

test("09 - Rechaza fechas de mision inexistentes", () => {
  for (const missionDate of [
    "2026-02-29",
    "2026-13-01",
    "13/10/2026",
    "2026-10-13T00:00:00Z"
  ]) {
    assert.throws(
      () => build(valid({missionDate})),
      /fecha de mision invalida/
    );
  }
});

test("10 - Acepta dia bisiesto valido", () => {
  const result = build(valid({missionDate: "2024-02-29"}));
  assert.equal(result.missionDate, "2024-02-29");
});

test("11 - Rechaza vencimientos expirados e invalidos", () => {
  for (const deadlineAt of [
    "2026-10-11T12:00:00.000Z",
    "2026-10-12T12:00:00.000Z",
    "2026-10-13T12:00:00-07:00",
    "fecha-invalida"
  ]) {
    assert.throws(
      () => build(valid({deadlineAt})),
      /fecha limite invalida o vencida/
    );
  }
});

test("12 - Normaliza textos y admite campos opcionales vacios", () => {
  const result = build(valid({
    title: "  Mision  ",
    description: null,
    locality: null,
    missionDate: null,
    deadlineAt: null
  }));

  assert.equal(result.title, "Mision");
  assert.equal(result.description, "");
  assert.equal(result.locality, "");
  assert.equal(result.missionDate, null);
  assert.equal(result.deadlineAt, null);
});

test("13 - Rechaza una entrada que no sea objeto", () => {
  for (const input of [null, [], "texto", 123]) {
    assert.throws(
      () => build(input),
      /datos de mision invalidos/
    );
  }
});