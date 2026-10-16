"use strict";

// TERRA Campaign V1 - B8 Mission Response Policy.
// Este módulo no escribe en Firestore.
// El backend debe proporcionar ahoraMs usando su propio reloj.

const HOUR_MS = 60 * 60 * 1000;

const STATES = Object.freeze({
  NO_RESPONSE: "NO_RESPONSE",
  ACCEPTED: "ACCEPTED",
  DECLINED: "DECLINED"
});

function parseStartAt(value) {
  if (value === null || value === undefined || value === "") {
    return { valid: false, reason: "START_TIME_MISSING" };
  }

  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)
  ) {
    return { valid: false, reason: "INVALID_START_TIME" };
  }

  const millis = Date.parse(value);

  if (!Number.isFinite(millis)) {
    return { valid: false, reason: "INVALID_START_TIME" };
  }

  const normalized = new Date(millis).toISOString();

  if (
    value !== normalized &&
    value !== normalized.replace(".000Z", "Z")
  ) {
    return { valid: false, reason: "INVALID_START_TIME" };
  }

  return { valid: true, millis };
}

function evaluateResponseChange({
  startAt,
  nowMs,
  currentStatus = STATES.NO_RESPONSE,
  nextStatus
}) {
  if (!Number.isSafeInteger(nowMs)) {
    return { allowed: false, changed: false, reason: "INVALID_SERVER_TIME" };
  }

  if (!Object.values(STATES).includes(currentStatus)) {
    return { allowed: false, changed: false, reason: "INVALID_CURRENT_STATUS" };
  }

  if (![STATES.ACCEPTED, STATES.DECLINED].includes(nextStatus)) {
    return { allowed: false, changed: false, reason: "INVALID_NEXT_STATUS" };
  }

  const start = parseStartAt(startAt);

  if (!start.valid) {
    return { allowed: false, changed: false, reason: start.reason };
  }

  const closesAtMs = start.millis - HOUR_MS;

  // B8: el cierre tiene prioridad sobre una solicitud nueva
  // que repite la decisión existente.
  if (nowMs >= closesAtMs) {
    return {
      allowed: false,
      changed: false,
      reason: "RESPONSE_WINDOW_CLOSED",
      closesAtMs
    };
  }

  if (currentStatus === nextStatus) {
    return {
      allowed: true,
      changed: false,
      reason: "NO_CHANGE",
      closesAtMs
    };
  }

  return {
    allowed: true,
    changed: true,
    reason: "ALLOWED",
    closesAtMs,
    nextStatus
  };
}

module.exports = {
  STATES,
  HOUR_MS,
  parseStartAt,
  evaluateResponseChange
};