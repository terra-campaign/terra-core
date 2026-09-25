'use strict';

const assert =
  require(
    'node:assert/strict'
  );

const fs =
  require(
    'node:fs'
  );

const path =
  require(
    'node:path'
  );


const root =
  path.resolve(
    __dirname,
    '..'
  );


const js =
  fs.readFileSync(
    path.join(
      root,
      'eventos.js'
    ),
    'utf8'
  );


const html =
  fs.readFileSync(
    path.join(
      root,
      'eventos.html'
    ),
    'utf8'
  );


// ======================================================
// CALLABLES
// ======================================================

assert.match(
  js,
  /createGeneralEvent/
);


assert.match(
  js,
  /resolveGeneralEventScope/
);


// ======================================================
// RESPONSABLE DE ORGANIZACION
// ======================================================

assert.match(
  js,
  /workspace\.viewer\.role\s*===\s*"coordinador_municipal"/
);


// ======================================================
// NO SE EXIGE ASSIGNEES EN NUEVO EVENTO
// ======================================================

const submitStart =
  js.indexOf(
    '$("newEventForm")'
  );


const delegationStart =
  js.indexOf(
    '// DELEGAR EVENTO RECIBIDO',
    submitStart
  );


assert.ok(
  submitStart >= 0,
  'No encontré submit de newEventForm.'
);


assert.ok(
  delegationStart >
    submitStart,
  'No encontré fin del bloque de nuevo evento.'
);


const submitBlock =
  js.slice(
    submitStart,
    delegationStart
  );


assert.doesNotMatch(
  submitBlock,
  /Selecciona entre 1 y 50 personas/
);


assert.doesNotMatch(
  submitBlock,
  /event-assignee-checkbox:checked/
);


assert.match(
  submitBlock,
  /createGeneralEvent/
);


assert.match(
  submitBlock,
  /resolveGeneralEventScope/
);


assert.match(
  submitBlock,
  /memberCount/
);


// ======================================================
// HTML
// ======================================================

assert.match(
  html,
  /Crear evento general/
);


assert.match(
  html,
  /Alcance automático/
);


assert.match(
  html,
  /legacyNewEventAssignees/
);


assert.match(
  html,
  /id="legacyNewEventAssignees"\s+hidden/
);


assert.match(
  html,
  /data-event-filter="archived"/
);


console.log(
  'OK: BUILD-118D1C general event UI contract passed.'
);
