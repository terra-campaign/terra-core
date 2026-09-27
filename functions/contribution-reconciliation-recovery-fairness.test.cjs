"use strict";

process.env.NODE_ENV = "test";

const test = require("node:test");
const assert = require("node:assert/strict");

test(
  "recovery store orders processable recoveries by oldest updatedAt first",
  async () => {
    const {
      listProcessableRecoveryRecords,
    } = require(
      "./contribution-reconciliation-recovery-store.cjs"
    );

    const calls = {};

    const db = {
      collection() {
        return {
          where() {
            return {
              orderBy(field, direction) {
                calls.orderBy = {
                  field,
                  direction,
                };

                return {
                  limit(value) {
                    calls.limit = value;

                    return {
                      async get() {
                        return {
                          docs: [],
                        };
                      },
                    };
                  },
                };
              },
            };
          },
        };
      },
    };

    const result =
      await listProcessableRecoveryRecords({
        db,
        limit: 25,
      });

    assert.deepEqual(
      calls.orderBy,
      {
        field: "updatedAt",
        direction: "asc",
      }
    );

    assert.equal(calls.limit, 25);
    assert.deepEqual(result, []);
  }
);