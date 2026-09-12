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

const galleryStyle=el('style');galleryStyle.textContent=`
.review-gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,180px));gap:12px;margin:16px 0}
.review-gallery button{margin:0;padding:8px;width:100%;background:#edf3f7;color:#17324d;border:1px solid #c5d5e2;border-radius:8px;cursor:zoom-in}
.review-gallery img{width:100%;height:130px;object-fit:contain;display:block;background:white;border-radius:4px}
.review-gallery span{display:block;padding-top:8px}
.review-gallery button:focus-visible,.review-viewer button:focus-visible{outline:3px solid #267cb5;outline-offset:3px}
.review-viewer{box-sizing:border-box;width:min(960px,94vw);max-height:94vh;padding:16px;border:0;border-radius:12px;background:white;color:#17324d}
.review-viewer::backdrop{background:rgba(0,0,0,.78)}
.review-viewer img{display:block;width:100%;height:70vh;object-fit:contain;background:#edf3f7}
.review-viewer button{padding:12px 16px;min-height:44px;background:#164a70;color:white;border:0;border-radius:8px;cursor:pointer}
.review-viewer p{margin:0 0 12px;font-weight:600}
.review-status{margin:16px 0;padding:14px 16px;border:2px solid #cbd5e1;border-radius:10px;background:#f8fafc}
.review-status strong{display:block;font-size:1.05rem;margin-bottom:6px}
.review-status p{margin:0}
.review-status--validated{background:#ecfdf3;border-color:#138a4b;color:#0d5c34}
.review-status--rejected{background:#fff1f2;border-color:#c83b4a;color:#8f1f2d}
.review-status--correction_requested{background:#fff8e6;border-color:#d98a12;color:#7a4a00}
.review-status--pending{background:#eef5fb;border-color:#5a8db5;color:#17324d}
.review-form-title{margin:20px 0 8px}
`;document.head.append(galleryStyle);
const viewer=el('dialog');viewer.className='review-viewer';viewer.setAttribute('aria-label','Fotografía de evidencia ampliada');
const viewerCaption=el('p'),viewerImage=el('img'),closeViewer=el('button','Cerrar fotografía');closeViewer.type='button';
viewer.append(viewerCaption,viewerImage,closeViewer);document.body.append(viewer);
closeViewer.onclick=()=>viewer.close();
viewer.addEventListener('click',event=>{if(event.target===viewer){const r=viewer.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)viewer.close();}});
viewer.addEventListener('close',()=>{viewerImage.removeAttribute('src');viewerImage.alt='';});
function showPhoto(url,index,total){viewerCaption.textContent=`Fotografía ${index+1} de ${total}`;viewerImage.alt=`Evidencia original, fotografía ${index+1}`;viewerImage.src=url;viewer.showModal();}

let generation=0,urls=[],current=null,busy=false;
const date=x=>x?new Date(x).toLocaleString('es-MX'):'Sin fecha';
function clear(){if(viewer.open)viewer.close();viewerImage.removeAttribute('src');generation++;urls.forEach(URL.revokeObjectURL);urls=[];detail.replaceChildren();current=null;}
async function reload(){
  const uid=auth.currentUser?.uid;if(!uid)return;
  clear();const token=generation;window.dispatchEvent(new CustomEvent('terra-review-summary',{detail:{uid,loading:true}}));refresh.disabled=true;message.textContent='Consultando revisiones...';rows.replaceChildren();
  try {
    const {data}=await list({});if(token!==generation||auth.currentUser?.uid!==uid)return;
    window.dispatchEvent(new CustomEvent('terra-review-summary',{detail:{uid,pending:data.items.filter(i=>i.status==='pending').length,validated:data.items.filter(i=>i.status==='validated').length,rejected:data.items.filter(i=>i.status==='rejected').length,correction:data.items.filter(i=>i.status==='correction_requested').length}}));
    message.textContent=data.items.length?'':'No hay reportes disponibles para revisión en tus asignaciones vinculadas.';
    for(const item of data.items){
      const row=el('article');row.style.cssText='padding:12px 0;border-bottom:1px solid #dbe3eb';
      row.append(el('strong',item.title),el('p',`${item.name} · ${labels[item.status]}${item.pendingAppeal?' · Revisión superior solicitada':''}`));
      const button=el('button',item.canResolve?'Revisar solicitud':item.canDecide?'Revisar reporte':'Ver decisión');button.type='button';button.className='button button--secondary';
      button.onclick=()=>open(item.evidenceId);row.append(button);rows.append(row);
    }
  }catch(error){if(token!==generation||auth.currentUser?.uid!==uid)return;window.dispatchEvent(new CustomEvent('terra-review-summary',{detail:{uid,error:true}}));message.textContent=error.message || 'No fue posible cargar las revisiones.';}
  finally{refresh.disabled=false;}
}

