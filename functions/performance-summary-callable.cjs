"use strict";

const {
  onCall,
  HttpsError
} =
  require(
    "firebase-functions/v2/https"
  );

const {
  getFirestore
} =
  require(
    "firebase-admin/firestore"
  );

const {
  readAuthorizedPerformanceSummary
} =
  require(
    "./performance-summary-read-service.cjs"
  );

const PERFORMANCE_SUMMARY_CALLABLE_VERSION =
  "1.0.0";

const PERFORMANCE_SUMMARY_CALLABLE_STATUS =
  "EXPOSED_READ_ONLY";

const PERFORMANCE_SUMMARY_CALLABLE_SCOPE =
  "AUTHORIZED_PERSON_PERFORMANCE_SUMMARY_READ";

const OPTIONS =
  Object.freeze({
    region:
      "us-central1",

    timeoutSeconds:
      60
  });

function validDocumentId(
  value
) {
  return (
    typeof value ===
      "string" &&
    value.trim().length >= 1 &&
    value.trim().length <= 128 &&
    !value.includes("/")
  );
}

function publicError(
  code,
  message
) {
  return new HttpsError(
    code,
    message
  );
}

function internalErrorCode(
  error
) {
  if (
    !error ||
    typeof error.message !==
      "string"
  ) {
    return "";
  }

  return error.message.trim();
}

function mapPerformanceSummaryError(
  error
) {
  if (
    error instanceof HttpsError
  ) {
    return error;
  }

  const code =
    internalErrorCode(
      error
    );

  if (
    code ===
      "TARGET_PERSON_NOT_FOUND"
  ) {
    return publicError(
      "not-found",
      "La persona solicitada no existe."
    );
  }

  if (
    code ===
      "PERFORMANCE_SUMMARY_READ_FORBIDDEN" ||
    code ===
      "ACTOR_PROFILE_NOT_FOUND"
  ) {
    return publicError(
      "permission-denied",
      "No tienes permiso para consultar el desempeño de esta persona."
    );
  }

  if (
    code ===
      "INVALID_TARGET_PERSON_ID" ||
    code ===
      "INVALID_PERIOD_START" ||
    code ===
      "INVALID_PERIOD_END" ||
    code ===
      "INVALID_PERFORMANCE_PERIOD" ||
    code ===
      "PERFORMANCE_PERIOD_REQUIRES_BOTH_BOUNDARIES"
  ) {
    return publicError(
      "invalid-argument",
      "La solicitud de desempeño contiene datos inválidos."
    );
  }

  if (
    code ===
      "TARGET_PERSON_DOCUMENT_ID_MISMATCH" ||
    code ===
      "TARGET_PERSON_ID_MISMATCH" ||
    code ===
      "TARGET_PERSON_LEGACY_ID_MISMATCH" ||
    code ===
      "TERRITORIAL_MEMBERSHIP_DOCUMENT_ID_MISMATCH" ||
    code ===
      "TERRITORIAL_MEMBERSHIP_ID_MISMATCH" ||
    code ===
      "TERRITORIAL_MEMBERSHIP_IDENTITY_MISMATCH" ||
    code ===
      "INVALID_PERFORMANCE_LEDGER_READ_RESULT" ||
    code ===
      "INVALID_PERFORMANCE_SUMMARY_PROJECTION"
  ) {
    return publicError(
      "failed-precondition",
      "La identidad operativa no cumple las condiciones necesarias para esta consulta."
    );
  }

  return publicError(
    "internal",
    "No fue posible consultar el desempeño en este momento."
  );
}

function requireCallableDependencies({
  db,
  readService
}) {
  if (
    !db ||
    typeof db !==
      "object"
  ) {
    throw new Error(
      "INVALID_CALLABLE_DATABASE"
    );
  }

  if (
    typeof readService !==
      "function"
  ) {
    throw new Error(
      "INVALID_CALLABLE_READ_SERVICE"
    );
  }
}

