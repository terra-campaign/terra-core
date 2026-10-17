// BUILD-20F: clasificación en pantalla independiente. Solo lectura.
// getStructureScoreboard mantiene la autorización del lado del servidor.
import {auth,db} from "./firebase-config.js";
import {onAuthStateChanged,signOut} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {doc,getDoc} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import {getFunctions,httpsCallable} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js";

const searchParams=new URLSearchParams(window.location.search);
const structureDocumentId=String(searchParams.get("id")||"").trim();
const $=id=>document.getElementById(id);
const rowsNode=$("scoreboardRows"),statusNode=$("scoreboardStatus");
const searchNode=$("scoreboardSearch"),refreshNode=$("scoreboardRefresh");
const paginationNode=$("scoreboardPagination"),prevNode=$("scoreboardPrev"),nextNode=$("scoreboardNext");
const callable=httpsCallable(getFunctions(undefined,"us-central1"),"getStructureScoreboard");
const PAGE_SIZE=50;
let session=0,profile=null,cache=[],page=0;
const text=value=>typeof value==="string"?value.trim():"";
const el=(tag,value,cls="")=>{
  const item=document.createElement(tag);
  if(value!==undefined && value!==null)item.textContent=String(value);
  if(cls)item.className=cls;
  return item;
};
const field=(label,value)=>{
  const box=el("div");
  box.append(el("small",label),el("strong",value));
  return box;
};
function resetSensitiveData(){
  cache=[];profile=null;page=0;
  rowsNode.replaceChildren();searchNode.value="";
  searchNode.disabled=true;refreshNode.disabled=true;
  paginationNode.hidden=true;
  for(const id of ["teamShortcut","teamShortcutTop"])$(id).hidden=true;
}
function render(){
  const query=text(searchNode.value).toLocaleLowerCase("es");
  const filtered=cache.filter(row=>
    [row.name,row.locality,row.roleLabel].join(" ").toLocaleLowerCase("es").includes(query)
  );
  const totalPages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
  if(page>=totalPages)page=totalPages-1;
  rowsNode.replaceChildren();
  if(!filtered.length){
    rowsNode.append(el("p",query?"No hay coincidencias.":"No hay integrantes activos registrados.","muted"));
  }
  for(const row of filtered.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE)){
    const details=el("details",null,"scoreboard-entry");
    const summary=el("summary");
    const title=el("span",null,"scoreboard-title");
    const name=text(row.name);
    const locality=text(row.locality);
    title.append(el("strong",name+(locality?" — "+locality:"")),
      el("small",text(row.roleLabel)+(row.municipality?" · "+row.municipality:"")));
    summary.append(el("span",String(row.position)+".","scoreboard-position"),
      title,el("span",String(row.points)+" puntos","scoreboard-points"));
    const body=el("div",null,"scoreboard-detail");
    const meta=el("div",null,"scoreboard-meta");
    meta.append(field("Superior directo",text(row.parentName)||"No registrado"),
      field("Quién lo incorporó",text(row.introducedByName)||"No registrado"),
      field("Contribuciones verificadas",String(row.contributions)),
      field("Cuenta digital",row.hasDigitalAccount?"Sí":"No"));
    body.append(meta);
    const actions=el("div",null,"scoreboard-actions");
    const profileLink=el("a","Ver perfil","button button--secondary button--small");
    profileLink.href="./persona.html?id="+encodeURIComponent(row.personId);
    actions.append(profileLink);
    if(/^52\d{10}$/.test(row.whatsAppNumber||"")){
      const wa=el("a","WhatsApp · "+name,"button button--small scoreboard-wa");
      const sender=text(profile?.name)||"tu responsable";
      const message="Hola, "+name+". Soy "+sender+". Me gustaría conversar contigo sobre tu actividad registrada en TERRA Campaign. ¿Tienes un momento?";
      wa.href="https://wa.me/"+row.whatsAppNumber+"?text="+encodeURIComponent(message);
      wa.target="_blank";wa.rel="noopener noreferrer";
      wa.title="Preparar mensaje para "+name+" (no se envía automáticamente)";
      actions.append(wa);
    }else actions.append(el("span","WhatsApp no disponible · contactar por otro medio","scoreboard-unavailable"));
    body.append(actions);details.append(summary,body);rowsNode.append(details);
  }
  paginationNode.hidden=filtered.length<=PAGE_SIZE;
  prevNode.disabled=page===0;
  nextNode.disabled=page>=totalPages-1;
  $("scoreboardPageInfo").textContent="Página "+(page+1)+" de "+totalPages+" · "+filtered.length+" personas";
}
async function fetchRanking(){
  const requestSession=session;
  const actor=auth.currentUser;
  if(!actor||!profile)return;
  refreshNode.disabled=true;
  statusNode.textContent="Consultando puntuaciones verificadas...";
  try{
    const {data}=await callable({structureDocumentId});
    if(requestSession!==session||auth.currentUser?.uid!==actor.uid)return;
    if(!data?.ok||!Array.isArray(data.rows))throw new Error("Respuesta incompleta.");
    cache=data.rows;page=0;
    for(const id of ["teamShortcut","teamShortcutTop"]){
      $(id).href="./estructura.html?id="+encodeURIComponent(structureDocumentId);
      $(id).hidden=false;
    }
    searchNode.disabled=false;
    $("scoreboardTitle").textContent="Puntuaciones · "+(text(data.structureName)||"Mi estructura");
    statusNode.textContent=cache.length+" personas · Mayor a menor puntuación · Datos verificados por TERRA";
    render();
  }catch(error){
    if(requestSession!==session||auth.currentUser?.uid!==actor.uid)return;
    cache=[];rowsNode.replaceChildren();paginationNode.hidden=true;
    statusNode.textContent="No fue posible cargar la clasificación. "+(text(error?.message)||"Vuelve a intentar.");
  }finally{
    if(requestSession===session)refreshNode.disabled=false;
  }
}
searchNode.addEventListener("input",()=>{page=0;render();});
refreshNode.addEventListener("click",()=>void fetchRanking());
prevNode.addEventListener("click",()=>{if(page>0){page--;render();}});
nextNode.addEventListener("click",()=>{page++;render();});
$("logoutButton").addEventListener("click",async()=>{
  resetSensitiveData();await signOut(auth);window.location.replace("./login.html");
});
onAuthStateChanged(auth,async user=>{
  const run=++session;resetSensitiveData();
  if(!user){window.location.replace("./login.html");return;}
  if(!/^[A-Za-z0-9_-]{1,128}$/.test(structureDocumentId)){
    statusNode.textContent="No se especificó una estructura válida.";return;
  }
  try{
    const snap=await getDoc(doc(db,"usuarios",user.uid));
    if(run!==session||auth.currentUser?.uid!==user.uid)return;
    const p=snap.exists()?snap.data():null;
    if(p?.active!==true||p.role !== "jefe_estructura"||!p.campaignId||!p.structureId){
      statusNode.textContent="No tienes autorización para consultar este ranking.";return;
    }
    profile=p;
    // El servidor valida que la estructura solicitada sea la propia.
    await fetchRanking();
  }catch(error){
    if(run!==session)return;
    statusNode.textContent="No fue posible comprobar tu acceso. "+(text(error?.message)||"");
  }
});
