'use strict';
const {onCall,HttpsError} = require('firebase-functions/v2/https');
const {getFirestore} = require('firebase-admin/firestore');
const {WINDOW_MS,parentOf,actions} = require('./mission-review-policy.cjs');
const options = {region:'us-central1',timeoutSeconds:60};
const fail = (code,message) => {throw new HttpsError(code,message);};
const validId = x => typeof x === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(x);
const profile = s => s.exists ? {...s.data(),uid:s.id} : null;
async function context(tx,db,uid,evidenceId) {
  const p = profile(await tx.get(db.collection('usuarios').doc(uid)));
  if (!p || p.active !== true || !p.campaignId) fail('permission-denied','Perfil no autorizado.');
  const e = (await tx.get(db.collection('missionEvidence').doc(evidenceId))).data();
  if (!e || !validId(e.missionId) || e.campaignId !== p.campaignId) fail('permission-denied','Reporte no disponible.');
  const m = (await tx.get(db.collection('misiones').doc(e.missionId))).data();
  const l = (await tx.get(db.collection('missionLinks').doc(e.missionId))).data();
  if (!m || !l || m.campaignId !== p.campaignId || l.campaignId !== p.campaignId ||
      l.assignedTo !== m.assignedTo || l.createdBy !== m.createdBy || e.uploadedBy !== l.assignedTo ||
      !validId(l.createdBy) || !validId(l.assignedTo)) fail('failed-precondition','La asignación requiere revisión; no se puede calificar automáticamente un reporte antiguo o sin vínculo.');
  const reviewer = profile(await tx.get(db.collection('usuarios').doc(l.createdBy)));
  const subject = profile(await tx.get(db.collection('usuarios').doc(l.assignedTo)));
  const ref = db.collection('missionReviews').doc(evidenceId);
  const r = (await tx.get(ref)).data() || null;
  let leaderDirect = false;
  if (reviewer?.role === 'lider_principal' && reviewer.active === true && subject?.active === true &&
      reviewer.campaignId === p.campaignId && subject.campaignId === p.campaignId && subject.role === 'coordinador_municipal') {
    const lock = await tx.get(db.collection('principalLeaders').doc(p.campaignId));
    leaderDirect = lock.data()?.uid === reviewer.uid;
  }
  const hierarchy = leaderDirect || parentOf(reviewer,subject);
  const direct = hierarchy && reviewer.uid === uid && uid !== e.uploadedBy;
  const superior = !leaderDirect && hierarchy && parentOf(p,reviewer) && uid !== e.uploadedBy;
  if (!(direct || (p.uid === e.uploadedBy) || (superior && r?.pendingAppeal))) fail('permission-denied','No tienes permiso para revisar este reporte.');
  return {p,e,m,l,r,ref,reviewer,subject,direct,superior,leaderDirect};
}
function reviewActions(c, now) {
  const result = actions(c.r,c.direct,c.superior,now);
  if (c.leaderDirect) result.canRequest = false;
  return result;
}
function images(e) {
  const prefix = `missions/${e.campaignId}/${e.missionId}/evidence/`;
  return (Array.isArray(e.imagePaths) ? e.imagePaths : [e.imagePath]).filter(x =>
    typeof x === 'string' && x.startsWith(prefix) && /^[A-Za-z0-9_.-]+$/.test(x.slice(prefix.length))).slice(0,5);
}
exports.getMissionReview = onCall(options,async request => {
  if (!request.auth) fail('unauthenticated','Inicia sesión.');
  const eid = request.data?.evidenceId;
  if (!validId(eid)) fail('invalid-argument','Reporte inválido.');
  const db = getFirestore();
  return db.runTransaction(async tx => {
    const c = await context(tx,db,request.auth.uid,eid);
    const history = await tx.get(c.ref.collection('history').orderBy('revision','desc').limit(30));
    return {evidenceId:eid,missionId:c.e.missionId,title:c.m.title || 'Misión',
      description:c.e.description || '',reportedByName:c.e.reportedByName || '',
      uploadedByName:c.e.uploadedByName || '',imagePaths:images(c.e),
      submittedAt:c.e.createdAt?.toMillis?.() || null,
      imageViaCallable:c.leaderDirect && c.direct,review:c.r,history:history.docs.map(s=>s.data()),serverNow:Date.now(),
      ...reviewActions(c,Date.now())};
  });
});
exports.listMissionReviews = onCall(options,async request => {
  if (!request.auth) fail('unauthenticated','Inicia sesión.');
  const db = getFirestore();
  const p = profile(await db.collection('usuarios').doc(request.auth.uid).get());
  if (!p || p.active !== true || !p.campaignId) fail('permission-denied','Perfil no autorizado.');
  const evidence = await db.collection('missionEvidence').where('campaignId','==',p.campaignId).limit(501).get();
  if (evidence.size > 500) fail('resource-exhausted','La bandeja requiere paginación para más de 500 reportes. No se muestran resultados parciales.');
  const result = [];
  // Revalidate each item against authoritative assignments and current hierarchy.
  const queue = [...evidence.docs];
  await Promise.all(Array.from({length:Math.min(6,queue.length)},async () => {
    for (let s; (s = queue.shift());) {
    try {
      const row = await db.runTransaction(async tx => {
        const c = await context(tx,db,p.uid,s.id);
        return {evidenceId:s.id,title:c.m.title || 'Misión',name:c.e.uploadedByName || 'Sin nombre',
          status:c.r?.status || 'pending',pendingAppeal:!!c.r?.pendingAppeal,
          revision:c.r?.revision || 0,submittedAt:c.e.createdAt?.toMillis?.() || 0,
          ...reviewActions(c,Date.now())};
      });
      result.push(row);
    } catch(error) { if (!['permission-denied','failed-precondition'].includes(error.code)) throw error; }
  }
  }));
  return {items:result.sort((a,b)=>b.submittedAt-a.submittedAt)};
});
exports.decideMissionReview = onCall(options,async request => {
  if (!request.auth) fail('unauthenticated','Inicia sesión.');
  const d = request.data || {};
  if (!validId(d.evidenceId) || !validId(d.requestId) || !Number.isInteger(d.expectedRevision) || d.expectedRevision < 0 ||
      !['decide','request','resolve'].includes(d.action) || typeof d.reason !== 'string' || !d.reason.trim() || d.reason.length > 1000 ||
      (d.action !== 'request' && !['validated','rejected','correction_requested'].includes(d.status))) fail('invalid-argument','Selecciona una decisión y explica el motivo (máximo 1000 caracteres).');
  const db = getFirestore();
  return db.runTransaction(async tx => {
    const c = await context(tx,db,request.auth.uid,d.evidenceId);
    const now = Date.now();
    const rights = reviewActions(c,now);
    const fingerprint = JSON.stringify([d.action,d.status || null,d.reason.trim(),d.expectedRevision]);
    if (c.r?.lastRequestId === d.requestId && c.r?.lastActor === request.auth.uid) {
      if (c.r.lastFingerprint !== fingerprint) fail('already-exists','Este intento tiene otros datos. Actualiza el reporte.');
      return {revision:c.r.revision};
    }
    if ((c.r?.revision || 0) !== d.expectedRevision) fail('aborted','Otra revisión cambió este reporte. Actualiza antes de decidir.');
    if (!(d.action === 'decide' && rights.canDecide || d.action === 'request' && rights.canRequest || d.action === 'resolve' && rights.canResolve)) fail('permission-denied','La acción no está permitida o el plazo de tres horas terminó.');
    let superior = null;
    if (d.action === 'request') {
      if (!validId(c.reviewer.parentUserId)) fail('failed-precondition','No hay un superior configurado para este revisor.');
      superior = profile(await tx.get(db.collection('usuarios').doc(c.reviewer.parentUserId)));
      if (!parentOf(superior,c.reviewer) || superior.uid === c.e.uploadedBy) fail('failed-precondition','El superior requiere configuración.');
    }
    const revision = (c.r?.revision || 0) + 1;
    const r = {...c.r,campaignId:c.p.campaignId,missionId:c.e.missionId,evidenceId:d.evidenceId,
      reviewerId:c.reviewer.uid,subjectId:c.subject.uid,revision,
      status:d.action === 'request' ? c.r.status : d.status,
      firstDecisionAt:c.r?.firstDecisionAt ?? now,reconsiderUntil:c.r?.reconsiderUntil ?? now + WINDOW_MS,
      pendingAppeal:d.action === 'request',escalated:c.r?.escalated === true || d.action === 'resolve',
      reason:d.reason.trim(),updatedAt:now,lastActor:c.p.uid,lastActorName:c.p.name || 'Sin nombre',
      lastRequestId:d.requestId,lastFingerprint:fingerprint};
    const event = {revision,action:d.action,previousStatus:c.r?.status || 'pending',status:r.status,
      actorId:c.p.uid,actorName:r.lastActorName,reason:r.reason,at:now};
    tx.set(c.ref,r);
    tx.create(c.ref.collection('history').doc(String(revision).padStart(8,'0')),event);
    return {revision};
  });
});

