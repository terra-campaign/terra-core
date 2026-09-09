import {renderMap,clearMap} from './direccion-mapa.js?v=lider-004';
import {auth} from './firebase-config.js';
import {onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js';
import {getFunctions,httpsCallable} from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js';
const $=id=>document.getElementById(id),call=httpsCallable(getFunctions(auth.app,'us-central1'),'getPrincipalLeaderTerritory');
const node=(tag,value)=>{const n=document.createElement(tag);n.textContent=value;return n;};let generation=0;
async function reload(){const g=++generation;clearMap();$('workspace').hidden=true;$('refresh').disabled=true;$('clear').disabled=true;$('status').textContent='Consultando actividad…';try{
 const {data:d}=await call({from:$('from').value,to:$('to').value,locality:$('locality').value});if(g!==generation)return;
 $('session').textContent=d.name;const selected=$('locality').value;$('locality').replaceChildren(new Option('Todas',''),...d.localities.map(l=>new Option(l,l)));$('locality').value=selected;
 $('metrics').replaceChildren();for(const [label,value] of [['Visitas registradas',d.visits],['Domicilios identificados',d.identifiedHomes],['Visitas con volante',d.flyerVisits],['Personas con actividad',d.activeReporters]]){const card=node('article',label);card.append(node('strong',value));$('metrics').append(card);}
 for(const [id,rows,field] of [['zones',d.zones,'name'],['daily',d.daily,'date']]){$(id).replaceChildren();for(const r of rows){const tr=document.createElement('tr');tr.append(node('td',r[field]),node('td',r.visits));$(id).append(tr);}if(!rows.length){const tr=document.createElement('tr'),td=node('td','Sin registros para estos filtros.');td.colSpan=2;tr.append(td);$(id).append(tr);}}
 $('quality').textContent=`En la selección: ${d.unknownAddress} visitas sin dirección/localidad suficiente para deduplicar; ${d.unknownDate} sin fecha válida. En toda la campaña: ${d.undatedTotal} sin fecha válida (se excluyen al filtrar por fecha).`;
 $('workspace').hidden=false;renderMap(d.points||[],d.withoutLocation??d.visits);$('status').textContent='Actualizado: '+new Date(d.calculatedAt).toLocaleString('es-MX');
 }catch(e){if(g===generation)$('status').textContent=e.message+' Recarga la página para reintentar.';}finally{if(g===generation){$('refresh').disabled=false;$('clear').disabled=false;}}}
$('filters').onsubmit=e=>{e.preventDefault();reload();};$('clear').onclick=()=>{$('filters').reset();reload();};
onAuthStateChanged(auth,user=>{generation++;clearMap();$('workspace').hidden=true;$('session').textContent='';if(!user){location.replace('./login.html');return;}reload();});
