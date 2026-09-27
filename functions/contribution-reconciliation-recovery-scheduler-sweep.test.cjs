"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

test("recovery sweep isolates an individual failure", async () => {
  const { runContributionRecoverySweep } = require("./contribution-reconciliation-recovery-scheduler.cjs");
  const processed = [];
  const runtime = {
    async listProcessable({ db, limit }) {
      assert.equal(db.id, "DB");
      assert.equal(limit, 25);
      return [
        { recoveryId: "REC-1", record: { operationId: "OP-1", status: "PENDING" } },
        { recoveryId: "REC-2", record: { operationId: "OP-2", status: "RETRY_REQUIRED" } },
        { recoveryId: "REC-3", record: { operationId: "OP-3", status: "PENDING" } },
      ];
    },
    async processRecovery({ db, record }) {
      assert.equal(db.id, "DB");
      processed.push(record.operationId);
      if (record.operationId === "OP-2") throw new Error("SIMULATED_RECOVERY_FAILURE");
      return { status: "RECONCILED" };
    },
  };
  const result = await runContributionRecoverySweep({ db: { id: "DB" }, limit: 25, runtime });
  assert.deepEqual(processed, ["OP-1", "OP-2", "OP-3"]);
  assert.deepEqual(result, { scanned: 3, reconciled: 2, failed: 1 });
});

test("recovery sweep isolates a malformed recovery record and continues", async () => {
  const {
    runContributionRecoverySweep,
  } = require("./contribution-reconciliation-recovery-scheduler.cjs");

  const processed = [];

  const runtime = {
    async listProcessable() {
      return [
        {
          recoveryId: "REC-VALID-1",
          record: {
            operationId: "OP-VALID-1",
            status: "PENDING",
          },
        },
        {
          recoveryId: "REC-CORRUPT",
          record: null,
        },
        {
          recoveryId: "REC-VALID-2",
          record: {
            operationId: "OP-VALID-2",
            status: "PENDING",
          },
        },
      ];
    },

    async processRecovery({ record }) {
      if (!record || typeof record.operationId !== "string") {
        throw new Error("INVALID_RECOVERY_RECORD");
      }

      processed.push(record.operationId);

      return {
        status: "RECONCILED",
      };
    },
  };

  const result =
    await runContributionRecoverySweep({
      db: { id: "DB" },
      limit: 25,
      runtime,
    });

  assert.deepEqual(
    processed,
    [
      "OP-VALID-1",
      "OP-VALID-2",
    ]
  );

  assert.deepEqual(
    result,
    {
      scanned: 3,
      reconciled: 2,
      failed: 1,
    }
  );
});