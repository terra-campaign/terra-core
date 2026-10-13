"use strict";

const {
  resolveCanonicalPersonForAccount
} = require("./person-identity.cjs");

const {
  discoverSmartAssignmentFromFirestore
} = require("./mission-smart-assignment-integrator.cjs");

const {
  validateSmartAssignmentSelection
} = require("./mission-smart-assignment-selection.cjs");

/**
 * BUILD B8.4
 *
 * Autoriza selecciones dentro de una transaccion
 * proporcionada por el futuro motor de escritura.
 *
 * No inicia transacciones.
 * No realiza escrituras.
 * No es callable.
 * No devuelve resultados al navegador.
 */
async function authorizeSmartAssignmentWithinTransaction({
  db,
  tx,
  request,
  activityCode,
  assigneeRefs,
  maxCandidates
} = {}) {

  const uid = request?.auth?.uid;

  if (
    typeof uid !== "string" ||
    !uid ||
    uid.trim() !== uid ||
    uid.includes("/")
  ) {
    throw new Error("smart-assignment-unauthenticated");
  }

  if (
    !db ||
    typeof db.collection !== "function" ||
    !tx ||
    typeof tx.get !== "function"
  ) {
    throw new TypeError("invalid-smart-assignment-write-context");
  }

  // Rechazar selecciones mal formadas antes de
  // efectuar cualquier lectura operacional.
  if (
    !Array.isArray(assigneeRefs) ||
    assigneeRefs.length < 1 ||
    assigneeRefs.length > 50
  ) {
    throw new Error("invalid-smart-assignment-selection-size");
  }

  const seen = new Set();

  for (const ref of assigneeRefs) {
    if (
      typeof ref !== "string" ||
      !/^[a-f0-9]{64}$/.test(ref)
    ) {
      throw new Error("invalid-smart-assignment-reference");
    }

    if (seen.has(ref)) {
      throw new Error("duplicate-smart-assignment-reference");
    }

    seen.add(ref);
  }

  const profileRef = db.collection("usuarios").doc(uid);
  const snapshot = await tx.get(profileRef);

  if (!snapshot.exists) {
    throw new Error("smart-assignment-profile-not-found");
  }

  const profile = snapshot.data();

  if (
    !profile ||
    profile.active !== true ||
    profile.role !== "jefe_estructura" ||
    typeof profile.campaignId !== "string" ||
    !profile.campaignId ||
    profile.campaignId.trim() !== profile.campaignId ||
    profile.campaignId.includes("/") ||
    (profile.uid != null && profile.uid !== uid)
  ) {
    throw new Error("smart-assignment-permission-denied");
  }

  const identity = await resolveCanonicalPersonForAccount({
    db,
    tx,
    accountUid: uid,
    profile,
    campaignId: profile.campaignId
  });

  if (
    !identity ||
    typeof identity.personId !== "string" ||
    !identity.personId ||
    identity.personId.trim() !== identity.personId ||
    identity.personId.includes("/")
  ) {
    throw new Error("smart-assignment-invalid-identity");
  }

  // La consulta y la autorizacion operan sobre
  // la misma transaccion recibida.
  const discovery = await discoverSmartAssignmentFromFirestore({
    db,
    campaignId: profile.campaignId,
    actorPersonId: identity.personId,
    activityCode,
    maxCandidates,
    tx
  });

  if (
    !discovery ||
    discovery.ok !== true ||
    discovery.internalOnly !== true ||
    !Array.isArray(discovery.eligible)
  ) {
    throw new Error("invalid-smart-assignment-discovery-result");
  }

  const selection = validateSmartAssignmentSelection({
    assigneeRefs,
    eligible: discovery.eligible,
    campaignId: profile.campaignId,
    actorPersonId: identity.personId
  });

  return {
    ok: true,
    internalOnly: true,
    actorUid: uid,
    campaignId: profile.campaignId,
    actorPersonId: identity.personId,
    activityCode: discovery.activityCode,
    selected: selection.selected
  };
}

module.exports = {
  authorizeSmartAssignmentWithinTransaction
};