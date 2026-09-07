const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {getFirestore} = require("firebase-admin/firestore");

// Resumen del historial de misiones de los usuarios actualmente asignados.
// No devuelve documentos personales, IDs de usuarios ni evidencia individual.
exports.getStructureProgress = onCall({region: "us-central1", timeoutSeconds: 60}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Inicie sesión.");
  const id = request.data?.structureDocumentId;
  if (typeof id !== "string" || !id || id.includes("/") || id.length > 1500)
    throw new HttpsError("invalid-argument", "Estructura inválida.");
  const db = getFirestore();
  return db.runTransaction(async (tx) => {
    const profileDoc = await tx.get(db.doc("usuarios/" + request.auth.uid));
    const p = profileDoc.data();
    if (!p || p.active !== true || !p.campaignId ||
        !["admin", "coordinador_municipal", "jefe_estructura"].includes(p.role))
      throw new HttpsError("permission-denied", "Acceso denegado.");
    const structureDoc = await tx.get(db.doc("estructuras/" + id));
    const s = structureDoc.data();
    if (!s || !s.id || !s.municipalityId || s.campaignId !== p.campaignId ||
        (p.role === "coordinador_municipal" && s.municipalityId !== p.municipalityId) ||
        (p.role === "jefe_estructura" && s.id !== p.structureId))
      throw new HttpsError("permission-denied", "Acceso denegado.");

    // Consultas simples: no requieren nuevos índices compuestos.
    // Límite explícito: nunca presentar totales parciales como completos.
    async function readCampaign(name) {
      const snap = await tx.get(db.collection(name).where("campaignId", "==", p.campaignId).limit(5001));
      if (snap.size > 5000)
        throw new HttpsError("resource-exhausted", "El volumen requiere un resumen precalculado.");
      return snap.docs;
    }
    const users = await readCampaign("usuarios");
    const ids = new Set(users.filter(d => {
      const u = d.data();
      return u.structureId === s.id && u.municipalityId === s.municipalityId &&
        ["jefe_estructura", "integrante", "participante"].includes(u.role);
    }).map(d => d.id));
    const missions = await readCampaign("misiones");
    const selected = new Map(missions.filter(d => ids.has(d.data().assignedTo)).map(d => [d.id, d.data()]));
    const evidence = await readCampaign("missionEvidence");
    const reported = new Set();
    let lastActivity = null;
    for (const d of evidence) {
      const e = d.data();
      const m = selected.get(e.missionId);
      if (!m || e.uploadedBy !== m.assignedTo) continue;
      reported.add(e.missionId);
      const time = e.createdAt?.toMillis?.();
      if (Number.isFinite(time) && (lastActivity === null || time > lastActivity)) lastActivity = time;
    }
    const total = selected.size;
    return {
      total, withEvidence: reported.size, withoutEvidence: total - reported.size,
      percentage: total ? Math.round(reported.size * 1000 / total) / 10 : null,
      lastActivity, calculatedAt: Date.now()
    };
  });
});
