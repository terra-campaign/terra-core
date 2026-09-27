"use strict";

const { listProcessableRecoveryRecords } = require("./contribution-reconciliation-recovery-store.cjs");
const { processMissionContributionRecovery } = require("./contribution-reconciliation-recovery-processor.cjs");

const productionRuntime = Object.freeze({
  listProcessable: listProcessableRecoveryRecords,
  processRecovery: processMissionContributionRecovery,
});

async function runContributionRecoverySweep({
  db,
  limit = 25,
  runtime = productionRuntime,
} = {}) {
  if (!runtime || typeof runtime.listProcessable !== "function") {
    throw new Error("RECOVERY_LIST_RUNTIME_REQUIRED");
  }

  if (typeof runtime.processRecovery !== "function") {
    throw new Error("RECOVERY_PROCESS_RUNTIME_REQUIRED");
  }

  const recoveries = await runtime.listProcessable({
    db,
    limit,
  });

  const items = Array.isArray(recoveries)
    ? recoveries
    : [];

  let reconciled = 0;
  let failed = 0;

  for (const item of items) {
    try {
      await runtime.processRecovery({
        db,
        record: item.record,
      });

      reconciled += 1;
    } catch (error) {
      failed += 1;
    }
  }

  return {
    scanned: items.length,
    reconciled,
    failed,
  };
}

module.exports = {
  runContributionRecoverySweep,
  _test: Object.freeze({ productionRuntime }),
};
