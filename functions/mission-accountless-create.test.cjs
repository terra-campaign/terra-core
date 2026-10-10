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
// B7B — ENTRADA DUAL
// ======================================================

assert.match(
  block,
  /assigneeRefs/,
  "createLinkedMissions debe aceptar assigneeRefs opacos."
);

assert.match(
  block,
  /assigneeIds/,
  "Debe conservar compatibilidad temporal con assigneeIds digitales."
);

assert.match(
  block,
  /selectionMode/,
  "Debe distinguir selección por referencia o por UID."
);

// ======================================================
// RESOLUCIÓN CANÓNICA SERVER-SIDE
// ======================================================

assert.match(
  block,
  /collection\(\s*['"]territorialMemberships['"]\s*\)/,
  "Debe resolver membresías territoriales canónicas."
);

assert.match(
  block,
  /collection\(\s*['"]persons['"]\s*\)/,
  "Debe resolver personas canónicas."
);

assert.match(
  block,
  /parentPersonId/,
  "La jerarquía debe poder validarse por parentPersonId."
);

assert.match(
  block,
  /hash\(\s*['"]mission-assignee['"]/,
  "El servidor debe recomputar assigneeRef."
);

// ======================================================
// IDENTIDAD DIGITAL + ACCOUNTLESS
// ======================================================

assert.match(
  block,
  /const\s+assignedTo\s*=\s*accountUid\s*\|\|\s*null/,
  "assignedTo debe derivarse de accountUid y admitir null."
);

const accountPersistence =
  block.match(
    /accountUid\s*:\s*accountUid\s*\|\|\s*null/g
  ) || [];

assert.ok(
  accountPersistence.length >= 2,
  "misiones y missionLinks deben persistir accountUid nullable."
);

const personPersistence =
  block.match(
    /\bpersonId\s*,/g
  ) || [];

assert.ok(
  personPersistence.length >= 2,
  "misiones y missionLinks deben persistir personId canónico."
);

const assignedToPersistence =
  block.match(
    /\bassignedTo\s*,/g
  ) || [];

assert.ok(
  assignedToPersistence.length >= 2,
  "misiones y missionLinks deben conservar assignedTo."
);

// ======================================================
// CAMINO DIGITAL LEGADO COMPATIBLE
// ======================================================

assert.match(
  block,
  /selectionMode\s*===\s*['"]uid['"]/,
  "Debe conservar el camino digital por UID."
);

assert.match(
  block,
  /accountUid\s*=\s*targetIdentity\.accountUid\s*\|\|\s*null/,
  "El camino digital debe resolver accountUid desde la identidad canónica."
);

// ======================================================
// NO DEPENDER EXCLUSIVAMENTE DE UID
// ======================================================

assert.doesNotMatch(
  block,
  /for\s*\(\s*const\s+uid\s+of\s+ids\s*\)/,
  "La creación no puede depender exclusivamente de recorrer UIDs."
);

assert.doesNotMatch(
  block,
  /personId\s*:\s*uid\b/,
  "Firebase UID nunca puede convertirse en personId."
);

console.log(
  "OK: accountless mission creation contract passed."
);
