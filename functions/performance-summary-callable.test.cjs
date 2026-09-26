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
  HttpsError
} =
  require(
    "firebase-functions/v2/https"
  );

const {
  PERFORMANCE_SUMMARY_CALLABLE_VERSION,
  PERFORMANCE_SUMMARY_CALLABLE_STATUS,
  PERFORMANCE_SUMMARY_CALLABLE_SCOPE,
  PERFORMANCE_SUMMARY_CALLABLE_POLICY,
  _test
} =
  require(
    "./performance-summary-callable.cjs"
  );

const {
  OPTIONS,
  mapPerformanceSummaryError,
  getPersonPerformanceSummaryCore,
  invokeGetPersonPerformanceSummary
} =
  _test;

function request({
  uid =
    "USER-1",
  personId =
    "PER-1",
  periodStart,
  periodEnd
} = {}) {
  const data = {
    personId
  };

  if (
    periodStart !== undefined
  ) {
    data.periodStart =
      periodStart;
  }

  if (
    periodEnd !== undefined
  ) {
    data.periodEnd =
      periodEnd;
  }

  return {
    auth:
      uid === null
        ? null
        : {
            uid
          },

    data
  };
}

function serviceResult({
  campaignId =
    "CAM-1",
  personId =
    "PER-1"
} = {}) {
  return {
    schemaVersion:
      "1.0.0",

    status:
      "DEFINED_NOT_EXPOSED",

    authorization:
      "GRANTED",

    campaignId,
    personId,

    ledger: {
      sourceDocumentCount:
        7,
      returnedDocumentCount:
        7,
      paginationRequired:
        false
    },

    summary: {
      campaignId,
      personId,

      generalPerformanceIndex: {
        calculated:
          false,
        value:
          null,
        formulaVersion:
          null
      },

      persistenceEnabled:
        false,

      runtimeScoringActivated:
        false
    }
  };
}

test(
  "callable contract is exposed read-only without scoring or writes",
  () => {
    assert.equal(
      PERFORMANCE_SUMMARY_CALLABLE_VERSION,
      "1.0.0"
    );

    assert.equal(
      PERFORMANCE_SUMMARY_CALLABLE_STATUS,
      "EXPOSED_READ_ONLY"
    );

    assert.equal(
      PERFORMANCE_SUMMARY_CALLABLE_SCOPE,
      "AUTHORIZED_PERSON_PERFORMANCE_SUMMARY_READ"
    );

    assert.equal(
      OPTIONS.region,
      "us-central1"
    );

    assert.equal(
      OPTIONS.timeoutSeconds,
      60
    );

    assert.equal(
      PERFORMANCE_SUMMARY_CALLABLE_POLICY
        .callableName,
      "getPersonPerformanceSummary"
    );

    assert.equal(
      PERFORMANCE_SUMMARY_CALLABLE_POLICY
        .accountlessTargetSupported,
      true
    );

    assert.equal(
      PERFORMANCE_SUMMARY_CALLABLE_POLICY
        .ledgerMetadataExposed,
      false
    );

    assert.equal(
      PERFORMANCE_SUMMARY_CALLABLE_POLICY
        .rawLedgerEntriesExposed,
      false
    );

    assert.equal(
      PERFORMANCE_SUMMARY_CALLABLE_POLICY
        .runtimeScoringActivated,
      false
    );

    assert.equal(
      PERFORMANCE_SUMMARY_CALLABLE_POLICY
        .writeCapability,
      false
    );

    assert.equal(
      Object.isFrozen(
        PERFORMANCE_SUMMARY_CALLABLE_POLICY
      ),
      true
    );
  }
);

test(
  "unauthenticated request is rejected before service invocation",
  async () => {
    let calls = 0;

    await assert.rejects(
      () =>
        invokeGetPersonPerformanceSummary({
          request:
            request({
              uid:
                null
            }),

          db: {},

          readService:
            async () => {
              calls++;
              return serviceResult();
            }
        }),
      error =>
        error instanceof HttpsError &&
        error.code ===
          "unauthenticated"
    );

    assert.equal(
      calls,
      0
    );
  }
);

test(
  "invalid canonical person input is rejected before service invocation",
  async () => {
    let calls = 0;

    await assert.rejects(
      () =>
        invokeGetPersonPerformanceSummary({
          request:
            request({
              personId:
                "BAD/PERSON"
            }),

          db: {},

          readService:
            async () => {
              calls++;
              return serviceResult();
            }
        }),
      error =>
        error instanceof HttpsError &&
        error.code ===
          "invalid-argument"
    );

    assert.equal(
      calls,
      0
    );
  }
);

