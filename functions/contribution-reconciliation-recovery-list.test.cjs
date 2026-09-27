"use strict";

process.env.NODE_ENV = "test";

const test = require("node:test");
const assert = require("node:assert/strict");

test(
  "recovery store lists processable recoveries with a bounded server query",
  async () => {
    const {
      RECOVERY_COLLECTION,
      listProcessableRecoveryRecords,
    } = require(
      "./contribution-reconciliation-recovery-store.cjs"
    );

    const calls = {};

    const pending = {
      operationId: "OP-1",
      status: "PENDING",
    };

    const retry = {
      operationId: "OP-2",
      status: "RETRY_REQUIRED",
    };

    const db = {
      collection(name) {
        calls.collection = name;

        return {
          where(field, operator, values) {
            calls.where = {
              field,
              operator,
              values,
            };

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
                      docs: [
                        {
                          id: "REC-1",
                          data: () => pending,
                        },
                        {
                          id: "REC-2",
                          data: () => retry,
                        },
                      ],
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

    assert.equal(
      calls.collection,
      RECOVERY_COLLECTION
    );

    assert.deepEqual(
      calls.where,
      {
        field: "status",
        operator: "in",
        values: [
          "PENDING",
          "RETRY_REQUIRED",
        ],
      }
    );

    assert.equal(
      calls.limit,
      25
    );

    assert.deepEqual(
      result,
      [
        {
          recoveryId: "REC-1",
          record: pending,
        },
        {
          recoveryId: "REC-2",
          record: retry,
        },
      ]
    );
  }
);
