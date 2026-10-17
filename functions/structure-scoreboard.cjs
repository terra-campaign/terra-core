"use strict";
const {onCall,HttpsError}=require("firebase-functions/v2/https");
const {getFirestore}=require("firebase-admin/firestore");
const {canonicalMembershipDocumentId}=require("./territorial-membership-id.cjs");
const {buildPerformanceSummaryProjection}=require("./performance-summary.cjs");
const {validId,authorizeChief,projectRows}=require("./structure-scoreboard-core.cjs");

const MAX_MEMBERS=1000;
const MAX_LEDGER_PER_BATCH=5000;
const BATCH_SIZE=20;
const deny=()=>{throw new HttpsError("permission-denied","No puedes consultar este listado.");};
const invalid=()=>{throw new HttpsError("invalid-argument","Estructura inválida.");};
const tooMany=()=>{throw new HttpsError("resource-exhausted","La estructura requiere paginación; no se mostrarán resultados parciales.");};

async function batchesGet(db,ids,collection) {
  const found=new Map();
  for (let offset=0;offset<ids.length;offset+=100) {
    const refs=ids.slice(offset,offset+100).map(id=>db.collection(collection).doc(id));
    const snaps=await db.getAll(...refs);
    for(const snap of snaps) {
      if(snap.exists) found.set(snap.id,snap.data());
    }
  }
  return found;
}

async function getStructureScoreboardCore({db,actorUid,structureDocumentId,projector=buildPerformanceSummaryProjection}) {
  if(!validId(actorUid)) deny();
  if(!validId(structureDocumentId)) invalid();
  const profileSnapshot=await db.collection("usuarios").doc(actorUid).get();
  const profile=profileSnapshot.exists?profileSnapshot.data():null;
  if(!profile || profile.role!=="jefe_estructura" || profile.active!==true ||
     !validId(profile.campaignId) || !validId(profile.personId)) deny();
  const [structureSnap,actorMembershipSnap]=await Promise.all([
    db.collection("estructuras").doc(structureDocumentId).get(),
    db.collection("territorialMemberships").doc(canonicalMembershipDocumentId(profile.campaignId,profile.personId)).get()
  ]);
  const structure=structureSnap.exists?structureSnap.data():null;
  const actorMembership=actorMembershipSnap.exists?actorMembershipSnap.data():null;
  if(!authorizeChief({profile,actorMembership,structure,uid:actorUid})) deny();
  if(actorMembershipSnap.id!==canonicalMembershipDocumentId(profile.campaignId,profile.personId)) deny();

  // Una sola condición indexada; filtrado de campaña y membresía activa en servidor.
  const membershipQuery=await db.collection("territorialMemberships")
    .where("structureId","==",structure.id).limit(MAX_MEMBERS+1).get();
  if(membershipQuery.size>MAX_MEMBERS || membershipQuery.docs.length>MAX_MEMBERS) tooMany();
  const members=[];
  const seen=new Set();
  for (const snap of membershipQuery.docs) {
    const m=snap.data();
    if(m?.campaignId!==profile.campaignId || m?.structureId!==structure.id ||
       m?.active!==true || !validId(m.personId)) continue;
    if (m.municipalityId!==structure.municipalityId) continue;
    if(snap.id!==canonicalMembershipDocumentId(profile.campaignId,m.personId)) {
      throw new HttpsError("failed-precondition","Membresía no canónica.");
    }
    if(seen.has(m.personId)) throw new HttpsError("failed-precondition","Membresía duplicada.");
    seen.add(m.personId);members.push(m);
  }
  // Ni cuentas digitales ni perfiles 'usuarios' son necesarios para enumerar personas.
  const allMemberIds=members.map(m=>m.personId);
  const personsById=await batchesGet(db,allMemberIds,"persons");
  const referencedIds=[...new Set(members.flatMap(m=>{
    const person=personsById.get(m.personId);
    return [m.parentPersonId||person?.parentPersonId,
      m.introducedByPersonId||person?.introducedByPersonId];
  }).filter(validId))].filter(id=>!personsById.has(id));
  const references=await batchesGet(db,referencedIds,"persons");
  for(const [id,person] of references) personsById.set(id,person);
  const nameById=new Map();
  for(const [id,p] of personsById) {
    if(p.campaignId===profile.campaignId && typeof p.name==="string" && p.name.trim())
      nameById.set(id,p.name.trim());
  }
  const ledgerByPerson=new Map(allMemberIds.map(id=>[id,[]]));
  for(let offset=0;offset<allMemberIds.length;offset+=BATCH_SIZE) {
    const ids=allMemberIds.slice(offset,offset+BATCH_SIZE);
    const result=await db.collection("contributionLedger")
      .where("personId","in",ids).limit(MAX_LEDGER_PER_BATCH+1).get();
    if(result.docs.length>MAX_LEDGER_PER_BATCH || result.size>MAX_LEDGER_PER_BATCH) tooMany();
    for(const doc of result.docs) {
      const ledger=doc.data();
      if(ledger?.campaignId!==profile.campaignId || !ledgerByPerson.has(ledger.personId)) continue;
      const list=ledgerByPerson.get(ledger.personId);
      if(list.length>=MAX_LEDGER_PER_BATCH) tooMany();
      list.push(ledger);
    }
  }
  let rows;
  try {
    rows=projectRows({members,personsById,ledgerByPerson,nameById,
      campaignId:profile.campaignId,buildPerformanceSummaryProjection:projector});
  } catch(error) {
    // No entregar puntuaciones parciales o inventadas cuando hay inconsistencia.
    throw new HttpsError("failed-precondition","No fue posible completar el ranking canónico.");
  }
  return {ok:true,structureName:typeof structure.name==="string"?structure.name:"Mi estructura",
    total:rows.length,rows,calculatedAt:new Date().toISOString()};
}

exports.getStructureScoreboard=onCall({region:"us-central1",timeoutSeconds:120},async request=>{
  if(!request.auth?.uid) throw new HttpsError("unauthenticated","Inicia sesión.");
  try{return await getStructureScoreboardCore({db:getFirestore(),actorUid:request.auth.uid,
    structureDocumentId:request.data?.structureDocumentId});}
  catch(error){
    if(error instanceof HttpsError) throw error;
    console.error("getStructureScoreboard error",error?.message||"unknown");
    throw new HttpsError("internal","No fue posible cargar las puntuaciones.");
  }
});
exports._test={getStructureScoreboardCore,batchesGet};
