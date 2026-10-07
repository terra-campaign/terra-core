'use strict';

const assert =
  require('node:assert/strict');

const {
  _test
} =
  require(
    './person-deduplication.cjs'
  );


assert.equal(
  _test.normalizePhone(
    '+52 322 123 4567'
  ),
  '3221234567',
  'Debe retirar +52 de un teléfono mexicano de 10 dígitos.'
);


assert.equal(
  _test.normalizePhone(
    '322-123-4567'
  ),
  '3221234567',
  'Debe normalizar separadores del teléfono.'
);


assert.equal(
  _test.normalizeText(
    '  José   Pérez  '
  ),
  'jose perez',
  'Debe normalizar espacios, acentos y mayúsculas.'
);


assert.equal(
  _test.cleanText(
    '  Calle   Juárez  ',
    100
  ),
  'Calle Juárez',
  'Debe limpiar espacios sin destruir el texto.'
);


console.log(
  'OK: helper canónico de deduplicación validado.'
);