async function getPersonPerformanceSummaryCore({
  request,
  db,
  readService =
    readAuthorizedPerformanceSummary
}) {
  requireCallableDependencies({
    db,
    readService
  });

  if (
    !request ||
    !request.auth
  ) {
    throw publicError(
      "unauthenticated",
      "Inicia sesión."
    );
  }

  const actorUid =
    request.auth.uid;

  if (
    !validDocumentId(
      actorUid
    )
  ) {
    throw publicError(
      "unauthenticated",
      "La sesión no contiene una identidad válida."
    );
  }

  const data =
    request.data &&
    typeof request.data ===
      "object" &&
    !Array.isArray(
      request.data
    )
      ? request.data
      : {};

  const targetPersonId =
    typeof data.personId ===
      "string"
      ? data.personId.trim()
      : "";

  if (
    !validDocumentId(
      targetPersonId
    )
  ) {
    throw publicError(
      "invalid-argument",
      "Persona inválida."
    );
  }

  const periodStart =
    data.periodStart ??
    null;

  const periodEnd =
    data.periodEnd ??
    null;

  const result =
    await readService({
      db,
      actorUid,
      targetPersonId,
      periodStart,
      periodEnd
    });

  if (
    !result ||
    typeof result !==
      "object" ||
    result.authorization !==
      "GRANTED" ||
    result.personId !==
      targetPersonId ||
    !result.campaignId ||
    !result.summary ||
    typeof result.summary !==
      "object"
  ) {
    throw new Error(
      "INVALID_CALLABLE_READ_RESULT"
    );
  }

  return Object.freeze({
    campaignId:
      result.campaignId,

    personId:
      result.personId,

    summary:
      result.summary
  });
}

async function invokeGetPersonPerformanceSummary({
  request,
  db,
  readService =
    readAuthorizedPerformanceSummary
}) {
  try {
    return await getPersonPerformanceSummaryCore({
      request,
      db,
      readService
    });
  }
  catch (error) {
    throw mapPerformanceSummaryError(
      error
    );
  }
}

exports.getPersonPerformanceSummary =
  onCall(
    OPTIONS,

    async request =>
      invokeGetPersonPerformanceSummary({
        request,

        db:
          getFirestore(),

        readService:
          readAuthorizedPerformanceSummary
      })
  );

const PERFORMANCE_SUMMARY_CALLABLE_POLICY =
  Object.freeze({
    version:
      PERFORMANCE_SUMMARY_CALLABLE_VERSION,

    status:
      PERFORMANCE_SUMMARY_CALLABLE_STATUS,

    scope:
      PERFORMANCE_SUMMARY_CALLABLE_SCOPE,

    callableName:
      "getPersonPerformanceSummary",

    inputIdentity:
      "personId",

    accountlessTargetSupported:
      true,

    authenticationRequired:
      true,

    authorizationDelegatedTo:
      "performance-summary-read-service.cjs",

    publicPayload:
      "campaignId_personId_summary",

    ledgerMetadataExposed:
      false,

    rawLedgerEntriesExposed:
      false,

    generalizedDescendantRead:
      false,

    clientFirestoreReadAllowed:
      false,

    performanceSummaryPersistenceEnabled:
      false,

    runtimeScoringActivated:
      false,

    writeCapability:
      false
  });

exports.PERFORMANCE_SUMMARY_CALLABLE_VERSION =
  PERFORMANCE_SUMMARY_CALLABLE_VERSION;

exports.PERFORMANCE_SUMMARY_CALLABLE_STATUS =
  PERFORMANCE_SUMMARY_CALLABLE_STATUS;

exports.PERFORMANCE_SUMMARY_CALLABLE_SCOPE =
  PERFORMANCE_SUMMARY_CALLABLE_SCOPE;

exports.PERFORMANCE_SUMMARY_CALLABLE_POLICY =
  PERFORMANCE_SUMMARY_CALLABLE_POLICY;

exports._test = {
  OPTIONS,
  validDocumentId,
  internalErrorCode,
  mapPerformanceSummaryError,
  getPersonPerformanceSummaryCore,
  invokeGetPersonPerformanceSummary
};