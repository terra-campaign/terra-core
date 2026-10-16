"use strict";

const {onCall,HttpsError} =
  require("firebase-functions/v2/https");

const {getApps,initializeApp} =
  require("firebase-admin/app");

const {getFirestore} =
  require("firebase-admin/firestore");

const {resolveCanonicalPersonForAccount} =
  require("./person-identity.cjs");

const {phoneFromProfile} =
  require("./mission-whatsapp-recipient-callable.cjs");

function validId(value) {
  return typeof value === "string" &&
    value.length >= 1 &&
    value.length <= 160 &&
    value.trim() === value &&
    value !== "." &&
    value !== ".." &&
    !value.includes("/") &&
    !value.includes("\\") &&
    !/^__.*__$/.test(value);
}

function fail(reason) {
  throw new Error(reason);
}

function label(value,max,fallback) {
  if (typeof value !== "string") return fallback;
  const clean = value.replace(/\s+/g," ").trim();
  return clean ? clean.slice(0,max) : fallback;
}

function defaultDb() {
  if (!getApps().length) initializeApp();
  return getFirestore();
}

async function resolveMissionOwnerWhatsAppCore({
  db,
  request,
  missionId,
  resolveIdentity = resolveCanonicalPersonForAccount
} = {}) {

  const uid = request?.auth?.uid;

  if (!validId(uid)) {
    fail("owner-whatsapp-unauthenticated");
  }

  if (!validId(missionId)) {
    fail("owner-whatsapp-invalid-id");
  }

  return db.runTransaction(async tx => {

    const memberSnap = await tx.get(
      db.collection("usuarios").doc(uid)
    );

    if (!memberSnap.exists) {
      fail("owner-whatsapp-denied");
    }

    const member = memberSnap.data();

    if (!member ||
        member.active !== true ||
        !validId(member.campaignId)) {
      fail("owner-whatsapp-denied");
    }

    const missionRef =
      db.collection("misiones").doc(missionId);

    const missionSnap = await tx.get(missionRef);

    if (!missionSnap.exists) {
      fail("owner-whatsapp-denied");
    }

    const mission = missionSnap.data();

    if (!mission ||
        mission.active !== true ||
        mission.campaignId !== member.campaignId ||
        mission.accountUid !== uid ||
        mission.assignedTo !== uid ||
        !validId(mission.personId) ||
        !validId(mission.createdBy)) {
      fail("owner-whatsapp-denied");
    }

    const memberIdentity = await resolveIdentity({
      db,
      tx,
      accountUid:uid,
      profile:member,
      campaignId:member.campaignId
    });

    if (!memberIdentity ||
        memberIdentity.personId !== mission.personId) {
      fail("owner-whatsapp-denied");
    }

    // La respuesta real debe estar registrada en Firestore.
    const responseSnap = await tx.get(
      missionRef
        .collection("responses")
        .doc(mission.personId)
    );

    if (!responseSnap.exists) {
      fail("owner-whatsapp-no-confirmation");
    }

    const response = responseSnap.data();

    if (!response ||
        response.missionId !== missionId ||
        response.campaignId !== member.campaignId ||
        response.personId !== mission.personId ||
        !["ACCEPTED","DECLINED"].includes(response.status)) {
      fail("owner-whatsapp-invalid-confirmation");
    }

    // El creador de la mision es el destinatario.
    const ownerUid = mission.createdBy;

    const ownerSnap = await tx.get(
      db.collection("usuarios").doc(ownerUid)
    );

    if (!ownerSnap.exists) {
      fail("owner-whatsapp-owner-invalid");
    }

    const owner = ownerSnap.data();

    if (!owner ||
        owner.active !== true ||
        owner.campaignId !== member.campaignId) {
      fail("owner-whatsapp-owner-invalid");
    }

    const ownerIdentity = await resolveIdentity({
      db,
      tx,
      accountUid:ownerUid,
      profile:owner,
      campaignId:member.campaignId
    });

    if (!ownerIdentity ||
        !validId(ownerIdentity.personId) ||
        owner.personId != null &&
          owner.personId !== ownerIdentity.personId) {
      fail("owner-whatsapp-owner-invalid");
    }

    const ownerPersonSnap = await tx.get(
      db.collection("persons").doc(ownerIdentity.personId)
    );

    if (!ownerPersonSnap.exists) {
      fail("owner-whatsapp-owner-invalid");
    }

    const ownerPerson = ownerPersonSnap.data();

    if (!ownerPerson ||
        ownerPerson.campaignId !== member.campaignId ||
        ownerPerson.personId != null &&
          ownerPerson.personId !== ownerIdentity.personId ||
        ownerPerson.accountUid != null &&
          ownerPerson.accountUid !== ownerUid) {
      fail("owner-whatsapp-owner-invalid");
    }

    // Reutilizar normalizacion existente en TERRA.
    const userPhone = phoneFromProfile(owner);
    const personPhone = phoneFromProfile(ownerPerson);

    if (userPhone.invalid ||
        personPhone.invalid ||
        userPhone.phone &&
          personPhone.phone &&
          userPhone.phone !== personPhone.phone) {
      fail("owner-whatsapp-phone-conflict");
    }

    const phone =
      personPhone.phone || userPhone.phone;

    if (!phone) {
      fail("owner-whatsapp-phone-missing");
    }

    return {
      missionId,
      phone,
      status:response.status,
      ownerName:label(
        ownerPerson.name || owner.name ||
          mission.createdByName,
        120,
        "Responsable de la misión"
      ),
      memberName:label(
        mission.assignedToName || member.name,
        120,
        "Integrante"
      ),
      missionTitle:label(
        mission.title,
        150,
        "Misión territorial"
      )
    };
  });
}

