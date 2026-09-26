"use strict";

const test =
  require(
    "node:test"
  );

const assert =
  require(
    "node:assert/strict"
  );

const {
  PERFORMANCE_LEDGER_READER_VERSION,
  PERFORMANCE_LEDGER_READER_STATUS,
  PERFORMANCE_LEDGER_READER_SCOPE,
  PERFORMANCE_LEDGER_READER_POLICY,
  MAX_LEDGER_DOCUMENTS_PER_PERSON,
  LEDGER_QUERY_LIMIT,
  buildPersonLedgerReadPlan,
  readPersonContributionLedger
} =
  require(
    "./performance-summary-ledger-reader.cjs"
  );

function snapshotDocument(
  data
) {
  return {
    data() {
      return data;
    }
  };
}

function mockDb(
  documents
) {
  const calls = [];

  const db = {
    collection(
      collectionName
    ) {
      calls.push([
        "collection",
        collectionName
      ]);

      return {
        where(
          field,
          operator,
          value
        ) {
          calls.push([
            "where",
            field,
            operator,
            value
          ]);

          return {
            limit(
              limitValue
            ) {
              calls.push([
                "limit",
                limitValue
              ]);

              return {
                async get() {
                  calls.push([
                    "get"
                  ]);

                  return {
                    size:
                      documents.length,

                    docs:
                      documents.map(
                        snapshotDocument
                      )
                  };
                }
              };
            }
          };
        }
      };
    }
  };

  return {
    db,
    calls
  };
}

test(
  "reader contract remains backend-only and unexposed",
  () => {
    assert.equal(
      PERFORMANCE_LEDGER_READER_VERSION,
      "1.0.0"
    );

    assert.equal(
      PERFORMANCE_LEDGER_READER_STATUS,
      "DEFINED_NOT_EXPOSED"
    );

    assert.equal(
      PERFORMANCE_LEDGER_READER_SCOPE,
      "PERSON_CONTRIBUTION_LEDGER_READ"
    );

    assert.equal(
      PERFORMANCE_LEDGER_READER_POLICY
        .identity,
      "personId"
    );

    assert.equal(
      PERFORMANCE_LEDGER_READER_POLICY
        .callableExposed,
      false
    );

    assert.equal(
      PERFORMANCE_LEDGER_READER_POLICY
        .clientFirestoreReadAllowed,
      false
    );

    assert.equal(
      PERFORMANCE_LEDGER_READER_POLICY
        .scoringActivation,
      false
    );

    assert.equal(
      PERFORMANCE_LEDGER_READER_POLICY
        .performanceSummaryPersistenceEnabled,
      false
    );

    assert.equal(
      PERFORMANCE_LEDGER_READER_POLICY
        .writeCapability,
      false
    );
  }
);

test(
  "read plan uses only canonical personId query",
  () => {
    const plan =
      buildPersonLedgerReadPlan({
        campaignId:
          " CAM-001 ",
        personId:
          " PER-001 "
      });

    assert.equal(
      plan.collection,
      "contributionLedger"
    );

    assert.equal(
      plan.queryField,
      "personId"
    );

    assert.equal(
      plan.queryOperator,
      "=="
    );

    assert.equal(
      plan.queryValue,
      "PER-001"
    );

    assert.equal(
      plan.campaignId,
      "CAM-001"
    );

    assert.equal(
      plan.limit,
      5001
    );

    assert.equal(
      plan.compositeIndexRequired,
      false
    );
  }
);

test(
  "invalid campaign or person identifiers fail closed",
  () => {
    assert.throws(
      () =>
        buildPersonLedgerReadPlan({
          campaignId:
            "",
          personId:
            "PER-001"
        }),
      /INVALID_CAMPAIGN_ID/
    );

    assert.throws(
      () =>
        buildPersonLedgerReadPlan({
          campaignId:
            "CAM-001",
          personId:
            " "
        }),
      /INVALID_PERSON_ID/
    );
  }
);

test(
  "reader performs single-field person query with bounded limit",
  async () => {
    const {
      db,
      calls
    } =
      mockDb([]);

    const result =
      await readPersonContributionLedger({
        db,
        campaignId:
          "CAM-001",
        personId:
          "PER-001"
      });

    assert.deepEqual(
      calls,
      [
        [
          "collection",
          "contributionLedger"
        ],
        [
          "where",
          "personId",
          "==",
          "PER-001"
        ],
        [
          "limit",
          5001
        ],
        [
          "get"
        ]
      ]
    );

    assert.equal(
      result.sourceDocumentCount,
      0
    );

    assert.equal(
      result.returnedDocumentCount,
      0
    );
  }
);

