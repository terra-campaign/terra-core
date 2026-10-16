"use strict";

const {
  onCall,
  HttpsError
} = require("firebase-functions/v2/https");

const {
  getApps,
  initializeApp
} = require("firebase-admin/app");

const {
  getFirestore
} = require("firebase-admin/firestore");

const {
  getMissionConfirmationIndexCore
} = require("./mission-confirmation-index.cjs");

function defaultDb() {
  if (!getApps().length) initializeApp();
  return getFirestore();
}

function validId(value) {
  return typeof value === "string" &&
    value.length >= 1 &&
    value.length <= 160 &&
    value === value.trim() &&
    value !== "." &&
    value !== ".." &&
    !value.includes("/") &&
    !value.includes("\\") &&
    !/^__.*__$/.test(value);
}

function fail(code) {
  throw new Error(code);
}

function sanitizeResult(result, missionId) {
  if (!result ||
      result.missionId !== missionId ||
      typeof result.title !== "string" ||
      result.title.length > 150 ||
      !Number.isSafeInteger(result.total) ||
      result.total < 1 ||
      result.total > 50 ||
      !Array.isArray(result.participants) ||
      result.participants.length !== result.total ||
      !result.totals) {
    fail("mission-index-invalid-result");
  }

  const counts = {
    accepted:0,
    declined:0,
    noResponse:0
  };

  const uniqueMissions = new Set();

  const participants = result.participants.map(item => {
    if (!item ||
        !validId(item.missionId) ||
        typeof item.name !== "string" ||
        !item.name.trim() ||
        item.name.length > 160 ||
        uniqueMissions.has(item.missionId) ||
        !["ACCEPTED","DECLINED","NO_RESPONSE"]
          .includes(item.status)) {
      fail("mission-index-invalid-result");
    }

    uniqueMissions.add(item.missionId);

    if (item.status === "ACCEPTED") counts.accepted++;
    if (item.status === "DECLINED") counts.declined++;
    if (item.status === "NO_RESPONSE") counts.noResponse++;

    // No devolver personId, UID ni datos internos.
    return {
      missionId:item.missionId,
      name:item.name,
      status:item.status
    };
  });

  if (!result.totals ||
      result.totals.accepted !== counts.accepted ||
      result.totals.declined !== counts.declined ||
      result.totals.noResponse !== counts.noResponse) {
    fail("mission-index-invalid-result");
  }

  return {
    missionId,
    title:result.title,
    total:result.total,
    totals:counts,
    participants
  };
}

function translateError(error) {
  if (error instanceof HttpsError) return error;

  const reason = error?.code || error?.message || "";

  if (reason === "mission-index-unauthenticated") {
    return new HttpsError(
      "unauthenticated",
      "Inicia sesión para consultar las confirmaciones."
    );
  }

  if (reason === "mission-index-invalid-id") {
    return new HttpsError(
      "invalid-argument",
      "Identificador de misión inválido."
    );
  }

  if ([
    "mission-index-permission-denied",
    "mission-index-invalid-group",
    "mission-index-invalid-response"
  ].includes(reason)) {
    return new HttpsError(
      "permission-denied",
      "No tienes autorización para consultar este índice."
    );
  }

  return new HttpsError(
    "internal",
    "No fue posible consultar las confirmaciones."
  );
}

function createMissionConfirmationIndexCallable({
  onCallImpl = onCall,
  getDb = defaultDb,
  core = getMissionConfirmationIndexCore
} = {}) {

  return onCallImpl(
    {region:"us-central1"},
    async request => {
      try {
        if (!validId(request?.auth?.uid)) {
          fail("mission-index-unauthenticated");
        }

        const data = request.data;

        if (!data ||
            typeof data !== "object" ||
            Array.isArray(data) ||
            Object.keys(data).length !== 1 ||
            !Object.hasOwn(data,"missionId") ||
            !validId(data.missionId)) {
          fail("mission-index-invalid-id");
        }

        const result = await core({
          db:getDb(),
          request,
          missionId:data.missionId
        });

        return sanitizeResult(result,data.missionId);

      } catch (error) {
        throw translateError(error);
      }
    }
  );
}

module.exports = {
  createMissionConfirmationIndexCallable,
  sanitizeResult
};