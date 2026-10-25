import {canControl} from './controller.js';

export function cameraControls(consume){
 if(window.DartsAndroid?.isLocalMode?.()===true)return;
 const button=document.createElement('button');button.id='autoscoring-open';button.textContent='Camera-invoer op NUC';
 document.getElementById('top-actions').append(button);
 const dialog=document.createElement('dialog');dialog.id='autoscoring-dialog';
 dialog.innerHTML='<h2>Camera-invoer op de NUC</h2><p id="autoscoring-status" role="status"></p><p>Bedien de camera-invoer van de NUC vanaf deze telefoon of het scherm. Na het overzetten van een partij: maak het bord leeg en zet de camera-invoer hier aan. Uitgeschakeld kun je handmatig scoren.</p><button id="autoscoring-start" class="primary wide">Camera-invoer op NUC aan</button><button id="autoscoring-pause" class="wide">Camera-invoer op NUC uit</button><label><input id="autoscoring-record" type="checkbox"> Diagnostische opnamen bewaren op de NUC</label><p><small>Maximaal 7 dagen, 80 opnamen en circa 128 MB. Alleen lokale camerabeelden en metingen; geen automatische training of verzending. AutoDarts-scores zijn nog geen gecontroleerde testlabels.</small></p><button id="autoscoring-close" class="wide">Sluiten</button>';
 document.body.append(dialog);
 const checkbox=dialog.querySelector('input');
 checkbox.style.cssText='width:24px;height:24px;min-height:24px;padding:0;margin:0;flex:none';
 checkbox.parentElement.style.cssText='display:flex;gap:12px;align-items:center;margin:14px 0';
 const note=document.createElement('p');note.id='autoscoring-note';note.setAttribute('role','status');note.style.cssText='margin:2px 12px;font-size:13px;color:#82d7e6';
 document.getElementById('connection-status').after(note);note.hidden=true;
 let latest=null,running=false,actionError='';
 const q=id=>document.getElementById(id);
 button.onclick=()=>dialog.showModal();q('autoscoring-close').onclick=()=>dialog.close();
 async function configure(enabled){
  const r=await fetch('/api/autoscoring',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled,recording:q('autoscoring-record').checked}),signal:AbortSignal.timeout(4000)});
  const data=await r.json();if(!r.ok)throw Error(data.error||'Camera-instelling niet opgeslagen');paint(data);
 }
 function action(enabled){actionError='';configure(enabled).catch(e=>{actionError=e.message;q('autoscoring-status').textContent=actionError;});}
 q('autoscoring-start').onclick=()=>action(true);q('autoscoring-pause').onclick=()=>action(false);
 q('autoscoring-record').onchange=()=>action(latest?.enabled||false);
 function paint(data){
  latest=data;
  if(data.available&&!button.isConnected)document.getElementById('top-actions').append(button);
  q('autoscoring-status').textContent=actionError||(data.connected?'AutoDarts verbonden. ':'AutoDarts niet bereikbaar. ')+data.message+(!canControl()?' Kies eerst Spelen ? Bediening overnemen om de camera-invoer te bedienen.':'')+(data.captureError?' Opnamen gepauzeerd: '+data.captureError:'');
  q('autoscoring-record').checked=data.recording;
  q('autoscoring-start').disabled=!canControl()||!data.connected;
  q('autoscoring-pause').disabled=!canControl();q('autoscoring-record').disabled=!canControl();
  note.hidden=!data.available;note.textContent='Camera: '+data.message;button.textContent='Camera-invoer op NUC: '+(data.enabled?'aan':'uit');
 }
 async function poll(){
  if(running)return;running=true;
  try{
   const r=await fetch('/api/autoscoring',{signal:AbortSignal.timeout(2000)});if(!r.ok)return;
   const data=await r.json();paint(data);
   if(data.enabled&&data.pending&&canControl())await consume(data.pending);
  }catch{if(latest?.available){note.hidden=false;note.textContent='Camera: verbinding controleren…';}}
  finally{running=false;}
 }
 poll();setInterval(poll,350);
}
