"use strict";

const {
  resolveCanonicalPersonForAccount
} = require("./person-identity.cjs");

const {
  discoverSmartAssignmentFromFirestore
} = require("./mission-smart-assignment-integrator.cjs");

const {
  toPublicSmartAssignment
} = require("./mission-smart-assignment-public.cjs");

/**
 * B8.3-T3C
 * Adaptador interno, no callable.
 * La identidad del jefe se deriva exclusivamente
 * de la sesion autenticada.
 */
async function discoverSmartAssignmentCore({
  db,
  request,
  activityCode,
  maxCandidates
} = {}, publicOutput = false) {

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
    typeof db.runTransaction !== "function" ||
    typeof db.collection !== "function"
  ) {
    throw new TypeError("invalid-smart-assignment-db");
  }

  return db.runTransaction(async tx => {

    if (!tx || typeof tx.get !== "function") {
      throw new TypeError("invalid-smart-assignment-tx");
    }

    const profileRef = db
      .collection("usuarios")
      .doc(uid);

    const profileSnapshot = await tx.get(profileRef);

    if (!profileSnapshot.exists) {
      throw new Error("smart-assignment-profile-not-found");
    }

    const profile = profileSnapshot.data();

    if (
      !profile ||
      profile.active !== true ||
      profile.role !== "jefe_estructura" ||
      typeof profile.campaignId !== "string" ||
      !profile.campaignId ||
      profile.campaignId.trim() !== profile.campaignId ||
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
      !identity.personId
    ) {
      throw new Error("smart-assignment-invalid-identity");
    }

    const result = await discoverSmartAssignmentFromFirestore({
      db,
      campaignId: profile.campaignId,
      actorPersonId: identity.personId,
      activityCode,
      maxCandidates,
      tx
    });

    if (!publicOutput) {
      return result;
    }

    return toPublicSmartAssignment({
      result,
      campaignId: profile.campaignId,
      actorPersonId: identity.personId
    });

  }, {readOnly: true});
}

async function discoverSmartAssignmentAuthenticated(options) {
  return discoverSmartAssignmentCore(options, false);
}

async function discoverSmartAssignmentPublicAuthenticated(options) {
  return discoverSmartAssignmentCore(options, true);
}

module.exports = {
  discoverSmartAssignmentAuthenticated,
  discoverSmartAssignmentPublicAuthenticated
};
