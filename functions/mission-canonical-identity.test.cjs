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

// ======================================================
// IDENTIDAD CANÓNICA DE DESTINATARIO DE MISIÓN
//
// personId   = identidad operacional primaria.
// accountUid = cuenta digital opcional.
// assignedTo = UID legado/compatibilidad durante transición.
// ======================================================

const canonicalPersonAssignments =
  source.match(
    /personId\s*:\s*targetIdentity\.personId/g
  ) || [];

const canonicalAccountAssignments =
  source.match(
    /accountUid\s*:\s*uid/g
  ) || [];

assert.ok(
  canonicalPersonAssignments.length >= 2,
  "misiones y missionLinks deben guardar personId canónico."
);

assert.ok(
  canonicalAccountAssignments.length >= 2,
  "misiones y missionLinks deben guardar accountUid explícito."
);

// ======================================================
// COMPATIBILIDAD
// ======================================================

assert.match(
  source,
  /assignedTo\s*:\s*uid/,
  "assignedTo debe conservarse como compatibilidad con el contrato actual."
);

// ======================================================
// PROHIBICIÓN
//
// UID nunca debe presentarse como personId.
// ======================================================

assert.doesNotMatch(
  source,
  /personId\s*:\s*uid\b/,
  "Firebase UID no puede utilizarse como personId."
);

console.log(
  "OK: canonical mission identity contract passed."
);
