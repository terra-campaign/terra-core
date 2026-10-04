"use strict";

const test =
  require("node:test");

const assert =
  require("node:assert/strict");

const {
  buildMissionContributionCandidate,
} =
  require(
    "./contribution-candidate.cjs"
  );

const {
  postContributionLedgerEntry,
} =
  require(
    "./contribution-ledger-writer.cjs"
  );

const {
  readPersonContributionLedger,
} =
  require(
    "./performance-summary-ledger-reader.cjs"
  );

const {
  buildPerformanceSummaryProjection,
} =
  require(
    "./performance-summary.cjs"
  );


function canonicalCandidate() {
  return buildMissionContributionCandidate({
    mission: {
      id:
        "MISSION-WRITER-001",

      campaignId:
        "CAM-001",

      assignedTo:
        "UID-SUBJECT-001",

      activityCode:
        "TERRITORIAL_BRIGADE",

      activityCatalogVersion:
        "1.0.0",
    },

    evidence: {
      id:
        "EVIDENCE-WRITER-001",

      missionId:
        "MISSION-WRITER-001",

      campaignId:
        "CAM-001",

      uploadedBy:
        "UID-SUBJECT-001",

      evidenceURL:
        "https://example.test/writer-evidence",

      createdAt:
        "2026-09-25T12:00:00.000Z",
    },

    review: {
      missionId:
        "MISSION-WRITER-001",

      campaignId:
        "CAM-001",

      evidenceId:
        "EVIDENCE-WRITER-001",

      subjectId:
        "UID-SUBJECT-001",

      status:
        "validated",

      pendingAppeal:
        false,
    },

    reviewId:
      "EVIDENCE-WRITER-001",

    canonicalIdentity: {
      accountUid:
        "UID-SUBJECT-001",

      personId:
        "PERSON-SUBJECT-001",

      campaignId:
        "CAM-001",
    },
  });
}


function createMemoryFirestore() {
  const documents =
    new Map();

  let automaticId =
    0;

  function keyFor(
    collectionName,
    documentId
  ) {
    return (
      String(collectionName) +
      "/" +
      String(documentId)
    );
  }


  function reference(
    collectionName,
    documentId
  ) {
    return Object.freeze({
      collection:
        collectionName,

      id:
        documentId,

      key:
        keyFor(
          collectionName,
          documentId
        ),

      path:
        keyFor(
          collectionName,
          documentId
        ),
    });
  }


  function snapshotFor(
    ref
  ) {
    const stored =
      documents.get(
        ref.key
      );

    return {
      id:
        ref.id,

      exists:
        stored !== undefined,

      ref,

      data() {
        if (
          stored === undefined
        ) {
          return undefined;
        }

        return stored;
      },
    };
  }


  function collectionApi(
    collectionName
  ) {
    return {
      doc(
        requestedId
      ) {
        const id =
          requestedId ||
          (
            "AUTO-" +
            String(
              ++automaticId
            ).padStart(
              6,
              "0"
            )
          );

        return reference(
          collectionName,
          id
        );
      },


      where(
        field,
        operator,
        value
      ) {
        if (
          operator !== "=="
        ) {
          throw new Error(
            "MEMORY_DB_ONLY_SUPPORTS_EQUALITY"
          );
        }

        return {
          limit(
            limitValue
          ) {
            return {
              async get() {
                const matches =
                  [];

                for (
                  const [
                    key,
                    data,
                  ]
                  of documents.entries()
                ) {
                  const prefix =
                    collectionName +
                    "/";

                  if (
                    !key.startsWith(
                      prefix
                    )
                  ) {
                    continue;
                  }

                  if (
                    !data ||
                    data[field] !==
                      value
                  ) {
                    continue;
                  }

                  const id =
                    key.slice(
                      prefix.length
                    );

                  matches.push({
                    id,

                    exists:
                      true,

                    data() {
                      return data;
                    },
                  });
                }

                const docs =
                  matches.slice(
                    0,
                    limitValue
                  );

                return {
                  docs,

                  size:
                    docs.length,

                  empty:
                    docs.length ===
                    0,
                };
              },
            };
          },
        };
      },
    };
  }


  const db = {
    collection(
      collectionName
    ) {
      return collectionApi(
        collectionName
      );
    },


    async runTransaction(
      callback
    ) {
      const pendingCreates =
        [];

      const pendingUpdates =
        [];

      const tx = {
        async get(
          ref
        ) {
          return snapshotFor(
            ref
          );
        },


        create(
          ref,
          data
        ) {
          if (
            documents.has(
              ref.key
            ) ||
            pendingCreates.some(
              item =>
                item.ref.key ===
                ref.key
            )
          ) {
            throw new Error(
              "MEMORY_DOCUMENT_ALREADY_EXISTS"
            );
          }

          pendingCreates.push({
            ref,
            data,
          });
        },


        update(
          ref,
          data
        ) {
          if (
            !documents.has(
              ref.key
            )
          ) {
            throw new Error(
              "MEMORY_DOCUMENT_NOT_FOUND"
            );
          }

          pendingUpdates.push({
            ref,
            data,
          });
        },
      };


      const result =
        await callback(
          tx
        );


      for (
        const item
        of pendingCreates
      ) {
        documents.set(
          item.ref.key,
          item.data
        );
      }


      for (
        const item
        of pendingUpdates
      ) {
        const current =
          documents.get(
            item.ref.key
          ) || {};

        documents.set(
          item.ref.key,
          {
            ...current,
            ...item.data,
          }
        );
      }


      return result;
    },
  };


  function seed(
    collectionName,
    documentId,
    data
  ) {
    documents.set(
      keyFor(
        collectionName,
        documentId
      ),
      data
    );
  }


  function docsIn(
    collectionName
  ) {
    const result =
      [];

    const prefix =
      collectionName +
      "/";

    for (
      const [
        key,
        data,
      ]
      of documents.entries()
    ) {
      if (
        !key.startsWith(
          prefix
        )
      ) {
        continue;
      }

      result.push({
        id:
          key.slice(
            prefix.length
          ),

        data,
      });
    }

    return result;
  }


  return {
    db,
    seed,
    docsIn,
    documents,
  };
}


