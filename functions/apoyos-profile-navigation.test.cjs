"use strict";

const test =
  require("node:test");

const assert =
  require("node:assert/strict");

const fs =
  require("node:fs");

const path =
  require("node:path");

const apoyosPath =
  path.join(
    __dirname,
    "..",
    "apoyos.js"
  );

const source =
  fs.readFileSync(
    apoyosPath,
    "utf8"
  );

test(
  "apoyos renders canonical profile navigation using member.personId",
  () => {

    assert.match(
      source,
      /member\?\.personId/
    );

    assert.match(
      source,
      /persona\.html\?id=/
    );

    assert.match(
      source,
      /encodeURIComponent\(\s*member\.personId\s*\)/
    );
  }
);