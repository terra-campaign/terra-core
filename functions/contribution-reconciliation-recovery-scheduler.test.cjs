"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

test("recovery sweep module exposes the server sweep", () => {
  const scheduler = require("./contribution-reconciliation-recovery-scheduler.cjs");
  assert.equal(typeof scheduler.runContributionRecoverySweep, "function");
});
