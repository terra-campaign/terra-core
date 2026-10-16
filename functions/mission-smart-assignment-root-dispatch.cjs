"use strict";

/**
 * TERRA Campaign V1 — B8 root transaction writer, NOT published.
 * Strictly internal: the server resolves actor, selected people and lineage.
 * B7's existing claim/receipt namespace and legacy mission ID are preserved.
 * This module is NOT a callable and MUST NOT be exported from index.js until
 * Firestore-emulator security, concurrency and end-to-end tests are complete.
 */
const {createHash} = require("node:crypto");
const SHA = /^[0-9a-f]{64}$/;
const MAX = 50;
const B8_RECEIPT_SOURCE = "b8-root-v1";
function sha(...parts) {return createHash("sha256").update(JSON.stringify(parts)).digest("hex");}
function validId(v) {return typeof v === "string" && !!v && v.length <= 128 && v.trim() === v && !v.includes("/");}
function err(code) {throw new Error(code);}
function smallText(v, max, required = false) {
  if (v == null) {
    if (required) err("invalid-b8-required-text");
    return "";
  }
  if (typeof v !== "string" || v.length > max || (required && !v.trim())) err("invalid-b8-text");
  return v.trim();
}
function validateInput(data, classify, clock) {
  if (!data || typeof data !== "object" || Array.isArray(data)) err("invalid-b8-data");
  const allowed = new Set(["requestId", "assigneeRefs", "activityCode", "title", "description",
    "locality", "missionDate", "startAt", "startTimeZone", "deadlineAt"]);
  if (Object.keys(data).some(k => !allowed.has(k))) err("invalid-b8-data-key");
  if (!validId(data.requestId)) err("invalid-b8-request-id");
  if (!Array.isArray(data.assigneeRefs) || data.assigneeRefs.length < 1 ||
      data.assigneeRefs.length > MAX || data.assigneeRefs.some(x => typeof x !== "string" || !SHA.test(x)) ||
      new Set(data.assigneeRefs).size !== data.assigneeRefs.length) err("invalid-b8-assignees");
  const classification = classify(data.activityCode);
  if (!classification || typeof classification.activityCode !== "string" ||
      !classification.activityCode || typeof classification.activityCatalogVersion !== "string" ||
      !classification.activityCatalogVersion) err("invalid-b8-activity");
  const missionDate = smallText(data.missionDate, 10) || null;
  if (missionDate && (!/^\d{4}-\d{2}-\d{2}$/.test(missionDate) ||
      !Number.isFinite(Date.parse(missionDate)) ||
      new Date(missionDate).toISOString().slice(0,10) !== missionDate)) err("invalid-b8-mission-date");
  let startAt = null;
  if (data.startAt !== undefined &&
      data.startAt !== null &&
      data.startAt !== "") {
    if (typeof data.startAt !== "string" ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(data.startAt) ||
        !Number.isFinite(Date.parse(data.startAt))) {
      err("invalid-b8-start");
    }
    const normalizedStart = new Date(data.startAt).toISOString();
    if (![normalizedStart, normalizedStart.replace(".000Z", "Z")]
        .includes(data.startAt) ||
        Date.parse(data.startAt) <= clock()) {
      err("invalid-b8-start");
    }
    startAt = normalizedStart;
  }
  let startTimeZone = null;
  if (data.startTimeZone !== undefined &&
      data.startTimeZone !== null &&
      data.startTimeZone !== "") {
    const validZones = new Set([
      "America/Mazatlan",
      "America/Bahia_Banderas",
      "America/Mexico_City",
      "America/Hermosillo",
      "America/Tijuana",
      "America/Cancun"
    ]);
    if (!startAt || !validZones.has(data.startTimeZone)) {
      err("invalid-b8-start-timezone");
    }
    startTimeZone = data.startTimeZone;
  }
  let deadlineAt = null;
  if (data.deadlineAt !== undefined && data.deadlineAt !== null && data.deadlineAt !== "") {
    if (typeof data.deadlineAt !== "string" ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(data.deadlineAt) ||
        !Number.isFinite(Date.parse(data.deadlineAt)) || Date.parse(data.deadlineAt) <= clock()) {
      err("invalid-b8-deadline");
    }
    deadlineAt = new Date(data.deadlineAt).toISOString();
  }
  const fields = {
    title: smallText(data.title, 150, true), description: smallText(data.description, 1500),
    locality: smallText(data.locality, 120), missionDate, ...(startAt ? { startAt } : {}), ...(startTimeZone ? { startTimeZone } : {}), deadlineAt,
    activityCode: classification.activityCode,
    activityCatalogVersion: classification.activityCatalogVersion
  };
  const refs = [...data.assigneeRefs].sort();
  const fingerprint = sha("b8-root-v1", refs, fields);
  return {requestId:data.requestId, refs, fields, fingerprint};
}

