const fs = require("fs");
const assert = require("node:assert/strict");

const source = fs.readFileSync(
  "./onboarding.js",
  "utf8"
);

assert.match(
  source,
  /apoyo_territorial:\s*"Apoyo territorial"/,
  'Onboarding debe mostrar "Apoyo territorial" para apoyo_territorial.'
);

console.log(
  "OK: etiqueta de apoyo_territorial en onboarding validada."
);
