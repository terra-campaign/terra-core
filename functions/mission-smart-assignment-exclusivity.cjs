"use strict";

/**
 * BUILD B8.4-T20
 *
 * Clave canonica de exclusividad de asignaciones.
 *
 * NO crea reservas.
 * NO consulta ni escribe Firestore.
 * NO garantiza concurrencia por si sola.
 *
 * Ambas rutas de escritura deberan adoptar el mismo
 * protocolo antes de activar la exclusividad.
 */

const crypto = require("node:crypto");

const COLLECTION = "missionAssignmentClaims";
const SCHEMA_VERSION = 1;

function validId(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 256 &&
    value.trim() === value &&
    !value.includes("/")
  );
}

function canonicalAssignmentClaim({
  campaignId,
  groupId,
  parentMissionId = null,
  personId
} = {}) {

  if (
    !validId(campaignId) ||
    !validId(groupId) ||
    !validId(personId) ||
    (
      parentMissionId !== null &&
      !validId(parentMissionId)
    )
  ) {
    throw new Error("invalid-canonical-assignment-identity");
  }

  const identity = [
    "terra-mission-assignment-claim",
    SCHEMA_VERSION,
    campaignId,
    groupId,
    parentMissionId,
    personId
  ];

  const claimId = crypto
    .createHash("sha256")
    .update(JSON.stringify(identity))
    .digest("hex");

  return {
    schemaVersion: SCHEMA_VERSION,
    collection: COLLECTION,
    claimId,
    identity: {
      campaignId,
      groupId,
      parentMissionId,
      personId
    }
  };
}

/**
 * Convierte un plan interno en claves de exclusividad.
 *
 * Es una proyeccion, NO una autorizacion de escritura.
 * El escritor futuro debera reconstruir el plan dentro
 * de una transaccion autenticada.
 */
function projectAssignmentClaims(plan) {

  if (
    !plan ||
    plan.ok !== true ||
    plan.internalOnly !== true ||
    plan.schemaVersion !== 1 ||
    !validId(plan.campaignId) ||
    !validId(plan.groupId) ||
    !Array.isArray(plan.missions) ||
    plan.missions.length < 1 ||
    plan.missions.length > 50
  ) {
    throw new Error("invalid-canonical-assignment-plan");
  }

  const claims = [];
  const seen = new Set();

  for (const mission of plan.missions) {
    const claim = canonicalAssignmentClaim({
      campaignId: plan.campaignId,
      groupId: plan.groupId,
      parentMissionId: plan.parentMissionId ?? null,
      personId: mission?.personId
    });

    if (seen.has(claim.claimId)) {
      throw new Error("duplicate-canonical-assignment");
    }

    seen.add(claim.claimId);
    claims.push(claim);
  }

  return {
    ok: true,
    internalOnly: true,
    claims
  };
}

module.exports = {
  canonicalAssignmentClaim,
  projectAssignmentClaims,
  COLLECTION,
  SCHEMA_VERSION
};