function createB8RootDispatchForTests({prepareRecipients, prepareClaims, classify, timestamp, clock} = {}) {
  if ([prepareRecipients,prepareClaims,classify,timestamp,clock].some(f=>typeof f !== "function"))
    throw new TypeError("invalid-b8-root-dispatch-dependencies");

  return async function dispatch({db,tx,request} = {}) {
    if (!db || typeof db.collection !== "function" ||
        !tx || typeof tx.get !== "function" || typeof tx.create !== "function" ||
        !validId(request?.auth?.uid)) err("invalid-b8-root-dispatch-context");
    const {requestId,refs,fields,fingerprint} = validateInput(request.data, classify, clock);
    const actorUid = request.auth.uid;

    // The bridge recomputes actor identity and hierarchy INSIDE THIS tx.
    const binding = await prepareRecipients({db,tx,request,
      activityCode:fields.activityCode,assigneeRefs:refs});
    if (binding?.ok !== true || binding.internalOnly !== true ||
        binding.status !== "root-recipient-binding-verified" ||
        binding.writeAuthorized !== false || binding.productionReady !== false ||
        binding.actorUid !== actorUid || binding.activityCode !== fields.activityCode ||
        !validId(binding.campaignId) || !validId(binding.actorPersonId) ||
        !(binding.recipients instanceof Map) || binding.recipients.size !== refs.length ||
        refs.some(x=>!binding.recipients.has(x))) err("invalid-b8-root-dispatch-binding");

    const actorDoc = await tx.get(db.collection("usuarios").doc(actorUid));
    const actor = actorDoc?.data?.();
    if (!actorDoc?.exists || actor?.active !== true || actor?.role !== "jefe_estructura" ||
        actor.campaignId !== binding.campaignId ||
        !Array.isArray(actor.ancestorIds ?? []) ||
        !(actor.ancestorIds ?? []).every(validId)) err("invalid-b8-root-dispatch-actor");
    const actorName = smallText(actor.name,150) || "Sin nombre";

    // Shared B7 idempotency namespace prevents requestId replay across writers.
    const receiptRef = db.collection("missionDispatches").doc(sha(actorUid,requestId));
    const existingReceipt = await tx.get(receiptRef);
    if (existingReceipt?.exists) {
      const old = existingReceipt.data?.();
      if (old?.source !== B8_RECEIPT_SOURCE ||
          old.campaignId !== binding.campaignId || old.fingerprint !== fingerprint ||
          !Number.isSafeInteger(old.result?.created) ||
          !Number.isSafeInteger(old.result?.alreadyAssigned) ||
          old.result.created < 1 || old.result.alreadyAssigned !== 0) err("b8-root-dispatch-replay-conflict");
      return {...old.result};
    }

    const groupId = sha(actorUid,requestId,"group");
    const records = [];
    const ids = new Set();
    for (const ref of refs) {
      const item = binding.recipients.get(ref);
      const person = item?.recipient;
      if (!person || !validId(item.personId) || person.personId !== item.personId ||
          typeof person.name !== "string" || !person.name.trim() ||
          !validId(person.role) ||
          !(item.accountUid === null || validId(item.accountUid)) ||
          (item.accountUid ?? null) !== (person.accountUid ?? null) ||
          !Array.isArray(item.intermediateSupervisorUids) ||
          !item.intermediateSupervisorUids.every(validId) ||
          !Array.isArray(item.intermediateSupervisorPersonIds) ||
          !item.intermediateSupervisorPersonIds.every(validId) ||
          item.intermediateSupervisorPersonIds.length < item.intermediateSupervisorUids.length)
        err("invalid-b8-root-dispatch-recipient");
      const recipientKey = item.accountUid || item.personId;
      const missionId = sha(groupId,null,recipientKey); // SAME B7 mission ID
      if (ids.has(missionId)) err("duplicate-b8-root-dispatch-mission");
      ids.add(missionId);
      const assignedTo = item.accountUid || null; // SAME B7 accountless representation
      const supervisorIds = [...new Set([actorUid,
        ...item.intermediateSupervisorUids,...(actor.ancestorIds ?? [])])];
      const missionRef = db.collection("misiones").doc(missionId);
      const linkRef = db.collection("missionLinks").doc(missionId);
      const content = {...fields};
      const data = {
        id:missionId,campaignId:binding.campaignId,...content,
        ...(fields.startAt ? {startAtMillis:Date.parse(fields.startAt)} : {}),
        deadlineAtMillis:fields.deadlineAt ? Date.parse(fields.deadlineAt):null,
        active:true,createdBy:actorUid,createdByName:actorName,
        createdByRole:"jefe_estructura",assignedTo,
        accountUid:item.accountUid,personId:item.personId,
        assignedToName:person.name,assignedToRole:person.role,supervisorIds,
        municipalityId:person.municipalityId || "",municipalityName:person.municipalityName || "",
        structureId:person.structureId || "",structureName:person.structureName || "",
        groupId,parentMissionId:null,linkedVersion:1,version:4,
        createdAt:timestamp(),updatedAt:timestamp()
      };
      const link = {
        campaignId:binding.campaignId,groupId,parentMissionId:null,
        ancestorMissionIds:[],assignedTo,accountUid:item.accountUid,
        personId:item.personId,assignedToRole:person.role,
        createdBy:actorUid,content,
        intermediateSupervisorPersonIds:[...item.intermediateSupervisorPersonIds],
        intermediateSupervisorUids:[...item.intermediateSupervisorUids]
      };
      records.push({missionRef,linkRef,data,link});
    }

    const shared = await prepareClaims({db,tx,campaignId:binding.campaignId,
      groupId,parentMissionId:null,actorUid,actorPersonId:binding.actorPersonId,
      requestId,fingerprint,records});
    if (shared?.ok !== true || shared.writeAuthorized !== false ||
        shared.productionReady !== false || !Array.isArray(shared.claimWrites) ||
        shared.claimWrites.length !== records.length ||
        new Set(shared.claimWrites.map(x=>x.id)).size !== records.length ||
        shared.claimWrites.some(x=>!SHA.test(x?.id||"") || x?.data?.campaignId !== binding.campaignId))
      err("invalid-b8-root-dispatch-shared-claims");

    // NO WRITE before all preceding server-side reads and collision guards.
    for (const record of records) {
      tx.create(record.missionRef,record.data);
      tx.create(record.linkRef,record.link);
    }
    for (const claim of shared.claimWrites) {
      tx.create(db.collection("missionAssignmentClaims").doc(claim.id),claim.data);
    }
    const result = {created:records.length,alreadyAssigned:0};
    tx.create(receiptRef,{source:B8_RECEIPT_SOURCE,campaignId:binding.campaignId,fingerprint,result,createdAt:timestamp()});
    return result;
  };
}

function dispatchB8RootWithinTransaction(options) {
  const {prepareB8RootRecipientsWithinTransaction} = require("./mission-smart-assignment-b7-root-bridge.cjs");
  const {prepareB7SharedClaimsWithinTransaction} = require("./mission-smart-assignment-b7-shared-claims.cjs");
  const {classifyMissionActivity} = require("./activity-classification.cjs");
  const {FieldValue} = require("firebase-admin/firestore");
  return createB8RootDispatchForTests({
    prepareRecipients:prepareB8RootRecipientsWithinTransaction,
    prepareClaims:prepareB7SharedClaimsWithinTransaction,
    classify:classifyMissionActivity,
    timestamp:()=>FieldValue.serverTimestamp(),
    clock:()=>Date.now()
  })(options);
}
module.exports = {createB8RootDispatchForTests,dispatchB8RootWithinTransaction};
