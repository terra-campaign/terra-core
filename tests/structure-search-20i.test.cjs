'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = process.env.TERRA_20I_ROOT || path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root,name), 'utf8');
const helper = read('structure-member-search.js');
const teamHtml = read('estructura.html');
const teamJs = read('estructura.js');
const scoreHtml = read('puntuaciones-estructura.html');
const scoreJs = read('puntuaciones-estructura.js');
const scoreCss = read('puntuaciones-estructura.css');
let modulePromise;
function loadHelper() {
  if (!modulePromise) modulePromise=import('data:text/javascript;base64,' + Buffer.from(helper).toString('base64'));
  return modulePromise;
}
const people = [
 {name:'ZULEMA LIZANDI REGALADO',locality:''},
 {name:'Eduardo Silva Camacho',locality:'Zacualpan'},
 {name:'Lucía Pérez',locality:'La Peñita de Jaltemba'},
 {name:'Manuel Silva',locality:'COMPOSTELA'},
];
test('filtra por nombre sin distinguir mayúsculas ni espacios sobrantes',async()=>{
 const {filterStructureMembers}=await loadHelper();
 assert.deepEqual(filterStructureMembers(people,' zUlEmA '),[people[0]]);
 assert.deepEqual(filterStructureMembers(people,'Eduardo  Silva'),[people[1]]);
});
test('filtra poblaciones y tolera acentos en ambos sentidos',async()=>{
 const {filterStructureMembers}=await loadHelper();
 assert.deepEqual(filterStructureMembers(people,'penita'),[people[2]]);
 assert.deepEqual(filterStructureMembers(people,'PEÑITA'),[people[2]]);
 assert.deepEqual(filterStructureMembers(people,'zacualpan'),[people[1]]);
});
test('admite palabras de nombre y población combinadas',async()=>{
 const {filterStructureMembers}=await loadHelper();
 assert.deepEqual(filterStructureMembers(people,'camacho zacualpan'),[people[1]]);
 assert.deepEqual(filterStructureMembers(people,'manuel Compostela'),[people[3]]);
});
test('vacío conserva el orden original y el cero resultados es lista vacía',async()=>{
 const {filterStructureMembers}=await loadHelper();
 assert.deepEqual(filterStructureMembers(people,''),people);
 assert.deepEqual(filterStructureMembers(people,'  '),people);
 assert.deepEqual(filterStructureMembers(people,'no existe'),[]);
 assert.deepEqual(filterStructureMembers(null,'zulema'),[]);
});
test('Equipo agrega controles con etiqueta, limpiar y estado accesible',()=>{
 for (const id of ['memberSearchControls','memberSearchInput','memberSearchClear','memberSearchCount','memberList'])
  assert.match(teamHtml,new RegExp('id="'+id+'"'));
 assert.match(teamHtml,/label for="memberSearchInput"[^>]*>Buscar integrante por nombre o población/);
 assert.match(teamHtml,/id="memberSearchCount"[^>]*role="status"[\s\S]*?aria-live="polite"/);
 assert.match(teamHtml,/id="memberSearchControls"[^>]*hidden/);
 assert.match(teamHtml,/id="memberSearchInput"[^>]*type="search"[\s\S]*disabled/);
 assert.match(teamHtml,/estructura\.js\?v=build-20i-001/);
});
test('Equipo filtra lista autorizada ya recibida sin escribir en Firebase',()=>{
 assert.match(teamJs,/filterStructureMembers\(currentMembers, searchText\)/);
 assert.match(teamJs,/filteredMembers\s*\.map\(/);
 assert.match(teamJs,/memberSearchInput\?\.addEventListener\("input"/);
 assert.match(teamJs,/memberSearchClear\?\.addEventListener\("click"/);
 assert.match(teamJs,/memberSearchInput\.value\s*=\s*""/);
 assert.match(teamJs,/No hay coincidencias con ese nombre o población/);
 assert.match(teamJs,/filteredMembers\.length \+ " de " \+ currentMembers\.length/);
 assert.match(teamJs,/currentUserProfile\?\.role !== "jefe_estructura"/);
});
test('Equipo oculta resultados del usuario anterior en cambio de sesión',()=>{
 assert.match(teamJs,/async \(user\) => \{\s*currentMembers = \[\];/);
 assert.match(teamJs,/memberList\.replaceChildren\(\)/);
 assert.match(teamJs,/stopStructureUsersListener\(\)/);
 assert.match(teamJs,/memberSearchControls\.hidden = true/);
 assert.match(teamJs,/memberSearchInput\.disabled = true/);
});
test('Equipo restringe filtro visible a jefe de estructura y mantiene nombres escapados',()=>{
 assert.match(teamJs,/if \(memberSearchControls\) memberSearchControls\.hidden = false/);
 assert.match(teamJs,/currentUserProfile\.role ===\s*"coordinador_municipal"[\s\S]*?memberSearchControls\.hidden = true/);
 assert.match(teamJs,/structureNameWithLocality\(member.name, member.locality\)/);
});
test('Puntuaciones mueve el único buscador a la barra de navegación',()=>{
 assert.equal((scoreHtml.match(/id="scoreboardSearch"/g)||[]).length,1);
 const nav=scoreHtml.match(/<nav[\s\S]*?<\/nav>/)?.[0];
 assert.ok(nav?.includes('id="scoreboardSearch"'));
 assert.match(nav,/score-page-search/);
 assert.match(scoreCss,/\.score-page-search\{margin-left:auto/);
 assert.match(scoreCss,/@media\(max-width:750px\)/);
 assert.match(scoreHtml,/puntuaciones-estructura\.css\?v=build-20i-001/);
 assert.match(scoreHtml,/puntuaciones-estructura\.js\?v=build-20i-001/);
});
test('Puntuaciones conserva cálculo, orden, límite y autorización existentes',()=>{
 assert.match(scoreJs,/getStructureScoreboard/);
 assert.match(scoreJs,/const PAGE_SIZE=50/);
 assert.match(scoreJs,/cache\.filter/);
 assert.match(scoreJs,/normalizeStructureSearch\(\[row\.name,row\.locality,row\.roleLabel\]/);
 assert.match(scoreJs,/filtered\.slice\(page\*PAGE_SIZE/);
 assert.match(scoreJs,/row\.parentName/);
 assert.match(scoreJs,/row\.introducedByName/);
 assert.match(scoreJs,/row\.whatsAppNumber/);
 assert.match(scoreJs,/row\.points/);
 assert.match(scoreJs,/p\?\.active!==true\|\|p\.role !== "jefe_estructura"/);
 assert.doesNotMatch(scoreJs,/setDoc|updateDoc|addDoc/);
});
test('Nueva funcionalidad no introduce consultas adicionales ni modifica backend',()=>{
 assert.doesNotMatch(helper,/firebase|fetch\(|httpsCallable|setDoc|updateDoc/);
 assert.match(scoreJs,/structure-member-search\.js\?v=build-20i-001/);
 assert.match(teamJs,/structure-member-search\.js\?v=build-20i-001/);
});