test(
  "productive contribution ledger is readable by performance projection end to end",
  async () => {
    const memory =
      createMemoryFirestore();


    /*
     * Canonical posting actor.
     */
    memory.seed(
      "usuarios",
      "ACTOR-UID-001",
      {
        active:
          true,

        campaignId:
          "CAM-001",

        personId:
          "PERSON-ACTOR-001",
      }
    );


    memory.seed(
      "persons",
      "PERSON-ACTOR-001",
      {
        personId:
          "PERSON-ACTOR-001",

        active:
          true,

        campaignId:
          "CAM-001",

        accountUid:
          "ACTOR-UID-001",
      }
    );


    const candidate =
      canonicalCandidate();


    assert.equal(
      candidate.campaignId,
      "CAM-001"
    );

    assert.equal(
      candidate.personId,
      "PERSON-SUBJECT-001"
    );


    /*
     * PRODUCTIVE WRITER.
     *
     * Candidate
     *   -> activation
     *   -> authorization
     *   -> ledger writer
     */
    const firstPosting =
      await postContributionLedgerEntry({
        db:
          memory.db,

        actorUid:
          "ACTOR-UID-001",

        candidate,
      });


    assert.equal(
      firstPosting.ok,
      true
    );

    assert.equal(
      firstPosting.alreadyPosted,
      false
    );

    assert.equal(
      firstPosting.performanceSummaryWritten,
      false
    );


    const ledgersAfterFirst =
      memory.docsIn(
        "contributionLedger"
      );


    assert.equal(
      ledgersAfterFirst.length,
      1
    );


    const ledger =
      ledgersAfterFirst[0]
        .data;


    assert.equal(
      ledger.ledgerStatus,
      "POSTED"
    );

    assert.equal(
      ledger.runtimeScoringEnabled,
      true
    );

    assert.equal(
      ledger.campaignId,
      "CAM-001"
    );

    assert.equal(
      ledger.personId,
      "PERSON-SUBJECT-001"
    );

    assert.equal(
      ledger.candidateId,
      candidate.candidateId
    );

    assert.equal(
      ledger.points,
      candidate.points
    );


    /*
     * PERFORMANCE LEDGER READER.
     *
     * It must read the exact ledger
     * physically written above.
     */
    const ledgerRead =
      await readPersonContributionLedger({
        db:
          memory.db,

        campaignId:
          "CAM-001",

        personId:
          "PERSON-SUBJECT-001",
      });


    assert.equal(
      ledgerRead.campaignId,
      "CAM-001"
    );

    assert.equal(
      ledgerRead.personId,
      "PERSON-SUBJECT-001"
    );

    assert.equal(
      ledgerRead.ledgerEntries.length,
      1
    );

    assert.equal(
      ledgerRead.ledgerEntries[0]
        .candidateId,
      candidate.candidateId
    );


    /*
     * PERFORMANCE PROJECTION.
     *
     * No Performance Summary document
     * is persisted. Projection is
     * generated from canonical ledger.
     */
    const summary =
      buildPerformanceSummaryProjection({
        campaignId:
          "CAM-001",

        personId:
          "PERSON-SUBJECT-001",

        ledgerEntries:
          ledgerRead.ledgerEntries,
      });


    assert.equal(
      summary.campaignId,
      "CAM-001"
    );

    assert.equal(
      summary.personId,
      "PERSON-SUBJECT-001"
    );

    assert.equal(
      summary.contribution.historical.points,
      candidate.points
    );

    assert.equal(
      summary.contribution.historical.contributionCount,
      1
    );


    assert.equal(
      memory.docsIn(
        "performanceSummary"
      ).length,
      0
    );


    /*
     * EXACTLY-ONCE / IDEMPOTENCY.
     *
     * Same canonical candidate posted
     * again must reuse the same ledger.
     */
    const auditsBeforeSecond =
      memory.docsIn(
        "logs"
      ).length;


    const secondPosting =
      await postContributionLedgerEntry({
        db:
          memory.db,

        actorUid:
          "ACTOR-UID-001",

        candidate,
      });


    assert.equal(
      secondPosting.ok,
      true
    );

    assert.equal(
      secondPosting.alreadyPosted,
      true
    );


    assert.equal(
      memory.docsIn(
        "contributionLedger"
      ).length,
      1
    );


    assert.equal(
      memory.docsIn(
        "logs"
      ).length,
      auditsBeforeSecond
    );


    /*
     * Re-read after idempotent posting:
     * score must remain unchanged.
     */
    const ledgerReadAfterSecond =
      await readPersonContributionLedger({
        db:
          memory.db,

        campaignId:
          "CAM-001",

        personId:
          "PERSON-SUBJECT-001",
      });


    const summaryAfterSecond =
      buildPerformanceSummaryProjection({
        campaignId:
          "CAM-001",

        personId:
          "PERSON-SUBJECT-001",

        ledgerEntries:
          ledgerReadAfterSecond
            .ledgerEntries,
      });


    assert.equal(
      ledgerReadAfterSecond
        .ledgerEntries.length,
      1
    );

    assert.equal(
      summaryAfterSecond.contribution.historical.points,
      candidate.points
    );

    assert.equal(
      summaryAfterSecond.contribution.historical.contributionCount,
      1
    );
  }
);
