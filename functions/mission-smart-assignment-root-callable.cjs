"use strict";

/**
 * TERRA Campaign V1 — B8 root callable gateway (STEP 3, NOT EXPORTED).
 *
 * NOT a deployed callable until index.js explicitly exports the factory.
 * Even if accidentally exported, fail closed without an explicit server flag.
 * B7 createLinkedMissions is not modified and keeps its own dispatch path.
 *
 * Trust only Firebase's authenticated request.auth.uid; never accept a client
 * campaignId/actorPersonId. Actual authorization and canonical binding is
 * always repeated INSIDE the supplied Firestore transaction by the root writer.
 */
const ALLOWED_FIELDS = new Set([
  "requestId", "assigneeRefs", "activityCode", "title", "description",
  "locality", "missionDate", "deadlineAt"
]);
const SHA256 = /^[0-9a-f]{64}$/;
const ROOT_OPTIONS = Object.freeze({region:"us-central1", timeoutSeconds:120});

function validId(v) {
  return typeof v === "string" && v.length > 0 && v.length <= 128 &&
    v.trim() === v && !v.includes("/");
}
function isDataShapeValid(d) {
  return d && typeof d === "object" && !Array.isArray(d) &&
    Object.keys(d).every(k => ALLOWED_FIELDS.has(k)) &&
    validId(d.requestId) && typeof d.activityCode === "string" &&
    d.activityCode.trim().length > 0 && d.activityCode.length <= 100 &&
    typeof d.title === "string" && d.title.trim().length > 0 &&
    d.title.length <= 150 &&
    Array.isArray(d.assigneeRefs) && d.assigneeRefs.length >= 1 &&
    d.assigneeRefs.length <= 50 &&
    d.assigneeRefs.every(v => typeof v === "string" && SHA256.test(v)) &&
    new Set(d.assigneeRefs).size === d.assigneeRefs.length;
}

const ARG_ERRORS = new Set([
  "invalid-b8-data", "invalid-b8-data-key", "invalid-b8-request-id",
  "invalid-b8-assignees", "invalid-b8-activity", "invalid-b8-text",
  "invalid-b8-required-text", "invalid-b8-mission-date", "invalid-b8-deadline",
  "invalid-smart-assignment-selection-size", "invalid-smart-assignment-reference",
  "duplicate-smart-assignment-reference", "invalid-b8-root-bridge-request"
]);
const PERMISSION_ERRORS = new Set([
  "smart-assignment-permission-denied", "smart-assignment-profile-not-found",
  "smart-assignment-invalid-identity", "invalid-b8-root-dispatch-actor",
  "invalid-b8-root-bridge-actor-membership", "invalid-b8-root-bridge-lineage",
  "invalid-b8-root-bridge-target-membership", "invalid-b8-root-bridge-selection-binding"
]);
const CONFLICT_ERRORS = new Set([
  "b7-b84-assignment-conflict", "b8-root-dispatch-replay-conflict",
  "canonical-assignment-already-claimed", "duplicate-b8-root-dispatch-mission"
]);
function safeErrorCode(error) {
  const msg = error && typeof error.message === "string" ? error.message : "";
  if (msg === "smart-assignment-unauthenticated") return "unauthenticated";
  if (ARG_ERRORS.has(msg)) return "invalid-argument";
  if (PERMISSION_ERRORS.has(msg)) return "permission-denied";
  if (CONFLICT_ERRORS.has(msg)) return "already-exists";
  return "failed-precondition";
}
const MESSAGES = Object.freeze({
  "unauthenticated":"Inicia sesion.",
  "invalid-argument":"Revisa los campos y destinatarios de la mision.",
  "permission-denied":"No tienes autorizacion para esta asignacion.",
  "already-exists":"Esta asignacion entra en conflicto con una existente. Actualiza la lista.",
  "failed-precondition":"No fue posible validar esta asignacion. Actualiza la lista.",
  "internal":"No fue posible completar la asignacion. Intenta mas tarde."
});
function createB8RootWriteHandlerForTests({getDb, dispatch, enabled, HttpsError, logError} = {}) {
  if ([getDb, dispatch, enabled, HttpsError].some(f => typeof f !== "function")) {
    throw new TypeError("invalid-b8-root-handler-dependencies");
  }
  const error = code => new HttpsError(code, MESSAGES[code]);
  return async request => {
    if (!validId(request?.auth?.uid)) throw error("unauthenticated");
    // Server-side release gate. Never allow a caller to override it.
    if (enabled() !== true) throw error("failed-precondition");
    if (!isDataShapeValid(request?.data)) throw error("invalid-argument");
    try {
      const db = getDb();
      if (!db || typeof db.runTransaction !== "function" ||
          typeof db.collection !== "function") throw new Error("invalid-b8-db");
      const result = await db.runTransaction(
        async tx => dispatch({db, tx, request}),
        {maxAttempts:5}
      );
      if (!result || !Number.isSafeInteger(result.created) ||
          !Number.isSafeInteger(result.alreadyAssigned) ||
          result.created < 0 || result.alreadyAssigned < 0) {
        throw new Error("invalid-b8-dispatch-result");
      }
      return {created:result.created, alreadyAssigned:result.alreadyAssigned};
    } catch (cause) {
      if (cause instanceof HttpsError) throw cause;
      const code = safeErrorCode(cause);
      if (typeof logError === "function") logError({kind:"b8-root-dispatch-error", code});
      throw error(code);
    }
  };
}

function createSmartAssignedMissionsCallable() {
  // Lazy imports let our isolated tests run without firebase-admin installed.
  const {onCall,HttpsError} = require("firebase-functions/v2/https");
  const {getFirestore} = require("firebase-admin/firestore");
  const {dispatchB8RootWithinTransaction} =
    require("./mission-smart-assignment-root-dispatch.cjs");
  return onCall(ROOT_OPTIONS, createB8RootWriteHandlerForTests({
    getDb:getFirestore,
    dispatch:dispatchB8RootWithinTransaction,
    HttpsError,
    enabled:() => process.env.TERRA_B8_ROOT_WRITE_ENABLED === "true",
    logError: details => console.error("TERRA B8 root:", details.code)
  }));
}
module.exports = {
  createB8RootWriteHandlerForTests,
  createSmartAssignedMissionsCallable,
  safeErrorCode,
  ROOT_OPTIONS
};
