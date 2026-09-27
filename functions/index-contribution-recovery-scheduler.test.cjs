"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(
  path.join(__dirname, "index.js"),
  "utf8"
);

test("index exposes a Gen2 scheduled contribution recovery worker", () => {
  assert.match(
    source,
    /require\(\s*["']firebase-functions\/v2\/scheduler["']\s*\)/
  );

  assert.match(
    source,
    /exports\.reconcileContributionRecovery\s*=\s*onSchedule\s*\(/
  );

  assert.match(
    source,
    /runContributionRecoverySweep\s*\(\s*\{\s*db\s*\}\s*\)/
  );
});