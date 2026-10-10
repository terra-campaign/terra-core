"use strict";

const assert =
  require("node:assert/strict");

const fs =
  require("node:fs");

const path =
  require("node:path");

const source =
  fs.readFileSync(
    path.join(
      __dirname,
      "..",
      "misiones.js"
    ),
    "utf8"
  );

// ======================================================
// B7C — SELECCIÓN CANÓNICA EN FRONTEND
//
// El navegador debe usar assigneeRef opaco.
// No debe depender del UID para seleccionar personas.
// ======================================================

assert.match(
  source,
  /person\.assigneeRef/,
  "El frontend debe usar assigneeRef entregado por el backend."
);

assert.match(
  source,
  /checkbox\.value\s*=\s*person\.assigneeRef/,
  "El valor seleccionable del checkbox debe ser assigneeRef."
);

assert.match(
  source,
  /assigneeRefs/,
  "El payload de creación debe enviar assigneeRefs."
);

assert.doesNotMatch(
  source,
  /const\s+assigneeIds\s*=\s*Array\.from\([\s\S]*mission-assignee-checkbox:checked/,
  "El formulario ya no debe construir la selección principal como assigneeIds."
);

assert.match(
  source,
  /hasDigitalAccount/,
  "El frontend debe poder reconocer si el destinatario tiene cuenta digital."
);

// La UI no necesita conocer personId ni accountUid.
assert.doesNotMatch(
  source,
  /person\.personId/,
  "El frontend de misiones no debe depender de personId interno."
);

assert.doesNotMatch(
  source,
  /person\.accountUid/,
  "El frontend de misiones no debe depender de accountUid interno."
);

console.log(
  "OK: accountless mission frontend contract passed."
);
