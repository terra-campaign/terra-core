'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const html = fs.readFileSync(
  path.join(__dirname, '..', 'apoyos.html'),
  'utf8'
);

const js = fs.readFileSync(
  path.join(__dirname, '..', 'apoyos.js'),
  'utf8'
);

for (const id of [
  'supportDigitalAccountYes',
  'supportDigitalAccountNo',
  'supportDigitalEmailGroup',
  'supportDigitalPasswordGroup',
  'supportEmail',
  'supportPassword'
]) {
  assert.match(
    html,
    new RegExp(`id=["']${id}["']`),
    `Falta ${id} en apoyos.html.`
  );

  assert.match(
    js,
    new RegExp(`#${id}`),
    `Falta enlazar ${id} en apoyos.js.`
  );
}

assert.match(
  js,
  /createDigitalAccount/,
  'apoyos.js debe calcular createDigitalAccount.'
);

assert.match(
  js,
  /supportDigitalEmailGroup[\s\S]*hidden/,
  'Debe controlar visibilidad del correo.'
);

assert.match(
  js,
  /supportDigitalPasswordGroup[\s\S]*hidden/,
  'Debe controlar visibilidad de la contraseña.'
);

assert.match(
  js,
  /createDigitalAccount[\s\S]*email[\s\S]*password/,
  'El payload debe enviar createDigitalAccount, email y password.'
);

assert.match(
  js,
  /createDigitalAccount[\s\S]*password\.length\s*<\s*6/,
  'Debe validar contraseña mínima cuando se crea cuenta.'
);

console.log(
  'OK: UI de cuenta digital opcional para Apoyo Territorial validada.'
);