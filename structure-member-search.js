// BUILD-20I — Filtrado únicamente de integrantes recibidos del alcance autorizado.
// No consulta Firebase ni cambia personas, misiones o puntuaciones.
export function normalizeStructureSearch(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-MX")
    .replace(/\s+/g, " ")
    .trim();
}

export function filterStructureMembers(members, query) {
  const list = Array.isArray(members) ? members : [];
  const words = normalizeStructureSearch(query).split(" ").filter(Boolean);
  if (words.length === 0) return list;
  return list.filter((member) => {
    const searchable = normalizeStructureSearch(
      `${member?.name ?? ""} ${member?.locality ?? ""}`
    );
    return words.every((word) => searchable.includes(word));
  });
}
