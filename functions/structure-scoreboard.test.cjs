"use strict";
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const {canonicalMembershipDocumentId}=require('./territorial-membership-id.cjs');
const core=require('./structure-scoreboard-core.cjs');

class FakeHttpsError extends Error {constructor(code,message){super(message);this.code=code;}}
const original=Module._load;
Module._load=function(request,parent,isMain){
 if(request==='firebase-functions/v2/https') return {onCall:(_opts,callback)=>callback,HttpsError:FakeHttpsError};
 if(request==='firebase-admin/firestore') return {getFirestore:()=>{throw new Error('Live firestore forbidden in tests');}};
 if(request==='./performance-summary.cjs' && parent?.filename?.endsWith('structure-scoreboard.cjs'))
   return {buildPerformanceSummaryProjection:()=>({contribution:{historical:{points:0,contributionCount:0,byDimension:{}}}})};
 return original.apply(this,arguments);
};
const { _test:{getStructureScoreboardCore} }=require('./structure-scoreboard.cjs');
Module._load=original;
const campaign='CAM-001'; const chiefId='P-CHIEF',structureId='EST-001',structureDocumentId='DOC-S1';
const memb=(id,role,parent,extra={})=>({campaignId:campaign,personId:id,structureId,municipalityId:'M-001',
  role,active:true,parentPersonId:parent||null,...extra});
const chief=memb(chiefId,'jefe_estructura',null,{accountUid:'UID-LALO'});
const members=[chief,memb('P-ZULEMA','integrante',chiefId,{introducedByPersonId:chiefId}),
  memb('P-BASE','apoyo_territorial','P-ZULEMA',{introducedByPersonId:'P-ZULEMA',accountUid:null})];
const persons=new Map([
  [chiefId,{personId:chiefId,name:'Lalo Gómez',campaignId:campaign,active:true,accountUid:'UID-LALO'}],
  ['P-ZULEMA',{personId:'P-ZULEMA',name:'Zulema Lizandi Regalado',locality:'Zacualpan',campaignId:campaign,active:true,phone:'327 102 9929',hasWhatsApp:true,accountUid:'UID-Z'}],
  ['P-BASE',{personId:'P-BASE',name:'Apoyo sin cuenta',campaignId:campaign,active:true,accountUid:null,hasWhatsApp:false}],
]);
function projector({campaignId,personId,ledgerEntries}){
 let points=0,count=0;
 for(const entry of ledgerEntries){
  if(entry.campaignId===campaignId && entry.personId===personId && entry.ledgerStatus==='POSTED' && entry.runtimeScoringEnabled===true){
   points+=entry.points;count++;
  }
 }
 return {contribution:{historical:{points,contributionCount:count,byDimension:{TERRITORIAL_ACTIVITY:points}}}};
}
function fakeDb(overrides={}){
 const profile={active:true,role:'jefe_estructura',personId:chiefId,structureId,campaignId:campaign,municipalityId:'M-001'};
 const structure={id:structureId,campaignId:campaign,municipalityId:'M-001',name:'Compostela'};
 const membershipRows=overrides.members||members;
 const ledgers=overrides.ledgers||[
  {personId:'P-ZULEMA',campaignId:campaign,ledgerStatus:'POSTED',runtimeScoringEnabled:true,points:30},
  {personId:'P-ZULEMA',campaignId:campaign,ledgerStatus:'POSTED',runtimeScoringEnabled:true,points:30},
  {personId:'P-BASE',campaignId:campaign,ledgerStatus:'DRAFT_NOT_POSTABLE',runtimeScoringEnabled:true,points:12}
 ];
 const readDoc=(collection,id)=>{
  let data=null;
  if(collection==='usuarios' && id==='UID-LALO') data=overrides.profile||profile;
  if(collection==='estructuras' && id===structureDocumentId) data=overrides.structure||structure;
  if(collection==='territorialMemberships' && id===canonicalMembershipDocumentId(campaign,chiefId))
    data=overrides.actorMembership||chief;
  if(collection==='persons') data=persons.get(id)||null;
  return {id,exists:data!=null,data:()=>data};
 };
 const collection=name=>({
  doc:id=>({id,get:async()=>readDoc(name,id)}),
  where:(field,op,value)=>({limit:(limit)=>({get:async()=>{
    const rows=name==='territorialMemberships'?membershipRows.filter(m=>m[field]===value):
      name==='contributionLedger'?ledgers.filter(l=>value.includes(l.personId)):[];
    const docs=rows.slice(0,limit).map((v,i)=>({id:name==='territorialMemberships'?canonicalMembershipDocumentId(v.campaignId,v.personId):String(i),data:()=>v}));
    return {docs,size:docs.length};
  }})})
 });
 return {collection,getAll:async(...refs)=>refs.map(ref=>readDoc('persons',ref.id))};
}

