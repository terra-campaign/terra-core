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
      "mission-delegation.cjs"
    ),
    "utf8"
  );

const start =
  source.indexOf(
    "exports.createLinkedMissions"
  );

const end =
  source.indexOf(
    "exports.getEligibleMissionAssignees",
    start
  );

assert.ok(
  start >= 0 &&
  end > start,
  "Debe poder aislarse createLinkedMissions."
);

const block =
  source.slice(
    start,
    end
  );

// ======================================================
// B6 — IDENTIDAD CANÓNICA DE DESTINATARIO
//
// personId   = identidad operacional primaria.
// accountUid = cuenta digital opcional.
// assignedTo = UID de compatibilidad o null.
// ======================================================

// Camino digital:
// el UID se resuelve a identidad canónica.
assert.match(
  block,
  /personId\s*=\s*targetIdentity\.personId/,
  "El camino digital debe resolver personId canónico."
);

assert.match(
  block,
  /accountUid\s*=\s*targetIdentity\.accountUid\s*\|\|\s*null/,
  "El camino digital debe resolver accountUid explícito."
);

// Persistencia común digital/accountless.
const personPersistence =
  block.match(
    /\bpersonId\s*,/g
  ) || [];

assert.ok(
  personPersistence.length >= 2,
  "misiones y missionLinks deben guardar personId canónico."
);

const accountPersistence =
  block.match(
    /accountUid\s*:\s*accountUid\s*\|\|\s*null/g
  ) || [];

assert.ok(
  accountPersistence.length >= 2,
  "misiones y missionLinks deben guardar accountUid explícito y nullable."
);

const assignedToPersistence =
  block.match(
    /\bassignedTo\s*,/g
  ) || [];

assert.ok(
  assignedToPersistence.length >= 2,
  "misiones y missionLinks deben conservar assignedTo."
);

assert.match(
  block,
  /const\s+assignedTo\s*=\s*accountUid\s*\|\|\s*null/,
  "assignedTo debe ser UID cuando existe cuenta y null cuando no existe."
);

// Protección fundamental:
assert.doesNotMatch(
  block,
  /personId\s*:\s*uid\b/,
  "Firebase UID no puede utilizarse como personId."
);

assert.doesNotMatch(
  block,
  /personId\s*=\s*uid\b/,
  "Firebase UID no puede asignarse como personId."
);

console.log(
  "OK: canonical mission identity contract passed."
);
