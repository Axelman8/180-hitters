// A user-requested recovery never discards a match or changes a local game.
// Events keep this module independent of controller.js in the legacy bundles.
const android=window.DartsAndroid;
let ready=false,own=false,running=null,sequence=0,feedback='',settleAt=Date.now()+2000;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const remote=()=>!!android&&android.isLocalMode?.()!==true;
let panel,summary,button;
function publish(text){
 feedback=text;paint();
 document.dispatchEvent(new CustomEvent('nuc-recovery-status',{detail:{text,busy:!!running,ready:ready&&own}}));
}
function paint(){
 if(!panel)return;
 panel.hidden=!remote()||(!running&&!feedback&&(ready&&own||Date.now()<settleAt));
 summary.textContent=feedback||(ready?'De NUC is verbonden, maar dit apparaat heeft de bediening nog niet.':'De verbinding met de NUC is weggevallen. Controleer of de NUC aanstaat en Bluetooth aan is.');
 button.disabled=!!running;
 button.textContent=running?'Bezig met herstellen…':'Verbinding en bediening herstellen';
 panel.classList.toggle('recovered',ready&&own);
 document.dispatchEvent(new CustomEvent('nuc-recovery-view',{detail:{visible:!panel.hidden,text:summary.textContent,busy:!!running,recovered:ready&&own}}));
}
async function info(){
 if(android.isTabletShell===true){
  const response=await fetch('/api/tablet/config',{cache:'no-store',signal:AbortSignal.timeout(4000)});
  if(!response.ok)throw Error('De tabletverbinding kon niet worden gecontroleerd. Probeer opnieuw.');
  return response.json();
 }
 try{return JSON.parse(android.getConnectionInfo?.()||'{}');}catch{return {};}
}
async function recover(){
 if(!remote()){publish('Je speelt lokaal. Kies NUC via Bluetooth om de NUC te bedienen.');return false;}
 try{
  publish('1/3 · Bluetooth-verbinding controleren…');
  const connection=await info();
  if(connection.bluetoothAvailable===false)throw Error('Dit apparaat heeft geen Bluetooth.');
  if(connection.mode!=='bluetooth'||connection.bluetoothEnabled===false||!(connection.bluetoothAddress||connection.selectedBluetooth)){
   publish(connection.bluetoothEnabled===false?'Bluetooth staat uit. Zet Bluetooth aan en kies je NUC.':'Kies eerst de NUC waarmee je wilt verbinden.');
   android.chooseMode?.();return false;
  }
  if(!ready){
   publish('1/3 · Opnieuw verbinden met de gekozen NUC…');
   if(android.isTabletShell===true){
    const response=await fetch('/api/tablet/bluetooth/connect',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(5000)});
    if(!response.ok)throw Error('Bluetooth kon niet worden gestart. Controleer de Bluetooth-instellingen.');
   }else android.repairConnection?.();
  }
  let reachable=false;
  for(let attempt=0;attempt<4&&!reachable;attempt++){
   try{
    const response=await fetch('/api/state',{cache:'no-store',signal:AbortSignal.timeout(4000)});
    if(response.ok){const state=await response.json();reachable=!!state.control;if(reachable)document.dispatchEvent(new CustomEvent('nuc-control-observed',{detail:state.control}));}
   }catch{}
   if(!reachable&&attempt<3)await delay(750);
  }
  if(!reachable)throw Error('De NUC reageert niet. Controleer of de NUC aanstaat, Bluetooth aan is en je dichtbij genoeg bent. Probeer daarna opnieuw.');
  publish('2/3 · Bediening op dit apparaat activeren…');
  const acquired=await new Promise(resolve=>{
   const timer=setTimeout(()=>resolve(false),14000);
   document.dispatchEvent(new CustomEvent('request-nuc-control',{detail:{resolve:value=>{clearTimeout(timer);resolve(value);}}}));
  });
  if(!acquired)throw Error('De verbinding werkt, maar de bediening kon niet worden overgenomen. Probeer opnieuw.');
  publish('3/3 · Actuele partij en invoer ophalen…');
  const previous=sequence;document.dispatchEvent(new Event('controller-refresh'));
  for(let attempt=0;attempt<60&&!(sequence>previous&&ready&&own);attempt++)await delay(100);
  if(!(sequence>previous&&ready&&own))throw Error('De actuele partij is nog niet bevestigd. Controleer de verbinding en probeer opnieuw.');
  publish('Verbinding en bediening hersteld. Je kunt weer darten op de NUC.');
  return true;
 }catch(error){publish(error.message||'Herstellen is niet gelukt. Controleer Bluetooth en probeer opnieuw.');return false;}
}
export function repairNucConnection(){
 if(running)return running;
 let recovered=false;
 running=Promise.resolve().then(recover).then(value=>{recovered=value;return value;}).finally(()=>{
  running=null;paint();
  document.dispatchEvent(new CustomEvent('nuc-recovery-status',{detail:{text:feedback,busy:false,ready:ready&&own}}));
  if(recovered){const notice=feedback;setTimeout(()=>{if(!running&&ready&&own&&feedback===notice){feedback='';paint();}},4000);}
 });paint();return running;
}
if(android){
 panel=document.createElement('section');panel.id='nuc-recovery';panel.hidden=true;panel.setAttribute('aria-label','NUC-verbinding herstellen');
 panel.innerHTML='<p role="status" aria-live="polite"></p><button type="button">Verbinding en bediening herstellen</button>';
 summary=panel.querySelector('p');button=panel.querySelector('button');
 if(android.isTabletShell&&android.bindAction)android.bindAction(button,repairNucConnection);else button.onclick=repairNucConnection;
 document.querySelector('header').after(panel);
 document.addEventListener('nuc-connection-status',event=>{const changed=ready!==event.detail.ready;ready=event.detail.ready;sequence++;if(changed&&!running)feedback='';paint();});
 document.addEventListener('nuc-control-status',event=>{own=event.detail.own;paint();});
 document.addEventListener('repair-nuc-connection',()=>void repairNucConnection());
 setTimeout(paint,2100);
}
