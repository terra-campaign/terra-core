"use strict";

// TERRA Campaign V1 - B8
// Constructor local. NO ejecuta escrituras ni llamadas Firebase.

const REF_SHA256 = /^[0-9a-f]{64}$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const UTC_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

const ALLOWED_FIELDS = new Set([
  "requestId",
  "assigneeRefs",
  "activityCode",
  "title",
  "description",
  "locality",
  "missionDate",
  "startAt", "startTimeZone",
  "deadlineAt"
]);

function textField(value, max, label, required = false) {
  if (value === null || value === undefined) {
    if (required) throw new Error(`B8: falta ${label}.`);
    return "";
  }

  if (
    typeof value !== "string" ||
    value.length > max ||
    (required && !value.trim())
  ) {
    throw new Error(`B8: ${label} no valido.`);
  }

  return value.trim();
}

function validRequestId(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 128 &&
    value.trim() === value &&
    !value.includes("/")
  );
}

function validMissionDate(value) {
  return (
    typeof value === "string" &&
    DATE_ONLY.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}

export function buildSmartAssignmentPayload(
  input,
  {nowMs = Date.now(), directAssigneeRefs = []} = {}
) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("B8: datos de mision invalidos.");
  }

  if (Object.keys(input).some(key => !ALLOWED_FIELDS.has(key))) {
    throw new Error("B8: campos no permitidos.");
  }

  if (!validRequestId(input.requestId)) {
    throw new Error("B8: identificador de solicitud invalido.");
  }

  // No mezclar destinatarios del guardado B7 con el envio B8.
  if (!Array.isArray(directAssigneeRefs) ||
      directAssigneeRefs.length !== 0) {
    throw new Error(
      "B8: desmarca los destinatarios de Mis directos antes de continuar."
    );
  }

  const refs = input.assigneeRefs;

  if (
    !Array.isArray(refs) ||
    refs.length < 1 ||
    refs.length > 50 ||
    refs.some(ref => typeof ref !== "string" || !REF_SHA256.test(ref)) ||
    new Set(refs).size !== refs.length
  ) {
    throw new Error("B8: seleccion de integrantes invalida.");
  }

  const activityCode = textField(
    input.activityCode, 100, "actividad", true
  );

  const title = textField(input.title, 150, "titulo", true);
  const description = textField(input.description, 1500, "descripcion");
  const locality = textField(input.locality, 120, "localidad");

  let missionDate = null;

  if (input.missionDate !== null &&
      input.missionDate !== undefined &&
      input.missionDate !== "") {
    if (!validMissionDate(input.missionDate)) {
      throw new Error("B8: fecha de mision invalida.");
    }
    missionDate = input.missionDate;
  }

  let startAt = null;
  if (input.startAt !== undefined &&
      input.startAt !== null &&
      input.startAt !== "") {
    if (typeof input.startAt !== "string" ||
        !UTC_DATE.test(input.startAt) ||
        !Number.isFinite(Date.parse(input.startAt)) ||
        !Number.isFinite(nowMs) ||
        Date.parse(input.startAt) <= nowMs) {
      throw new Error("B8: hora de inicio invalida o vencida.");
    }
    const normalizedStart = new Date(input.startAt).toISOString();
    if (![normalizedStart, normalizedStart.replace(".000Z", "Z")]
        .includes(input.startAt)) {
      throw new Error("B8: hora de inicio invalida.");
    }
    startAt = normalizedStart;
  }
  let startTimeZone = null;
  if (input.startTimeZone !== undefined &&
      input.startTimeZone !== null &&
      input.startTimeZone !== "") {
    const validZones = new Set([
      "America/Mazatlan",
      "America/Bahia_Banderas",
      "America/Mexico_City",
      "America/Hermosillo",
      "America/Tijuana",
      "America/Cancun"
    ]);
    if (!startAt || !validZones.has(input.startTimeZone)) {
      throw new Error("B8: zona horaria invalida.");
    }
    startTimeZone = input.startTimeZone;
  }
  let deadlineAt = null;

  if (input.deadlineAt !== null &&
      input.deadlineAt !== undefined &&
      input.deadlineAt !== "") {
    if (
      typeof input.deadlineAt !== "string" ||
      !UTC_DATE.test(input.deadlineAt) ||
      !Number.isFinite(Date.parse(input.deadlineAt)) ||
      !Number.isFinite(nowMs) ||
      Date.parse(input.deadlineAt) <= nowMs
    ) {
      throw new Error("B8: fecha limite invalida o vencida.");
    }

    deadlineAt = new Date(input.deadlineAt).toISOString();
  }

  return {
    requestId: input.requestId,
    assigneeRefs: [...refs].sort(),
    activityCode,
    title,
    description,
    locality,
    missionDate,
    ...(startAt ? { startAt } : {}),
    ...(startTimeZone ? { startTimeZone } : {}),
    deadlineAt
  };
}