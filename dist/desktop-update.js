// Desktop installers use the OS installation flow; game data stays separate.
const local=['127.0.0.1','localhost','[::1]'].includes(location.hostname);
if(local&&!window.DartsAndroid)void init();

async function init(){
 let installed;
 try{
  const response=await fetch('/api/desktop-installation',{cache:'no-store'});
  if(!response.ok)return;
  installed=await response.json();
  if(!['windows','linux'].includes(installed.platform))return;
 }catch{return;}
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
