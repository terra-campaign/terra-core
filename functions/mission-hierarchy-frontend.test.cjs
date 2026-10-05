const fs = require("fs");
const assert = require("node:assert/strict");

const source = fs.readFileSync(
  "./misiones.js",
  "utf8"
);

assert.match(
  source,
  /case "participante":\s*return "colaborador_base";/,
  "Participante debe asignar a colaborador_base."
);

assert.match(
  source,
  /case "colaborador_base":\s*return "apoyo_territorial";/,
  "Colaborador base debe asignar a apoyo_territorial."
);

assert.match(
  source,
  /case "apoyo_territorial":\s*return null;/,
  "Apoyo territorial debe permanecer terminal."
);

assert.match(
  source,
  /"apoyo_territorial"/,
  "Apoyo territorial debe estar reconocido por la interfaz de Misiones."
);

assert.match(
  source,
  /apoyo_territorial:\s*"Apoyo territorial"/,
  "Debe existir la etiqueta visual Apoyo territorial."
);

console.log(
  "OK: jerarquia frontend de Misiones Base -> Apoyo validada."
);
