const fs = require("fs");
const assert = require("node:assert/strict");

const source = fs.readFileSync(
  "./eventos.js",
  "utf8"
);

assert.match(
  source,
  /apoyo_territorial:\s*"Apoyo territorial"/,
  'Eventos debe mostrar "Apoyo territorial" en ROLE_LABELS.'
);

assert.doesNotMatch(
  source,
  /workspace\?\.viewer\?\.role ===\s*"colaborador_base"/,
  "Colaborador base ya no debe ser tratado como terminal visual."
);

assert.doesNotMatch(
  source,
  /workspace\?\.viewer\?\.role !==\s*"colaborador_base"/,
  "La visibilidad terminal ya no debe depender de colaborador_base."
);

assert.doesNotMatch(
  source,
  /workspace\.viewer\.role ===\s*"colaborador_base"/,
  "Render general ya no debe marcar colaborador_base como terminal."
);

assert.match(
  source,
  /workspace\?\.viewer\?\.role ===\s*"apoyo_territorial"/,
  "Apoyo territorial debe ser el terminal visual en accesos rapidos."
);

assert.match(
  source,
  /workspace\?\.viewer\?\.role !==\s*"apoyo_territorial"/,
  "La seccion de transporte debe ocultarse al apoyo territorial."
);

assert.match(
  source,
  /workspace\.viewer\.role ===\s*"apoyo_territorial"/,
  "Render general debe tratar apoyo_territorial como terminal."
);

console.log(
  "OK: jerarquia frontend de Eventos Base -> Apoyo validada."
);