test(
  "reader enforces campaign isolation after person query",
  async () => {
    const {
      db
    } =
      mockDb([
        {
          ledgerId:
            "LEDGER-1",
          campaignId:
            "CAM-001",
          personId:
            "PER-001",
          ledgerStatus:
            "POSTED"
        },
        {
          ledgerId:
            "LEDGER-2",
          campaignId:
            "CAM-002",
          personId:
            "PER-001",
          ledgerStatus:
            "POSTED"
        },
        {
          ledgerId:
            "LEDGER-3",
          campaignId:
            "CAM-001",
          personId:
            "PER-OTHER",
          ledgerStatus:
            "POSTED"
        }
      ]);

    const result =
      await readPersonContributionLedger({
        db,
        campaignId:
          "CAM-001",
        personId:
          "PER-001"
      });

    assert.equal(
      result.sourceDocumentCount,
      3
    );

    assert.equal(
      result.returnedDocumentCount,
      1
    );

    assert.equal(
      result.ledgerEntries.length,
      1
    );

    assert.equal(
      result.ledgerEntries[0]
        .ledgerId,
      "LEDGER-1"
    );
  }
);

test(
  "reader deliberately preserves ledger semantic states for projection",
  async () => {
    const {
      db
    } =
      mockDb([
        {
          ledgerId:
            "LEDGER-POSTED",
          campaignId:
            "CAM-001",
          personId:
            "PER-001",
          ledgerStatus:
            "POSTED",
          runtimeScoringEnabled:
            true
        },
        {
          ledgerId:
            "LEDGER-DRAFT",
          campaignId:
            "CAM-001",
          personId:
            "PER-001",
          ledgerStatus:
            "DRAFT_NOT_POSTABLE",
          runtimeScoringEnabled:
            false
        },
        {
          ledgerId:
            "LEDGER-REVERSED",
          campaignId:
            "CAM-001",
          personId:
            "PER-001",
          ledgerStatus:
            "REVERSED",
          runtimeScoringEnabled:
            false
        }
      ]);

    const result =
      await readPersonContributionLedger({
        db,
        campaignId:
          "CAM-001",
        personId:
          "PER-001"
      });

    assert.equal(
      result.ledgerEntries.length,
      3
    );

    assert.deepEqual(
      result.ledgerEntries.map(
        entry =>
          entry.ledgerStatus
      ),
      [
        "POSTED",
        "DRAFT_NOT_POSTABLE",
        "REVERSED"
      ]
    );
  }
);

test(
  "reader fails closed when ledger history exceeds bounded capacity",
  async () => {
    const documents =
      Array.from(
        {
          length:
            LEDGER_QUERY_LIMIT
        },
        (
          _,
          index
        ) => ({
          ledgerId:
            `LEDGER-${index}`,
          campaignId:
            "CAM-001",
          personId:
            "PER-001"
        })
      );

    const {
      db
    } =
      mockDb(
        documents
      );

    await assert.rejects(
      () =>
        readPersonContributionLedger({
          db,
          campaignId:
            "CAM-001",
          personId:
            "PER-001"
        }),
      /CONTRIBUTION_LEDGER_HISTORY_REQUIRES_PAGINATION/
    );
  }
);

test(
  "reader requires a valid backend database adapter",
  async () => {
    await assert.rejects(
      () =>
        readPersonContributionLedger({
          db:
            null,
          campaignId:
            "CAM-001",
          personId:
            "PER-001"
        }),
      /INVALID_LEDGER_DATABASE/
    );
  }
);

test(
  "reader rejects malformed query snapshot",
  async () => {
    const db = {
      collection() {
        return {
          where() {
            return {
              limit() {
                return {
                  async get() {
                    return {
                      size:
                        0
                    };
                  }
                };
              }
            };
          }
        };
      }
    };

    await assert.rejects(
      () =>
        readPersonContributionLedger({
          db,
          campaignId:
            "CAM-001",
          personId:
            "PER-001"
        }),
      /INVALID_LEDGER_QUERY_SNAPSHOT/
    );
  }
);

test(
  "reader rejects malformed ledger document data",
  async () => {
    const db = {
      collection() {
        return {
          where() {
            return {
              limit() {
                return {
                  async get() {
                    return {
                      size:
                        1,

                      docs: [
                        {
                          data() {
                            return null;
                          }
                        }
                      ]
                    };
                  }
                };
              }
            };
          }
        };
      }
    };

    await assert.rejects(
      () =>
        readPersonContributionLedger({
          db,
          campaignId:
            "CAM-001",
          personId:
            "PER-001"
        }),
      /INVALID_LEDGER_DOCUMENT_DATA/
    );
  }
);

test(
  "reader limits are explicit and internally consistent",
  () => {
    assert.equal(
      MAX_LEDGER_DOCUMENTS_PER_PERSON,
      5000
    );

    assert.equal(
      LEDGER_QUERY_LIMIT,
      MAX_LEDGER_DOCUMENTS_PER_PERSON +
        1
    );

    assert.equal(
      PERFORMANCE_LEDGER_READER_POLICY
        .maxDocumentsPerPerson,
      MAX_LEDGER_DOCUMENTS_PER_PERSON
    );

    assert.equal(
      PERFORMANCE_LEDGER_READER_POLICY
        .queryLimit,
      LEDGER_QUERY_LIMIT
    );
  }
);

test(
  "reader policy object is immutable",
  () => {
    assert.equal(
      Object.isFrozen(
        PERFORMANCE_LEDGER_READER_POLICY
      ),
      true
    );
  }
);