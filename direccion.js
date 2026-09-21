import {auth,db} from './firebase-config.js';
import {onAuthStateChanged,signOut} from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js';
import {doc,getDoc} from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';
import {getFunctions,httpsCallable} from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js';
const $=id=>document.getElementById(id);
const functions=getFunctions(auth.app,'us-central1');
const fetchPanel=httpsCallable(functions,'getPrincipalLeaderPanel');
const assign=httpsCallable(functions,'assignPrincipalLeader');
const listAdminCampaigns=httpsCallable(functions,'listAdminCampaigns');
const createCoordinator=httpsCallable(functions,'createMunicipalCoordinator');

let epoch=0;
let currentRole='';
let currentPanelCampaignId='';
let selectedMunicipalityId='';
let selectedMunicipalityName='';
function line(parent,text){const p=document.createElement('p');p.textContent=text;parent.append(p);}
async function loadAdminCampaigns(){
 const assignmentSelect=$('campaignId');
 const panelSelect=$('panelCampaignId');

 assignmentSelect.replaceChildren();
 panelSelect.replaceChildren();

 assignmentSelect.disabled=true;
 panelSelect.disabled=true;
 $('save').disabled=true;

 $('campaignStatus').textContent='Consultando campañas autorizadas…';
 $('panelCampaignStatus').textContent='Consultando campañas autorizadas…';

 const {data}=await listAdminCampaigns();
 const campaigns=Array.isArray(data?.campaigns)?data.campaigns:[];

 for(const campaign of campaigns){
  const text=`${campaign.name} · ${campaign.campaignId}`;

  const assignmentOption=document.createElement('option');
  assignmentOption.value=campaign.campaignId;
  assignmentOption.textContent=text;
  assignmentSelect.append(assignmentOption);

  const panelOption=document.createElement('option');
  panelOption.value=campaign.campaignId;
  panelOption.textContent=text;
  panelSelect.append(panelOption);
 }

 const requestedDefault=
  data?.selectedCampaignId &&
  campaigns.some(c=>c.campaignId===data.selectedCampaignId)
   ? data.selectedCampaignId
   : campaigns[0]?.campaignId||'';

 if(requestedDefault){
  assignmentSelect.value=requestedDefault;
  panelSelect.value=requestedDefault;
  currentPanelCampaignId=requestedDefault;
 }

 const available=campaigns.length>0;

 assignmentSelect.disabled=!available;
 panelSelect.disabled=!available;
 $('save').disabled=!available;

 $('campaignStatus').textContent=available
  ? `Campañas disponibles: ${campaigns.length}. Selecciona dónde se asignará el Líder principal.`
  : 'No hay campañas activas autorizadas para esta cuenta.';

 $('panelCampaignStatus').textContent=available
  ? `Supervisando ${currentPanelCampaignId}. Cambiar esta selección no modifica la campaña destino al asignar un Líder principal.`
  : 'No hay campañas activas autorizadas para supervisar.';

 return available;
}
async function refresh(){
 const version=epoch;
 $('refresh').disabled=true;
 $('municipalities').replaceChildren();
 $('coverage').textContent='';
 $('unmatched').textContent='';
 $('status').textContent='Consultando campaña…';

 const payload=
  currentRole==='admin' && currentPanelCampaignId
   ? {campaignId:currentPanelCampaignId}
   : {};

 try{
  const {data}=await fetchPanel(payload);
  if(version!==epoch)return;

  if(currentRole==='admin'){
   currentPanelCampaignId=data.campaignId||currentPanelCampaignId;
   if($('panelCampaignId').value!==currentPanelCampaignId){
    $('panelCampaignId').value=currentPanelCampaignId;
   }
   $('panelCampaignStatus').textContent=`Supervisando ${currentPanelCampaignId}. Cambiar esta selección no modifica la campaña destino al asignar un Líder principal.`;
  }

 $('session').textContent=data.name;
 $('coverage').textContent=`Municipios registrados: ${data.municipalities.length}. Objetivo de cobertura: 20 municipios de Nayarit.`;
 $('unmatched').textContent=[data.unassignedMissions?`${data.unassignedMissions} misiones sin destinatario individual; no se incluyen en el avance municipal.`:'',data.unmatchedMissions?`${data.unmatchedMissions} asignaciones con destinatario no se pudieron asociar a un municipio registrado; no están incluidas en las tarjetas.`:''].filter(Boolean).join(' ');
 for(const m of data.municipalities){
 const card=document.createElement('article');
 const h=document.createElement('h2');
 h.textContent=m.municipalityCode
   ? `${m.municipalityCode} · ${m.name}`
   : m.name;
 card.append(h);

 line(card,`${m.active?'Activo':'Inactivo'} · Estructuras: ${m.structures}`);

 const activeCoordinator=m.coordinators.some(c=>c.active===true);

 line(
   card,
   m.coordinators.length
     ? 'Coordinadores: '+m.coordinators.map(c=>c.name+(c.active?'':' (inactivo)')).join(', ')
     : 'Sin coordinador registrado'
 );

 line(card,`Asignaciones: ${m.total} · Con evidencia: ${m.withEvidence} · Sin evidencia: ${m.withoutEvidence}`);
 line(card,'Avance reportado: '+(m.percentage===null?'Sin asignaciones':m.percentage+'%'));

 if(
   currentRole==='lider_principal' &&
   m.active===true &&
   !activeCoordinator
 ){
   const button=document.createElement('button');
   button.type='button';
   button.textContent='Registrar coordinador';
   button.onclick=()=>openCoordinatorRegistration(m);
   card.append(button);
 }

 $('municipalities').append(card);
}
 $('status').textContent='Actualizado: '+new Date(data.calculatedAt).toLocaleString('es-MX');
 }catch(e){if(version===epoch)$('status').textContent=e.message||'No fue posible consultar el panel.';}finally{if(version===epoch)$('refresh').disabled=false;}
}
$('refresh').onclick=refresh;
$('logout').onclick=()=>signOut(auth);