test(
  "callable passes authenticated uid canonical person and period unchanged",
  async () => {
    const db = {};

    const periodStart =
      "2026-09-01T00:00:00.000Z";

    const periodEnd =
      "2026-10-01T00:00:00.000Z";

    let received =
      null;

    const result =
      await getPersonPerformanceSummaryCore({
        request:
          request({
            uid:
              "USER-9",
            personId:
              "PER-9",
            periodStart,
            periodEnd
          }),

        db,

        readService:
          async input => {
            received =
              input;

            return serviceResult({
              campaignId:
                "CAM-9",
              personId:
                "PER-9"
            });
          }
      });

    assert.strictEqual(
      received.db,
      db
    );

    assert.equal(
      received.actorUid,
      "USER-9"
    );

    assert.equal(
      received.targetPersonId,
      "PER-9"
    );

    assert.equal(
      received.periodStart,
      periodStart
    );

    assert.equal(
      received.periodEnd,
      periodEnd
    );

    assert.equal(
      result.campaignId,
      "CAM-9"
    );

    assert.equal(
      result.personId,
      "PER-9"
    );
  }
);

test(
  "public result exposes summary but not authorization or ledger metadata",
  async () => {
    const result =
      await getPersonPerformanceSummaryCore({
        request:
          request(),

        db: {},

        readService:
          async () =>
            serviceResult()
      });

    assert.equal(
      "authorization" in result,
      false
    );

    assert.equal(
      "ledger" in result,
      false
    );

    assert.equal(
      "summary" in result,
      true
    );

    assert.equal(
      result.summary
        .generalPerformanceIndex
        .calculated,
      false
    );

    assert.equal(
      result.summary
        .runtimeScoringActivated,
      false
    );

    assert.equal(
      Object.isFrozen(
        result
      ),
      true
    );
  }
);

test(
  "target not found maps to public not-found",
  async () => {
    await assert.rejects(
      () =>
        invokeGetPersonPerformanceSummary({
          request:
            request(),

          db: {},

          readService:
            async () => {
              throw new Error(
                "TARGET_PERSON_NOT_FOUND"
              );
            }
        }),
      error =>
        error instanceof HttpsError &&
        error.code ===
          "not-found"
    );
  }
);

test(
  "authorization denial maps to permission-denied",
  async () => {
    await assert.rejects(
      () =>
        invokeGetPersonPerformanceSummary({
          request:
            request(),

          db: {},

          readService:
            async () => {
              throw new Error(
                "PERFORMANCE_SUMMARY_READ_FORBIDDEN"
              );
            }
        }),
      error =>
        error instanceof HttpsError &&
        error.code ===
          "permission-denied"
    );
  }
);

test(
  "missing actor profile maps to permission-denied",
  () => {
    const mapped =
      mapPerformanceSummaryError(
        new Error(
          "ACTOR_PROFILE_NOT_FOUND"
        )
      );

    assert.equal(
      mapped.code,
      "permission-denied"
    );
  }
);

test(
  "invalid period boundaries map to invalid-argument",
  () => {
    for (
      const code of
      [
        "INVALID_PERIOD_START",
        "INVALID_PERIOD_END",
        "INVALID_PERFORMANCE_PERIOD",
        "PERFORMANCE_PERIOD_REQUIRES_BOTH_BOUNDARIES"
      ]
    ) {
      const mapped =
        mapPerformanceSummaryError(
          new Error(
            code
          )
        );

      assert.equal(
        mapped.code,
        "invalid-argument"
      );
    }
  }
);

test(
  "canonical identity contradiction maps to failed-precondition",
  () => {
    for (
      const code of
      [
        "TARGET_PERSON_ID_MISMATCH",
        "TARGET_PERSON_LEGACY_ID_MISMATCH",
        "TERRITORIAL_MEMBERSHIP_IDENTITY_MISMATCH",
        "INVALID_PERFORMANCE_LEDGER_READ_RESULT",
        "INVALID_PERFORMANCE_SUMMARY_PROJECTION"
      ]
    ) {
      const mapped =
        mapPerformanceSummaryError(
          new Error(
            code
          )
        );

      assert.equal(
        mapped.code,
        "failed-precondition"
      );
    }
  }
);

test(
  "existing HttpsError survives public error mapping unchanged",
  () => {
    const source =
      new HttpsError(
        "resource-exhausted",
        "Límite alcanzado."
      );

    const mapped =
      mapPerformanceSummaryError(
        source
      );

    assert.strictEqual(
      mapped,
      source
    );
  }
);

test(
  "unknown internal exception is sanitized as internal error",
  () => {
    const mapped =
      mapPerformanceSummaryError(
        new Error(
          "SECRET_INTERNAL_DETAIL"
        )
      );

    assert.equal(
      mapped.code,
      "internal"
    );

    assert.equal(
      mapped.message.includes(
        "SECRET_INTERNAL_DETAIL"
      ),
      false
    );
  }
);

test(
  "malformed service result is never returned to client",
  async () => {
    await assert.rejects(
      () =>
        invokeGetPersonPerformanceSummary({
          request:
            request(),

          db: {},

          readService:
            async () => ({
              authorization:
                "GRANTED",
              campaignId:
                "CAM-1",
              personId:
                "PER-OTHER",
              summary: {}
            })
        }),
      error =>
        error instanceof HttpsError &&
        error.code ===
          "internal"
    );
  }
);