test('ordena puntos 60 > 0 y conserva a personas sin cuenta',async()=>{
 const data=await getStructureScoreboardCore({db:fakeDb(),actorUid:'UID-LALO',structureDocumentId,projector});
 assert.equal(data.total,3);
 assert.deepEqual(data.rows.map(r=>r.name),['Zulema Lizandi Regalado','Apoyo sin cuenta','Lalo Gómez']);
 assert.deepEqual(data.rows.map(r=>r.points),[60,0,0]);
 assert.equal(data.rows[0].position,1);
 assert.equal(data.rows[0].locality,'Zacualpan');
 assert.equal(data.rows[1].locality,'');
 assert.equal(data.rows[0].contributions,2);
 assert.equal(data.rows[1].hasDigitalAccount,false);
 assert.equal(data.rows[1].whatsAppNumber,null);
 assert.equal(data.rows[0].whatsAppNumber,'523271029929');
 assert.equal(data.rows[0].parentName,'Lalo Gómez');
 assert.equal(data.rows[1].introducedByName,'Zulema Lizandi Regalado');
});
test('impide lectura desde otra jerarquia',async()=>{
 const db=fakeDb({profile:{active:true,role:'participante',campaignId:campaign,personId:chiefId,structureId}});
 await assert.rejects(getStructureScoreboardCore({db,actorUid:'UID-LALO',structureDocumentId,projector}),e=>e.code==='permission-denied');
});
test('impide estructura distinta',async()=>{
 const db=fakeDb({structure:{id:'OTRA',campaignId:campaign,municipalityId:'M-001'}});
 await assert.rejects(getStructureScoreboardCore({db,actorUid:'UID-LALO',structureDocumentId,projector}),e=>e.code==='permission-denied');
});
test('impide membresia inactiva',async()=>{
 const db=fakeDb({actorMembership:{...chief,active:false}});
 await assert.rejects(getStructureScoreboardCore({db,actorUid:'UID-LALO',structureDocumentId,projector}),e=>e.code==='permission-denied');
});
test('no mezcla puntos de otra campaña ni borradores',async()=>{
 const db=fakeDb({ledgers:[{personId:'P-ZULEMA',campaignId:'OTRA',ledgerStatus:'POSTED',runtimeScoringEnabled:true,points:5000},
  {personId:'P-ZULEMA',campaignId:campaign,ledgerStatus:'DRAFT_NOT_POSTABLE',runtimeScoringEnabled:true,points:15}]});
 const data=await getStructureScoreboardCore({db,actorUid:'UID-LALO',structureDocumentId,projector});
 assert.equal(data.rows.find(r=>r.personId==='P-ZULEMA').points,0);
});
test('no lista membresias ajenas a la campaña o municipio',async()=>{
 const db=fakeDb({members:[...members,memb('P-OTHER','integrante',chiefId,{campaignId:'OTRA'}),memb('P-OTHER2','integrante',chiefId,{municipalityId:'M-002'})]});
 const data=await getStructureScoreboardCore({db,actorUid:'UID-LALO',structureDocumentId,projector});
 assert.equal(data.total,3);
});
test('reconoce numero WhatsApp mexicano solo con autorización',()=>{
 assert.equal(core.normalizeMxWhatsApp({phone:'3271029929',hasWhatsApp:true}),'523271029929');
 assert.equal(core.normalizeMxWhatsApp({phone:'523271029929',hasWhatsApp:true}),'523271029929');
 assert.equal(core.normalizeMxWhatsApp({phone:'3271029929',hasWhatsApp:false}),null);
 assert.equal(core.normalizeMxWhatsApp({phone:'123',hasWhatsApp:true}),null);
 assert.equal(core.normalizeMxWhatsApp({phone:'52;alert(1)',hasWhatsApp:true}),null);
});
test('empates se ordenan alfabeticamente',()=>{
 const rows=core.sortRows([{name:'Zulema',points:0,personId:'2'},{name:'Ana',points:0,personId:'1'}]);
 assert.deepEqual(rows.map(x=>x.name),['Ana','Zulema']);
});
test('BUILD-20F: ranking en pantalla separada, conservando protección del servidor',()=>{
 const team=fs.readFileSync(path.join(__dirname,'../estructura.html'),'utf8');
 const teamJs=fs.readFileSync(path.join(__dirname,'../estructura.js'),'utf8');
 const ranking=fs.readFileSync(path.join(__dirname,'../puntuaciones-estructura.html'),'utf8');
 const rankingJs=fs.readFileSync(path.join(__dirname,'../puntuaciones-estructura.js'),'utf8');
 const index=fs.readFileSync(path.join(__dirname,'index.js'),'utf8');
 assert.doesNotMatch(team,/id="structureScoreboard"/);
 assert.match(team,/id="structureScoresShortcut"/);
 assert.match(teamJs,/structureNameWithLocality/);
 assert.match(teamJs,/puntuaciones-estructura\.html\?id=/);
 assert.match(ranking,/id="structureScoreboard"/);
 assert.match(rankingJs,/getStructureScoreboard/);
 assert.match(rankingJs,/persona\.html\?id=/);
 assert.match(rankingJs,/https:\/\/wa\.me\//);
 assert.match(rankingJs,/role !== "jefe_estructura"/);
 assert.match(index,/exports\.getStructureScoreboard\s*=/);
});
