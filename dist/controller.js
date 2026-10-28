// Ownership concerns input on a shared NUC, never a phone's local match.
const params=new URLSearchParams(location.search);
const localHost=['127.0.0.1','localhost','::1','[::1]'].includes(location.hostname);
const remote=window.DartsAndroid?.isLocalMode?.()!==true&&
 (!!window.DartsAndroid||params.get('remote')==='1'||!localHost);
const tabletShell=window.DartsAndroid?.isTabletShell===true;
const originalFetch=window.fetch.bind(window);
let id;
try{id=sessionStorage.getItem('darts.controller');}catch{}
if(!id){id=Date.now().toString(36)+Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2);try{sessionStorage.setItem('darts.controller',id);}catch{}}
let status=null,claiming=false,refreshing=false,failedAutoClaim=false,lastTabletAutoClaim=0,errorText='';
const button=document.createElement('button');button.id='take-control';button.type='button';
const note=document.createElement('span');note.id='controller-note';note.setAttribute('role','status');
export function canControl(){return !remote||(!refreshing&&status?.owner===id);}
export async function takeControl(){
 if(canControl())return true;
 await claim(true);
 for(let attempt=0;attempt<60&&!canControl();attempt++)await new Promise(resolve=>setTimeout(resolve,100));
 return canControl();
}
function paint(){
 if(!remote)return;
 const own=canControl();
 button.textContent=own?(tabletShell?'Bediening gekoppeld':'Bediening op deze telefoon'):'Bediening overnemen';
 button.disabled=claiming||own;
 note.textContent=errorText||(own?'Scorebediening actief':status?(tabletShell?'Meekijken - bediening via Verbindingsmodus':'Meekijken - bediening via Spelen'):'Bediening controleren...');
 document.body.classList.toggle('controller-viewer',!own);
}
export function updateControl(value){
 if(!remote||!value)return;
 status=value;paint();
 // De dedicated tablet neemt de bediening over zodra Bluetooth of wifi de
 // NUC werkelijk bereikt. Een korte wachttijd voorkomt herhaalde claims.
 if(tabletShell&&status.owner!==id&&!claiming&&Date.now()-lastTabletAutoClaim>5000){lastTabletAutoClaim=Date.now();void claim(true);}
 else if(!status.owner&&!claiming&&!failedAutoClaim)void claim(false);
}
async function claim(takeover){
 if(claiming)return;claiming=true;errorText='';paint();
 try{
  const response=await originalFetch('/api/controller',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,takeover}),signal:AbortSignal.timeout(5000)});
  if(!response.ok)throw Error();
  const data=await response.json();status=data.control;
  if(status?.owner===id){
   // Read the NUC's current match and draft before accepting any new input.
   refreshing=true;
   document.dispatchEvent(new Event('controller-refresh'));
  }
 }catch{failedAutoClaim=true;errorText=tabletShell?'Overname niet bevestigd; probeer opnieuw via Verbindingsmodus.':'Overname niet bevestigd; probeer opnieuw via Spelen.';}
 finally{claiming=false;paint();}
}
export function controllerRefreshed(){refreshing=false;paint();}
if(remote){
 if(tabletShell){
  // Verbindingsmodus haalt deze verborgen houder naar zijn eigen paneel.
  const host=document.createElement('div');host.id='tablet-control-host';host.hidden=true;host.append(button,note);document.body.append(host);
 }else{
  document.getElementById('top-actions').append(button);
  document.getElementById('connection-status').after(note);
 }
 note.style.cssText='display:block;text-align:center;font-size:12px;padding:3px 8px;color:#82d7e6';
 button.onclick=()=>void claim(true);
 paint();
 const protectedPaths=new Set(['/api/autoscoring','/api/autoscoring/apply','/api/state','/api/draft','/api/setup','/api/display','/api/match-transfer','/api/match-restore']);
 window.fetch=async(input,options)=>{
  const url=new URL(typeof input==='string'?input:input.url,location.href);
  if(url.origin===location.origin&&options?.method?.toUpperCase()==='POST'&&protectedPaths.has(url.pathname)){
   const body=JSON.parse(options.body);
   options={...options,body:JSON.stringify({...body,_controller:{id,epoch:status?.epoch??-1}})};
   if(!canControl())return new Response(JSON.stringify({error:'Kies Bediening overnemen.',control:status}),{status:423,headers:{'Content-Type':'application/json'}});
   const response=await originalFetch(input,options);
   if(response.status===423){updateControl((await response.clone().json()).control);document.dispatchEvent(new Event('controller-refresh'));}
   return response;
  }
  return originalFetch(input,options);
 };
 // Read-only on followers, while device menus and the takeover button remain usable.
 for(const type of ['click','keydown','submit','change','input'])document.addEventListener(type,event=>{
  if(canControl()||!event.isTrusted)return;
  if(event.target.closest('#mouse-control-open,#mouse-control-dialog,#camera-game-controls,#autoscoring-open,#autoscoring-dialog,#desktop-update-action,#desktop-update-dialog,#transfer-dialog,#take-control,#header-menu summary,#fullscreen,#layout-open,#layout-dialog,#toggle-toolbar,#toggle-history,#network-open,#network-dialog,#players-list,#players-dialog,#open-kiosk,#android-app-action,#android-update-action,#android-download-dialog,#mobile-dock'))return;
  event.preventDefault();event.stopImmediatePropagation();
 },true);
}
