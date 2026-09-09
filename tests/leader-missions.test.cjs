// Unit tests with a transactional Firestore double; no production writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const {test} = require('node:test');
function fixture() {
  let docs = new Map();
  const snap = (key) => ({id:key.split('/').at(-1), exists:docs.has(key), data:()=>docs.get(key)});
  const col = name => ({name, doc:key=>({key:`${name}/${key}`}), where:(field,op,value)=>({name,field,value,limit(n){return {...this,n};}})});
  const db = {collection:col, async runTransaction(fn) {
    let writing = false;
    const staged = [];
    const result = await fn({async get(ref) {
      assert.equal(writing,false,'All reads must precede writes');
      if (ref.key) return snap(ref.key);
      const found = [...docs].filter(([k,v])=>k.startsWith(ref.name+'/') && v[ref.field] === ref.value).slice(0,ref.n).map(([k])=>snap(k));
      return {docs:found,size:found.length};
    }, update(ref,data){writing=true;assert(docs.has(ref.key));staged.push([ref.key,{...docs.get(ref.key),...data}]);}, create(ref,data){writing=true;assert(!docs.has(ref.key));staged.push([ref.key,data]);}});
    staged.forEach(([k,v])=>docs.set(k,v));
    return result;
  }};
  class HttpsError extends Error {constructor(code,message){super(message);this.code=code;}}
  const api = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../functions/mission-delegation.cjs'),'utf8'),{exports:api,require(name){
    if (name === 'firebase-functions/v2/https') return {onCall:(opts,fn)=>fn,HttpsError};
    if (name === 'firebase-admin/firestore') return {getFirestore:()=>db,FieldValue:{serverTimestamp:()=>({toMillis:()=>100})}};
    return require(name);
  }});
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../functions/leader-missions.cjs'),'utf8'),{exports:api,require(name){
    if(name==='firebase-functions/v2/https')return {onCall:(_o,fn)=>fn,HttpsError};
    if(name==='firebase-admin/firestore')return {getFirestore:()=>db};
    return require(name);
  }});
  const user = (uid,role,parentUserId,extra={})=>docs.set('usuarios/'+uid,{name:uid,role,parentUserId,active:true,campaignId:'C',municipalityId:'M',structureId:'S',...extra});
  user('admin','admin',null); user('coord','coordinador_municipal','admin'); user('head','jefe_estructura','coord');
  user('member','integrante','head'); user('member2','integrante','head'); user('part','participante','member'); user('other','jefe_estructura','coord');
  const call=(uid,data)=>api.createLinkedMissions({auth:uid ? {uid}:null,data});
  const create=(uid,assigneeIds,requestId,parentMissionId=null)=>call(uid,{assigneeIds,requestId,parentMissionId,title:'Misión',description:'Objetivo'});
  const find=(uid)=>[...docs].find(([k,v])=>k.startsWith('missionLinks/') && v.assignedTo === uid)?.[0].split('/')[1];
  return {docs,user,create,call,find,list:(uid)=>api.getPrincipalLeaderMissions({auth:uid?{uid}:null}),manage:(uid,data)=>api.manageMissionLifecycle({auth:{uid},data}),total:(uid)=>api.getMissionEvidenceTotal({auth:uid ? {uid}:null,data:{}}),progress:(uid,missionId)=>api.getMissionBranchProgress({auth:{uid},data:{missionId}})};
}
test('Authentication, immediate hierarchy, scope, and all-or-nothing validation',async()=>{
  const f=fixture();
  await assert.rejects(f.create(null,['coord'],'a'),{code:'unauthenticated'});
  await assert.rejects(f.create('coord',['member'],'b'),{code:'permission-denied'});
  f.user('wrong','jefe_estructura','coord',{campaignId:'OTHER'});
  await assert.rejects(f.create('coord',['head','wrong'],'c'),{code:'permission-denied'});
  assert.equal([...f.docs.keys()].filter(k=>k.startsWith('misiones/')).length,0);
  f.user('wrong','jefe_estructura','coord',{municipalityId:'OTHER'});
  await assert.rejects(f.create('coord',['wrong'],'d'),{code:'permission-denied'});
});
test('Retries are idempotent and a delegated recipient is never duplicated',async()=>{
  const f=fixture();
  await f.create('coord',['head'],'root');
  await f.create('coord',['head'],'root');
  assert.equal([...f.docs.keys()].filter(k=>k.startsWith('misiones/')).length,1);
  await assert.rejects(f.create('coord',['other'],'root'),{code:'already-exists'});
  const parent=f.find('head');
  await f.create('head',['member'],'first',parent);
  const repeat=await f.create('head',['member'],'second',parent);
  assert.equal(repeat.created,0);assert.equal(repeat.alreadyAssigned,1);
  await assert.rejects(f.create('other',['member'],'bad',parent),{code:'permission-denied'});
  f.docs.get('misiones/'+parent).active=false;
  await assert.rejects(f.create('head',['member2'],'inactive',parent),{code:'permission-denied'});
});
test('Branch counts exclude siblings, forged links and evidence from other uploaders; return no identities',async()=>{
  const f=fixture();
  await f.create('coord',['head','other'],'root');
  const root=f.find('head');
  await f.create('head',['member'],'child',root);
  const child=f.find('member');
  f.docs.set('misiones/forged',{campaignId:'C',assignedTo:'part',parentMissionId:root});
  const evidence=(id,missionId,uploadedBy)=>f.docs.set('missionEvidence/'+id,{campaignId:'C',missionId,uploadedBy,createdAt:{toMillis:()=>1000}});
  evidence('one',root,'head');evidence('two',root,'head');evidence('wrong',child,'other');evidence('sibling',f.find('other'),'other');evidence('forged','forged','part');
  const data=await f.progress('coord',root);
  assert.equal(data.total,2);assert.equal(data.withEvidence,1);assert.equal(data.percentage,50);
  assert.deepEqual(Object.keys(data).sort(),['total','withEvidence','withoutEvidence','percentage','lastEvidence','calculatedAt'].sort());
  await assert.rejects(f.progress('coord',child),{code:'permission-denied'});
  await assert.rejects(f.progress('other',root),{code:'permission-denied'});
  await assert.rejects(f.progress('admin','forged'),{code:'permission-denied'});
});
test('Full chain preserves objective and stops at participant',async()=>{
  const f=fixture();
  await f.create('admin',['coord'],'r');
  await f.create('coord',['head'],'h',f.find('coord'));
  await f.create('head',['member'],'m',f.find('head'));
  await f.call('member',{requestId:'p',assigneeIds:['part'],parentMissionId:f.find('member'),title:'Forged'});
  assert.equal(f.docs.get('misiones/'+f.find('part')).title,'Misión');
  assert.equal((await f.progress('admin',f.find('coord'))).total,4);
  await assert.rejects(f.create('part',['head'],'stop',f.find('part')),{code:'permission-denied'});
});
test('Invalid dates and inactive profiles fail',async()=>{
  const f=fixture();
  await assert.rejects(f.call('coord',{requestId:'date',assigneeIds:['head'],title:'X',missionDate:'2026-99-99'}),{code:'invalid-argument'});
  f.docs.get('usuarios/coord').active=false;
  await assert.rejects(f.create('coord',['head'],'blocked'),{code:'permission-denied'});
});
test('Oversized summaries fail instead of silently truncating',async()=>{
  const f=fixture();await f.create('coord',['head'],'root');
  for(let i=0;i<5001;i++) f.docs.set('missionEvidence/'+i,{campaignId:'C',missionId:'unrelated',uploadedBy:'other'});
  await assert.rejects(f.progress('coord',f.find('head')),{code:'resource-exhausted'});
});

