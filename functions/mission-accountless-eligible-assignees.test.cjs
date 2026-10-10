"use strict";

const assert =
  require("node:assert/strict");

const fs =
  require("node:fs");

const path =
  require("node:path");

const source =
  fs.readFileSync(
    path.join(
      __dirname,
      "mission-delegation.cjs"
    ),
    "utf8"
  );

const callableStart =
  source.indexOf(
    "exports.getEligibleMissionAssignees"
  );

const callableEnd =
  source.indexOf(
    "exports.getMissionBranchProgress",
    callableStart
  );

assert.ok(
  callableStart >= 0 &&
  callableEnd > callableStart,
  "Debe existir getEligibleMissionAssignees."
);

const block =
  source.slice(
    callableStart,
    callableEnd
  );

assert.match(
  block,
  /collection\(\s*['"]territorialMemberships['"]\s*\)/,
  "El buscador debe partir de territorialMemberships."
);

assert.match(
  block,
  /parentPersonId/,
  "La jerarquía debe poder resolverse por parentPersonId."
);

assert.match(
  block,
  /collection\(\s*['"]persons['"]\s*\)/,
  "El buscador debe resolver persons."
);

assert.match(
  block,
  /const\s+personId\s*=/,
  "El servidor debe trabajar internamente con personId."
);

assert.match(
  block,
  /const\s+accountUid\s*=/,
  "El servidor debe resolver accountUid opcional."
);

assert.match(
  block,
  /const\s+assigneeRef\s*=/,
  "Debe generar una referencia opaca de destinatario."
);

assert.match(
  block,
  /hash\(\s*['"]mission-assignee['"]/,
  "assigneeRef debe derivarse con el hash existente."
);

const publicPushStart =
  block.indexOf(
    "eligible.push({"
  );

const publicPushEnd =
  block.indexOf(
    "});",
    publicPushStart
  );

assert.ok(
  publicPushStart >= 0 &&
  publicPushEnd > publicPushStart,
  "Debe poder aislarse la respuesta pública."
);

const publicObject =
  block.slice(
    publicPushStart,
    publicPushEnd
  );

assert.match(
  publicObject,
  /assigneeRef/,
  "La respuesta pública debe incluir assigneeRef."
);

assert.match(
  publicObject,
  /hasDigitalAccount/,
  "Debe indicar si existe cuenta digital."
);

assert.doesNotMatch(
  publicObject,
  /\bpersonId\b/,
  "La respuesta pública no debe exponer personId."
);

assert.doesNotMatch(
  publicObject,
  /\baccountUid\b/,
  "La respuesta pública no debe exponer accountUid."
);

assert.doesNotMatch(
  publicObject,
  /activityPreferences/,
  "La respuesta pública no debe exponer activityPreferences."
);

assert.doesNotMatch(
  block,
  /const\s+usersQuery[\s\S]*collection\(\s*['"]usuarios['"]\s*\)/,
  "El descubrimiento no debe depender de usuarios como fuente primaria."
);

console.log(
  "OK: accountless mission eligible assignees contract passed."
);
