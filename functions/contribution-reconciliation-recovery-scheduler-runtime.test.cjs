"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

test("recovery scheduler exposes the official production runtime", () => {
  const scheduler =
    require("./contribution-reconciliation-recovery-scheduler.cjs");

  const store =
    require("./contribution-reconciliation-recovery-store.cjs");

  const processor =
    require("./contribution-reconciliation-recovery-processor.cjs");

  assert.equal(
    scheduler._test.productionRuntime.listProcessable,
    store.listProcessableRecoveryRecords
  );

  assert.equal(
    scheduler._test.productionRuntime.processRecovery,
    processor.processMissionContributionRecovery
  );
});
