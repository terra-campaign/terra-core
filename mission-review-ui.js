import {auth,storage} from './firebase-config.js';
import {onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js';
import {getFunctions,httpsCallable} from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js';
import {getBlob,ref} from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-storage.js';
const functions = getFunctions(auth.app,'us-central1');
const list = httpsCallable(functions,'listMissionReviews');
const get = httpsCallable(functions,'getMissionReview');
const getImage = httpsCallable(functions,'getMissionReviewImage');
const decide = httpsCallable(functions,'decideMissionReview');
const labels = {pending:'Pendiente de validar',validated:'Validado',rejected:'Rechazado',correction_requested:'Corrección solicitada'};
const el = (tag,text) => {const n=document.createElement(tag);if(text)n.textContent=text;return n;};
const panel=el('section');panel.className='card';panel.hidden=true;
const title=el('h2','Revisión de reportes');
const help=el('p','Consulta tus reportes y revisa los de tu nivel inmediato. Las decisiones conservan su historial.');
const refresh=el('button','Actualizar revisiones');refresh.type='button';refresh.className='button button--secondary';
const message=el('p');message.setAttribute('role','status');
const rows=el('div'),detail=el('div');
panel.append(title,help,refresh,message,rows,detail);
document.querySelector('main').append(panel);
let generation=0,urls=[],current=null,busy=false;
const date=x=>x?new Date(x).toLocaleString('es-MX'):'Sin fecha';
function clear(){generation++;urls.forEach(URL.revokeObjectURL);urls=[];detail.replaceChildren();current=null;}
async function reload(){
  const uid=auth.currentUser?.uid;if(!uid)return;
  clear();const token=generation;refresh.disabled=true;message.textContent='Consultando revisiones...';rows.replaceChildren();
  try {
    const {data}=await list({});if(token!==generation||auth.currentUser?.uid!==uid)return;
    message.textContent=data.items.length?'':'No hay reportes disponibles para revisión en tus asignaciones vinculadas.';
    for(const item of data.items){
      const row=el('article');row.style.cssText='padding:12px 0;border-bottom:1px solid #dbe3eb';
      row.append(el('strong',item.title),el('p',`${item.name} · ${labels[item.status]}${item.pendingAppeal?' · Revisión superior solicitada':''}`));
      const button=el('button',item.canResolve?'Revisar solicitud':item.canDecide?'Revisar reporte':'Ver decisión');button.type='button';button.className='button button--secondary';
      button.onclick=()=>open(item.evidenceId);row.append(button);rows.append(row);
    }
  }catch(error){if(token!==generation||auth.currentUser?.uid!==uid)return;message.textContent=error.message || 'No fue posible cargar las revisiones.';}
  finally{refresh.disabled=false;}
}
async function open(evidenceId){
  clear();const token=generation,uid=auth.currentUser?.uid;if(!uid)return;
  detail.append(el('p','Cargando reporte...'));
  try{
    const {data:d}=await get({evidenceId});if(token!==generation||auth.currentUser?.uid!==uid)return;
    current=d;detail.replaceChildren();detail.style.cssText='padding:16px 0;overflow-wrap:anywhere';
    detail.append(el('h3',d.title),el('p',`Reportó: ${d.reportedByName || d.uploadedByName}`),el('p',`Entregado: ${date(d.submittedAt)}`),el('p',d.description || 'Sin nota'));
    const photoBox=el('div');detail.append(photoBox);
    detail.append(el('p',`Decisión: ${labels[d.review?.status || 'pending']}`));
    if(d.review){detail.append(el('p',`Reconsideración hasta: ${date(d.review.reconsiderUntil)}. El plazo no se reinicia.`));
      if(d.review.pendingAppeal)detail.append(el('p','Solicitud pendiente de revisión por el superior.'));
    }
    const form=el('form');
    const selectLabel=el('label','Decisión '),select=el('select');
    for(const status of ['validated','rejected','correction_requested']){const o=el('option',labels[status]);o.value=status;select.append(o);}
    selectLabel.append(select);
    const reasonLabel=el('label','Motivo obligatorio '),reason=el('textarea');reason.maxLength=1000;reason.required=true;reason.rows=3;reason.style.cssText='display:block;width:100%;box-sizing:border-box';reasonLabel.append(reason);
    const hint=el('p','Solicitar corrección registra lo que falta; esta entrega no habilita la edición de evidencia ni nuevas cargas fuera de plazo.');
    const feedback=el('p');feedback.setAttribute('role','status');
    form.append(selectLabel,reasonLabel,hint,feedback);
    const buttons=[];
    for(const [action,enabled,label] of [['decide',d.canDecide,'Guardar decisión'],['request',d.canRequest,'Solicitar revisión superior'],['resolve',d.canResolve,'Resolver revisión superior']]){
      if(!enabled)continue;
      const b=el('button',label);b.type='button';b.className='button';b.style.margin='6px';buttons.push(b);form.append(b);
      b.onclick=async()=>{
        if(busy||!form.reportValidity())return;
        busy=true;buttons.forEach(x=>x.disabled=true);feedback.textContent='Guardando...';
        try{await decide({evidenceId,action,status:select.value,reason:reason.value.trim(),expectedRevision:d.review?.revision || 0,requestId:crypto.randomUUID()});
          if(token===generation&&auth.currentUser?.uid===uid){await reload();if(action!=='resolve')await open(evidenceId);else message.textContent='Revisión superior guardada.';}
        }catch(error){if(token===generation)feedback.textContent=error.message || 'No se pudo guardar. Actualiza para comprobar el estado.';}
        finally{busy=false;buttons.forEach(x=>x.disabled=false);}
      };
    }
    form.onsubmit=e=>e.preventDefault();
    if(buttons.length)detail.append(form);
    if(d.review && d.canDecide){
      const offset=d.serverNow-Date.now();
      const timer=setInterval(()=>{
        if(token!==generation){clearInterval(timer);return;}
        if(Date.now()+offset>=d.review.reconsiderUntil){buttons.forEach(b=>b.disabled=true);feedback.textContent='Terminó el plazo. Actualiza para solicitar revisión superior.';clearInterval(timer);}
      },1000);
    }
    const history=el('details');history.append(el('summary','Historial de decisiones (últimas 30)'));
    for(const h of d.history)history.append(el('p',`${date(h.at)} · ${h.actorName} · ${h.action==='request'?'Solicitó revisión superior':`${labels[h.previousStatus]} → ${labels[h.status]}`} · ${h.reason}`));
    detail.append(history);detail.scrollIntoView({behavior:'smooth',block:'start'});
    for(const [index,path] of d.imagePaths.entries()){
      try{let blob;
        if(d.canResolve){const {data:image}=await getImage({evidenceId,index});blob=new Blob([Uint8Array.from(atob(image.base64),c=>c.charCodeAt(0))],{type:image.contentType});}
        else blob=await getBlob(ref(storage,path),8*1024*1024);if(token!==generation||auth.currentUser?.uid!==uid)return;
        const url=URL.createObjectURL(blob);urls.push(url);const img=el('img');img.alt='Evidencia original';img.src=url;img.style.cssText='max-width:100%;max-height:440px;display:block;margin:10px 0';photoBox.append(img);
      }catch{if(token===generation)photoBox.append(el('p','No se pudo cargar una fotografía con tu permiso actual.'));}
    }
  }catch(error){if(token===generation)detail.replaceChildren(el('p',error.message || 'Reporte no disponible.'));}
}
refresh.onclick=reload;
onAuthStateChanged(auth,user=>{clear();rows.replaceChildren();panel.hidden=!user;if(user)reload();});
window.addEventListener('pagehide',clear);
