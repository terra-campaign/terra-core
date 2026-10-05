const fs = require("fs");
const assert = require("node:assert/strict");

const source = fs.readFileSync(
  "./mission-delegation.cjs",
  "utf8"
);

assert.match(
  source,
  /participante:'colaborador_base',\s*colaborador_base:'apoyo_territorial'/,
  "NEXT debe permitir colaborador_base -> apoyo_territorial."
);

assert.match(
  source,
  /\[\.\.\.Object\.keys\(NEXT\),'apoyo_territorial'\]/,
  "apoyo_territorial debe ser reconocido como nivel terminal autorizado."
);

assert.match(
  source,
  /\['jefe_estructura','integrante','participante','colaborador_base'\]\.includes\(p\.role\)/,
  "colaborador_base debe conservar la validacion de misma estructura."
);

assert.doesNotMatch(
  source,
  /apoyo_territorial:'[^']+'/,
  "apoyo_territorial no debe tener un nivel inferior."
);

console.log(
  "OK: jerarquia de delegacion Base -> Apoyo validada; Apoyo permanece terminal."
);
