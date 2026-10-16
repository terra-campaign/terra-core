"use strict";

const LABELS = Object.freeze({
  ACCEPTED: "Aceptó participar",
  DECLINED: "No podrá participar",
  NO_RESPONSE: "Sin respuesta"
});

export function normalizeConfirmationIndex(data) {
  if (!data || typeof data !== "object" ||
      typeof data.title !== "string" ||
      !Number.isSafeInteger(data.total) ||
      data.total < 1 || data.total > 50 ||
      !Array.isArray(data.participants) ||
      data.participants.length !== data.total) {
    throw new Error("Índice de confirmaciones inválido.");
  }

  const rows = [];
  const unique = new Set();

  const totals = {
    accepted: 0,
    declined: 0,
    noResponse: 0
  };

  for (const person of data.participants) {
    if (!person ||
        typeof person.missionId !== "string" ||
        !person.missionId ||
        unique.has(person.missionId) ||
        typeof person.name !== "string" ||
        !person.name.trim() ||
        person.name.length > 160 ||
        !Object.hasOwn(LABELS,person.status)) {
      throw new Error("Integrante o estado inválido.");
    }

    unique.add(person.missionId);

    if (person.status === "ACCEPTED") totals.accepted++;
    if (person.status === "DECLINED") totals.declined++;
    if (person.status === "NO_RESPONSE") totals.noResponse++;

    rows.push({
      name: person.name,
      status: person.status,
      label: LABELS[person.status]
    });
  }

  if (!data.totals ||
      totals.accepted !== data.totals.accepted ||
      totals.declined !== data.totals.declined ||
      totals.noResponse !== data.totals.noResponse) {
    throw new Error("Totales de confirmación inconsistentes.");
  }

  return {
    title: data.title,
    total: data.total,
    totals,
    rows
  };
}