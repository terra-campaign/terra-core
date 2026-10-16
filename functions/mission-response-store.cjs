"use strict";

const {
  STATES,
  evaluateResponseChange
} = require("./mission-response-policy.cjs");

function reject(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function validSegment(value) {
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

/*
 * B8 - Registro de participacion personal.
 *
 * - La identidad procede de la sesion y del resolvedor canonico.
 * - No admite personId enviado por el cliente.
 * - La hora procede del servidor.
 * - La operacion es transaccional.
 * - El historial conserva decisiones verificables.
 * - Los usuarios sin cuenta requieren otro flujo asistido.
 *
 * Esta funcion es interna: todavia NO es una callable publica.
 */

async function recordMissionResponseCore({
  db,
  request,
  missionId,
  requestId,
  nextStatus,
  resolveIdentity,
  clock = Date.now
} = {}) {

  const uid = request?.auth?.uid;

  if (!validSegment(uid)) {
    reject("mission-response-unauthenticated");
  }

  if (!validSegment(missionId) ||
      !validSegment(requestId)) {
    reject("mission-response-invalid-id");
  }

  if (![STATES.ACCEPTED, STATES.DECLINED]
      .includes(nextStatus)) {
    reject("mission-response-invalid-decision");
  }

  if (typeof clock !== "function") {
    reject("mission-response-invalid-clock");
  }

  if (!db ||
      typeof db.collection !== "function" ||
      typeof db.runTransaction !== "function" ||
      typeof resolveIdentity !== "function") {
    reject("mission-response-invalid-dependencies");
  }

  const profileRef = db.collection("usuarios").doc(uid);
  const missionRef = db.collection("misiones").doc(missionId);

  return db.runTransaction(async (tx) => {

    const profileSnap = await tx.get(profileRef);

    if (!profileSnap.exists) {
      reject("mission-response-profile-not-found");
    }

    const profile = profileSnap.data();

    if (!profile ||
        profile.active !== true ||
        !validSegment(profile.campaignId)) {
      reject("mission-response-permission-denied");
    }

    const missionSnap = await tx.get(missionRef);

    if (!missionSnap.exists) {
      reject("mission-response-mission-not-found");
    }

    const mission = missionSnap.data();

    if (!mission ||
        mission.active !== true ||
        mission.campaignId !== profile.campaignId) {
      reject("mission-response-permission-denied");
    }

    const identity = await resolveIdentity({
      db,
      tx,
      accountUid: uid,
      profile,
      campaignId: profile.campaignId
    });

    if (!identity ||
        !validSegment(identity.personId) ||
        mission.personId !== identity.personId ||
        mission.accountUid !== uid ||
        mission.assignedTo !== uid) {
      reject("mission-response-not-assignee");
    }

    const responseRef = missionRef
      .collection("responses")
      .doc(identity.personId);

    const historyRef = responseRef
      .collection("history")
      .doc(requestId);

    const historySnap = await tx.get(historyRef);
    const responseSnap = await tx.get(responseRef);

    const current = responseSnap.exists
      ? responseSnap.data()
      : null;

    if (current &&
        (current.campaignId !== mission.campaignId ||
         current.personId !== identity.personId ||
         current.missionId !== missionId ||
         !Object.values(STATES).includes(current.status))) {
      reject("mission-response-invalid-existing-state");
    }

    // Reintento seguro: no genera otra decision.
    if (historySnap.exists) {

      const previous = historySnap.data();

      if (!previous ||
          previous.actorUid !== uid ||
          previous.nextStatus !== nextStatus ||
          previous.personId !== identity.personId ||
          previous.missionId !== missionId) {
        reject("mission-response-request-conflict");
      }

      return {
        recorded: true,
        changed: false,
        idempotent: true,
        status: current?.status ?? previous.nextStatus,
        recordedStatus: previous.nextStatus
      };
    }

    // Hora evaluada en cada intento de transaccion.
    const nowMs = clock();

    if (!Number.isSafeInteger(nowMs)) {
      reject("mission-response-invalid-server-time");
    }

    const previousStatus =
      current?.status ?? STATES.NO_RESPONSE;

    const policy = evaluateResponseChange({
      startAt: mission.startAt,
      nowMs,
      currentStatus: previousStatus,
      nextStatus
    });

    if (!policy.allowed) {
      reject(policy.reason);
    }

    if (!policy.changed) {
      return {
        recorded: true,
        changed: false,
        idempotent: false,
        status: previousStatus
      };
    }

    const revision = (current?.revision ?? 0) + 1;

    if (!Number.isSafeInteger(revision)) {
      reject("mission-response-invalid-revision");
    }

    const record = {
      missionId,
      campaignId: mission.campaignId,
      personId: identity.personId,
      accountUid: uid,
      status: nextStatus,
      revision,
      decidedAtMs: nowMs,
      updatedByUid: uid
    };

    const event = {
      missionId,
      campaignId: mission.campaignId,
      personId: identity.personId,
      actorUid: uid,
      fromStatus: previousStatus,
      nextStatus,
      revision,
      decidedAtMs: nowMs,
      requestId,
      source: "SELF_AUTHENTICATED"
    };

    tx.create(historyRef, event);
    tx.set(responseRef, record);

    return {
      recorded: true,
      changed: true,
      idempotent: false,
      status: nextStatus,
      revision,
      closesAtMs: policy.closesAtMs
    };
  });
}

module.exports = {recordMissionResponseCore};