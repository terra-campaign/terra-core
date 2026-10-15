"use strict";
/**
 * TERRA Campaign V1 — B8-20V1 (LABORATORY ONLY).
 * Safe read-only receipt-status prototype. NOT linked from functions/index.js.
 * NO production authorization, NO writes, NO auto-retries and NO unlocks.
 *
 * CRITICAL: B7 and B8 legacy receipt shape is identical. Only a future
 * explicitly tagged B8 receipt can be classified as B8 confirmed.
 * THIS MODULE DOES NOT CHANGE THE EXISTING B8 WRITER.
 */
const {createHash} = require("node:crypto");
const HEX64 = /^[0-9a-f]{64}$/;
const B8_RECEIPT_SOURCE = "b8-root-v1"; // Proposed future discriminator.
function validId(x) {
  return typeof x === "string" && x.length > 0 && x.length <= 128 &&
    x === x.trim() && !x.includes("/");
}
function receiptId(uid, requestId) {
  if (!validId(uid) || !validId(requestId)) throw new TypeError("invalid-receipt-key");
  // Must exactly match the B7 and B8 writer hashing logic.
  return createHash("sha256").update(JSON.stringify([uid, requestId])).digest("hex");
}
function createB8ReceiptStatusHandlerForTests({getDb, HttpsError} = {}) {
  if (typeof getDb !== "function" || typeof HttpsError !== "function") {
    throw new TypeError("missing-receipt-status-dependencies");
  }
  function reject(code) {
    const messages = {
      "unauthenticated":"Inicia sesion.",
      "invalid-argument":"Solicitud invalida.",
      "permission-denied":"No tienes autorizacion para consultar esta solicitud.",
      "failed-precondition":"No se pudo verificar la solicitud. Intenta consultar mas tarde."
    };
    throw new HttpsError(code, messages[code]);
  }
  return async function receiptStatus(request) {
    const uid = request?.auth?.uid;
    if (!validId(uid)) reject("unauthenticated");
    const data = request?.data;
    if (!data || typeof data !== "object" || Array.isArray(data) ||
        Object.keys(data).length !== 1 || !Object.hasOwn(data, "requestId") ||
        !validId(data.requestId)) reject("invalid-argument");
    try {
      const db = getDb();
      if (!db || typeof db.collection !== "function") throw new Error("invalid-db");
      const actorSnap = await db.collection("usuarios").doc(uid).get();
      const actor = actorSnap?.data?.();
      if (!actorSnap?.exists || !actor || actor.active !== true ||
          actor.role !== "jefe_estructura" || !validId(actor.campaignId)) {
        reject("permission-denied");
      }
      const id = receiptId(uid, data.requestId);
      const receiptSnap = await db.collection("missionDispatches").doc(id).get();
      // No receipt does NOT prove that a remote transaction has ceased.
      if (!receiptSnap || receiptSnap.exists === false) {
        return {status:"unconfirmed", safeToRetry:false};
      }
      if (receiptSnap.exists !== true || receiptSnap.id !== id ||
          typeof receiptSnap.data !== "function") {
        throw new Error("invalid-receipt-snapshot");
      }
      const rec = receiptSnap.data();
      if (!rec || rec.campaignId !== actor.campaignId) reject("permission-denied");
      // Untagged legacy receipt might be B7 — NEVER label as confirmed B8.
      if (rec.source !== B8_RECEIPT_SOURCE) {
        return {status:"needs-review", safeToRetry:false};
      }
      const result = rec.result;
      if (!HEX64.test(rec.fingerprint || "") ||
          !result || !Number.isSafeInteger(result.created) || result.created < 1 ||
          !Number.isSafeInteger(result.alreadyAssigned) || result.alreadyAssigned !== 0 ||
          !Object.hasOwn(rec, "createdAt") || rec.createdAt == null) {
        return {status:"needs-review", safeToRetry:false};
      }
      // No names, fingerprints, campaign IDs, request keys, mission IDs or UIDs.
      return {status:"confirmed",safeToRetry:false,
        created:result.created,alreadyAssigned:result.alreadyAssigned};
    } catch (e) {
      if (e instanceof HttpsError) throw e;
      reject("failed-precondition");
    }
  };
}
module.exports = {receiptId, B8_RECEIPT_SOURCE, createB8ReceiptStatusHandlerForTests};
