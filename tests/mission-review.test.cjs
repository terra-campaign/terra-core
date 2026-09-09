const {test,beforeEach} = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const {WINDOW_MS,parentOf} = require('../functions/mission-review-policy.cjs');
let records,now;
const realNow=Date.now;
Date.now=()=>now;
const ref=path=>({path,id:path.split('/').pop(),collection:name=>col(path+'/'+name)});
const snap=path=>({id:path.split('/').pop(),exists:records.has(path),data:()=>records.get(path)});
const col=path=>({doc:id=>ref(path+'/'+id),orderBy:()=>({limit:()=>({query:path})})});
const db={collection:col,async runTransaction(fn){
 const writes=[];
 const result=await fn({get:async r=>r.query?{docs:[...records.keys()].filter(k=>k.startsWith(r.query+'/')).map(snap)}:snap(r.path),
 set:(r,d)=>writes.push(()=>records.set(r.path,d)),create:(r,d)=>writes.push(()=>{assert(!records.has(r.path));records.set(r.path,d);})});
 writes.forEach(f=>f());return result;
}};
class HttpsError extends Error{constructor(code,message){super(message);this.code=code;}}
const load=Module._load;
Module._load=function(id,...rest){if(id==='firebase-functions/v2/https')return {onCall:(_o,fn)=>fn,HttpsError};if(id==='firebase-admin/firestore')return {getFirestore:()=>db};return load.call(this,id,...rest);};
const api=require('../functions/mission-review.cjs');Module._load=load;
function request(uid,data){return {auth:{uid},data};}
function decision(uid='chief',extra={}){return api.decideMissionReview(request(uid,{evidenceId:'e1',requestId:'r1',expectedRevision:0,action:'decide',status:'validated',reason:'Evidencia comprobada',...extra}));}
const denied=async(fn,code='permission-denied')=>assert.rejects(fn,e=>e.code===code);
beforeEach(()=>{now=100000000;records=new Map(Object.entries({
 'usuarios/admin':{active:true,role:'admin',campaignId:'C'},
 'usuarios/coord':{active:true,role:'coordinador_municipal',campaignId:'C',municipalityId:'M',parentUserId:'admin'},
 'usuarios/chief':{active:true,role:'jefe_estructura',campaignId:'C',municipalityId:'M',structureId:'S',parentUserId:'coord'},
 'usuarios/member':{active:true,role:'integrante',campaignId:'C',municipalityId:'M',structureId:'S',parentUserId:'chief'},
 'usuarios/other':{active:true,role:'jefe_estructura',campaignId:'OTHER',municipalityId:'M',structureId:'S'},
 'misiones/m1':{campaignId:'C',assignedTo:'member',createdBy:'chief',active:false,deadlineAt:'2020-01-01T00:00:00Z'},
 'missionLinks/m1':{campaignId:'C',assignedTo:'member',createdBy:'chief'},
 'missionEvidence/e1':{campaignId:'C',missionId:'m1',uploadedBy:'member',description:'Original'}
}));});
test('review expired/deactivated mission without changing source evidence',async()=>{await decision();assert.equal(records.get('missionReviews/e1').status,'validated');assert.equal(records.get('missionEvidence/e1').description,'Original');assert.equal(records.get('misiones/m1').active,false);});
test('self review prohibited',()=>denied(()=>decision('member')));
test('other campaign prohibited',()=>denied(()=>decision('other')));
test('superior cannot skip initial reviewer',()=>denied(()=>decision('coord')));
test('fixed three hour window and immutable history',async()=>{await decision();const end=records.get('missionReviews/e1').reconsiderUntil;now+=WINDOW_MS-1;await decision('chief',{requestId:'r2',expectedRevision:1,status:'rejected'});assert.equal(records.get('missionReviews/e1').reconsiderUntil,end);assert.equal(records.get('missionReviews/e1/history/00000001').status,'validated');assert.equal(records.get('missionReviews/e1/history/00000002').status,'rejected');});
test('exact deadline denies reconsideration',async()=>{await decision();now+=WINDOW_MS;await denied(()=>decision('chief',{requestId:'r2',expectedRevision:1,status:'rejected'}));});
test('repeated identical request does not duplicate decision',async()=>{await decision();await decision();assert.equal(records.get('missionReviews/e1').revision,1);});
test('stale revision rejects concurrent overwrite',async()=>{await decision();await denied(()=>decision('chief',{requestId:'r2'}),'aborted');});
test('appeal after deadline resolved only by superior',async()=>{await decision();now+=WINDOW_MS;await decision('chief',{action:'request',requestId:'r2',expectedRevision:1});await decision('coord',{action:'resolve',status:'rejected',requestId:'r3',expectedRevision:2});assert.equal(records.get('missionReviews/e1').pendingAppeal,false);assert.equal(records.get('missionReviews/e1').status,'rejected');});
test('cannot appeal before three hours',async()=>{await decision();await denied(()=>decision('chief',{action:'request',requestId:'r2',expectedRevision:1}));});
test('hierarchy move revokes reviewer',async()=>{records.get('usuarios/member').parentUserId='another';await denied(()=>decision());});
test('inactive reviewer prohibited',async()=>{records.get('usuarios/chief').active=false;await denied(()=>decision());});
test('municipality and structure must match',()=>{const p={...records.get('usuarios/chief'),uid:'chief'};const c={...records.get('usuarios/member'),municipalityId:'X'};assert.equal(parentOf(p,c),false);c.municipalityId='M';c.structureId='X';assert.equal(parentOf(p,c),false);});
test('reason required',()=>denied(()=>decision('chief',{reason:' '}),'invalid-argument'));
test('unlinked legacy assignment is not silently validated',async()=>{records.delete('missionLinks/m1');await denied(()=>decision(),'failed-precondition');});
test('request cannot inject evidence change',async()=>{await decision('chief',{description:'Tampered'});assert.equal(records.get('missionEvidence/e1').description,'Original');});
process.on('exit',()=>{Date.now=realNow;});

