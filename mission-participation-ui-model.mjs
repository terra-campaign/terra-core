"use strict";

export function describeParticipation({
  status,
  canChange,
  startAt
} = {}) {
  const labels = {
    NO_RESPONSE: "Sin respuesta",
    ACCEPTED: "Aceptó participar",
    DECLINED: "No podrá participar"
  };

  if (!Object.hasOwn(labels,status) ||
      typeof canChange !== "boolean") {
    throw new Error("Estado de participación inválido.");
  }

  let explanation;

  if (!startAt) {
    explanation =
      "Esta misión no tiene hora de inicio registrada. " +
      "No se puede confirmar en línea.";
  } else if (!canChange) {
    explanation =
      "El plazo para responder o cambiar tu decisión ha terminado.";
  } else {
    explanation =
      "Puedes cambiar tu decisión hasta una hora antes del inicio.";
  }

  return {
    label: labels[status],
    explanation,
    acceptEnabled: canChange && status !== "ACCEPTED",
    declineEnabled: canChange && status !== "DECLINED"
  };
}