// Authenticated image transfer for the superior's pending appeal. No public URLs or broader Storage rules.
exports.getMissionReviewImage = onCall({...options,memory:'256MiB'},async request => {
  if (!request.auth) fail('unauthenticated','Inicia sesión.');
  const {evidenceId,index} = request.data || {};
  if (!validId(evidenceId) || !Number.isInteger(index) || index < 0 || index > 4) fail('invalid-argument','Imagen inválida.');
  const db = getFirestore();
  const path = await db.runTransaction(async tx => {
    const c = await context(tx,db,request.auth.uid,evidenceId);
    if (!(c.leaderDirect && c.direct) && !(c.superior && c.r?.pendingAppeal)) fail('permission-denied','No tienes una revisión superior pendiente.');
    const value = images(c.e)[index];
    if (!value) fail('not-found','Imagen no disponible.');
    return value;
  });
  const {getStorage} = require('firebase-admin/storage');
  const file = getStorage().bucket().file(path);
  const [metadata] = await file.getMetadata();
  if (!Number.isFinite(Number(metadata.size)) || Number(metadata.size) >= 8*1024*1024 || !['image/jpeg','image/png','image/webp'].includes(metadata.contentType)) fail('failed-precondition','Imagen fuera del formato permitido.');
  const [buffer] = await file.download();
  return {base64:buffer.toString('base64'),contentType:metadata.contentType};
});