$('panelCampaignId').onchange=async()=>{
 if(currentRole!=='admin')return;
 const campaignId=$('panelCampaignId').value.trim();
 if(!campaignId)return;

 currentPanelCampaignId=campaignId;
 $('panelCampaignStatus').textContent=`Cambiando panel a ${campaignId}…`;

 await refresh();
};
onAuthStateChanged(auth,async user=>{const version=++epoch;$('municipalities').replaceChildren();$('setup').hidden=true;$('leaderMissions').hidden=true;$('leaderEvents').hidden=true;$('refresh').disabled=true;
 if(!user){location.replace('./login.html');return;}
 try{const p=(await getDoc(doc(db,'usuarios',user.uid))).data();if(version!==epoch)return;if(!p||p.active!==true||!['admin','lider_principal'].includes(p.role))throw Error('Acceso reservado al Líder principal y administrador.');currentRole=p.role;currentPanelCampaignId='';$('setup').hidden=p.role!=='admin';$('panelCampaignControl').hidden=p.role!=='admin';$('leaderMissions').hidden=p.role!=='lider_principal';$('leaderEvents').hidden=p.role!=='lider_principal';if(p.role==='admin'){const available=await loadAdminCampaigns();if(!available){$('status').textContent='No hay campañas activas autorizadas para esta cuenta.';return;}}await refresh();}catch(e){$('status').textContent=e.message;}
});
$('assign').onsubmit=async e=>{e.preventDefault();const campaignId=$('campaignId').value.trim();if(!campaignId){$('assignmentStatus').textContent='Selecciona la campaña donde se asignará al Líder principal.';return;}$('save').disabled=true;try{await assign({campaignId,uid:$('uid').value.trim(),name:$('name').value.trim()});$('assignmentStatus').textContent=`Líder asignado correctamente en ${campaignId}. Puede entrar con su cuenta desde el acceso habitual.`;$('assign').reset();$('campaignId').value=campaignId;}catch(e){$('assignmentStatus').textContent=e.message;}finally{$('save').disabled=!$('campaignId').value;}};


function normalizeWelcomePhone(value){
 const digits=String(value||'').replace(/\D/g,'');

 if(/^52\d{10}$/.test(digits)){
   return digits;
 }

 if(/^\d{10}$/.test(digits)){
   return '52'+digits;
 }

 return '';
}

