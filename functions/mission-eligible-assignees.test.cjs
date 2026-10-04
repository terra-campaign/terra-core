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
// NUEVO CALLABLE DE DESTINATARIOS ELEGIBLES
// ======================================================

assert.match(
  source,
  /exports\.getEligibleMissionAssignees\s*=\s*onCall/,
  "Debe existir getEligibleMissionAssignees."
);


// ======================================================
// DEBE REUTILIZAR AUTORIZACION EXISTENTE
// ======================================================

assert.match(
  source,
  /await caller\(tx,\s*db,\s*request\)/,
  "Debe autenticar mediante caller()."
);

assert.match(
  source,
  /targetAllowed\(p,\s*[^)]+\)/,
  "Debe reutilizar targetAllowed()."
);


// ======================================================
// ACTIVIDAD NUEVA O HEREDADA
// ======================================================

assert.match(
  source,
  /classifyMissionActivity/,
  "Debe validar actividades nuevas con el catálogo oficial."
);

assert.match(
  source,
  /parent\.content\?\.activityCode/,
  "La delegación debe usar el activityCode heredado."
);


// ======================================================
// IDENTIDAD Y MEMBRESIA CANONICAS
// ======================================================

assert.match(
  source,
  /resolveCanonicalPersonForAccount/,
  "Debe resolver identidad canónica."
);

assert.match(
  source,
  /canonicalMembershipDocumentId/,
  "Debe usar el identificador canónico de membresía."
);

assert.match(
  source,
  /membershipMatchesSubject/,
  "Debe validar que la membresía corresponda a la persona."
);


// ======================================================
// MOTOR OFICIAL DE ELEGIBILIDAD
// ======================================================

assert.match(
  source,
  /evaluateMissionAssigneeEligibility/,
  "Debe usar el motor oficial de elegibilidad."
);


// ======================================================
// RESPUESTA SANITIZADA
// ======================================================

assert.match(
  source,
  /uid:/,
  "Debe devolver uid para el contrato actual de misiones."
);

assert.match(
  source,
  /name:/,
  "Debe devolver nombre."
);

assert.match(
  source,
  /role:/,
  "Debe devolver rol."
);


// ======================================================
// NO EXPONER DATOS INTERNOS
// ======================================================

const callableStart =
  source.indexOf(
    "exports.getEligibleMissionAssignees"
  );

const nextCallable =
  source.indexOf(
    "exports.getMissionBranchProgress",
    callableStart
  );

assert.ok(
  callableStart >= 0,
  "Debe existir el callable."
);

assert.ok(
  nextCallable > callableStart,
  "Debe poder aislarse el cuerpo del callable."
);

const callableSource =
  source.slice(
    callableStart,
    nextCallable
  );


// ======================================================
// RESPUESTA PUBLICA SANITIZADA
//
// El callable puede usar internamente:
// - personId
// - activityPreferences
//
// Lo que no debe hacer es devolverlos al navegador.
// ======================================================

const publicPushStart =
  callableSource.indexOf(
    "eligible.push({"
  );

assert.ok(
  publicPushStart >= 0,
  "Debe existir la construcción explícita de la respuesta pública."
);

const publicPushEnd =
  callableSource.indexOf(
    "});",
    publicPushStart
  );

assert.ok(
  publicPushEnd >
    publicPushStart,
  "Debe poder aislarse el objeto público del destinatario."
);

const publicAssigneeSource =
  callableSource.slice(
    publicPushStart,
    publicPushEnd
  );

assert.doesNotMatch(
  publicAssigneeSource,
  /activityPreferences/,
  "La respuesta pública no debe exponer activityPreferences."
);

assert.doesNotMatch(
  publicAssigneeSource,
  /personId/,
  "La respuesta pública no debe exponer personId."
);


console.log(
  "OK: eligible mission assignees callable contract passed."
);
