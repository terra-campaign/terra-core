'use strict';

const fs =
  require('node:fs');

const path =
  require('node:path');

const assert =
  require('node:assert/strict');


const htmlPath =
  path.join(
    __dirname,
    '..',
    'incorporacion-ascendente.html'
  );

const jsPath =
  path.join(
    __dirname,
    '..',
    'incorporacion-ascendente.js'
  );


assert.equal(
  fs.existsSync(htmlPath),
  true,
  'Debe existir incorporacion-ascendente.html.'
);

assert.equal(
  fs.existsSync(jsPath),
  true,
  'Debe existir incorporacion-ascendente.js.'
);


const html =
  fs.readFileSync(
    htmlPath,
    'utf8'
  );

const js =
  fs.readFileSync(
    jsPath,
    'utf8'
  );


// ======================================================
// HTML
// ======================================================

assert.match(
  html,
  /Mi organización/,
  'La pantalla debe formar parte de Mi organización.'
);

assert.match(
  html,
  /Incorporar persona/,
  'Debe existir la acción de incorporar persona.'
);

assert.match(
  html,
  /targetRole/,
  'Debe existir selección de nivel objetivo.'
);

assert.match(
  html,
  /parentPersonId/,
  'Debe existir selección del responsable jerárquico.'
);

assert.match(
  html,
  /Correo electrónico/,
  'La cuenta digital requiere correo.'
);

assert.match(
  html,
  /Contraseña temporal/,
  'La cuenta digital requiere contraseña temporal.'
);


// ======================================================
// JAVASCRIPT
// ======================================================

assert.match(
  js,
  /getUpwardIncorporationContext/,
  'Debe cargar el contexto autorizado.'
);

assert.match(
  js,
  /createUpwardIncorporation/,
  'Debe utilizar el callable de incorporación ascendente.'
);

assert.match(
  js,
  /participante/,
  'Debe soportar incorporación de Participante.'
);

assert.match(
  js,
  /apoyo_territorial/,
  'Debe soportar incorporación de Apoyo Territorial.'
);

assert.match(
  js,
  /parentCandidates/,
  'Debe renderizar responsables válidos entregados por backend.'
);

assert.match(
  js,
  /parentPersonId/,
  'Debe enviar el padre jerárquico seleccionado.'
);

assert.match(
  js,
  /targetRole/,
  'Debe enviar el rol objetivo.'
);

assert.doesNotMatch(
  html,
  /¿Crear cuenta digital\?/,
  'En incorporación ascendente la cuenta digital no debe ser opcional.'
);


console.log(
  'OK: contrato UI de incorporación ascendente validado.'
);