test('Total includes descendants once, multiple reports, and excludes unrelated branches and campaigns', async()=>{
 const f=fixture();
 await f.create('coord',['head'],'r');
 await f.create('head',['member'],'m',f.find('head'));
 await f.create('member',['part'],'p',f.find('member'));
 const add=(key,uid)=>f.docs.set('missionEvidence/'+key,{campaignId:'C',missionId:f.find(uid),uploadedBy:uid,imagePaths:['a','b']});
 add('1','head');add('2','member');add('3','part');add('4','part');
 assert.equal((await f.total('coord')).total,4);
 assert.equal((await f.total('member')).total,3);
 assert.equal((await f.total('part')).total,2);
 assert.equal((await f.total('other')).total,0);
 f.docs.set('missionEvidence/forged',{campaignId:'C',missionId:f.find('part'),uploadedBy:'other'});
 f.docs.set('missionEvidence/foreign',{campaignId:'X',missionId:f.find('part'),uploadedBy:'part'});
 assert.equal((await f.total('coord')).total,4);
 assert.deepEqual(Object.keys(await f.total('coord')).sort(),['calculatedAt','total']);
 await assert.rejects(f.total(null),{code:'unauthenticated'});
 f.docs.get('usuarios/coord').active=false;
 await assert.rejects(f.total('coord'),{code:'permission-denied'});
});

