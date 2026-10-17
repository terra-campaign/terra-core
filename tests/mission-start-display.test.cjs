'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const here = process.env.TERRA_19R_TARGET || path.resolve(__dirname, "..");
const text = name => fs.readFileSync(path.join(here,name),'utf8');
const helperData = 'data:text/javascript;base64,'+Buffer.from(text('mission-start-display.js')).toString('base64');
const get = async () => (await import(helperData)).missionStartDisplay;

test('Mision antigua sin startAt no inventa hora',async()=>{
 const fmt=await get();
 assert.equal(fmt({missionDate:'2026-10-16',deadlineAt:'2026-10-17T22:00:00Z'}),'Hora de inicio no registrada');
});
test('Falso inicio ausente no se deduce de creacion',async()=>{
 const fmt=await get();
 assert.equal(fmt({createdAt:{toDate:()=>new Date('2026-10-16T19:00:00Z')}}),'Hora de inicio no registrada');
});
test('Mazatlan convierte hora UTC al horario del lugar',async()=>{
 const fmt=await get();
 const rendered=fmt({startAt:'2026-10-20T19:00:00.000Z',startTimeZone:'America/Mazatlan'});
 assert.match(rendered,/20/);
 assert.match(rendered,/12:00/);
 assert.match(rendered,/Mazatlan/);
});
test('Zona horaria altera la hora sin alterar el instante',async()=>{
 const fmt=await get();
 const date='2026-10-20T19:00:00Z';
 const maz=fmt({startAt:date,startTimeZone:'America/Mazatlan'});
 const mexico=fmt({startAt:date,startTimeZone:'America/Mexico_City'});
 assert.match(maz,/12:00/);
 assert.match(mexico,/1:00/);
});
test('Firestore Timestamp toDate se acepta',async()=>{
 const fmt=await get();
 const rendered=fmt({startAt:{toDate:()=>new Date('2026-10-20T19:00:00Z')},startTimeZone:'America/Mazatlan'});
 assert.match(rendered,/12:00/);
});
test('Firestore Timestamp seconds se acepta',async()=>{
 const fmt=await get();
 const rendered=fmt({startAt:{seconds:Date.parse('2026-10-20T19:00:00Z')/1000,nanoseconds:0},startTimeZone:'America/Mazatlan'});
 assert.match(rendered,/12:00/);
});
test('Fechas sin zona horaria explícita no se interpretan silenciosamente',async()=>{
 const fmt=await get();
 assert.match(fmt({startAt:'2026-10-20T12:00',startTimeZone:'America/Mazatlan'}),/no verificables/);
});
test('startAt inválido no inventa hora',async()=>{
 const fmt=await get();
 assert.match(fmt({startAt:'imposible',missionDate:'2026-10-16'}),/no verificables/);
});
test('Sin zona de misión se usa UTC con aviso claro',async()=>{
 const fmt=await get();
 const rendered=fmt({startAt:'2026-10-20T19:00:00Z'});
 assert.match(rendered,/7:00/);
 assert.match(rendered,/UTC; zona de la mision no registrada/);
});
test('Zona horaria inválida no causa caída de interfaz',async()=>{
 const fmt=await get();
 assert.match(fmt({startAt:'2026-10-20T19:00:00Z',startTimeZone:'Mars\/Phobos'}),/Zona horaria de inicio no verificable/);
});
test('Listado presenta inicio, conserva vencimiento y escapa salida',()=>{
 const src=text('misiones.js');
 assert.match(src,/Inicio programado:/);
 assert.match(src,/escapeHtml\(missionStartDisplay\(mission\)\)/);
 assert.match(src,/deadlineText\(mission\)/);
 assert.match(src,/mission-start-display\.js\?v=19r-01/);
});
test('Detalle incorpora nodo visible y lo actualiza desde Firestore',()=>{
 const html=text('mision.html'),js=text('mision.js');
 assert.match(html,/id="missionStartAt"/);
 assert.match(js,/missionStartAtElement\.textContent\s*=\s*missionStartDisplay\(currentMission\)/);
 assert.match(html,/mision\.js\?v=build-19r-horario-20261016-01/);
});
test('Las dos páginas cargan módulos nuevos sin modificar revisión',()=>{
 const misiones=text('misiones.html');
 assert.match(misiones,/misiones\.js\?v=build-19r-horario-20261016-01/);
 for(const file of ['mision.html','misiones.html']) assert.match(text(file),/mission-review-ui\.js\?v=build-19m-alert-20261016-01/);
});
