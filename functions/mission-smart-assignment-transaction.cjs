"use strict";

const {
  discoverSmartAssignmentFromFirestore
} = require("./mission-smart-assignment-integrator.cjs");

/**
 * B8.3 - Ejecutor interno de lectura consistente.
 *
 * No autentica usuarios.
 * No expone resultados al navegador.
 * No crea ni modifica asignaciones.
 * No realiza escrituras en Firestore.
 */
async function discoverSmartAssignmentConsistently({
  db,
  campaignId,
  actorPersonId,
  activityCode,
  maxCandidates
} = {}) {

  if (
    !db ||
    typeof db.runTransaction !== "function" ||
    typeof db.collection !== "function"
  ) {
    throw new TypeError(
      "invalid-smart-assignment-transaction-db"
    );
  }

  return db.runTransaction(
    async tx => {
      if (!tx || typeof tx.get !== "function") {
        throw new TypeError(
          "invalid-smart-assignment-transaction"
        );
      }

      return discoverSmartAssignmentFromFirestore({
        db,
        campaignId,
        actorPersonId,
        activityCode,
        maxCandidates,
        tx
      });
    },
    {readOnly: true}
  );
}

module.exports = {
  discoverSmartAssignmentConsistently
};
