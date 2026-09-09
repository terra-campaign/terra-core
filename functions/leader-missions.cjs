'use strict';
const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {getFirestore}=require('firebase-admin/firestore');
exports.getPrincipalLeaderMissions=onCall({region:'us-central1',timeoutSeconds:60},async request=>{
 if(!request.auth)throw new HttpsError('unauthenticated','Inicia sesión.');
 const db=getFirestore();
 return db.runTransaction(async tx=>{
  const uid=request.auth.uid;
  const p=(await tx.get(db.collection('usuarios').doc(uid))).data();
  if(!p||p.active!==true||p.role!=='lider_principal'||typeof p.campaignId!=='string'||!p.campaignId||p.campaignId.includes('/'))throw new HttpsError('permission-denied','Acceso exclusivo del Líder principal.');
  const lock=await tx.get(db.collection('principalLeaders').doc(p.campaignId));
  if(lock.data()?.uid!==uid)throw new HttpsError('permission-denied','Líder no registrado.');
  const users=await tx.get(db.collection('usuarios').where('campaignId','==',p.campaignId).limit(5001));
  const missions=await tx.get(db.collection('misiones').where('createdBy','==',uid).limit(5001));
  if(users.size>5000||missions.size>5000)throw new HttpsError('resource-exhausted','El listado requiere paginación; no se muestran resultados parciales.');
  const coordinators=users.docs.filter(d=>d.data().role==='coordinador_municipal'&&d.data().active===true).map(d=>({uid:d.id,name:d.data().name||'Sin nombre',municipalityId:d.data().municipalityId||'',phone:typeof d.data().phone==='string'?d.data().phone:''}));
  return {name:p.name||'Líder principal',coordinators,missions:missions.docs.filter(d=>d.data().campaignId===p.campaignId&&d.data().linkedVersion===1&&d.data().assignedToRole==='coordinador_municipal').map(d=>{
   const m=d.data();return {id:d.id,title:m.title||'Misión',description:m.description||'',locality:m.locality||'',deadlineAt:m.deadlineAt||null,active:m.active===true,assignedTo:m.assignedTo,assignedToName:m.assignedToName||'Sin nombre'};
  })};
 });
});
