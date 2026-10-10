"use strict";

const assert =
  require("node:assert/strict");

const fs =
  require("node:fs");

const path =
  require("node:path");

const file =
  path.join(
    __dirname,
    "mission-delegation.cjs"
  );

const source =
  fs.readFileSync(
    file,
    "utf8"
  );

// ======================================================
// IMPORTS / CONTRATOS OBLIGATORIOS
// ======================================================

assert.match(
  source,
  /resolveCanonicalPersonForAccount/
);

assert.match(
  source,
  /canonicalMembershipDocumentId/
);

assert.match(
  source,
  /membershipMatchesSubject/
);

assert.match(
  source,
  /evaluateMissionAssigneeEligibility/
);

// ======================================================
// AISLAR createLinkedMissions
// ======================================================

const createStart =
  source.indexOf(
    "exports.createLinkedMissions"
  );

const createEnd =
  source.indexOf(
    "exports.getEligibleMissionAssignees",
    createStart
  );

assert.ok(
  createStart >= 0 &&
  createEnd > createStart,
  "Debe poder aislarse createLinkedMissions."
);

const block =
  source.slice(
    createStart,
    createEnd
  );

// ======================================================
// ACTIVIDAD EFECTIVA
// ======================================================

assert.match(
  block,
  /const effectiveActivityCode\s*=\s*parent\s*\?\s*parent\.content\?\.activityCode\s*:\s*fields\?\.activityCode/
);

// ======================================================
// B7 - DOS CAMINOS DE DESTINATARIO
// ======================================================

assert.match(
  block,
  /selectionMode\s*===\s*['"]uid['"]/,
  "Debe existir el camino legado por UID."
);

assert.match(
  block,
  /selectionMode\s*===\s*['"]ref['"]/,
  "Debe existir el camino canónico por assigneeRef."
);

// ======================================================
// CAMINO UID
//
// Jerarquía sobre perfil digital antes de resolver
// identidad canónica del destinatario.
// ======================================================

const uidModeIndex =
  block.indexOf(
    "selectionMode === 'uid'"
  );

const uidHierarchyIndex =
  block.indexOf(
    "targetAllowed(",
    uidModeIndex
  );

const uidIdentityIndex =
  block.indexOf(
    "const targetIdentity =",
    uidModeIndex
  );

assert.ok(
  uidModeIndex >= 0,
  "Debe existir el camino UID."
);

assert.ok(
  uidHierarchyIndex > uidModeIndex,
  "El camino UID debe validar jerarquía con targetAllowed()."
);

assert.ok(
  uidIdentityIndex > uidHierarchyIndex,
  "En camino UID, la jerarquía debe validarse antes de resolver identidad del destinatario."
);

// ======================================================
// CAMINO assigneeRef
//
// La membresía canónica es la fuente primaria.
// Debe validarse antes de resolver la persona.
// ======================================================

const refModeIndex =
  block.indexOf(
    "if (selectionMode === 'ref')"
  );

const refMembershipQueryIndex =
  block.indexOf(
    "'territorialMemberships'",
    refModeIndex
  );

const refHierarchyIndex =
  block.indexOf(
    "targetAllowed(",
    refMembershipQueryIndex
  );

const refPersonReadIndex =
  block.indexOf(
    "'persons'",
    refHierarchyIndex
  );

assert.ok(
  refModeIndex >= 0,
  "Debe existir el camino assigneeRef."
);

assert.ok(
  refMembershipQueryIndex > refModeIndex,
  "assigneeRef debe partir de territorialMemberships."
);

assert.ok(
  refHierarchyIndex > refMembershipQueryIndex,
  "assigneeRef debe validar jerarquía mediante targetAllowed()."
);

assert.ok(
  refPersonReadIndex > refHierarchyIndex,
  "La jerarquía canónica debe validarse antes de resolver persons."
);

// ======================================================
// MEMBRESÍA CANÓNICA EN CAMINO UID
// ======================================================

const membershipIdIndex =
  block.indexOf(
    "canonicalMembershipDocumentId(",
    uidIdentityIndex
  );

const membershipReadIndex =
  block.indexOf(
    "'territorialMemberships'",
    membershipIdIndex
  );

const membershipValidationIndex =
  block.indexOf(
    "membershipMatchesSubject({",
    membershipReadIndex
  );

assert.ok(
  membershipIdIndex > uidIdentityIndex,
  "Después de resolver identidad UID debe calcular membershipId."
);

assert.ok(
  membershipReadIndex > membershipIdIndex,
  "membershipId debe calcularse antes de leer territorialMemberships."
);

assert.ok(
  membershipValidationIndex > membershipReadIndex,
  "La membresía debe leerse antes de validarse."
);

// ======================================================
// ELEGIBILIDAD ANTES DE ESCRITURAS
// ======================================================

const eligibilityIndex =
  block.lastIndexOf(
    "evaluateMissionAssigneeEligibility({"
  );

const contentIndex =
  block.indexOf(
    "const content ="
  );

const firstWriteIndex =
  block.indexOf(
    "tx.create("
  );

assert.ok(
  eligibilityIndex >= 0,
  "Debe existir evaluación de elegibilidad."
);

assert.ok(
  contentIndex > eligibilityIndex,
  "La elegibilidad debe validarse antes de construir el contenido persistente."
);

assert.ok(
  firstWriteIndex > contentIndex,
  "Todas las validaciones deben ocurrir antes de la primera escritura."
);

// ======================================================
// PROTECCIONES DE IDENTIDAD
// ======================================================

assert.doesNotMatch(
  block,
  /personId\s*:\s*uid\b/,
  "UID no puede persistirse como personId."
);

assert.doesNotMatch(
  block,
  /personId\s*=\s*uid\b/,
  "UID no puede convertirse en personId."
);

console.log(
  "OK: mission delegation eligibility integration contract passed."
);
