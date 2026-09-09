import {auth} from './firebase-config.js';
import {onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js';
import {getFunctions,httpsCallable} from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js';
const $=id=>document.getElementById(id);
const functions=getFunctions(auth.app,'us-central1');
const list=httpsCallable(functions,'getPrincipalLeaderMissions');
const create=httpsCallable(functions,'createLinkedMissions');
const progress=httpsCallable(functions,'getMissionBranchProgress');
const node=(tag,text)=>{const e=document.createElement(tag);e.textContent=text;return e;};
let generation=0,coordinators=[],attempt=null,busy=false;
async function reload(){
 const g=generation,uid=auth.currentUser?.uid;if(!uid)return;
 $('refresh').disabled=true;$('status').textContent='Consultando misiones…';
 try{const {data}=await list({});if(g!==generation)return;
 coordinators=data.coordinators;$('session').textContent=data.name;$('workspace').hidden=false;
 const selected=new Set([...$('people').querySelectorAll('input:checked')].map(e=>e.value));
 $('people').replaceChildren();
 for(const p of coordinators){const label=node('label','');const check=document.createElement('input');check.type='checkbox';check.value=p.uid;check.checked=selected.has(p.uid);label.append(check,document.createTextNode(` ${p.name} · ${p.municipalityId||'Sin municipio registrado'}`));$('people').append(label);}
 if(!coordinators.length)$('people').append(node('p','No hay coordinadores municipales activos.'));
 $('missions').replaceChildren();
 for(const m of data.missions){const card=node('article','');card.append(node('h3',m.title),node('p','Asignada a: '+m.assignedToName),node('p',m.description),node('p','Lugar: '+(m.locality||'Sin especificar')),node('p','Límite: '+(m.deadlineAt?new Date(m.deadlineAt).toLocaleString('es-MX'):'Sin fecha')),node('p',!m.active?'Inactiva':m.deadlineAt&&Date.parse(m.deadlineAt)<=Date.now()?'Vencida':'Activa'));
 const wa=node('button','Comunicar misión por WhatsApp');wa.classList.add('button-whatsapp');wa.onclick=()=>communicate(m);card.append(wa);
 const advance=node('button','Ver avance');const output=node('p','');advance.onclick=async()=>{advance.disabled=true;try{const {data:r}=await progress({missionId:m.id});if(g!==generation)return;output.textContent=`Asignaciones en la cadena: ${r.total} · Con evidencia: ${r.withEvidence} · Sin evidencia: ${r.withoutEvidence}. La evidencia no certifica validación.`;}catch(e){output.textContent=e.message;}finally{advance.disabled=false;}};card.append(advance,output);$('missions').append(card);}
 if(!data.missions.length)$('missions').append(node('p','Aún no has asignado misiones.'));
 $('status').textContent='Misiones actualizadas.';
 await import('./mission-review-ui.js?v=lider-002');
 }catch(e){if(g===generation)$('status').textContent=e.message;}finally{if(g===generation)$('refresh').disabled=false;}
}
function communicate(m){const p=coordinators.find(p=>p.uid===m.assignedTo);$('recipient').textContent='Destinatario: '+m.assignedToName;$('phone').value=p?.phone||'';
 const link=new URL('./login.html',location.href);link.searchParams.set('mission',m.id);
 $('message').value=`Hola, ${m.assignedToName}. Tienes una misión en TERRA Campaign:\n\n${m.title}\n${m.description}\nLugar: ${m.locality||'Consulta las instrucciones'}\nFecha límite: ${m.deadlineAt?new Date(m.deadlineAt).toLocaleString('es-MX'):'Consulta la plataforma'}\nEstado: ${!m.active?'Inactiva':m.deadlineAt&&Date.parse(m.deadlineAt)<=Date.now()?'Vencida':'Activa'}\n\nConsulta la misión y registra tu evidencia con tu cuenta:\n${link.href}`;
 $('communicationStatus').textContent='';$('communication').hidden=false;$('communication').scrollIntoView({behavior:'smooth'});
}
$('send').onclick=()=>{const phone=$('phone').value.replace(/[\s()+.-]/g,'');if(!/^[1-9]\d{7,14}$/.test(phone)){$('communicationStatus').textContent='Escribe el número completo con código de país, o elige el contacto en WhatsApp.';return;}window.open('https://wa.me/'+phone+'?text='+encodeURIComponent($('message').value),'_blank','noopener,noreferrer');};
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
onAuthStateChanged(auth,user=>{generation++;coordinators=[];attempt=null;$('workspace').hidden=true;$('missions').replaceChildren();$('people').replaceChildren();$('communication').hidden=true;if(!user){location.replace('./login.html');return;}reload();});
