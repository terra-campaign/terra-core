// TERRA Campaign — linked assignments. Private registry is authoritative.
const {onCall, HttpsError} = require('firebase-functions/v2/https');
const {getFirestore, FieldValue} = require('firebase-admin/firestore');
const {createHash} = require('node:crypto');
const NEXT = {admin:'coordinador_municipal', coordinador_municipal:'jefe_estructura', jefe_estructura:'integrante', integrante:'participante'};
const OPTIONS = {region:'us-central1', timeoutSeconds:60};
const fail = (code, message) => { throw new HttpsError(code, message); };
const hash = (...parts) => createHash('sha256').update(JSON.stringify(parts)).digest('hex');
function id(value) {
  if (typeof value !== 'string' || !value.length || value.length > 128 || value.includes('/')) fail('invalid-argument','Identificador inválido.');
  return value;
}
function text(value, max, required=false) {
  if (value == null && !required) return '';
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) fail('invalid-argument','Revisa los campos de la misión.');
  return value.trim();
}
async function caller(tx, db, request) {
  if (!request.auth) fail('unauthenticated','Inicia sesión.');
  const s = await tx.get(db.collection('usuarios').doc(request.auth.uid));
  const p = s.data();
  if (!p || p.active !== true || !p.campaignId || ![...Object.keys(NEXT),'participante'].includes(p.role)) fail('permission-denied','Perfil no autorizado.');
  return {...p, uid:s.id};
}
function targetAllowed(p, t) {
  return t && t.active === true && t.campaignId === p.campaignId && t.role === NEXT[p.role] &&
    (p.role === 'admin' || (t.parentUserId === p.uid && !!p.municipalityId && t.municipalityId === p.municipalityId)) &&
    (!['jefe_estructura','integrante'].includes(p.role) || (!!p.structureId && t.structureId === p.structureId));
}
exports.createLinkedMissions = onCall(OPTIONS, async request => {
  const d = request.data || {};
  const requestId = id(d.requestId);
  if (!Array.isArray(d.assigneeIds) || !d.assigneeIds.length || d.assigneeIds.length > 50) fail('invalid-argument','Selecciona entre 1 y 50 personas.');
  const ids = [...new Set(d.assigneeIds.map(id))].sort();
  const parentId = d.parentMissionId == null ? null : id(d.parentMissionId);
  const fields = parentId ? null : {
    title:text(d.title,150,true), description:text(d.description,1500),
    locality:text(d.locality,120), missionDate:text(d.missionDate,10) || null
  };
  if (fields?.missionDate && (!/^\d{4}-\d{2}-\d{2}$/.test(fields.missionDate) || !Number.isFinite(Date.parse(fields.missionDate)) || new Date(fields.missionDate).toISOString().slice(0,10) !== fields.missionDate)) fail('invalid-argument','Fecha inválida.');
  const fingerprint = hash(parentId,ids,fields);
  const db = getFirestore();
  return db.runTransaction(async tx => {
    const p = await caller(tx,db,request);
    if (!NEXT[p.role]) fail('permission-denied','Tu nivel no puede delegar.');
    const receiptRef = db.collection('missionDispatches').doc(hash(p.uid,requestId));
    const receipt = await tx.get(receiptRef);
    if (receipt.exists) {
      if (receipt.data().fingerprint !== fingerprint || receipt.data().campaignId !== p.campaignId) fail('already-exists','Este intento ya se usó con otros datos. Cierra y abre el formulario.');
      return receipt.data().result;
    }
    let parent = null;
    if (parentId) {
      const registry = await tx.get(db.collection('missionLinks').doc(parentId));
      const source = await tx.get(db.collection('misiones').doc(parentId));
      parent = registry.data();
      if (!parent || !source.exists || parent.campaignId !== p.campaignId || parent.assignedTo !== p.uid || parent.assignedToRole !== p.role || source.data().active !== true) fail('permission-denied','Solo puedes delegar una misión vinculada, activa y asignada a ti.');
      if (parent.ancestorMissionIds.length >= 3) fail('failed-precondition','Se alcanzó el último nivel de delegación.');
    }
    const groupId = parent ? parent.groupId : hash(p.uid,requestId,'group');
    const ancestors = parent ? [...parent.ancestorMissionIds,parentId] : [];
    const records = [];
    for (const uid of ids) {
      const target = await tx.get(db.collection('usuarios').doc(uid));
      if (!targetAllowed(p,target.data())) fail('permission-denied','Una persona ya no pertenece a tu nivel inmediato o está inactiva. Actualiza la lista.');
      const missionId = hash(groupId,parentId,uid);
      const missionRef = db.collection('misiones').doc(missionId);
      const linkRef = db.collection('missionLinks').doc(missionId);
      const existing = await tx.get(linkRef);
      const existingMission = await tx.get(missionRef);
      if (existing.exists) {
        if (!existingMission.exists || existing.data().createdBy !== p.uid) fail('failed-precondition','La asignación existente requiere revisión.');
        continue; // A second dispatch to the same recipient never duplicates this branch.
      }
      if (existingMission.exists) fail('already-exists','El identificador de asignación ya está ocupado.');
      const t = target.data();
      const content = parent ? parent.content : fields;
      const data = {
        id:missionId, campaignId:p.campaignId, ...content, active:true,
        createdBy:p.uid, createdByName:p.name || 'Sin nombre', createdByRole:p.role,
        assignedTo:uid, assignedToName:t.name || 'Sin nombre', assignedToRole:t.role,
        supervisorIds:[...new Set([p.uid,...(Array.isArray(p.ancestorIds) ? p.ancestorIds : [])])],
        municipalityId:t.municipalityId || '', municipalityName:t.municipalityName || '',
        structureId:t.structureId || '', structureName:t.structureName || '',
        groupId, parentMissionId:parentId, linkedVersion:1, version:4,
        createdAt:FieldValue.serverTimestamp(), updatedAt:FieldValue.serverTimestamp()
      };
      records.push({missionRef,linkRef,data,link:{campaignId:p.campaignId, groupId, parentMissionId:parentId,
        ancestorMissionIds:ancestors, assignedTo:uid, assignedToRole:t.role, createdBy:p.uid, content}});
    }
    // All validation/reads precede every write: one atomic dispatch.
    for (const r of records) { tx.create(r.missionRef,r.data); tx.create(r.linkRef,r.link); }
    const result = {created:records.length, alreadyAssigned:ids.length-records.length};
    tx.create(receiptRef,{campaignId:p.campaignId,fingerprint,result,createdAt:FieldValue.serverTimestamp()});
    return result;
  });
});
exports.getMissionBranchProgress = onCall(OPTIONS, async request => {
  const missionId = id(request.data?.missionId);
  const db = getFirestore();
  return db.runTransaction(async tx => {
    const p = await caller(tx,db,request);
    const root = (await tx.get(db.collection('missionLinks').doc(missionId))).data();
    if (!root || root.campaignId !== p.campaignId || (p.role !== 'admin' && root.createdBy !== p.uid && root.assignedTo !== p.uid)) fail('permission-denied','No tienes acceso al resumen de esta asignación.');
    const all = await tx.get(db.collection('missionLinks').where('groupId','==',root.groupId).limit(5001));
    const evidence = await tx.get(db.collection('missionEvidence').where('campaignId','==',p.campaignId).limit(5001));
    if (all.size > 5000 || evidence.size > 5000) fail('resource-exhausted','El resumen supera el límite de esta versión; no se mostrarán totales parciales.');
    const branch = new Map();
    for (const s of all.docs) {
      const l = s.data();
      if (l.campaignId === p.campaignId && (s.id === missionId || l.ancestorMissionIds.includes(missionId))) branch.set(s.id,l.assignedTo);
    }
    const reported = new Set();
    let latest = 0;
    for (const s of evidence.docs) {
      const e = s.data();
      if (branch.has(e.missionId) && branch.get(e.missionId) === e.uploadedBy) {
        reported.add(e.missionId);
        latest = Math.max(latest,e.createdAt?.toMillis?.() || 0);
      }
    }
    return {total:branch.size,withEvidence:reported.size,withoutEvidence:branch.size-reported.size,
      percentage:branch.size ? Math.round(1000*reported.size/branch.size)/10 : null,
      lastEvidence:latest ? new Date(latest).toISOString() : null, calculatedAt:new Date().toISOString()};
  });
});

