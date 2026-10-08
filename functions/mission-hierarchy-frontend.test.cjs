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


assert.match(
  source,
  /function\s+canCreateNewMission\s*\(/
);

assert.match(
  source,
  /"lider_principal",\s*"coordinador_municipal",\s*"jefe_estructura"/,
  "Solo lider, coordinador y jefe deben formar la politica de creacion."
);

assert.match(
  source,
  /case "lider_principal":\s*return "coordinador_municipal";/,
  "Lider principal debe delegar a coordinador municipal."
);

assert.doesNotMatch(
  source,
  /case "admin":\s*return "coordinador_municipal";/,
  "Admin tecnico no debe participar en la cadena operativa de delegacion."
);

assert.match(
  source,
  /newMissionButton\.hidden\s*=\s*!canCreateNewMission\s*\(/,
  "El boton Nueva mision debe depender del permiso de creacion."
);

assert.match(
  source,
  /!parent\s*&&\s*!canCreateNewMission\s*\(/,
  "La apertura del modal debe bloquear creacion no autorizada."
);

assert.match(
  source,
  /!parentMission\s*&&\s*!canCreateNewMission\s*\(/,
  "El submit debe bloquear creacion no autorizada."
);

console.log(
  "OK: politica frontend de creacion y delegacion de misiones."
);