"use strict";

process.env.NODE_ENV = "test";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  listProcessableRecoveryRecords,
} = require(
  "./contribution-reconciliation-recovery-store.cjs"
);

test(
  "recovery store rejects an unbounded recovery sweep",
  async () => {
    const db = {
      collection() {
        throw new Error(
          "QUERY_MUST_NOT_RUN"
        );
      },
    };

    await assert.rejects(
      () =>
        listProcessableRecoveryRecords({
          db,
          limit: 101,
        }),
      /RECOVERY_LIST_LIMIT_INVALID/
    );
  }
);
