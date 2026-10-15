"use strict";

// TERRA Campaign V1 — Resolver SOLO el teléfono de la persona asignada a una
// misión creada por el actor autenticado, dentro de su campaña.
// No modifica misiones, personas, usuarios ni estados de entrega.

function validId(value) {
  return typeof value === "string" && value.length >= 1 && value.length <= 128 &&
    value.trim() === value && !value.includes("/") && value !== "." && value !== "..";
}

function normalizeWhatsAppNumber(value) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const trimmed = String(value).trim();
  if (!trimmed || !/^\+?[\d\s().-]+$/.test(trimmed)) return null;
  const number = trimmed.replace(/[\s().-]/g, "");
  if (/^\+?521\d{10}$/.test(number)) return "52" + number.replace(/^\+?521/, "");
  if (/^\+?52\d{10}$/.test(number)) return number.replace(/^\+/, "");
  if (/^\d{10}$/.test(number)) return "52" + number;
  if (/^\+[1-9]\d{7,14}$/.test(number)) return number.slice(1);
  return null;
}

const PHONE_FIELDS = Object.freeze([
  "phone", "phoneNumber", "telefono", "teléfono", "mobile", "cellphone",
  "celular", "whatsappPhone", "whatsAppPhone"
]);

function phoneFromProfile(profile) {
  if (!profile || typeof profile !== "object") return {phone: null, invalid: false};
  const found = new Set();
  let invalid = false;
  for (const field of PHONE_FIELDS) {
    const value = profile[field];
    if (value === null || value === undefined || value === "") continue;
    const normalized = normalizeWhatsAppNumber(value);
    if (!normalized) invalid = true;
    else found.add(normalized);
  }
  if (invalid || found.size > 1) return {phone: null, invalid: true};
  return {phone: found.size ? [...found][0] : null, invalid: false};
}

function createMissionWhatsAppRecipientCallable(dependencies = {}) {
  const https = dependencies.https || require("firebase-functions/v2/https");
  const getDb = dependencies.getDb || (() => require("firebase-admin/firestore").getFirestore());
  const {onCall, HttpsError} = https;

  return onCall({region: "us-central1", timeoutSeconds: 30}, async request => {
    const uid = request?.auth?.uid;
    if (!validId(uid)) throw new HttpsError("unauthenticated", "Inicia sesión.");
    const data = request?.data;
    if (!data || Array.isArray(data) || typeof data !== "object" ||
        Object.keys(data).length !== 1 || !validId(data.missionId)) {
      throw new HttpsError("invalid-argument", "Selecciona una misión válida.");
    }

    const db = getDb();
    const [actorSnapshot, missionSnapshot] = await Promise.all([
      db.collection("usuarios").doc(uid).get(),
      db.collection("misiones").doc(data.missionId).get()
    ]);
    const actor = actorSnapshot.exists ? actorSnapshot.data() : null;
    const mission = missionSnapshot.exists ? missionSnapshot.data() : null;

    if (!actor || actor.active !== true || !validId(actor.campaignId) ||
        !mission || mission.createdBy !== uid ||
        mission.campaignId !== actor.campaignId || mission.active !== true) {
      throw new HttpsError("permission-denied", "No tienes autorización para comunicar esta misión.");
    }

    const missionAccountUid = validId(mission.accountUid) ? mission.accountUid : null;
    const assignedUid = validId(mission.assignedTo) ? mission.assignedTo : null;
    if (mission.accountUid != null && !missionAccountUid ||
        mission.assignedTo != null && !assignedUid ||
        missionAccountUid && assignedUid && missionAccountUid !== assignedUid) {
      throw new HttpsError("failed-precondition", "La identidad de la persona asignada requiere revisión.");
    }
    const accountUid = missionAccountUid || assignedUid;
    const personId = validId(mission.personId) ? mission.personId : null;
    if (mission.personId != null && !personId || !personId && !accountUid) {
      throw new HttpsError("failed-precondition", "La misión no identifica de forma válida al destinatario.");
    }

    let person = null;
    if (personId) {
      const snapshot = await db.collection("persons").doc(personId).get();
      person = snapshot.exists ? snapshot.data() : null;
      if (!person || person.campaignId !== actor.campaignId ||
          person.personId != null && person.personId !== personId ||
          person.accountUid != null && person.accountUid !== accountUid) {
        throw new HttpsError("failed-precondition", "El perfil asignado requiere revisión.");
      }
    }

    let user = null;
    if (accountUid) {
      const snapshot = await db.collection("usuarios").doc(accountUid).get();
      user = snapshot.exists ? snapshot.data() : null;
      if (!user || user.campaignId !== actor.campaignId ||
          personId && user.personId != null && user.personId !== personId) {
        throw new HttpsError("failed-precondition", "La cuenta digital asignada requiere revisión.");
      }
    }

    const personPhone = phoneFromProfile(person);
    const userPhone = phoneFromProfile(user);
    if (personPhone.invalid || userPhone.invalid ||
        personPhone.phone && userPhone.phone && personPhone.phone !== userPhone.phone) {
      throw new HttpsError("failed-precondition", "Existen teléfonos inconsistentes en el perfil; verifica el registro.");
    }
    const phone = personPhone.phone || userPhone.phone;
    if (!phone) {
      throw new HttpsError("failed-precondition", "La persona asignada no tiene un teléfono de WhatsApp válido registrado. Comunica la misión personalmente.");
    }
    return {
      phone,
      hasDigitalAccount: !!accountUid,
      missionId: data.missionId
    };
  });
}

module.exports = {
  createMissionWhatsAppRecipientCallable,
  normalizeWhatsAppNumber,
  phoneFromProfile
};
