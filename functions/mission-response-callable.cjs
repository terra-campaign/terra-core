"use strict";

const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {getFirestore} = require("firebase-admin/firestore");
const {getApps, initializeApp} = require("firebase-admin/app");
const {resolveCanonicalPersonForAccount} = require("./person-identity.cjs");
const {recordMissionResponseCore} = require("./mission-response-store.cjs");
const {STATES, parseStartAt, HOUR_MS} = require("./mission-response-policy.cjs");

function defaultDb() {
  if (!getApps().length) initializeApp();
  return getFirestore();
}

function validId(value) {
  return typeof value === "string" &&
    value.length > 0 && value.length <= 160 &&
    value.trim() === value &&
    value !== "." && value !== ".." &&
    !value.includes("/") && !value.includes("\\") &&
    !/^__.*__$/.test(value);
}

function fail(code) {
  throw new Error(code);
}

function strictData(data, keys) {
  return data && typeof data === "object" &&
    !Array.isArray(data) &&
    Object.keys(data).length === keys.length &&
    keys.every(key => Object.hasOwn(data, key));
}

async function readOwnMissionResponse({
  db, request, missionId,
  resolveIdentity = resolveCanonicalPersonForAccount,
  clock = Date.now
}) {
  const uid = request?.auth?.uid;

  if (!validId(uid)) fail("mission-response-unauthenticated");
  if (!validId(missionId)) fail("mission-response-invalid-id");

  return db.runTransaction(async tx => {
    const profileSnap = await tx.get(
      db.collection("usuarios").doc(uid)
    );

    if (!profileSnap.exists) {
      fail("mission-response-permission-denied");
    }

    const profile = profileSnap.data();

    if (!profile || profile.active !== true ||
        !validId(profile.campaignId)) {
      fail("mission-response-permission-denied");
    }

    const missionRef = db.collection("misiones").doc(missionId);
    const missionSnap = await tx.get(missionRef);

    if (!missionSnap.exists) {
      fail("mission-response-permission-denied");
    }

    const mission = missionSnap.data();

    if (!mission || mission.active !== true ||
        mission.campaignId !== profile.campaignId) {
      fail("mission-response-permission-denied");
    }

    const identity = await resolveIdentity({
      db,
      tx,
      accountUid: uid,
      profile,
      campaignId: profile.campaignId
    });

    if (!identity || !validId(identity.personId) ||
        identity.personId !== mission.personId ||
        mission.accountUid !== uid ||
        mission.assignedTo !== uid) {
      fail("mission-response-not-assignee");
    }

    const responseSnap = await tx.get(
      missionRef.collection("responses").doc(identity.personId)
    );

    const response = responseSnap.exists
      ? responseSnap.data()
      : null;

    if (response && (
        response.campaignId !== mission.campaignId ||
        response.missionId !== missionId ||
        response.personId !== identity.personId ||
        ![STATES.ACCEPTED, STATES.DECLINED]
          .includes(response.status))) {
      fail("mission-response-invalid-existing-state");
    }

    const start = parseStartAt(mission.startAt);
    const closesAtMs = start.valid
      ? start.millis - HOUR_MS
      : null;

    const nowMs = clock();

    if (!Number.isSafeInteger(nowMs)) {
      fail("mission-response-invalid-server-time");
    }

    return {
      missionId,
      status: response?.status ?? STATES.NO_RESPONSE,
      revision: response?.revision ?? 0,
      decidedAtMs: response?.decidedAtMs ?? null,
      startAt: start.valid ? mission.startAt : null,
      closesAtMs,
      canChange: closesAtMs !== null && nowMs < closesAtMs
    };
  });
}

function translateError(error) {
  if (error instanceof HttpsError) return error;

  const reason = error?.code || error?.message || "";

  if (reason === "mission-response-unauthenticated") {
    return new HttpsError(
      "unauthenticated", "Inicia sesión para responder."
    );
  }

  if ([
    "mission-response-invalid-id",
    "mission-response-invalid-decision"
  ].includes(reason)) {
    return new HttpsError(
      "invalid-argument", "Datos de confirmación inválidos."
    );
  }

  if ([
    "mission-response-permission-denied",
    "mission-response-profile-not-found",
    "mission-response-not-assignee",
    "mission-response-mission-not-found"
  ].includes(reason)) {
    return new HttpsError(
      "permission-denied",
      "No tienes autorización para consultar o responder esta misión."
    );
  }

  if (reason === "RESPONSE_WINDOW_CLOSED") {
    return new HttpsError(
      "failed-precondition",
      "El plazo para cambiar la participación ha terminado.",
      {reason}
    );
  }

  if (reason === "START_TIME_MISSING") {
    return new HttpsError(
      "failed-precondition",
      "Esta misión no tiene hora de inicio confirmada.",
      {reason}
    );
  }

  if (reason === "mission-response-request-conflict") {
    return new HttpsError(
      "already-exists",
      "Esta solicitud ya se utilizó para otra decisión."
    );
  }

  return new HttpsError(
    "internal",
    "No fue posible completar la consulta o confirmación."
  );
}

function createMissionResponseCallables({
  onCallImpl = onCall,
  getDb = defaultDb,
  resolveIdentity = resolveCanonicalPersonForAccount,
  record = recordMissionResponseCore,
  read = readOwnMissionResponse
} = {}) {
  const options = {region: "us-central1"};

  const recordMissionParticipationResponse = onCallImpl(
    options,
    async request => {
      try {
        if (!validId(request?.auth?.uid)) {
          fail("mission-response-unauthenticated");
        }

        const data = request.data;

        if (!strictData(
          data, ["missionId", "requestId", "decision"]
        ) || !validId(data.missionId) ||
             !validId(data.requestId) ||
             ![STATES.ACCEPTED, STATES.DECLINED]
               .includes(data.decision)) {
          fail("mission-response-invalid-decision");
        }

        return await record({
          db: getDb(),
          request,
          missionId: data.missionId,
          requestId: data.requestId,
          nextStatus: data.decision,
          resolveIdentity
        });
      } catch (error) {
        throw translateError(error);
      }
    }
  );

  const getMissionParticipationStatus = onCallImpl(
    options,
    async request => {
      try {
        if (!validId(request?.auth?.uid)) {
          fail("mission-response-unauthenticated");
        }

        const data = request.data;

        if (!strictData(data, ["missionId"]) ||
            !validId(data.missionId)) {
          fail("mission-response-invalid-id");
        }

        return await read({
          db: getDb(),
          request,
          missionId: data.missionId,
          resolveIdentity
        });
      } catch (error) {
        throw translateError(error);
      }
    }
  );

  return {
    recordMissionParticipationResponse,
    getMissionParticipationStatus
  };
}

module.exports = {
  createMissionResponseCallables,
  readOwnMissionResponse
};