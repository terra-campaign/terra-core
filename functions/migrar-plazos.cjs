// Run from Cloud Shell: node functions/migrar-plazos.cjs
// Adds server-comparable deadlines only. Does not modify reports or active flags.
const {initializeApp, applicationDefault} = require('firebase-admin/app');
const {getFirestore, FieldPath} = require('firebase-admin/firestore');
initializeApp({credential:applicationDefault(),projectId:'terra-campaign'});
const db=getFirestore();
(async()=>{
 let cursor=null, updated=0, invalid=0;
 for (;;) {
  let q=db.collection('misiones').orderBy(FieldPath.documentId()).limit(200);
  if(cursor) q=q.startAfter(cursor);
  const page=await q.get(); if(page.empty) break;
  for(const doc of page.docs) {
   const result=await db.runTransaction(async tx=>{
    const snap=await tx.get(doc.ref); if(!snap.exists) return 0;
    const m=snap.data(); if(!m.deadlineAt) return 0;
    const millis=Date.parse(m.deadlineAt);
    if(!Number.isFinite(millis)) return -1;
    if(m.deadlineAtMillis===millis) return 0;
    tx.update(doc.ref,{deadlineAtMillis:millis}); return 1;
   });
   if(result===1) updated++; if(result===-1) invalid++;
  }
  cursor=page.docs.at(-1);
 }
 console.log(`Plazos preparados: ${updated}. Fechas inválidas: ${invalid}.`);
 if(invalid) throw new Error('Hay fechas inválidas; revisar antes de continuar.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