function showCoordinatorWelcome(user){
 const name=String(user?.name||'Coordinador municipal').trim();
 const email=String(user?.email||'').trim();
 const municipality=String(
   user?.municipalityName||
   selectedMunicipalityName||
   ''
 ).trim();

 const whatsappNumber=
   normalizeWelcomePhone(user?.phone);

 const hasWhatsApp=
   user?.hasWhatsApp === true;

 const text=[
   'TERRA CAMPAIGN · Bienvenida',
   '',
   `Hola, ${name}.`,
   '',
   `Has sido registrado como Coordinador municipal${municipality?' de '+municipality:''}.`,
   '',
   'Tu acceso a TERRA CAMPAIGN ya está habilitado.',
   '',
   'Usuario:',
   email,
   '',
   'Ingresa aquí:',
   'https://terra-campaign.github.io/terra-core/login.html',
   '',
   'Por seguridad, tu contraseña temporal no se comparte en este mensaje.',
   'Recíbela por separado del responsable que realizó tu registro.',
   '',
   'Bienvenido al equipo territorial.'
 ].join('\n');

 $('welcomeRecipient').textContent=
   'Destinatario: '+name;

 $('welcomePhone').textContent=
   whatsappNumber
     ? 'Teléfono: +'+whatsappNumber
     : 'Teléfono registrado no disponible o inválido.';

 $('welcomeMessage').value=text;

 const updateLinks=()=>{
   const message=$('welcomeMessage').value;

   $('welcomeManual').href=
     'https://wa.me/?text='+
     encodeURIComponent(message);

   if(hasWhatsApp && whatsappNumber){
     $('welcomeDirect').hidden=false;
     $('welcomeDirect').textContent=
       'Abrir WhatsApp con '+name;
     $('welcomeDirect').href=
       'https://wa.me/'+
       whatsappNumber+
       '?text='+
       encodeURIComponent(message);
   }else{
     $('welcomeDirect').hidden=true;
     $('welcomeDirect').removeAttribute('href');
   }
 };

 $('welcomeMessage').oninput=updateLinks;

 updateLinks();

 $('coordinatorWelcome').hidden=false;
}

function openCoordinatorRegistration(municipality){
 selectedMunicipalityId=municipality.id;
 selectedMunicipalityName=municipality.name;

 $('selectedMunicipality').textContent=
   'Municipio: '+selectedMunicipalityName;

 $('coordinatorStatus').textContent='';
 $('coordinatorForm').reset();
 $('coordinatorWelcome').hidden=true;
 $('welcomeMessage').value='';
 $('coordinatorRegistration').hidden=false;

 $('coordinatorRegistration').scrollIntoView({
   behavior:'smooth',
   block:'start'
 });

 $('coordinatorName').focus();
}

$('cancelCoordinator').onclick=()=>{
 selectedMunicipalityId='';
 selectedMunicipalityName='';
 $('coordinatorRegistration').hidden=true;
 $('coordinatorWelcome').hidden=true;
 $('coordinatorForm').reset();
 $('welcomeMessage').value='';
 $('coordinatorStatus').textContent='';
};

$('coordinatorForm').onsubmit=async event=>{
 event.preventDefault();

 if(currentRole!=='lider_principal'){
   $('coordinatorStatus').textContent=
     'Solo el Líder principal puede usar este formulario.';
   return;
 }

 if(!selectedMunicipalityId){
   $('coordinatorStatus').textContent=
     'Selecciona un municipio.';
   return;
 }

 const name=$('coordinatorName').value.trim().replace(/\s+/g,' ');
 const email=$('coordinatorEmail').value.trim().toLowerCase();
 const phone=$('coordinatorPhone').value.trim();

 const hasWhatsApp=
   $('coordinatorWhatsAppYes').checked
     ? true
     : $('coordinatorWhatsAppNo').checked
       ? false
       : null;

 const password=$('coordinatorPassword').value;

 if(hasWhatsApp===null){
   $('coordinatorStatus').textContent=
     'Indica si este número tiene WhatsApp.';
   return;
 }

 if(hasWhatsApp===true && !phone){
   $('coordinatorStatus').textContent=
     'Si seleccionas WhatsApp: Sí, debes registrar un teléfono.';
   return;
 }

 $('saveCoordinator').disabled=true;
 $('coordinatorStatus').textContent=
   'Registrando coordinador municipal…';

 try{
   const {data}=await createCoordinator({
     name,
     email,
     phone,
     hasWhatsApp,
     password,
     municipalityId:selectedMunicipalityId
   });

   const createdUser=data?.user||{
     name,
     email,
     phone,
     hasWhatsApp,
     municipalityName:selectedMunicipalityName,
     mustChangePassword:true
   };

   $('coordinatorStatus').textContent=
     (createdUser.name||name)+' registrado correctamente.';

   $('coordinatorForm').reset();

   showCoordinatorWelcome(createdUser);

   await refresh();

 }catch(error){
   $('coordinatorStatus').textContent=
     error?.message||'No fue posible registrar al coordinador.';
 }finally{
   $('saveCoordinator').disabled=false;
 }
};
