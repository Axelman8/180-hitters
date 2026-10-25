import {canControl,takeControl} from './controller.js';

export function cameraControls(consume){
 if(window.DartsAndroid?.isLocalMode?.()===true)return;
 const tabletShell=window.DartsAndroid?.isTabletShell===true;
 const requestTimeout=tabletShell?20000:4000;
 const note=document.createElement('p');note.id='autoscoring-note';note.setAttribute('role','status');note.style.cssText='margin:2px 12px;font-size:13px;color:#82d7e6';
 document.getElementById('connection-status').after(note);note.hidden=true;
 const quick=document.createElement('div');quick.id='camera-game-controls';
 quick.setAttribute('role','group');quick.setAttribute('aria-label','Camera-invoer');
 quick.innerHTML='<button type="button" id="camera-game-on" aria-pressed="false">Camera aan</button><button type="button" id="camera-game-off" aria-pressed="false">Camera uit</button>';
 document.getElementById('top-actions').append(quick);
 const bind=(element,handler)=>{
  if(window.DartsAndroid?.isTabletShell&&typeof window.DartsAndroid.bindAction==='function')window.DartsAndroid.bindAction(element,handler);
  else element.onclick=handler;
 };
 bind(quick.querySelector('#camera-game-on'),()=>action(true));
 bind(quick.querySelector('#camera-game-off'),()=>action(false));
 let latest=null,running=false,changing=false,actionError='';
 const q=id=>document.getElementById(id);
 async function configure(enabled){
  const r=await fetch('/api/autoscoring',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled,recording:latest?.recording||false}),signal:AbortSignal.timeout(requestTimeout)});
  const data=await r.json();if(!r.ok)throw Error(data.error||'Camera-instelling niet opgeslagen');paint(data);
 }
 async function action(enabled){
  if(changing)return;changing=true;actionError='';
  for(const button of quick.querySelectorAll('button'))button.disabled=true;
  try{
   if(!canControl()){
    note.textContent='Bediening overnemen en huidige NUC-stand ophalen...';
    if(!await takeControl())throw Error('Bediening kon niet worden overgenomen. Probeer het nogmaals.');
   }
   await configure(enabled);
  }catch(e){actionError=e.message;note.textContent=actionError;}
  finally{changing=false;if(latest)paint(latest);}
 }
 function paint(data){
  latest=data;
  for(const [id,active] of [['camera-game-on',data.enabled],['camera-game-off',!data.enabled]]){
   q(id).disabled=changing;
   q(id).setAttribute('aria-pressed',String(active));
  }
  note.hidden=!data.available;note.textContent=actionError||'Camera: '+data.message;
 }
 async function poll(){
  if(running)return;running=true;
  try{
   const r=await fetch('/api/autoscoring',{signal:AbortSignal.timeout(requestTimeout)});if(!r.ok)return;
   const data=await r.json();paint(data);
   if(data.enabled&&data.pending&&canControl())await consume(data.pending);
  }catch{if(latest?.available){note.hidden=false;note.textContent='Camera: verbinding controleren…';}}
  finally{running=false;}
 }
 poll();setInterval(poll,tabletShell?3000:350);
}
