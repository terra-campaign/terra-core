const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {getFirestore}=require('firebase-admin/firestore');
const {getAuth}=require('firebase-admin/auth');
const options={region:'us-central1',timeoutSeconds:60};
function deny(){throw new HttpsError('permission-denied','Acceso no autorizado.');}
async function profile(tx,db,request){
 if(!request.auth) throw new HttpsError('unauthenticated','Inicie sesión.');
 const p=(await tx.get(db.doc('usuarios/'+request.auth.uid))).data();
 if(!p||p.active!==true||typeof p.campaignId!=='string'||!p.campaignId||p.campaignId.includes('/')) deny();
 return p;
}
exports.assignPrincipalLeader=onCall(options,async request=>{
 const db=getFirestore();
 // Authorize before looking up any Auth account.
 const caller=await db.runTransaction(tx=>profile(tx,db,request));
 if(caller.role!=='admin') deny();
 const uid=request.data?.uid;
 if(typeof uid!=='string'||!uid||uid.includes('/')||uid.length>128||uid===request.auth.uid) throw new HttpsError('invalid-argument','UID inválido. Use una cuenta nueva del líder.');
 const account=await getAuth().getUser(uid);
 if(account.disabled||!account.email) throw new HttpsError('failed-precondition','La cuenta debe estar habilitada y tener correo.');
 const name=String(request.data?.name||'').trim();
 if(name.length<2||name.length>120) throw new HttpsError('invalid-argument','Indique el nombre completo.');
 return db.runTransaction(async tx=>{
  const p=await profile(tx,db,request); if(p.role!=='admin') deny();
  const ref=db.doc('principalLeaders/'+p.campaignId), userRef=db.doc('usuarios/'+uid);
  const lock=await tx.get(ref), existing=await tx.get(userRef);
  if(lock.exists){if(lock.data().uid===uid&&existing.data()?.role==='lider_principal'&&existing.data()?.campaignId===p.campaignId)return {ok:true}; throw new HttpsError('already-exists','La campaña ya tiene un líder asignado.');}
  if(existing.exists) throw new HttpsError('failed-precondition','Esta cuenta ya tiene perfil. Utilice una cuenta nueva para conservar la jerarquía actual.');
  tx.create(ref,{uid,createdBy:request.auth.uid,createdAt:new Date()});
  tx.create(userRef,{name,email:account.email,role:'lider_principal',campaignId:p.campaignId,active:true,createdBy:request.auth.uid,createdAt:new Date()});
  return {ok:true};
 });
});
exports.getPrincipalLeaderPanel=onCall(options,async request=>{
 const db=getFirestore();
 return db.runTransaction(async tx=>{
  const p=await profile(tx,db,request);
  if(!['admin','lider_principal'].includes(p.role))deny();
  if(p.role==='lider_principal'){
   const lock=await tx.get(db.doc('principalLeaders/'+p.campaignId));
   if(lock.data()?.uid!==request.auth.uid)deny();
  }
  async function read(name){const s=await tx.get(db.collection(name).where('campaignId','==',p.campaignId).limit(5001));if(s.size>5000)throw new HttpsError('resource-exhausted','Se requiere un resumen precalculado por el volumen de datos.');return s.docs.map(d=>({...d.data(),_id:d.id}));}
  const municipalities=await read('municipios'),users=await read('usuarios'),structures=await read('estructuras'),missions=await read('misiones'),evidence=await read('missionEvidence');
  const result=buildPanel(municipalities,users,structures,missions,evidence);
  return {name:p.name||'Dirección',campaignId:p.campaignId,calculatedAt:Date.now(),...result};
 });
});
function buildPanel(municipalities,users,structures,missions,evidence){
 const userMap=new Map(users.map(u=>[u._id,u]));
 const reported=new Set();const missionMap=new Map(missions.map(m=>[m._id,m]));
 for(const e of evidence){const m=missionMap.get(e.missionId);if(m&&e.uploadedBy===m.assignedTo)reported.add(m._id);}
 const known=new Set(municipalities.map(m=>m.id));
 const unmatched=missions.filter(m=>!known.has(userMap.get(m.assignedTo)?.municipalityId)).length;
 return {unmatchedMissions:unmatched,municipalities:municipalities.map(m=>{
  const selected=missions.filter(x=>userMap.get(x.assignedTo)?.municipalityId===m.id);
  const withEvidence=selected.filter(x=>reported.has(x._id)).length;
  return {id:m.id||m._id,name:m.name||'Sin nombre',active:m.active===true,structures:structures.filter(s=>s.municipalityId===m.id).length,
   coordinators:users.filter(u=>u.role==='coordinador_municipal'&&u.municipalityId===m.id).map(u=>({name:u.name||'Sin nombre',active:u.active===true})),
   total:selected.length,withEvidence,withoutEvidence:selected.length-withEvidence,percentage:selected.length?Math.round(withEvidence*1000/selected.length)/10:null};
 }).sort((a,b)=>a.name.localeCompare(b.name,'es'))};
}
exports._buildPanel=buildPanel;