function addDecisionCommunication(d,evidenceId,token,uid){
  if(!d.imageViaCallable || !['validated','rejected','correction_requested'].includes(d.review?.status))return;
  const box=el('div'),prepare=el('button','Comunicar decisión por WhatsApp'),status=el('p'),content=el('div');
  prepare.type='button';prepare.className='button-whatsapp';status.setAttribute('role','status');box.append(prepare,status,content);detail.append(box);
  prepare.onclick=async()=>{
    prepare.disabled=true;content.replaceChildren();status.textContent='Consultando la decisión guardada…';
    try{
      const {data:fresh}=await get({evidenceId});
      if(token!==generation||auth.currentUser?.uid!==uid)return;
      if(!fresh.imageViaCallable)throw new Error('Actualiza el reporte para consultar las acciones disponibles.');
      const decision=(fresh.history||[]).find(h=>['decide','resolve'].includes(h.action));
      if(!decision || decision.status!==fresh.review?.status)throw new Error('No hay una decisión con motivo disponible para comunicar.');
      const link=new URL('./login.html',location.href);link.searchParams.set('mission',fresh.missionId);
      const text=['TERRA CAMPAIGN · Revisión de reporte',`Misión: ${fresh.title}`,`Reportó: ${fresh.reportedByName||fresh.uploadedByName||'Sin nombre'}`,`Resultado: ${labels[decision.status]}`,`Motivo: ${decision.reason}`,`Decisión registrada: ${date(decision.at)}`,fresh.review.pendingAppeal?'Hay una solicitud de revisión superior pendiente.':'', 'Consulta el estado actual en TERRA:',link.href].filter(Boolean).join('\n');
      const label=el('label','Mensaje preparado'),preview=el('textarea');preview.readOnly=true;preview.rows=9;preview.value=text;preview.style.cssText='display:block;width:100%;box-sizing:border-box';label.append(preview);

      const recipientName=fresh.reportedByName||fresh.uploadedByName||'Sin nombre';
      const rawPhone=String(fresh.reportedByPhone||'').trim();
      const digits=rawPhone.replace(/\D/g,'');
      let whatsappNumber='';

      if(/^52\d{10}$/.test(digits)) whatsappNumber=digits;
      else if(/^\d{10}$/.test(digits)) whatsappNumber='52'+digits;

      const recipient=el('p',`Destinatario: ${recipientName}`);
      const phoneInfo=el('p',whatsappNumber?`Teléfono: +${whatsappNumber}`:'Teléfono registrado no disponible o inválido.');

      const actions=el('div');

      if(whatsappNumber){
        const direct=el('a',`Abrir WhatsApp con ${recipientName}`);
        direct.href='https://wa.me/'+whatsappNumber+'?text='+encodeURIComponent(text);
        direct.target='_blank';
        direct.rel='noopener noreferrer';
        direct.style.cssText='display:inline-block;background:#25D366;color:#073b21;padding:12px 16px;border-radius:8px;font-weight:600;text-decoration:none;margin:10px 10px 10px 0';
        actions.append(direct);
      }

      const choose=el('a',whatsappNumber?'Elegir otro contacto en WhatsApp':'Elegir contacto en WhatsApp');
      choose.href='https://wa.me/?text='+encodeURIComponent(text);
      choose.target='_blank';
      choose.rel='noopener noreferrer';
      choose.style.cssText='display:inline-block;background:#25D366;color:#073b21;padding:12px 16px;border-radius:8px;font-weight:600;text-decoration:none;margin:10px 0';
      actions.append(choose);

      content.append(
        recipient,
        phoneInfo,
        label,
        actions,
        el('p',whatsappNumber
          ?'TERRA preparó el destinatario registrado. Revisa el número y confirma el envío en WhatsApp. También puedes elegir otro contacto manualmente.'
          :'No hay un teléfono mexicano válido registrado para este usuario. Puedes elegir el contacto manualmente en WhatsApp.')
      );
      status.textContent='Mensaje listo con la decisión guardada. Si cambia la revisión, vuelve a preparar el mensaje.';
    }catch(error){if(token===generation&&auth.currentUser?.uid===uid)status.textContent=error.message||'No fue posible preparar el mensaje.';}
    finally{prepare.disabled=false;}
  };
}

