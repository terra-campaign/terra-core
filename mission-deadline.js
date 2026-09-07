export function deadlineText(mission) {
  if (mission.active !== true) return "DESACTIVADA. No admite nuevos reportes.";
  if (!mission.deadlineAt) return "Sin fecha límite.";
  const end = Date.parse(mission.deadlineAt);
  if (!Number.isFinite(end)) return "Fecha límite no disponible.";
  const label = new Date(end).toLocaleString('es-MX');
  const minutes = Math.ceil((end-Date.now())/60000);
  if (minutes <= 0) return `Plazo vencido: ${label}. Los nuevos reportes se registran fuera de plazo.`;
  return `Vence: ${label}. Te quedan ${Math.floor(minutes/60)} h ${minutes%60} min para reportar.`;
}
export function deadlineInputValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);
}
export function inputDeadline(value) {
  return value ? new Date(value).toISOString() : null;
}
