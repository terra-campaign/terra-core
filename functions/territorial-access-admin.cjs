const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {getFirestore,Timestamp}=require('firebase-admin/firestore');
const {
  evaluateTerritorialGrant,
  territorialRecordMetadata
}=require('./territorial-access.cjs');

const text=value=>typeof value==='string'?value.trim():'';

function managerProfileValid(profile,campaignId){
  return Boolean(
    profile &&
    profile.active===true &&
    ['admin','lider_principal'].includes(profile.role) &&
    text(profile.campaignId)===text(campaignId)
  );
}

function validateGrantInput(data={}){
  const uid=text(data.uid);
  const mode=text(data.mode);
  const scopeType=text(data.scopeType);
  const permissions=Array.isArray(data.permissions)
    ? [...new Set(data.permissions.map(text))]
        .filter(v=>v==='read'||v==='write')
    : [];

  const durationMinutes=Number(data.durationMinutes);

  if(!uid) throw new HttpsError('invalid-argument','Falta el usuario.');
  if(!['demo','operational'].includes(mode))
    throw new HttpsError('invalid-argument','Modo territorial inválido.');

  if(!['campaign','municipality','structure','brigade'].includes(scopeType))
    throw new HttpsError('invalid-argument','Alcance territorial inválido.');

  if(!permissions.length)
    throw new HttpsError('invalid-argument','Debe existir al menos un permiso.');

  if(
    !Number.isInteger(durationMinutes) ||
    durationMinutes<5 ||
    durationMinutes>1440
  ){
    throw new HttpsError(
      'invalid-argument',
      'La autorización debe durar entre 5 minutos y 24 horas.'
    );
  }

  const municipalityId=text(data.municipalityId);
  const structureId=text(data.structureId);
  const brigadeId=text(data.brigadeId);

  if(scopeType==='municipality'&&!municipalityId)
    throw new HttpsError('invalid-argument','Falta el municipio.');

  if(scopeType==='structure'&&(!municipalityId||!structureId))
    throw new HttpsError('invalid-argument','Falta municipio o estructura.');

  if(scopeType==='brigade'&&!brigadeId)
    throw new HttpsError('invalid-argument','Falta la brigada.');

  return {
    uid,
    mode,
    scopeType,
    permissions,
    durationMinutes,
    municipalityId,
    structureId,
    brigadeId,
    reason:text(data.reason).slice(0,300)
  };
}

async function assertManager(db,uid,campaignId){
  const profileSnap=await db.doc(`usuarios/${uid}`).get();
  const profile=profileSnap.data();

  if(!managerProfileValid(profile,campaignId))
    throw new HttpsError('permission-denied','No puede administrar accesos territoriales.');

  if(profile.role==='lider_principal'){
    const leader=(
      await db.doc(`principalLeaders/${campaignId}`).get()
    ).data();

    if(!leader||leader.uid!==uid)
      throw new HttpsError('permission-denied','Líder principal no registrado.');
  }

  return profile;
}

exports.getMyTerritorialAccess=onCall(
  {region:'us-central1'},
  async request=>{
    if(!request.auth)
      throw new HttpsError('unauthenticated','Inicie sesión.');

    const db=getFirestore();
    const uid=request.auth.uid;

    const [profileSnap,grantSnap]=await Promise.all([
      db.doc(`usuarios/${uid}`).get(),
      db.doc(`territorialAccessGrants/${uid}`).get()
    ]);

    const profile=profileSnap.data();

    if(!profile||profile.active!==true||!text(profile.campaignId))
      throw new HttpsError('permission-denied','Cuenta no habilitada.');

    if(!grantSnap.exists){
      return {
        authorized:false,
        read:false,
        write:false,
        reason:'missing-grant'
      };
    }

    const grant=grantSnap.data();
    const nowMs=Date.now();

    const read=evaluateTerritorialGrant({
      grant,
      uid,
      campaignId:profile.campaignId,
      permission:'read',
      nowMs
    });

    const write=evaluateTerritorialGrant({
      grant,
      uid,
      campaignId:profile.campaignId,
      permission:'write',
      nowMs
    });

    return {
      authorized:read.allowed||write.allowed,
      read:read.allowed,
      write:write.allowed,
      reason:read.allowed||write.allowed
        ? 'authorized'
        : read.reason,
      grant:{
        grantId:text(grant.grantId),
        uid:text(grant.uid),
        personId:text(grant.personId),
        campaignId:text(grant.campaignId),
        mode:text(grant.mode),
        scopeType:text(grant.scopeType),
        municipalityId:text(grant.municipalityId),
        structureId:text(grant.structureId),
        brigadeId:text(grant.brigadeId),
        permissions:Array.isArray(grant.permissions)?grant.permissions:[],
        startsAt:grant.startsAt?.toMillis?.()||null,
        expiresAt:grant.expiresAt?.toMillis?.()||null,
        recordMetadata:territorialRecordMetadata(grant)
      }
    };
  }
);