test('Deadline is inherited; cancellation closes descendants, preserves evidence, and enforces creator',async()=>{
 const f=fixture();
 await f.create('coord',['head'],'r');
 await f.create('head',['member'],'m',f.find('head'));
 const root=f.find('head'), child=f.find('member');
 const due=new Date(Date.now()+86400000).toISOString();
 await assert.rejects(f.manage('part',{missionId:root,action:'deactivate',reason:'x'}),{code:'permission-denied'});
 await assert.rejects(f.manage('head',{missionId:child,action:'deadline',deadlineAt:due}),{code:'failed-precondition'});
 await f.manage('coord',{missionId:root,action:'deadline',deadlineAt:due});
 assert.equal(f.docs.get('misiones/'+child).deadlineAt,due);
 await f.create('member',['part'],'p',child);
 assert.equal(f.docs.get('misiones/'+f.find('part')).deadlineAt,due);
 await assert.rejects(f.manage('coord',{missionId:root,action:'deadline',deadlineAt:due}),{code:'failed-precondition'});
 f.docs.set('missionEvidence/report',{campaignId:'C',missionId:child,uploadedBy:'member'});
 await f.manage('coord',{missionId:root,action:'deactivate',reason:'Evento cancelado'});
 for(const uid of ['head','member','part']) assert.equal(f.docs.get('misiones/'+f.find(uid)).active,false);
 assert(f.docs.has('missionEvidence/report'));
 assert.equal((await f.manage('coord',{missionId:root,action:'deactivate',reason:'retry'})).affected,0);
 await assert.rejects(f.create('head',['member2'],'after',root),{code:'permission-denied'});
});
test('New deadline validates, inherits and rejects new delegation after expiry',async()=>{
 const f=fixture();
 await assert.rejects(f.call('coord',{requestId:'bad',assigneeIds:['head'],title:'x',deadlineAt:'yesterday'}),{code:'invalid-argument'});
 await assert.rejects(f.call('coord',{requestId:'past',assigneeIds:['head'],title:'x',deadlineAt:'2020-01-01T00:00:00.000Z'}),{code:'invalid-argument'});
 const due=new Date(Date.now()+86400000).toISOString();
 await f.call('coord',{requestId:'ok',assigneeIds:['head'],title:'x',deadlineAt:due});
 assert.equal(f.docs.get('misiones/'+f.find('head')).deadlineAt,due);
 f.docs.get('missionLinks/'+f.find('head')).content.deadlineAt='2020-01-01T00:00:00.000Z';
 await assert.rejects(f.create('head',['member'],'late',f.find('head')),{code:'failed-precondition'});
});

function leaderFixture(){const f=fixture();f.user('leader','lider_principal',null,{municipalityId:'',structureId:''});f.docs.set('principalLeaders/C',{uid:'leader'});return f;}
const leaderData=(extra={})=>({requestId:'leader-root',assigneeIds:['coord'],title:'Actividad',deadlineAt:new Date(Date.now()+86400000).toISOString(),...extra});
test('registered leader assigns coordinator without changing parent; retry and full chain',async()=>{
 const f=leaderFixture(),data=leaderData();await f.call('leader',data);await f.call('leader',data);
 assert.equal(f.docs.get('usuarios/coord').parentUserId,'admin');
 assert.equal([...f.docs.keys()].filter(k=>k.startsWith('misiones/')).length,1);
 await f.create('coord',['head'],'delegate-head',f.find('coord'));
 await f.create('head',['member'],'delegate-member',f.find('head'));
 await f.create('member',['part'],'delegate-part',f.find('member'));
 const r=await f.progress('leader',f.find('coord'));assert.equal(r.total,4);
});
test('leader cannot skip levels, cross campaign, use inactive recipient or omit deadline',async()=>{
 const f=leaderFixture();await assert.rejects(f.call('leader',leaderData({assigneeIds:['member']})),{code:'permission-denied'});
 f.user('foreign','coordinador_municipal','admin',{campaignId:'OTHER'});
 await assert.rejects(f.call('leader',leaderData({assigneeIds:['coord','foreign']})),{code:'permission-denied'});
 assert.equal([...f.docs.keys()].filter(k=>k.startsWith('misiones/')).length,0);
 f.docs.get('usuarios/coord').active=false;
 await assert.rejects(f.call('leader',leaderData()),{code:'permission-denied'});
 await assert.rejects(f.call('leader',leaderData({deadlineAt:null})),{code:'invalid-argument'});
});
test('leader role without singleton cannot assign, count, inspect or manage missions',async()=>{
 const f=leaderFixture();f.docs.set('principalLeaders/C',{uid:'other'});
 await assert.rejects(f.call('leader',leaderData()),{code:'permission-denied'});
 await assert.rejects(f.total('leader'),{code:'permission-denied'});
 await assert.rejects(f.progress('leader','m'),{code:'permission-denied'});
 await assert.rejects(f.manage('leader',{missionId:'m',action:'deactivate',reason:'Prueba'}),{code:'permission-denied'});
});

test('leader list enforces identity and exposes only own campaign assignments and active coordinators',async()=>{
 const f=leaderFixture();await assert.rejects(f.list(null),{code:'unauthenticated'});await assert.rejects(f.list('coord'),{code:'permission-denied'});await assert.rejects(f.list('admin'),{code:'permission-denied'});
 f.user('foreign','coordinador_municipal','admin',{campaignId:'OTHER'});f.user('inactive','coordinador_municipal','admin',{active:false});
 await f.call('leader',leaderData());await f.create('admin',['coord'],'admin-root');
 f.docs.set('misiones/foreign',{createdBy:'leader',campaignId:'OTHER',assignedToRole:'coordinador_municipal',linkedVersion:1});
 const r=await f.list('leader');assert.equal(r.coordinators.length,1);assert.equal(r.coordinators[0].uid,'coord');assert.equal(r.missions.length,1);
 f.docs.set('principalLeaders/C',{uid:'other'});await assert.rejects(f.list('leader'),{code:'permission-denied'});
});