function translateError(error) {
  if (error instanceof HttpsError) return error;

  const reason = error?.code || error?.message || "";

  if (reason === "owner-whatsapp-unauthenticated") {
    return new HttpsError(
      "unauthenticated",
      "Inicia sesión en TERRA."
    );
  }

  if (reason === "owner-whatsapp-invalid-id") {
    return new HttpsError(
      "invalid-argument",
      "Identificador de misión inválido."
    );
  }

  if (reason === "owner-whatsapp-denied") {
    return new HttpsError(
      "permission-denied",
      "No tienes autorización para este contacto."
    );
  }

  if ([
    "owner-whatsapp-no-confirmation",
    "owner-whatsapp-invalid-confirmation"
  ].includes(reason)) {
    return new HttpsError(
      "failed-precondition",
      "Primero debes registrar una decisión válida en TERRA."
    );
  }

  if ([
    "owner-whatsapp-owner-invalid",
    "owner-whatsapp-phone-conflict",
    "owner-whatsapp-phone-missing"
  ].includes(reason)) {
    return new HttpsError(
      "failed-precondition",
      "El contacto del responsable requiere revisión. " +
      "No se seleccionará otro número automáticamente."
    );
  }

  return new HttpsError(
    "internal",
    "No fue posible verificar el contacto del responsable."
  );
}

function createMissionResponseOwnerWhatsAppCallable({
  onCallImpl = onCall,
  getDb = defaultDb,
  resolveIdentity = resolveCanonicalPersonForAccount,
  core = resolveMissionOwnerWhatsAppCore
} = {}) {

  return onCallImpl(
    {region:"us-central1",timeoutSeconds:30},
    async request => {
      try {
        if (!validId(request?.auth?.uid)) {
          fail("owner-whatsapp-unauthenticated");
        }

        const data = request.data;

        if (!data ||
            typeof data !== "object" ||
            Array.isArray(data) ||
            Object.keys(data).length !== 1 ||
            !Object.hasOwn(data,"missionId") ||
            !validId(data.missionId)) {
          fail("owner-whatsapp-invalid-id");
        }

        return await core({
          db:getDb(),
          request,
          missionId:data.missionId,
          resolveIdentity
        });

      } catch (error) {
        throw translateError(error);
      }
    }
  );
}

module.exports = {
  resolveMissionOwnerWhatsAppCore,
  createMissionResponseOwnerWhatsAppCallable
};