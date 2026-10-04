"use strict";

const assert =
  require("node:assert/strict");

const fs =
  require("node:fs");

const source =
  fs.readFileSync(
    "./misiones.js",
    "utf8"
  );


// ======================================================
// CALLABLE FRONTEND
// ======================================================

assert.match(
  source,
  /const getEligibleMissionAssignees\s*=\s*httpsCallable\(\s*functions,\s*["']getEligibleMissionAssignees["']\s*\)/,
  "misiones.js debe declarar el callable getEligibleMissionAssignees."
);


// ======================================================
// AISLAR loadAvailableAssignees
// ======================================================

const loadStart =
  source.indexOf(
    "async function loadAvailableAssignees()"
  );

const selectAllStart =
  source.indexOf(
    "missionSelectAll.addEventListener",
    loadStart
  );

assert.ok(
  loadStart >= 0,
  "Debe existir loadAvailableAssignees()."
);

assert.ok(
  selectAllStart > loadStart,
  "Debe poder aislarse loadAvailableAssignees()."
);

const loadSource =
  source.slice(
    loadStart,
    selectAllStart
  );


// ======================================================
// YA NO DEBE CONSULTAR usuarios DIRECTAMENTE
// ======================================================

assert.doesNotMatch(
  loadSource,
  /getDocs\s*\(/,
  "loadAvailableAssignees no debe consultar Firestore directamente."
);

assert.doesNotMatch(
  loadSource,
  /collection\(\s*db,\s*["']usuarios["']/,
  "loadAvailableAssignees no debe construir consulta directa a usuarios."
);


// ======================================================
// NUEVA MISIÓN: REQUIERE ACTIVIDAD ANTES DE CONSULTAR
// ======================================================

assert.match(
  loadSource,
  /missionActivityCodeInput\.value/,
  "Debe leer el tipo de actividad seleccionado."
);

assert.match(
  loadSource,
  /parentMission/,
  "Debe distinguir misión nueva de delegación."
);


// ======================================================
// LLAMADA SERVER-SIDE
// ======================================================

assert.match(
  loadSource,
  /await\s+getEligibleMissionAssignees\s*\(/,
  "Debe consultar la elegibilidad al servidor."
);

assert.match(
  loadSource,
  /activityCode(?:\s*:|\s*\n\s*})/,
  "Una misión nueva debe enviar activityCode."
);

assert.match(
  loadSource,
  /parentMissionId\s*:/,
  "Una delegación debe enviar parentMissionId."
);


// ======================================================
// RESPUESTA DEL SERVIDOR
// ======================================================

assert.match(
  loadSource,
  /\.data\.eligible|data\.eligible/,
  "Debe renderizar únicamente la lista eligible devuelta por el servidor."
);


// ======================================================
// CAMBIO DE ACTIVIDAD = RECARGAR ELEGIBLES
// ======================================================

assert.match(
  source,
  /missionActivityCodeInput\.addEventListener\(\s*["']change["']/,
  "Cambiar el tipo de actividad debe volver a cargar destinatarios."
);


// ======================================================
// TODOS = CHECKBOXES VISIBLES/ELEGIBLES
// ======================================================

assert.match(
  source,
  /querySelectorAll\(\s*["']\.mission-assignee-checkbox["']\s*\)/,
  "Todos debe operar sobre los destinatarios elegibles renderizados."
);


// ======================================================
// RESPUESTAS ATRASADAS
// ======================================================

assert.match(
  loadSource,
  /loadAvailableAssignees\s*\.requestVersion/,
  "Debe versionar cada carga de destinatarios."
);

assert.match(
  loadSource,
  /requestVersion\s*!==\s*loadAvailableAssignees\s*\.requestVersion/,
  "Una respuesta anterior no debe reemplazar una carga m?s reciente."
);

assert.match(
  loadSource,
  /missionModal\.hidden/,
  "Una respuesta tard?a no debe renderizar si el modal ya est? cerrado."
);

assert.match(
  loadSource,
  /currentParentMissionId/,
  "Debe confirmar que la misi?n padre siga siendo la misma."
);

assert.match(
  loadSource,
  /currentActivityCode/,
  "Debe confirmar que el tipo de actividad siga siendo el mismo."
);


console.log(
  "OK: mission eligible assignees frontend contract passed."
);
