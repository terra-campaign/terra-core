import {whatsappPhone} from './whatsapp-phone.js?v=lider-009';
import {missionState,selectMissions,summarizeMissions} from './leader-summary.js?v=lider-005';
import {auth} from './firebase-config.js';
import {onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js';
import {getFunctions,httpsCallable} from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js';
const $=id=>document.getElementById(id);
const functions=getFunctions(auth.app,'us-central1');
const list=httpsCallable(functions,'getPrincipalLeaderMissions');
const create=httpsCallable(functions,'createLinkedMissions');
const progress=httpsCallable(functions,'getMissionBranchProgress');
const lifecycle=httpsCallable(functions,'manageMissionLifecycle');
const node=(tag,text)=>{const e=document.createElement(tag);e.textContent=text;return e;};
let allMissions=[],generation=0,coordinators=[],attempt=null,busy=false;
async function reload(){
 const g=generation,uid=auth.currentUser?.uid;if(!uid)return;
 $('refresh').disabled=true;$('status').textContent='Consultando misiones…';
 try{const {data}=await list({});if(g!==generation)return;
 coordinators=data.coordinators;$('session').textContent=data.name;$('workspace').hidden=false;
 const selected=new Set([...$('people').querySelectorAll('input:checked')].map(e=>e.value));
 $('people').replaceChildren();
 for(const p of coordinators){const label=node('label','');const check=document.createElement('input');check.type='checkbox';check.value=p.uid;check.checked=selected.has(p.uid);label.append(check,document.createTextNode(` ${p.name} · ${p.municipalityId||'Sin municipio registrado'}`));$('people').append(label);}
 if(!coordinators.length)$('people').append(node('p','No hay coordinadores municipales activos.'));
 allMissions=data.missions;populateFilters();renderMissions();
 $('status').textContent='Misiones actualizadas.';
 await import('./mission-review-ui.js?v=build-117d-003');
 }catch(e){if(g===generation)$('status').textContent=e.message;}finally{if(g===generation)$('refresh').disabled=false;}
}

let cancellationBusy=false;
async function cancelMission(m){
 if(cancellationBusy||!m.active)return;
 const reason=window.prompt(`Cancelar: ${m.title}\nAsignada a: ${m.assignedToName}\n\nEscribe el motivo (máximo 500 caracteres):`);
 if(reason===null)return;
 const clean=reason.trim();
 if(!clean||clean.length>500){window.alert('Escribe un motivo de entre 1 y 500 caracteres.');return;}
 if(!window.confirm(`¿Confirmas cancelar «${m.title}» para ${m.assignedToName}?\n\nTambién se cerrarán sus asignaciones delegadas. Se conservarán las evidencias, decisiones e historial. La misión aparecerá como Inactiva.\n\nMotivo: ${clean}`))return;
 const g=generation;cancellationBusy=true;renderMissions();$('communication').hidden=true;$('status').textContent='Cancelando la misión y sus delegaciones…';
 try{
  await lifecycle({missionId:m.id,action:'deactivate',reason:clean});
  if(g!==generation)return;
  m.active=false;renderMissions();await reload();
  if(g===generation)$('status').textContent='Cancelación confirmada. Se conservaron las evidencias y el historial. Consulta la misión con el filtro Inactivas; si aún aparece activa, pulsa Actualizar misiones.';
 }catch(error){if(g===generation)$('status').textContent=(error.message||'No se pudo confirmar la cancelación.')+' Actualiza las misiones para comprobar el estado antes de reintentar.';}
 finally{cancellationBusy=false;if(g===generation)renderMissions();}
}

function communicate(m){const p=coordinators.find(p=>p.uid===m.assignedTo);$('recipient').textContent='Destinatario: '+m.assignedToName;$('phone').value=p?.phone||'';const saved=String(p?.phone||'').replace(/[\s()+.-]/g,'');$('phoneCountry').value=/^(?:\d{10}|52\d{10})$/.test(saved)||!saved?'mx':'international';updatePhonePreview();
 const link=new URL('./login.html',location.href);link.searchParams.set('mission',m.id);
 $('message').value=`Hola, ${m.assignedToName}. Tienes una misión en TERRA Campaign:\n\n${m.title}\n${m.description}\nLugar: ${m.locality||'Consulta las instrucciones'}\nFecha límite: ${m.deadlineAt?new Date(m.deadlineAt).toLocaleString('es-MX'):'Consulta la plataforma'}\nEstado: ${!m.active?'Inactiva':m.deadlineAt&&Date.parse(m.deadlineAt)<=Date.now()?'Vencida':'Activa'}\n\nConsulta la misión y registra tu evidencia con tu cuenta:\n${link.href}`;
 $('communicationStatus').textContent='';$('communication').hidden=false;$('communication').scrollIntoView({behavior:'smooth'});
}
function updatePhonePreview(){
 const mx=$('phoneCountry').value==='mx';$('phoneHelp').textContent=mx?'México: escribe 10 dígitos. Si ya incluye +52, no se duplicará.':'Escribe el número completo con su código de país.';$('phone').placeholder=mx?'Ejemplo: 3221234567':'Ejemplo: +1 202 555 0123';
 try{$('phonePreview').textContent=$('phone').value.trim()?'Se abrirá WhatsApp para: +'+whatsappPhone($('phone').value,$('phoneCountry').value):'';}catch(e){$('phonePreview').textContent=e.message;}
}
$('phone').oninput=updatePhonePreview;$('phoneCountry').onchange=updatePhonePreview;
$('send').onclick=()=>{try{const phone=whatsappPhone($('phone').value,$('phoneCountry').value);$('communicationStatus').textContent='Abriendo WhatsApp para +'+phone;window.open('https://wa.me/'+phone+'?text='+encodeURIComponent($('message').value),'_blank','noopener,noreferrer');}catch(e){$('communicationStatus').textContent=e.message;}};
$('choose').onclick=()=>window.open('https://wa.me/?text='+encodeURIComponent($('message').value),'_blank','noopener,noreferrer');
$('create').onsubmit=async event=>{
 event.preventDefault();if(busy)return;
 const ids=[...$('people').querySelectorAll('input:checked')].map(e=>e.value).sort();
 if(!ids.length||ids.length>50){$('saveStatus').textContent='Selecciona entre 1 y 50 coordinadores.';return;}
 const due=new Date($('deadline').value);if(!Number.isFinite(due.getTime())||due.getTime()<=Date.now()){$('saveStatus').textContent='Elige una fecha límite futura.';return;}
 const payload={assigneeIds:ids,title:$('title').value.trim(),description:$('description').value.trim(),locality:$('locality').value.trim(),deadlineAt:due.toISOString()};
 const fingerprint=JSON.stringify(payload);if(attempt?.fingerprint!==fingerprint)attempt={fingerprint,requestId:crypto.randomUUID()};
 const g=generation;busy=true;$('save').disabled=true;$('saveStatus').textContent='Guardando…';
 try{const {data}=await create({...payload,requestId:attempt.requestId});if(g!==generation)return;attempt=null;$('create').reset();$('saveStatus').textContent=`Guardadas: ${data.created}. Ya existentes: ${data.alreadyAssigned}. Comunica cada misión con su botón de WhatsApp.`;await reload();}
 catch(e){if(g===generation)$('saveStatus').textContent=e.message+' Puedes reintentar sin cambiar los datos.';}finally{busy=false;$('save').disabled=false;}
};
$('refresh').onclick=reload;
onAuthStateChanged(auth,user=>{generation++;allMissions=[];$('missionSummary').replaceChildren();$('reviewSummary').textContent='Reportes: pendientes de consultar.';coordinators=[];attempt=null;$('workspace').hidden=true;$('missions').replaceChildren();$('people').replaceChildren();$('communication').hidden=true;if(!user){location.replace('./login.html');return;}reload();});

function populateFilters(){
 for(const [id,pairs] of [['filterMunicipality',allMissions.map(m=>[m.municipalityId||'__missing',m.municipalityId||'Sin municipio'])],['filterCoordinator',allMissions.map(m=>[m.assignedTo,m.assignedToName])]]){
 const select=$(id),previous=select.value;select.replaceChildren(new Option('Todos',''));
 for(const [value,label] of [...new Map(pairs)].sort((a,b)=>a[1].localeCompare(b[1],'es')))select.append(new Option(label,value));
 if([...select.options].some(o=>o.value===previous))select.value=previous;
 }
}
function renderMissions(){
 const g=generation;
 const visible=selectMissions(allMissions,{municipality:$('filterMunicipality').value,coordinator:$('filterCoordinator').value,state:$('filterState').value});
 const counts=summarizeMissions(visible);$('missionSummary').replaceChildren();
 for(const [label,value] of [['Misiones seleccionadas',visible.length],['Activas',counts.active],['Vencidas',counts.expired],['Inactivas',counts.inactive],['Sin fecha válida',counts.undated]]){const card=node('article',label);card.append(node('strong',value));$('missionSummary').append(card);}
 $('filterStatus').textContent=`Mostrando ${visible.length} de ${allMissions.length} misiones. El municipio corresponde al perfil actual del coordinador.`;
 $('missions').replaceChildren();
 for(const m of visible){const card=node('article','');card.append(node('h3',m.title),node('p','Asignada a: '+m.assignedToName),node('p',m.description),node('p','Lugar: '+(m.locality||'Sin especificar')),node('p','Límite: '+(m.deadlineAt?new Date(m.deadlineAt).toLocaleString('es-MX'):'Sin fecha')),node('p',({active:'Activa',expired:'Vencida',inactive:'Inactiva',undated:'Sin fecha válida'})[missionState(m)]));
 const wa=node('button','Comunicar misión por WhatsApp');wa.classList.add('button-whatsapp');wa.onclick=()=>communicate(m);card.append(wa);
 const advance=node('button','Ver avance');const output=node('p','');advance.onclick=async()=>{advance.disabled=true;try{const {data:r}=await progress({missionId:m.id});if(g!==generation)return;output.textContent=`Asignaciones en la cadena: ${r.total} · Con evidencia: ${r.withEvidence} · Sin evidencia: ${r.withoutEvidence}. La evidencia no certifica validación.`;}catch(e){output.textContent=e.message;}finally{advance.disabled=false;}};card.append(advance,output);if(m.active){const cancel=node('button','Cancelar misión');cancel.type='button';cancel.style.cssText='background:#9b2525;color:white';cancel.disabled=cancellationBusy;cancel.onclick=()=>cancelMission(m);card.append(cancel);}$('missions').append(card);}
 if(!visible.length)$('missions').append(node('p',allMissions.length?'No hay misiones con estos filtros.':'Aún no has asignado misiones.'));

}
for(const id of ['filterMunicipality','filterCoordinator','filterState'])$(id).onchange=()=>{$('communication').hidden=true;renderMissions();};
$('clearFilters').onclick=()=>{for(const id of ['filterMunicipality','filterCoordinator','filterState'])$(id).value='';$('communication').hidden=true;renderMissions();};
window.addEventListener('terra-review-summary',event=>{if(event.detail.uid!==auth.currentUser?.uid)return;const d=event.detail;$('reviewSummary').textContent=d.error?'Reportes: no disponibles. Pulsa Actualizar revisiones.':d.loading?'Consultando reportes…':`Reportes de toda la bandeja: ${d.pending} pendientes · ${d.validated} validados · ${d.rejected} rechazados · ${d.correction} con corrección solicitada.`;});
setInterval(()=>{if(!$('workspace').hidden&&allMissions.length)renderMissions();},60000);
