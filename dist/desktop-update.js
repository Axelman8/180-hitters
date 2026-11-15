// Desktop installers use the OS installation flow; game data stays separate.
import {updateNuc} from './nuc-update-client.js';
const local=['127.0.0.1','localhost','[::1]'].includes(location.hostname);
if(local&&!window.DartsAndroid)void init();

async function init(){
 let installed;
 try{
  const response=await fetch('/api/desktop-installation',{cache:'no-store'});
  if(!response.ok)return;
  installed=await response.json();
  if(!installed.nativeUpdate&&!['windows','linux'].includes(installed.platform))return;
 }catch{return;}
 // Updates can also be started from a phone or by the background timer.
 // Refresh this NUC screen only once the replacement server is ready.
 const displayedVersion=installed.runningVersion||installed.version;
 setInterval(async()=>{
  try{
   const r=await fetch('/api/desktop-installation',{cache:'no-store',signal:AbortSignal.timeout(5000)});
   if(!r.ok)return;const data=await r.json(),version=data.runningVersion||data.version;
   if(version&&displayedVersion&&version!==displayedVersion)location.reload();
  }catch{}
 },15000);
 if(installed.nativeUpdate){nativeUpdater(installed);return;}
 const button=document.createElement('button');
 button.id='desktop-update-action';button.type='button';button.textContent='Update controleren';
 button.style.color='#ff7474';
 const dialog=document.createElement('dialog');dialog.id='desktop-update-dialog';
 dialog.setAttribute('aria-labelledby','desktop-update-title');
 dialog.innerHTML='<h2 id="desktop-update-title">DartsApp bijwerken</h2><p class="update-status" role="status"></p><p class="update-help"></p><a class="primary" hidden>Update downloaden</a><p><button type="button">Sluiten</button></p>';
 dialog.style.maxWidth='min(480px,90vw)';
 const status=dialog.querySelector('.update-status'),help=dialog.querySelector('.update-help'),link=dialog.querySelector('a');
 document.body.append(dialog);document.getElementById('top-actions').append(button);
 let controller;
 dialog.querySelector('button').onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>controller?.abort());
 button.onclick=async()=>{
  controller?.abort();controller=new AbortController();
  const current=controller;
  link.hidden=true;help.textContent='';status.textContent=`Geïnstalleerd: ${installed.version}. Updates zoeken…`;
  dialog.showModal();
  const timer=setTimeout(()=>current.abort(),15000);
  try{
   const response=await fetch('https://api.github.com/repos/Axelman8/180-hitters/releases/latest',{cache:'no-store',signal:current.signal});
   if(!response.ok)throw new Error();
   const release=await response.json();
   const latest=String(release.tag_name||'').replace(/^v/,'');
   const parse=v=>/^\d+\.\d+\.\d+$/.test(v)?v.split('.').map(Number):null;
   const a=parse(latest),b=parse(installed.version);
   if(!a||!b||release.draft||release.prerelease)throw new Error();
   const newer=a.reduce((result,n,i)=>result||(n>b[i]?1:n<b[i]?-1:0),0)>0;
   if(!newer){status.textContent=`Versie ${installed.version}: je app is up-to-date.`;return;}
   const asset=installed.platform==='windows'?'DartsApp-Setup-Windows-x64.exe':'DartsApp-Ubuntu-Debian-amd64.deb';
   if(!release.assets?.some(item=>item.name===asset&&item.state==='uploaded'))throw new Error();
   status.textContent=`Versie ${latest} is beschikbaar. Je gebruikt ${installed.version}.`;
   link.href=`https://github.com/Axelman8/180-hitters/releases/download/v${latest}/${asset}`;
   link.textContent=`Update ${latest} downloaden`;link.hidden=false;
   help.textContent=installed.platform==='windows'
    ?'Open na het downloaden de installer en volg de stappen. Werk bij tussen partijen: de server moet tijdens installatie sluiten. Spelers en opgeslagen partijen blijven behouden. Open daarna DartsApp opnieuw.'
    :'Open het gedownloade .deb-bestand met Software installeren en bevestig de update met je Linux-wachtwoord. Spelers en opgeslagen partijen blijven behouden. Werk bij tussen partijen; vernieuw daarna dit scherm.';
  }catch{
   if(current!==controller||!dialog.open)return;
   status.textContent='Updates controleren is niet gelukt. Controleer je internetverbinding en probeer opnieuw.';
  }finally{clearTimeout(timer);}
 };
}


function nativeUpdater(installed){
 const button=document.createElement('button');
 button.id='desktop-update-action';button.type='button';button.textContent='Update';button.style.color='#ff7474';
 const dialog=document.createElement('dialog');dialog.id='desktop-update-dialog';
 dialog.innerHTML='<h2>180 Hitters bijwerken</h2><p role="status"></p><p>Controleer op de nieuwste versie en installeer deze automatisch. De NUC heeft zelf internet nodig. Spelers en opgeslagen partijen blijven bewaard. De app start tijdens de update kort opnieuw.</p><button class="primary" type="button">Controleren en bijwerken</button> <button type="button">Sluiten</button>';
 const status=dialog.querySelector('[role="status"]'),start=dialog.querySelector('.primary'),close=dialog.querySelector('button:last-child');
 document.body.append(dialog);document.getElementById('top-actions').append(button);
 let busy=false;
 button.onclick=()=>{if(!busy)status.textContent=`Ge?nstalleerde versie: ${installed.version}`;dialog.showModal();};
 close.onclick=()=>dialog.close();
 start.onclick=async()=>{
  if(busy)return;busy=true;start.disabled=true;
  try{
   const result=await updateNuc({status:text=>{status.textContent=text;},request:async(path,options)=>{
    const response=await fetch(path,{...options,signal:AbortSignal.timeout(15000)});
    const data=await response.json();if(!response.ok)throw Error(data.error||'Update starten is niet gelukt.');return data;
   }});
   installed.version=result.version||installed.version;
  }catch(error){status.textContent=error.message;}
  finally{busy=false;start.disabled=false;}
 };
}
