"use strict";

// B8: convierte fecha + hora local + zona IANA a UTC.
// No utiliza la zona horaria del navegador.

export const MISSION_ZONES = Object.freeze([
  "America/Mazatlan",
  "America/Bahia_Banderas",
  "America/Mexico_City",
  "America/Hermosillo",
  "America/Tijuana",
  "America/Cancun"
]);

export function missionStartToUTC({
  missionDate,
  startTime,
  timeZone
}) {
  if (!MISSION_ZONES.includes(timeZone)) {
    throw new Error("Selecciona la zona horaria de la misión.");
  }

  if (typeof missionDate !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(missionDate)) {
    throw new Error("Selecciona la fecha de la misión.");
  }

  if (typeof startTime !== "string" ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)) {
    throw new Error("Selecciona una hora de inicio válida.");
  }

  const [year, month, day] = missionDate.split("-").map(Number);
  const [hour, minute] = startTime.split(":").map(Number);

  const localAsUTC = Date.UTC(
    year, month - 1, day, hour, minute
  );

  const dateCheck = new Date(localAsUTC);

  if (dateCheck.getUTCFullYear() !== year ||
      dateCheck.getUTCMonth() !== month - 1 ||
      dateCheck.getUTCDate() !== day) {
    throw new Error("La fecha de la misión no existe.");
  }

  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });

  const matches = [];

  // Buscar el instante UTC que corresponde a la hora local.
  // También detecta horas inexistentes o ambiguas por cambio horario.
  for (let offsetMinutes = -840;
       offsetMinutes <= 840;
       offsetMinutes += 15) {

    const candidate = localAsUTC - offsetMinutes * 60000;

    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(candidate))
        .filter(part => part.type !== "literal")
        .map(part => [part.type, Number(part.value)])
    );

    if (parts.year === year &&
        parts.month === month &&
        parts.day === day &&
        parts.hour === hour &&
        parts.minute === minute) {
      matches.push(candidate);
    }
  }

  if (matches.length !== 1) {
    throw new Error(
      "La hora indicada no es única o no existe en esa zona horaria. " +
      "Selecciona otra hora."
    );
  }

  return new Date(matches[0]).toISOString();
}