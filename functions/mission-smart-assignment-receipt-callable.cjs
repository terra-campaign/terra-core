"use strict";
/**
 * TERRA Campaign V1 — B8-20V5A (LAB ONLY; NOT CONNECTED TO index.js).
 * Authenticated, READ-ONLY receipt lookup. Future production export must
 * receive a separate explicit authorization and a verified deploy plan.
 * This file neither writes to Firestore nor unlocks a pending request.
 */
const {createB8ReceiptStatusHandlerForTests} =
  require("./mission-smart-assignment-receipt-status.cjs");

const B8_RECEIPT_OPTIONS = Object.freeze({region:"us-central1", timeoutSeconds:30});
const ENABLE_ENV = "TERRA_B8_RECEIPT_STATUS_ENABLED";

function validId(x) {
  return typeof x === "string" && x.length > 0 && x.length <= 128 &&
    x === x.trim() && !x.includes("/");
}
function createB8ReceiptStatusGatewayForTests({getDb, HttpsError, enabled}={}) {
  if ([getDb,HttpsError,enabled].some(f=>typeof f!=="function")) {
    throw new TypeError("missing-b8-receipt-callable-dependencies");
  }
  const lookup = createB8ReceiptStatusHandlerForTests({getDb,HttpsError});
  return async function receiptCallable(request) {
    // Authentication and release switch are server-controlled, never client-supplied.
    if (!validId(request?.auth?.uid)) {
      throw new HttpsError("unauthenticated", "Inicia sesion.");
    }
    if (enabled() !== true) {
      throw new HttpsError("failed-precondition", "Consulta no habilitada.");
    }
    // Base handler independently validates request shape and owner/campaign.
    // All successful and unresolved results retain safeToRetry:false.
    const result = await lookup(request);
    if (!result || result.safeToRetry !== false ||
        !["confirmed","unconfirmed","needs-review"].includes(result.status)) {
      throw new HttpsError("failed-precondition", "No se pudo verificar la solicitud.");
    }
    return result;
  };
}

function createB8ReceiptStatusCallable() {
  // Lazy require; this module can be tested without Firebase CLI or admin SDK.
  // This is NOT exported by functions/index.js during B8-20V5A.
  const {onCall,HttpsError} = require("firebase-functions/v2/https");
  const {getFirestore} = require("firebase-admin/firestore");
  return onCall(B8_RECEIPT_OPTIONS, createB8ReceiptStatusGatewayForTests({
    getDb:getFirestore,
    HttpsError,
    enabled:() => process.env[ENABLE_ENV] === "true"
  }));
}
module.exports = {
  B8_RECEIPT_OPTIONS, ENABLE_ENV,
  createB8ReceiptStatusGatewayForTests,
  createB8ReceiptStatusCallable
};
