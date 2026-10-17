'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const team=read('estructura.html');
const teamJs=read('estructura.js');
const scores=read('puntuaciones-estructura.html');
const scoresJs=read('puntuaciones-estructura.js');
const core=read('functions/structure-scoreboard-core.cjs');

test('dos pantallas: equipo sin ranking y puntuaciones con lista',()=>{
  assert.match(team,/id="structureNavigation"/);
  assert.match(team,/id="structureScoresShortcut"/);
  assert.doesNotMatch(team,/id="structureScoreboard"/);
  assert.match(scores,/id="structureScoreboard"/);
  assert.match(scores,/id="teamShortcut"/);
  assert.match(scores,/id="teamShortcutTop"/);
  assert.match(teamJs,/puntuaciones-estructura\.html\?id=/);
  assert.match(scoresJs,/\.\/estructura\.html\?id=/);
});
test('ambas listas unen nombre y población solo si está registrada',()=>{
  const fn=teamJs.match(/function structureNameWithLocality\(name, locality\) \{[\s\S]+?\n\}/)?.[0];
  assert.ok(fn,'helper no encontrado');
  const scope={escapeHtml:value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')};
  vm.runInNewContext(fn+'\nthis.structureNameWithLocality=structureNameWithLocality;',scope);
  assert.equal(scope.structureNameWithLocality('Ana','Zacualpan'),'Ana — Zacualpan');
  assert.equal(scope.structureNameWithLocality('Ana',''),'Ana');
  assert.equal(scope.structureNameWithLocality('Ana','  '),'Ana');
  assert.equal(scope.structureNameWithLocality('<Ana>','<Lugar>'),'&lt;Ana&gt; — &lt;Lugar&gt;');
  assert.match(teamJs,/structureNameWithLocality\(chief.name, chief.locality\)/);
  assert.match(teamJs,/structureNameWithLocality\(member.name, member.locality\)/);
  assert.match(core,/locality:clean\(person.locality\)/);
  assert.match(scoresJs,/name\+\(locality\?" — "\+locality:""\)/);
});
test('puntuaciones consulta función existente sin puntos paralelos',()=>{
  assert.match(scoresJs,/httpsCallable\(getFunctions\(undefined,"us-central1"\),"getStructureScoreboard"\)/);
  assert.doesNotMatch(scoresJs,/contributionLedger|setDoc|updateDoc|addDoc/);
  assert.match(scoresJs,/\.\/persona\.html\?id=/);
  assert.match(scoresJs,/https:\/\/wa\.me\//);
  assert.match(scoresJs,/role !== "jefe_estructura"/);
  assert.match(scoresJs,/auth\.currentUser\?\.uid/);
  assert.match(teamJs,/currentUserProfile\?\.role === "jefe_estructura"/);
  assert.match(teamJs,/currentStructure\?\.id === currentUserProfile\?\.structureId/);
});
test('ranking paginado y búsqueda local; conserva detalles',()=>{
  assert.match(scoresJs,/const PAGE_SIZE=50/);
  assert.match(scoresJs,/filtered\.slice\(page\*PAGE_SIZE/);
  assert.match(scoresJs,/row.locality/);
  assert.match(scoresJs,/row.parentName/);
  assert.match(scoresJs,/row.introducedByName/);
  assert.match(scoresJs,/row.contributions/);
  assert.match(scoresJs,/row.whatsAppNumber/);
  assert.match(scoresJs,/resetSensitiveData\(\)/);
});
test('los nombres de población no se inventan a partir del municipio',()=>{
  const coreMod=require(path.join(root,'functions/structure-scoreboard-core.cjs'));
  const base={campaignId:'CAM-001',personId:'P-A',role:'integrante',parentPersonId:null,municipalityName:'COMPOSTELA'};
  const summary=()=>({contribution:{historical:{points:0,contributionCount:0,byDimension:{}}}});
  const make=person=>coreMod.projectRows({members:[base],personsById:new Map([['P-A',person]]),
    ledgerByPerson:new Map([['P-A',[]]]),nameById:new Map(),campaignId:'CAM-001',buildPerformanceSummaryProjection:summary})[0];
  assert.equal(make({name:'Luis',campaignId:'CAM-001',active:true,locality:'ZACUALPAN'}).locality,'ZACUALPAN');
  assert.equal(make({name:'Luis',campaignId:'CAM-001',active:true}).locality,'');
  assert.equal(make({name:'Luis',campaignId:'CAM-001',active:true}).municipality,'COMPOSTELA');
});