exports.grantTerritorialAccess=onCall(
  {region:'us-central1'},
  async request=>{
    if(!request.auth)
      throw new HttpsError('unauthenticated','Inicie sesión.');

    const db=getFirestore();
    const input=validateGrantInput(request.data);
    const managerSnap=await db.doc(`usuarios/${request.auth.uid}`).get();
    const manager=managerSnap.data();

    if(!manager||!text(manager.campaignId))
      throw new HttpsError('permission-denied','Administrador no válido.');

    await assertManager(
      db,
      request.auth.uid,
      manager.campaignId
    );

    const targetSnap=await db.doc(`usuarios/${input.uid}`).get();
    const target=targetSnap.data();

    if(
      !target ||
      target.active!==true ||
      text(target.campaignId)!==text(manager.campaignId)
    ){
      throw new HttpsError('failed-precondition','Usuario objetivo no válido.');
    }

    if(!text(target.personId))
      throw new HttpsError(
        'failed-precondition',
        'El usuario objetivo todavía no tiene personId canónico.'
      );

    const now=Date.now();
    const grantId=db.collection('territorialAccessGrantAudit').doc().id;

    const grant={
      grantId,
      uid:input.uid,
      personId:text(target.personId),
      campaignId:text(manager.campaignId),
      mode:input.mode,
      scopeType:input.scopeType,
      municipalityId:input.municipalityId,
      structureId:input.structureId,
      brigadeId:input.brigadeId,
      permissions:input.permissions,
      active:true,
      startsAt:Timestamp.fromMillis(now),
      expiresAt:Timestamp.fromMillis(
        now+(input.durationMinutes*60*1000)
      ),
      revokedAt:null,
      grantedBy:request.auth.uid,
      grantedByName:text(manager.name),
      reason:input.reason,
      createdAt:Timestamp.fromMillis(now),
      updatedAt:Timestamp.fromMillis(now),
      version:1
    };

    const batch=db.batch();

    batch.set(
      db.doc(`territorialAccessGrants/${input.uid}`),
      grant
    );

    batch.set(
      db.doc(`territorialAccessGrantAudit/${grantId}`),
      {
        ...grant,
        action:'GRANTED'
      }
    );

    await batch.commit();

    return {
      ok:true,
      grantId,
      uid:input.uid,
      expiresAt:grant.expiresAt.toMillis()
    };
  }
);

exports.revokeTerritorialAccess=onCall(
  {region:'us-central1'},
  async request=>{
    if(!request.auth)
      throw new HttpsError('unauthenticated','Inicie sesión.');

    const uid=text(request.data?.uid);
    if(!uid)
      throw new HttpsError('invalid-argument','Falta el usuario.');

    const db=getFirestore();
    const manager=(
      await db.doc(`usuarios/${request.auth.uid}`).get()
    ).data();

    if(!manager||!text(manager.campaignId))
      throw new HttpsError('permission-denied','Administrador no válido.');

    await assertManager(
      db,
      request.auth.uid,
      manager.campaignId
    );

    const ref=db.doc(`territorialAccessGrants/${uid}`);
    const snap=await ref.get();

    if(!snap.exists)
      throw new HttpsError('not-found','No existe autorización territorial.');

    const grant=snap.data();

    if(text(grant.campaignId)!==text(manager.campaignId))
      throw new HttpsError('permission-denied','Autorización de otra campaña.');

    const now=Date.now();
    const auditId=db.collection('territorialAccessGrantAudit').doc().id;

    const batch=db.batch();

    batch.update(ref,{
      active:false,
      revokedAt:Timestamp.fromMillis(now),
      revokedBy:request.auth.uid,
      revokedByName:text(manager.name),
      updatedAt:Timestamp.fromMillis(now)
    });

    batch.set(
      db.doc(`territorialAccessGrantAudit/${auditId}`),
      {
        ...grant,
        auditId,
        action:'REVOKED',
        active:false,
        revokedAt:Timestamp.fromMillis(now),
        revokedBy:request.auth.uid,
        revokedByName:text(manager.name),
        createdAt:Timestamp.fromMillis(now)
      }
    );

    await batch.commit();

    return {ok:true,uid};
  }
);

exports._test={
  managerProfileValid,
  validateGrantInput
};
