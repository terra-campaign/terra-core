"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {createHash} = require("node:crypto");
const {
  prepareB7SharedClaimsWithinTransaction: prepare
} = require("./mission-smart-assignment-b7-shared-claims.cjs");
const {
  planB7CanonicalCompatibility
} = require("./mission-smart-assignment-b7-compatibility.cjs");

const hash = (...parts) => createHash("sha256")
  .update(JSON.stringify(parts)).digest("hex");
const context = () => ({campaignId:"CAMP-T64",groupId:"GROUP-T64",
  parentMissionId:"PARENT-T64",actorUid:"ACTOR-T64",
  actorPersonId:"PERSON-ACTOR-T64",requestId:"REQUEST-T64",
  fingerprint:hash("B7-T64-PAYLOAD")});
function fixture({people, present, badSnapshot} = {}) {
  const p = context();
  const selected = people || [
    {personId:"PERSON-1",accountUid:"UID-1"},
    {personId:"PERSON-2",accountUid:null}
  ];
  const contract = planB7CanonicalCompatibility({
    ...p,assignees:selected
  });
  const records = contract.recipients.map(row => ({
    missionRef:{id:row.legacyMissionId},linkRef:{id:row.legacyMissionId},
    data:{id:row.legacyMissionId,campaignId:p.campaignId,
      personId:row.personId,accountUid:row.accountUid,
      createdBy:p.actorUid},
    link:{campaignId:p.campaignId,groupId:p.groupId,
      parentMissionId:p.parentMissionId,personId:row.personId,
      accountUid:row.accountUid,createdBy:p.actorUid}
  }));
  const observed = [];
  const db = {collection(collection) {return {doc(id) {
    return {id,path:`${collection}/${id}`};
  }};}};
  const tx = {async get(ref) {
    observed.push(ref.path);
    if (badSnapshot) return {id:ref.id,exists:"wrong"};
    const exists = (present || []).includes(ref.path);
    return {id:ref.id,exists,data() {return {campaignId:p.campaignId};}};
  },create() {throw Error("unexpected-write");}};
  return {...p,db,tx,records,contract,observed};
}
function expected(f, row, collection, idField) {
  return `${collection}/${f.contract.recipients[row][idField]}`;
}

