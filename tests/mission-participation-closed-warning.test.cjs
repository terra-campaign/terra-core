'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = process.env.TERRA_19V_ROOT || path.resolve(__dirname,'../..');
const js = fs.readFileSync(path.join(root,'mission-participation-ui.js'),'utf8');
const html = fs.readFileSync(path.join(root,'mision.html'),'utf8');
const match = js.match(/function render\(\) \{[\s\S]*?\n\}\n\nasync function refresh/);
assert.ok(match,'No se encuentra render de participacion');
const renderSource = match[0].slice(0, -'\n\nasync function refresh'.length);

function element(){
 const classes=new Set();
 return {
  textContent:'',disabled:false,hidden:false,style:{},
  classList:{toggle(name,enabled){if(enabled)classes.add(name);else classes.delete(name);},contains(name){return classes.has(name);}}
 };
}
function execute({canChange,status='NO_RESPONSE',startAt='2026-10-16T19:00:00Z'}){
 const statusEl=element(), accept=element(), decline=element(), whatsappButton=element();
 const recoverButton=element(), feedback=element();
 const ctx={
  state:{canChange,status,startAt},statusEl,accept,decline,whatsappButton,recoverButton,feedback,
  saving:false,preparingWhatsApp:false,currentUid:'ficticio',
  localStorage:{getItem:()=>null},key:()=> 'p',
  disable(){accept.disabled=true;decline.disabled=true;whatsappButton.disabled=true;},
  describeParticipation(s){
   return {label:s.status==='NO_RESPONSE'?'Sin respuesta':s.status==='ACCEPTED'?'Aceptó participar':'No podrá participar',
    explanation:s.canChange?'Puedes cambiar tu decisión hasta una hora antes del inicio.':
      'El plazo para responder o cambiar tu decisión ha terminado.',
    acceptEnabled:s.canChange&&s.status!=='ACCEPTED',
    declineEnabled:s.canChange&&s.status!=='DECLINED'};
  }
 };
 vm.runInNewContext(renderSource+'\nrender();',ctx);
 return {statusEl,accept,decline,whatsappButton};
}

test('cerrado: se resalta la advertencia, incluye explicacion y bloquea botones',()=>{
 const r=execute({canChange:false});
 assert.equal(r.statusEl.classList.contains('terra-participation-status--closed'),true);
 assert.match(r.statusEl.textContent,/Confirmación cerrada/);
 assert.match(r.statusEl.textContent,/Sin respuesta/);
 assert.match(r.statusEl.textContent,/plazo independiente/);
 assert.equal(r.accept.disabled,true);assert.equal(r.decline.disabled,true);
 assert.equal(r.accept.classList.contains('terra-participation-button--closed'),true);
});

test('abierto: se conserva el texto ordinario y la posibilidad de responder',()=>{
 const r=execute({canChange:true});
 assert.equal(r.statusEl.classList.contains('terra-participation-status--closed'),false);
 assert.match(r.statusEl.textContent,/Tu respuesta: Sin respuesta/);
 assert.doesNotMatch(r.statusEl.textContent,/Confirmación cerrada/);
 assert.equal(r.accept.disabled,false);assert.equal(r.decline.disabled,false);
});

test('respuesta previamente aceptada, cerrada: aviso sin eliminar comunicacion existente',()=>{
 const r=execute({canChange:false,status:'ACCEPTED'});
 assert.match(r.statusEl.textContent,/Aceptó participar/);
 assert.equal(r.accept.disabled,true);assert.equal(r.decline.disabled,true);
 assert.equal(r.whatsappButton.disabled,false);
});

test('sin horario disponible: no habilita respuestas ni inventa plazos',()=>{
 const r=execute({canChange:false,startAt:null});
 assert.equal(r.accept.disabled,true);assert.equal(r.decline.disabled,true);
 assert.equal(r.statusEl.classList.contains('terra-participation-status--closed'),false);
  assert.match(r.statusEl.textContent,/Sin respuesta/);
});

test('estilo visible, legible, sin cambiar CSS global ni las reglas del backend',()=>{
 assert.match(html,/id="terra-participation-deadline-style-19v"/);
 assert.match(html,/#missionParticipationStatus\.terra-participation-status--closed/);
 assert.match(html,/background:\s*#fff7ed/);
 assert.match(html,/border-left:\s*4px solid #ea580c/);
 assert.match(html,/#missionParticipationSection \.terra-participation-button--closed:disabled/);
 assert.match(html,/mission-participation-ui\.js\?v=19v-cierre-visible-001/);
});

test('el formulario de evidencias y la hora de inicio quedan en la pantalla',()=>{
 assert.match(html,/id="evidenceForm"/);
 assert.match(html,/id="missionStartAt"/);
 assert.match(html,/id="missionParticipationStatus"/);
 assert.match(js,/"recordMissionParticipationResponse"/);
});