function leaderReview(){
 records.set('usuarios/leader',{role:'lider_principal',active:true,campaignId:'C'});
 records.set('principalLeaders/C',{uid:'leader'});
 for(const path of ['misiones/m1','missionLinks/m1'])Object.assign(records.get(path),{createdBy:'leader',assignedTo:'coord'});
 records.get('missionEvidence/e1').uploadedBy='coord';
}
test('leader reviews own coordinator assignment without hierarchy mutation',async()=>{
 leaderReview();await decision('leader');assert.equal(records.get('usuarios/coord').parentUserId,'admin');
 const r=await api.getMissionReview(request('leader',{evidenceId:'e1'}));assert.equal(r.imageViaCallable,true);assert.equal(r.canDecide,true);
 now+=WINDOW_MS;const expired=await api.getMissionReview(request('leader',{evidenceId:'e1'}));assert.equal(expired.canRequest,false);
 await denied(()=>decision('leader',{requestId:'later',expectedRevision:1}));
});
test('leader cannot review another creators report or act without singleton',async()=>{
 records.set('usuarios/leader',{role:'lider_principal',active:true,campaignId:'C'});records.set('principalLeaders/C',{uid:'leader'});
 await denied(()=>decision('leader'));leaderReview();records.set('principalLeaders/C',{uid:'other'});await denied(()=>decision('leader'));
});
test('leader review denied for inactive leader, inactive coordinator and foreign coordinator',async()=>{
 leaderReview();records.get('usuarios/leader').active=false;await denied(()=>decision('leader'));
 records.get('usuarios/leader').active=true;records.get('usuarios/coord').active=false;await denied(()=>decision('leader'));
 records.get('usuarios/coord').active=true;records.get('usuarios/coord').campaignId='OTHER';await denied(()=>decision('leader'));
});
test('admin cannot bypass first review of leader assignment',async()=>{leaderReview();await denied(()=>decision('admin'));});
test('leader image transfer authorizes own report and rejects other reviewers',async()=>{
 leaderReview();records.get('missionEvidence/e1').imagePaths=['missions/C/m1/evidence/photo.jpg'];
 const old=Module._load;Module._load=function(id,...rest){if(id==='firebase-admin/storage')return {getStorage:()=>({bucket:()=>({file:path=>{assert.equal(path,'missions/C/m1/evidence/photo.jpg');return {getMetadata:async()=>[{size:3,contentType:'image/jpeg'}],download:async()=>[Buffer.from('img')]};}})})};return old.call(this,id,...rest);};
 try{const image=await api.getMissionReviewImage(request('leader',{evidenceId:'e1',index:0}));assert.equal(image.base64,Buffer.from('img').toString('base64'));await denied(()=>api.getMissionReviewImage(request('admin',{evidenceId:'e1',index:0})));}finally{Module._load=old;}
});
