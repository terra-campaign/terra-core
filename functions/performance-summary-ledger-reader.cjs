"use strict";

const {
  LEDGER_COLLECTION
} =
  require(
    "./contribution-ledger-writer-policy.cjs"
  );

const PERFORMANCE_LEDGER_READER_VERSION =
  "1.0.0";

const PERFORMANCE_LEDGER_READER_STATUS =
  "DEFINED_NOT_EXPOSED";

const PERFORMANCE_LEDGER_READER_SCOPE =
  "PERSON_CONTRIBUTION_LEDGER_READ";

const MAX_LEDGER_DOCUMENTS_PER_PERSON =
  5000;

const LEDGER_QUERY_LIMIT =
  MAX_LEDGER_DOCUMENTS_PER_PERSON + 1;

function requireToken(
  value,
  fieldName
) {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    throw new Error(
      "INVALID_" +
      fieldName
    );
  }

  return value.trim();
}

function buildPersonLedgerReadPlan({
  campaignId,
  personId
}) {
  const campaign =
    requireToken(
      campaignId,
      "CAMPAIGN_ID"
    );

  const person =
    requireToken(
      personId,
      "PERSON_ID"
    );

  return Object.freeze({
    collection:
      LEDGER_COLLECTION,

    queryField:
      "personId",

    queryOperator:
      "==",

    queryValue:
      person,

    limit:
      LEDGER_QUERY_LIMIT,

    campaignId:
      campaign,

    personId:
      person,

    semanticFiltering:
      "PERFORMANCE_SUMMARY_PROJECTION",

    compositeIndexRequired:
      false
  });
}

function snapshotDocumentData(
  documentSnapshot
) {
  if (
    !documentSnapshot ||
    typeof documentSnapshot.data !==
      "function"
  ) {
    throw new Error(
      "INVALID_LEDGER_SNAPSHOT_DOCUMENT"
    );
  }

  const data =
    documentSnapshot.data();

  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
    throw new Error(
      "INVALID_LEDGER_DOCUMENT_DATA"
    );
  }

  return data;
}

async function readPersonContributionLedger({
  db,
  campaignId,
  personId
}) {
  const plan =
    buildPersonLedgerReadPlan({
      campaignId,
      personId
    });

  if (
    !db ||
    typeof db.collection !==
      "function"
  ) {
    throw new Error(
      "INVALID_LEDGER_DATABASE"
    );
  }

  const collection =
    db.collection(
      plan.collection
    );

  if (
    !collection ||
    typeof collection.where !==
      "function"
  ) {
    throw new Error(
      "INVALID_LEDGER_COLLECTION_READER"
    );
  }

  const filtered =
    collection.where(
      plan.queryField,
      plan.queryOperator,
      plan.queryValue
    );

  if (
    !filtered ||
    typeof filtered.limit !==
      "function"
  ) {
    throw new Error(
      "INVALID_LEDGER_QUERY_READER"
    );
  }

  const limited =
    filtered.limit(
      plan.limit
    );

  if (
    !limited ||
    typeof limited.get !==
      "function"
  ) {
    throw new Error(
      "INVALID_LEDGER_QUERY_EXECUTOR"
    );
  }

  const snapshot =
    await limited.get();

  if (
    !snapshot ||
    !Array.isArray(
      snapshot.docs
    )
  ) {
    throw new Error(
      "INVALID_LEDGER_QUERY_SNAPSHOT"
    );
  }

  const snapshotSize =
    Number.isInteger(
      snapshot.size
    )
      ? snapshot.size
      : snapshot.docs.length;

  if (
    snapshotSize >
      MAX_LEDGER_DOCUMENTS_PER_PERSON ||
    snapshot.docs.length >
      MAX_LEDGER_DOCUMENTS_PER_PERSON
  ) {
    throw new Error(
      "CONTRIBUTION_LEDGER_HISTORY_REQUIRES_PAGINATION"
    );
  }

  const ledgerEntries = [];

  for (
    const documentSnapshot of
    snapshot.docs
  ) {
    const entry =
      snapshotDocumentData(
        documentSnapshot
      );

    // Defensive post-filter:
    // the Firestore query is intentionally single-field
    // by personId. Campaign isolation is then enforced
    // here before data reaches the projection.
    if (
      entry.personId !==
        plan.personId ||
      entry.campaignId !==
        plan.campaignId
    ) {
      continue;
    }

    // Do NOT pre-filter ledgerStatus,
    // runtimeScoringEnabled or score dimension here.
    // Those semantics belong to the canonical
    // Performance Summary projection.
    ledgerEntries.push(
      entry
    );
  }

  return Object.freeze({
    schemaVersion:
      PERFORMANCE_LEDGER_READER_VERSION,

    status:
      PERFORMANCE_LEDGER_READER_STATUS,

    scope:
      PERFORMANCE_LEDGER_READER_SCOPE,

    campaignId:
      plan.campaignId,

    personId:
      plan.personId,

    ledgerEntries:
      Object.freeze(
        ledgerEntries.slice()
      ),

    sourceDocumentCount:
      snapshot.docs.length,

    returnedDocumentCount:
      ledgerEntries.length,

    paginationRequired:
      false
  });
}

const PERFORMANCE_LEDGER_READER_POLICY =
  Object.freeze({
    version:
      PERFORMANCE_LEDGER_READER_VERSION,

    status:
      PERFORMANCE_LEDGER_READER_STATUS,

    scope:
      PERFORMANCE_LEDGER_READER_SCOPE,

    collection:
      LEDGER_COLLECTION,

    identity:
      "personId",

    query:
      "personId_only",

    campaignIsolation:
      "server_post_filter",

    semanticFiltering:
      "performance-summary.cjs",

    maxDocumentsPerPerson:
      MAX_LEDGER_DOCUMENTS_PER_PERSON,

    queryLimit:
      LEDGER_QUERY_LIMIT,

    compositeIndexRequired:
      false,

    callableExposed:
      false,

    clientFirestoreReadAllowed:
      false,

    scoringActivation:
      false,

    performanceSummaryPersistenceEnabled:
      false,

    writeCapability:
      false
  });

module.exports = {
  PERFORMANCE_LEDGER_READER_VERSION,
  PERFORMANCE_LEDGER_READER_STATUS,
  PERFORMANCE_LEDGER_READER_SCOPE,
  PERFORMANCE_LEDGER_READER_POLICY,
  MAX_LEDGER_DOCUMENTS_PER_PERSON,
  LEDGER_QUERY_LIMIT,
  buildPersonLedgerReadPlan,
  readPersonContributionLedger
};