async function open(evidenceId){
  clear();const token=generation,uid=auth.currentUser?.uid;if(!uid)return;
  detail.append(el('p','Cargando reporte...'));
  try{
    const {data:d}=await get({evidenceId});if(token!==generation||auth.currentUser?.uid!==uid)return;
    current=d;detail.replaceChildren();detail.style.cssText='padding:16px 0;overflow-wrap:anywhere';
    detail.append(el('h3',d.title),el('p',`Reportó: ${d.reportedByName || d.uploadedByName}`),el('p',`Entregado: ${date(d.submittedAt)}`),el('p',d.description || 'Sin nota'));
    const photoBox=el('div');photoBox.className='review-gallery';detail.append(el('h4','Fotografías de evidencia'),el('p',d.imagePaths.length?'Pulsa una fotografía para ampliarla. Cierra con el botón o la tecla Esc.':'Este reporte no contiene fotografías.'),photoBox);
    const currentStatus=d.review?.status || 'pending';

    const statusBox=el('div');
    statusBox.className=`review-status review-status--${currentStatus}`;

    statusBox.append(
      el('strong',`Estado actual: ${labels[currentStatus]}`)
    );

    let statusHelp='Este reporte todavía no tiene una decisión registrada.';

    if(d.review?.pendingAppeal){
      statusHelp='La decisión ya está registrada y existe una revisión superior pendiente.';
    }else if(d.review && d.canDecide){
      statusHelp=`Esta entrega ya tiene una decisión registrada. Puedes modificarla hasta ${date(d.review.reconsiderUntil)}.`;
    }else if(d.review && d.canRequest){
      statusHelp='Terminó el plazo para modificar directamente esta decisión. Puedes solicitar una revisión superior.';
    }else if(d.review && d.canResolve){
      statusHelp='Existe una solicitud de revisión superior pendiente de resolver.';
    }else if(d.review){
      statusHelp='La decisión ya está registrada y no puede modificarse desde tu nivel actual.';
    }

    statusBox.append(
      el('p',statusHelp)
    );

    detail.append(statusBox);

    if(d.review){
      detail.append(
        el(
          'p',
          `Reconsideración hasta: ${date(d.review.reconsiderUntil)}. El plazo no se reinicia.`
        )
      );

      if(d.review.pendingAppeal){
        detail.append(
          el(
            'p',
            'Solicitud pendiente de revisión por el superior.'
          )
        );
      }
    }

    const form=el('form');

    const formTitle=el(
      'h4',
      d.canResolve
        ? 'Resolver revisión superior'
        : d.canRequest && !d.canDecide
          ? 'Solicitar revisión superior'
          : d.review
            ? 'Modificar decisión'
            : 'Registrar decisión'
    );

    formTitle.className='review-form-title';

    const selectLabel=el('label','Decisión ');
    const select=el('select');

    for(const status of ['validated','rejected','correction_requested']){
      const o=el('option',labels[status]);
      o.value=status;
      select.append(o);
    }

    if(
      d.review?.status &&
      ['validated','rejected','correction_requested'].includes(
        d.review.status
      )
    ){
      select.value=d.review.status;
    }

    selectLabel.append(select);

    const reasonLabel=el('label','Motivo obligatorio ');
    const reason=el('textarea');

    reason.maxLength=1000;
    reason.required=true;
    reason.rows=3;
    reason.style.cssText='display:block;width:100%;box-sizing:border-box';

    reasonLabel.append(reason);

    const hint=el(
      'p',
      'Solicitar corrección registra lo que falta; esta entrega no habilita la edición de evidencia ni nuevas cargas fuera de plazo.'
    );

    const feedback=el('p');
    feedback.setAttribute('role','status');

    form.append(
      formTitle,
      selectLabel,
      reasonLabel,
      hint,
      feedback
    );

    const buttons=[];

    const decisionButtonLabel=
      d.review
        ? 'Actualizar decisión'
        : 'Guardar decisión';

    for(const [action,enabled,label] of [
      ['decide',d.canDecide,decisionButtonLabel],
      ['request',d.canRequest,'Solicitar revisión superior'],
      ['resolve',d.canResolve,'Resolver revisión superior']
    ]){
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
        if(Date.now()+offset>=d.review.reconsiderUntil){buttons.forEach(b=>b.disabled=true);feedback.textContent='Terminó el plazo de reconsideración. Actualiza para consultar las acciones disponibles.';clearInterval(timer);}
      },1000);
    }
    const history=el('details');history.append(el('summary','Historial de decisiones (últimas 30)'));
    for(const h of d.history)history.append(el('p',`${date(h.at)} · ${h.actorName} · ${h.action==='request'?'Solicitó revisión superior':`${labels[h.previousStatus]} → ${labels[h.status]}`} · ${h.reason}`));
    detail.append(history);addDecisionCommunication(d,evidenceId,token,uid);detail.scrollIntoView({behavior:'smooth',block:'start'});
    for(const [index,path] of d.imagePaths.entries()){
      try{let blob;
        if(d.canResolve || d.imageViaCallable){const {data:image}=await getImage({evidenceId,index});blob=new Blob([Uint8Array.from(atob(image.base64),c=>c.charCodeAt(0))],{type:image.contentType});}
        else blob=await getBlob(ref(storage,path),8*1024*1024);if(token!==generation||auth.currentUser?.uid!==uid)return;
        const url=URL.createObjectURL(blob);urls.push(url);const img=el('img');img.alt=`Evidencia, fotografía ${index+1}`;img.src=url;
        const thumbnail=el('button');thumbnail.type='button';thumbnail.setAttribute('aria-label',`Ampliar fotografía ${index+1} de ${d.imagePaths.length}`);thumbnail.append(img,el('span',`Foto ${index+1} · Ampliar`));thumbnail.onclick=()=>showPhoto(url,index,d.imagePaths.length);photoBox.append(thumbnail);
        img.onerror=()=>{thumbnail.replaceWith(el('p',`No se pudo mostrar la fotografía ${index+1}.`));};
      }catch{if(token===generation)photoBox.append(el('p','No se pudo cargar una fotografía con tu permiso actual.'));}
    }
  }catch(error){if(token===generation)detail.replaceChildren(el('p',error.message || 'Reporte no disponible.'));}
}
refresh.onclick=reload;
onAuthStateChanged(auth,user=>{clear();rows.replaceChildren();panel.hidden=!user;if(user)reload();});
window.addEventListener('pagehide',clear);