// Aggregate only: descendants are authorized through the private registry.
exports.getMissionEvidenceTotal = onCall(OPTIONS, async request => {
  const db = getFirestore();
  return db.runTransaction(async tx => {
    const p = await caller(tx, db, request);
    const read = name => tx.get(db.collection(name).where('campaignId','==',p.campaignId).limit(5001));
    const missions = await read('misiones');
    const links = await read('missionLinks');
    const evidence = await read('missionEvidence');
    if ([missions,links,evidence].some(s => s.size > 5000)) fail('resource-exhausted','El total supera el límite de esta versión. No se muestran cifras parciales.');
    const allowed = new Set();
    const roots = new Map();
    for (const s of missions.docs) {
      const m = s.data();
      if (p.role === 'admin' || m.createdBy === p.uid || m.assignedTo === p.uid ||
          (p.role !== 'coordinador_municipal' && Array.isArray(m.supervisorIds) && m.supervisorIds.includes(p.uid))) allowed.add(s.id);
    }
    for (const s of links.docs) {
      const l = s.data();
      if (p.role === 'admin' || l.createdBy === p.uid || l.assignedTo === p.uid) roots.set(s.id,l.groupId);
    }
    const assignees = new Map();
    for (const s of links.docs) {
      const l = s.data();
      if (roots.has(s.id) || (Array.isArray(l.ancestorMissionIds) && l.ancestorMissionIds.some(a => roots.has(a) && roots.get(a) === l.groupId))) allowed.add(s.id);
      assignees.set(s.id,l.assignedTo);
    }
    let total = 0;
    for (const s of evidence.docs) {
      const e = s.data();
      if (allowed.has(e.missionId) && (!assignees.has(e.missionId) || assignees.get(e.missionId) === e.uploadedBy)) total++;
    }
    return {total, calculatedAt:new Date().toISOString()};
  });
});
