"use strict";

const {
  resolveCanonicalPersonForAccount
} = require("./person-identity.cjs");

const MAX_GROUP = 50;

function deny(reason = "mission-index-permission-denied") {
  throw new Error(reason);
}

function validId(value) {
  return typeof value === "string" &&
    value.length > 0 &&
    value.length <= 160 &&
    value.trim() === value &&
    value !== "." &&
    value !== ".." &&
    !value.includes("/") &&
    !value.includes("\\") &&
    !/^__.*__$/.test(value);
}

async function getMissionConfirmationIndexCore({
  db,
  request,
  missionId,
  resolveIdentity = resolveCanonicalPersonForAccount
} = {}) {

  const uid = request?.auth?.uid;

  if (!validId(uid)) {
    deny("mission-index-unauthenticated");
  }

  if (!validId(missionId)) {
    deny("mission-index-invalid-id");
  }

  if (!db ||
      typeof db.collection !== "function" ||
      typeof db.runTransaction !== "function" ||
      typeof resolveIdentity !== "function") {
    deny("mission-index-invalid-dependencies");
  }

  const scope = await db.runTransaction(async tx => {

    const profileSnap = await tx.get(
      db.collection("usuarios").doc(uid)
    );

    if (!profileSnap.exists) deny();

    const profile = profileSnap.data();

    if (!profile ||
        profile.active !== true ||
        profile.role !== "jefe_estructura" ||
        !validId(profile.campaignId)) {
      deny();
    }

    const missionSnap = await tx.get(
      db.collection("misiones").doc(missionId)
    );

    if (!missionSnap.exists) deny();

    const mission = missionSnap.data();

    if (!mission ||
        mission.campaignId !== profile.campaignId ||
        mission.createdBy !== uid ||
        !validId(mission.groupId) ||
        !validId(mission.personId)) {
      deny();
    }

    const identity = await resolveIdentity({
      db,
      tx,
      accountUid: uid,
      profile,
      campaignId: profile.campaignId
    });

    if (!identity || !validId(identity.personId)) {
      deny();
    }

    return {
      campaignId: profile.campaignId,
      groupId: mission.groupId,
      title: typeof mission.title === "string"
        ? mission.title.slice(0,150)
        : "Mision sin titulo"
    };
  });

  const snapshot = await db.collection("misiones")
    .where("groupId","==",scope.groupId)
    .limit(MAX_GROUP + 1)
    .get();

  if (!Array.isArray(snapshot.docs) ||
      snapshot.docs.length < 1 ||
      snapshot.docs.length > MAX_GROUP) {
    deny("mission-index-invalid-group");
  }

  const missions = snapshot.docs.map(item => ({
    id: item.id,
    ...item.data()
  }));

  const unique = new Set();

  // El grupo no confiere acceso por si mismo.
  // Validar cada mision antes de leer cualquier respuesta.
  for (const mission of missions) {
    if (!validId(mission.id) ||
        !validId(mission.personId) ||
        mission.groupId !== scope.groupId ||
        mission.campaignId !== scope.campaignId ||
        mission.createdBy !== uid ||
        unique.has(mission.id)) {
      deny("mission-index-invalid-group");
    }

    unique.add(mission.id);
  }

  if (!unique.has(missionId)) {
    deny("mission-index-invalid-group");
  }

  const participants = await Promise.all(
    missions.map(async mission => {
      const responseSnap = await db
        .collection("misiones")
        .doc(mission.id)
        .collection("responses")
        .doc(mission.personId)
        .get();

      const response = responseSnap.exists
        ? responseSnap.data()
        : null;

      if (response && (
          response.missionId !== mission.id ||
          response.campaignId !== scope.campaignId ||
          response.personId !== mission.personId ||
          !["ACCEPTED","DECLINED"].includes(response.status)
      )) {
        deny("mission-index-invalid-response");
      }

      return {
        missionId: mission.id,
        name: typeof mission.assignedToName === "string"
          && mission.assignedToName.trim()
          ? mission.assignedToName.trim().slice(0,160)
          : "Nombre no registrado",
        status: response?.status ?? "NO_RESPONSE"
      };
    })
  );

  participants.sort((a,b) =>
    a.name.localeCompare(b.name,"es") ||
    a.missionId.localeCompare(b.missionId)
  );

  const totals = {
    accepted: participants.filter(
      item => item.status === "ACCEPTED"
    ).length,
    declined: participants.filter(
      item => item.status === "DECLINED"
    ).length,
    noResponse: participants.filter(
      item => item.status === "NO_RESPONSE"
    ).length
  };

  return {
    missionId,
    title: scope.title,
    total: participants.length,
    totals,
    participants
  };
}

module.exports = {
  getMissionConfirmationIndexCore
};