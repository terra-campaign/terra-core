'use strict';

const assert =
  require(
    'node:assert/strict'
  );

const fs =
  require(
    'node:fs'
  );

const source =
  fs.readFileSync(
    require.resolve(
      './event-general.cjs'
    ),
    'utf8'
  );

const createPos =
  source.indexOf(
    'exports.createGeneralEvent ='
  );

assert.ok(
  createPos >= 0,
  'Debe existir createGeneralEvent.'
);

const createSource =
  source.slice(
    createPos
  );

const receiptReadPos =
  createSource.indexOf(
    'const receiptSnapshot ='
  );

const receiptExistsPos =
  createSource.indexOf(
    'receiptSnapshot.exists',
    receiptReadPos
  );

const returnSavedPos =
  createSource.indexOf(
    'return saved.result;',
    receiptExistsPos
  );

const startsAtValidationPos =
  createSource.indexOf(
    'const startsAtMillis =',
    returnSavedPos
  );

const confirmationValidationPos =
  createSource.indexOf(
    'const confirmationClosesAtMillis =',
    startsAtValidationPos
  );

const activityCheckPos =
  createSource.indexOf(
    'if (!activityClassification) {',
    confirmationValidationPos
  );

assert.ok(
  receiptReadPos >= 0,
  'Debe leerse el recibo idempotente.'
);

assert.ok(
  receiptExistsPos > receiptReadPos,
  'Debe comprobarse si ya existe el recibo.'
);

assert.ok(
  returnSavedPos > receiptExistsPos,
  'Un reintento válido debe devolver saved.result.'
);

assert.ok(
  startsAtValidationPos > returnSavedPos,
  'La validación de fecha debe ocurrir después de recuperar un intento idempotente existente.'
);

assert.ok(
  confirmationValidationPos >
    startsAtValidationPos,
  'La validación del cierre de confirmaciones debe permanecer después de la fecha de inicio.'
);

assert.ok(
  activityCheckPos >
    confirmationValidationPos,
  'La creación nueva debe continuar después de las validaciones temporales.'
);

const temporalValidationBeforeReceipt =
  createSource
    .slice(
      0,
      returnSavedPos
    )
    .includes(
      'const startsAtMillis ='
    );

assert.equal(
  temporalValidationBeforeReceipt,
  false,
  'No debe existir validación temporal antes de recuperar el resultado idempotente.'
);

console.log(
  'OK: createGeneralEvent recupera primero el intento idempotente y valida fechas solo para una creación nueva.'
);
