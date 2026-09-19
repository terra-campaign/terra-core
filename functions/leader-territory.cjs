const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {getFirestore}=require('firebase-admin/firestore');
const {
  evaluateTerritorialGrant
}=require('./territorial-access.cjs');
const TZ='America/Mazatlan';
const text=v=>typeof v==='string'?v.trim():'';
const key=v=>text(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ');
const fmt=new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'});
function day(value){try{const date=value?.toDate?value.toDate():null;if(!date||!Number.isFinite(date.getTime()))return '';const p=Object.fromEntries(fmt.formatToParts(date).map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}`;}catch{return '';}}
function filters(data={}){const r={};for(const n of ['from','to']){r[n]=text(data[n]);if(r[n]&&(!/^\d{4}-\d{2}-\d{2}$/.test(r[n])||!Number.isFinite(Date.parse(r[n]))||new Date(r[n]).toISOString().slice(0,10)!==r[n]))throw new HttpsError('invalid-argument','Fecha inválida.');}if(r.from&&r.to&&r.from>r.to)throw new HttpsError('invalid-argument','La fecha inicial debe ser anterior a la final.');r.locality=text(data.locality);if(r.locality.length>300)throw new HttpsError('invalid-argument','Localidad inválida.');return r;}
function summarize(rows,f){
 const localities=[...new Set(rows.map(v=>text(v.locality)||'Sin localidad'))].sort((a,b)=>a.localeCompare(b,'es'));
 const selected=rows.filter(v=>{const d=day(v.createdAt);return (!f.locality||(text(v.locality)||'Sin localidad')===f.locality)&&(!f.from||(d&&d>=f.from))&&(!f.to||(d&&d<=f.to));});
 const points=selected.filter(v=>v.hasLocation===true&&Number.isFinite(v.latitude)&&Number.isFinite(v.longitude)&&Math.abs(v.latitude)<=90&&Math.abs(v.longitude)<=180).map(v=>({lat:v.latitude,lng:v.longitude}));
 const homes=new Set(),workers=new Set(),zones=new Map(),days=new Map();let unknownAddress=0,unknownDate=0,flyers=0;
 for(const v of selected){const l=text(v.locality)||'Sin localidad',d=day(v.createdAt),a=key(v.normalizedAddress);if(a&&key(v.locality))homes.add(JSON.stringify([key(v.locality),a]));else unknownAddress++;
 if(text(v.interviewerId))workers.add(v.interviewerId);if(v.flyerDelivered===true)flyers++;
 zones.set(l,(zones.get(l)||0)+1);if(d)days.set(d,(days.get(d)||0)+1);else unknownDate++;
 }
 return {points,withoutLocation:selected.length-points.length,visits:selected.length,identifiedHomes:homes.size,unknownAddress,unknownDate,flyerVisits:flyers,activeReporters:workers.size,localities,zones:[...zones].map(([name,visits])=>({name,visits})).sort((a,b)=>b.visits-a.visits),daily:[...days].sort(([a],[b])=>a.localeCompare(b)).map(([date,visits])=>({date,visits})),undatedTotal:rows.filter(v=>!day(v.createdAt)).length};
}

function recordModeForGrant(grant){
  return grant.mode==='demo'
    ? 'demo'
    : 'production';
}

function territoryQuery(db,campaignId,grant){
  let q=db
    .collection('visitas')
    .where('campaignId','==',campaignId)
    .where(
      'recordMode',
      '==',
      recordModeForGrant(grant)
    );

  if(grant.scopeType==='campaign'){
    return q;
  }

  if(grant.scopeType==='municipality'){
    return q.where(
      'municipalityId',
      '==',
      grant.municipalityId
    );
  }

  if(grant.scopeType==='structure'){
    return q
      .where(
        'municipalityId',
        '==',
        grant.municipalityId
      )
      .where(
        'structureId',
        '==',
        grant.structureId
      );
  }

  if(grant.scopeType==='brigade'){
    return q.where(
      'brigadeId',
      '==',
      grant.brigadeId
    );
  }

  throw new HttpsError(
    'permission-denied',
    'Alcance territorial no autorizado.'
  );
}

function visitAllowedByGrant(
  grant,
  uid,
  campaignId,
  visit,
  nowMs
){
  return evaluateTerritorialGrant({
    grant,
    uid,
    campaignId,
    permission:'read',
    nowMs,
    resource:{
      municipalityId:text(
        visit.municipalityId
      ),
      structureId:text(
        visit.structureId
      ),
      brigadeId:text(
        visit.brigadeId
      )
    }
  }).allowed;
}

exports.getPrincipalLeaderTerritory=onCall(
  {
    region:'us-central1',
    timeoutSeconds:60
  },
  async request=>{

    if(!request.auth){
      throw new HttpsError(
        'unauthenticated',
        'Inicie sesión.'
      );
    }

    const db=getFirestore();
    const f=filters(request.data);

    return db.runTransaction(
      async tx=>{

        const uid=request.auth.uid;

        const profileSnap=
          await tx.get(
            db.doc(`usuarios/${uid}`)
          );

        const p=profileSnap.data();

        if(
          !p ||
          p.active!==true ||
          typeof p.campaignId!=='string' ||
          !text(p.campaignId) ||
          p.campaignId.includes('/')
        ){
          throw new HttpsError(
            'permission-denied',
            'Cuenta territorial no habilitada.'
          );
        }

        const grantSnap=
          await tx.get(
            db.doc(
              `territorialAccessGrants/${uid}`
            )
          );

        if(!grantSnap.exists){
          throw new HttpsError(
            'permission-denied',
            'No existe autorización territorial vigente.',
            {reason:'missing-grant'}
          );
        }

        const grant=grantSnap.data();
        const nowMs=Date.now();

        const access=
          evaluateTerritorialGrant({
            grant,
            uid,
            campaignId:p.campaignId,
            permission:'read',
            nowMs
          });

        if(!access.allowed){
          throw new HttpsError(
            'permission-denied',
            'Autorización territorial no vigente.',
            {reason:access.reason}
          );
        }

        const query=
          territoryQuery(
            db,
            p.campaignId,
            access.grant
          )
          .limit(10001);

        const snapshot=
          await tx.get(query);

        if(snapshot.size>10000){
          throw new HttpsError(
            'resource-exhausted',
            'El volumen requiere un resumen precalculado. No se muestran totales parciales.'
          );
        }

        const rows=
          snapshot.docs
            .map(doc=>doc.data())
            .filter(visit=>
              visitAllowedByGrant(
                grant,
                uid,
                p.campaignId,
                visit,
                nowMs
              )
            );

        return {
          name:
            text(p.name) ||
            'Territorio',

          calculatedAt:
            Date.now(),

          timeZone:
            TZ,

          territorialAccess:{
            mode:
              access.grant.mode,

            scopeType:
              access.grant.scopeType,

            municipalityId:
              access.grant.municipalityId ||
              '',

            structureId:
              access.grant.structureId ||
              '',

            brigadeId:
              access.grant.brigadeId ||
              '',

            expiresAt:
              access.grant.expiresAtMs
          },

          ...summarize(
            rows,
            f
          )
        };
      }
    );
  }
);

exports._summarize=summarize;
exports._filters=filters;

exports._test={
  recordModeForGrant,
  territoryQuery,
  visitAllowedByGrant
};
