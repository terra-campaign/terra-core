"use strict";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DECISIONS = ["ACCEPTED","DECLINED"];

export function parsePendingResponse(raw) {
  if (raw === null) return null;

  if (typeof raw !== "string" ||
      raw.length < 2 ||
      raw.length > 600) {
    throw new Error("Marcador pendiente inválido.");
  }

  let value;

  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("Marcador pendiente ilegible.");
  }

  if (!value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      Object.keys(value).length !== 3 ||
      !Object.hasOwn(value,"requestId") ||
      !Object.hasOwn(value,"decision") ||
      !Object.hasOwn(value,"createdAt") ||
      typeof value.requestId !== "string" ||
      !UUID.test(value.requestId) ||
      !DECISIONS.includes(value.decision) ||
      !Number.isSafeInteger(value.createdAt) ||
      value.createdAt <= 0) {
    throw new Error("Marcador pendiente inválido.");
  }

  return Object.freeze({
    requestId:value.requestId,
    decision:value.decision,
    createdAt:value.createdAt,
    raw
  });
}

export function verifyPendingReceipt(data,pending) {
  if (!pending ||
      !DECISIONS.includes(pending.decision) ||
      !data ||
      data.recorded !== true ||
      !DECISIONS.includes(data.status)) {
    throw new Error("Confirmación no acreditada.");
  }

  const recordedStatus =
    data.recordedStatus ?? data.status;

  if (!DECISIONS.includes(recordedStatus) ||
      recordedStatus !== pending.decision) {
    throw new Error(
      "La respuesta no corresponde a la solicitud pendiente."
    );
  }

  // En un reintento idempotente el estado actual puede
  // haber cambiado por una revisión posterior legítima.
  return {
    recordedStatus,
    currentStatus:data.status
  };
}