test("T64 produce reservas de B7 con IDs canonicos por persona", async () => {
  const f = fixture();
  const r = await prepare(f);
  assert.equal(r.claimWrites.length,2);
  assert.deepEqual(r.claimWrites.map(c=>c.id),
    f.contract.recipients.map(x=>x.canonicalClaimId));
  assert.equal(r.claimWrites[0].data.personId,"PERSON-1");
  assert.equal(r.claimWrites[1].data.personId,"PERSON-2");
  assert.equal(r.claimWrites[0].data.receiptId,f.contract.legacyReceiptId);
});
test("T64 inspecciona las dos familias de ID y de comprobantes", async () => {
  const f=fixture();await prepare(f);
  assert.ok(f.observed.includes(expected(f,0,"misiones","legacyMissionId")));
  assert.ok(f.observed.includes(expected(f,0,"misiones","canonicalMissionId")));
  assert.ok(f.observed.includes(`missionDispatches/${f.contract.legacyReceiptId}`));
  assert.ok(f.observed.includes(`missionDispatches/${f.contract.canonicalReceiptId}`));
});
test("T64 bloquea claim existente",async()=>{
  const f=fixture();f.tx = fixture({present:[expected(f,0,"missionAssignmentClaims","canonicalClaimId")]}).tx;
  await assert.rejects(prepare(f),/b7-b84-assignment-conflict/);
});
test("T64 bloquea mision B8.4 preexistente",async()=>{
  const first=fixture();const f=fixture({present:[expected(first,0,"misiones","canonicalMissionId")]});
  await assert.rejects(prepare(f),/b7-b84-assignment-conflict/);
});
test("T64 bloquea mision B7 preexistente",async()=>{
  const first=fixture();const f=fixture({present:[expected(first,0,"missionLinks","legacyMissionId")]});
  await assert.rejects(prepare(f),/b7-b84-assignment-conflict/);
});
test("T64 bloquea comprobante B8.4 preexistente",async()=>{
  const first=fixture();const f=fixture({present:[`missionDispatches/${first.contract.canonicalReceiptId}`]});
  await assert.rejects(prepare(f),/b7-b84-assignment-conflict/);
});
test("T64 detecta persona duplicada",async()=>{
  const f=fixture(); f.records.push({...f.records[0]});
  await assert.rejects(prepare(f),/duplicate-compatibility-person/);
});
test("T64 bloquea ID legado manipulado",async()=>{
  const f=fixture();f.records[0].data.id="FALSO";
  await assert.rejects(prepare(f),/invalid-b7-shared-claim-record|b7-legacy-mission-id-mismatch/);
});
test("T64 bloquea datos de otra campana",async()=>{
  const f=fixture();f.records[0].link.campaignId="OTRA";
  await assert.rejects(prepare(f),/invalid-b7-shared-claim-record/);
});
test("T64 falla cerrado ante snapshot invalido",async()=>{
  const f=fixture({badSnapshot:true});
  await assert.rejects(prepare(f),/invalid-b7-footprint-snapshot/);
});
test("T64 con lista vacia detecta receipt B8.4",async()=>{
  const f=fixture();const present=`missionDispatches/${f.contract.canonicalReceiptId}`;
  const g=fixture({present:[present]});g.records=[];
  await assert.rejects(prepare(g),/b7-b84-assignment-conflict/);
});
test("T64 con lista vacia no crea claims",async()=>{
  const f=fixture();f.records=[];
  const r=await prepare(f);
  assert.deepEqual(r.claimWrites,[]);
  assert.equal(r.writeAuthorized,false);
});
test("T64 nunca ejecuta escrituras ni habilita produccion",async()=>{
  const f=fixture(); const r=await prepare(f);
  assert.equal(r.writeAuthorized,false);
  assert.equal(r.productionReady,false);
  assert.equal(r.clientWritePathsClosed,false);
});
// Firestore Emulator integration tests: only the fictional demo project.
const {initializeApp, deleteApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");
const DEMO = "demo-terra-b84";
if (process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8080" ||
    process.env.GCLOUD_PROJECT !== DEMO ||
    process.env.GOOGLE_CLOUD_PROJECT !== DEMO) {
  throw new Error("t64-demo-firestore-emulator-required");
}
const t64App = initializeApp({projectId:DEMO}, `t64-integration-${process.pid}`);
const t64Db = getFirestore(t64App);
test.after(async () => {await t64Db.terminate(); await deleteApp(t64App);});
function realFixture(tag, req = "REQ") {
  const x = {
    campaignId:`CAMP-T64-${tag}-${process.pid}`,
    groupId:`GROUP-T64-${tag}-${process.pid}`,
    parentMissionId:`PARENT-T64-${tag}-${process.pid}`,
    actorUid:`UID-T64-ACTOR-${tag}`,
    actorPersonId:`PERSON-T64-ACTOR-${tag}`,
    requestId:`${req}-${tag}-${process.pid}`,
    fingerprint:hash("T64",tag,req)
  };
  const contract = planB7CanonicalCompatibility({
    ...x,assignees:[{personId:`PERSON-T64-CHILD-${tag}-${process.pid}`,accountUid:`UID-T64-CHILD-${tag}-${process.pid}`}]
  });
  const row = contract.recipients[0];
  const record = {
    missionRef:t64Db.collection("misiones").doc(row.legacyMissionId),
    linkRef:t64Db.collection("missionLinks").doc(row.legacyMissionId),
    data:{id:row.legacyMissionId,campaignId:x.campaignId,personId:row.personId,
      accountUid:row.accountUid,createdBy:x.actorUid,active:true},
    link:{campaignId:x.campaignId,groupId:x.groupId,parentMissionId:x.parentMissionId,
      personId:row.personId,accountUid:row.accountUid,createdBy:x.actorUid}
  };
  return {...x,contract,records:[record]};
}
async function realDispatch(f, failAfterReserve=false) {
  return t64Db.runTransaction(async tx => {
    const plan = await prepare({...f,db:t64Db,tx});
    for (const c of plan.claimWrites) {
      tx.create(t64Db.collection("missionAssignmentClaims").doc(c.id),c.data);
    }
    for (const r of f.records) {
      tx.create(r.missionRef,r.data);
      tx.create(r.linkRef,r.link);
    }
    tx.create(t64Db.collection("missionDispatches").doc(f.contract.legacyReceiptId),{
      campaignId:f.campaignId,requestId:f.requestId
    });
    if (failAfterReserve) throw new Error("t64-simulated-rollback");
    return plan;
  });
}

test("T64 emulador: reservas y documentos juntos en transaccion",async()=>{
  const f=realFixture("ATOMIC");
  const plan=await realDispatch(f);
  assert.equal(plan.claimWrites.length,1);
  const [claim,mission,link,receipt]=await Promise.all([
    t64Db.collection("missionAssignmentClaims").doc(f.contract.recipients[0].canonicalClaimId).get(),
    f.records[0].missionRef.get(), f.records[0].linkRef.get(),
    t64Db.collection("missionDispatches").doc(f.contract.legacyReceiptId).get()
  ]);
  assert.ok(claim.exists && mission.exists && link.exists && receipt.exists);
  assert.equal(claim.data().personId,f.records[0].data.personId);
});

test("T64 emulador: reserva canonica existente bloquea B7",async()=>{
  const f=realFixture("BLOCKCLAIM");
  const ref=t64Db.collection("missionAssignmentClaims").doc(f.contract.recipients[0].canonicalClaimId);
  await ref.create({campaignId:f.campaignId,personId:f.records[0].data.personId,marker:"existing"});
  await assert.rejects(realDispatch(f),/b7-b84-assignment-conflict/);
  assert.equal((await ref.get()).data().marker,"existing");
  assert.equal((await f.records[0].missionRef.get()).exists,false);
});

test("T64 emulador: mision canonica B8.4 existente bloquea B7",async()=>{
  const f=realFixture("BLOCKMISSION");
  const ref=t64Db.collection("misiones").doc(f.contract.recipients[0].canonicalMissionId);
  await ref.create({campaignId:f.campaignId,marker:"b84"});
  await assert.rejects(realDispatch(f),/b7-b84-assignment-conflict/);
  assert.equal((await ref.get()).data().marker,"b84");
  assert.equal((await t64Db.collection("missionAssignmentClaims")
    .doc(f.contract.recipients[0].canonicalClaimId).get()).exists,false);
});

test("T64 emulador: fallo posterior revierte claim y mision",async()=>{
  const f=realFixture("ROLLBACK");
  await assert.rejects(realDispatch(f,true),/t64-simulated-rollback/);
  assert.equal((await f.records[0].missionRef.get()).exists,false);
  assert.equal((await t64Db.collection("missionAssignmentClaims")
    .doc(f.contract.recipients[0].canonicalClaimId).get()).exists,false);
});

test("T64 emulador: concurrencia solo permite una reserva",async()=>{
  const f=realFixture("RACE","REQUEST-ONE");
  const g=realFixture("RACE","REQUEST-TWO");
  assert.equal(f.contract.recipients[0].canonicalClaimId,g.contract.recipients[0].canonicalClaimId);
  const outcomes=await Promise.allSettled([realDispatch(f),realDispatch(g)]);
  assert.equal(outcomes.filter(r=>r.status==="fulfilled").length,1);
  assert.equal(outcomes.filter(r=>r.status==="rejected").length,1);
  const ref=t64Db.collection("missionAssignmentClaims").doc(f.contract.recipients[0].canonicalClaimId);
  assert.equal((await ref.get()).exists,true);
});