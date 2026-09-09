import {auth,db} from './firebase-config.js';
import {onAuthStateChanged,signOut} from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js';
import {doc,getDoc} from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';
import {getFunctions,httpsCallable} from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js';
const $=id=>document.getElementById(id);
const functions=getFunctions(auth.app,'us-central1');
const fetchPanel=httpsCallable(functions,'getPrincipalLeaderPanel');
const assign=httpsCallable(functions,'assignPrincipalLeader');
let epoch=0;
function line(parent,text){const p=document.createElement('p');p.textContent=text;parent.append(p);}
async function refresh(){
 const version=epoch; $('refresh').disabled=true;$('municipalities').replaceChildren();$('coverage').textContent='';$('unmatched').textContent='';$('status').textContent='Consultando campaña…';
 try{const {data}=await fetchPanel();if(version!==epoch)return;
 $('session').textContent=data.name;
 $('coverage').textContent=`Municipios registrados: ${data.municipalities.length}. Objetivo de cobertura: 20 municipios de Nayarit.`;
 $('unmatched').textContent=data.unmatchedMissions?`${data.unmatchedMissions} asignaciones no se pudieron asociar a un municipio registrado; no están incluidas en las tarjetas.`:'';
 for(const m of data.municipalities){const card=document.createElement('article');const h=document.createElement('h2');h.textContent=m.name;card.append(h);line(card,`${m.id} · ${m.active?'Activo':'Inactivo'} · Estructuras: ${m.structures}`);
 line(card,m.coordinators.length?'Coordinadores: '+m.coordinators.map(c=>c.name+(c.active?'':' (inactivo)')).join(', '):'Sin coordinador registrado');
 line(card,`Asignaciones: ${m.total} · Con evidencia: ${m.withEvidence} · Sin evidencia: ${m.withoutEvidence}`);line(card,'Avance reportado: '+(m.percentage===null?'Sin asignaciones':m.percentage+'%'));$('municipalities').append(card);}
 $('status').textContent='Actualizado: '+new Date(data.calculatedAt).toLocaleString('es-MX');
 }catch(e){if(version===epoch)$('status').textContent=e.message||'No fue posible consultar el panel.';}finally{if(version===epoch)$('refresh').disabled=false;}
}
$('refresh').onclick=refresh;$('logout').onclick=()=>signOut(auth);
onAuthStateChanged(auth,async user=>{const version=++epoch;$('municipalities').replaceChildren();$('setup').hidden=true;$('refresh').disabled=true;
 if(!user){location.replace('./login.html');return;}
 try{const p=(await getDoc(doc(db,'usuarios',user.uid))).data();if(version!==epoch)return;if(!p||p.active!==true||!['admin','lider_principal'].includes(p.role))throw Error('Acceso reservado al Líder principal y administrador.');$('setup').hidden=p.role!=='admin';await refresh();}catch(e){$('status').textContent=e.message;}
});
$('assign').onsubmit=async e=>{e.preventDefault();$('save').disabled=true;try{await assign({uid:$('uid').value.trim(),name:$('name').value.trim()});$('assignmentStatus').textContent='Líder asignado. Puede entrar con su cuenta desde el acceso habitual.';$('assign').reset();}catch(e){$('assignmentStatus').textContent=e.message;}finally{$('save').disabled=false;}};
