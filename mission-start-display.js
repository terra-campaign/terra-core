// TERRA Campaign 19R: presentacion segura del inicio canonico de una mision.
// No infiere la hora desde missionDate, createdAt o deadlineAt.
const zoneLabels = Object.freeze({
  "America/Mazatlan": "hora de Mazatlan",
  "America/Bahia_Banderas": "hora de Bahia de Banderas",
  "America/Mexico_City": "hora del centro de Mexico",
  "America/Hermosillo": "hora de Hermosillo",
  "America/Tijuana": "hora de Tijuana",
  "America/Cancun": "hora de Cancun"
});

function instantFrom(value) {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value : null;
  }
  if (value && typeof value.toDate === "function") {
    try {
      const date = value.toDate();
      return date instanceof Date && Number.isFinite(date.getTime()) ? date : null;
    } catch { return null; }
  }
  if (value && typeof value.toMillis === "function") {
    try {
      const date = new Date(value.toMillis());
      return Number.isFinite(date.getTime()) ? date : null;
    } catch { return null; }
  }
  if (value && typeof value === "object" &&
      Number.isFinite(value.seconds) && Number.isFinite(value.nanoseconds ?? 0)) {
    const date = new Date(value.seconds * 1000 + Math.floor((value.nanoseconds ?? 0) / 1000000));
    return Number.isFinite(date.getTime()) ? date : null;
  }
  if (typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
  }
  return null;
}

export function missionStartDisplay(mission) {
  if (!mission || mission.startAt == null || mission.startAt === "") {
    return "Hora de inicio no registrada";
  }
  const instant = instantFrom(mission.startAt);
  if (!instant) return "Fecha y hora de inicio no verificables";

  const rawZone = mission.startTimeZone;
  // Sin zona canonica, mostrar el instante real en UTC y no asumir zona del navegador.
  const zoneMissing = typeof rawZone !== "string" || !rawZone.trim();
  const zone = zoneMissing ? "UTC" : rawZone.trim();
  try {
    const formatted = new Intl.DateTimeFormat("es-MX", {
      timeZone: zone,
      day: "numeric", month: "short", year: "numeric",
      hour: "numeric", minute: "2-digit", hour12: true
    }).format(instant);
    const zoneLabel = zoneMissing
      ? "UTC; zona de la mision no registrada"
      : (zoneLabels[zone] || zone);
    return `${formatted} (${zoneLabel})`;
  } catch {
    // Una zona invalida nunca debe producir una hora local inventada.
    return "Zona horaria de inicio no verificable";
  }
}
