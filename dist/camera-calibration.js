import {canControl,takeControl} from './controller.js';

export function calibrationControls({bind,getStatus,onStatus,resume,timeout}){
 const open=document.createElement('button');open.id='camera-calibration-open';open.type='button';open.textContent="Camera’s kalibreren";
 document.getElementById('top-actions').append(open);
 const style=document.createElement('link');style.rel='stylesheet';style.href='camera-calibration.css';document.head.append(style);
 const dialog=document.createElement('dialog');dialog.id='camera-calibration-dialog';dialog.className='app-dialog';dialog.setAttribute('aria-labelledby','camera-calibration-title');
 dialog.innerHTML=`<h2 id="camera-calibration-title">Camera’s kalibreren</h2>
 <p>Camera aan / herstart gebruikt de opgeslagen kalibratie. Gebruik deze aparte stap als de camera’s of het dartbord zijn verplaatst, of de detectie niet klopt.</p>
 <p id="camera-calibration-current" role="status">Huidige kalibratie ophalen...</p>
 <section class="app-settings-card"><h3>1. Bord voorbereiden</h3><p>Haal alle darts uit het bord. Zet de bordverlichting aan en laat camera’s en bord stilstaan. Rond eventuele beurtinvoer of correcties eerst af.</p>
 <label class="camera-calibration-check"><input id="camera-calibration-empty" type="checkbox"> Het bord is leeg en de bordverlichting staat aan.</label>
 <button id="camera-calibration-start" class="primary wide" type="button" disabled>Automatisch kalibreren</button></section>
 <p id="camera-calibration-status" role="status" aria-live="polite"></p>
 <section id="camera-calibration-test" class="app-settings-card" hidden><h3>2. Proefworpen controleren</h3><p>Wacht tot AutoDarts klaar is. Gooi daarna drie bekende getallen en vergelijk ze met de metingen hieronder. Proefworpen tellen niet mee voor je partij.</p>
 <div id="camera-calibration-darts" aria-label="Gedetecteerde proefworpen"></div><p id="camera-calibration-test-status" role="status"></p>
 <label class="camera-calibration-check"><input id="camera-calibration-verified" type="checkbox"> Ik heb de proefworpen gecontroleerd; de metingen kloppen.</label>
 <button id="camera-calibration-resume" class="primary wide" type="button" disabled>Controle afronden en camera aan</button><p>Haal de proefworpen uit het bord. De score-invoer hervat pas wanneer het bord leeg is.</p></section>
 <p>Je partij en spelers blijven bewaard. Na het starten van de kalibratie blijft de score-invoer bij sluiten uit totdat je zelf Camera aan kiest. De USB- en frequentie-instellingen blijven zoals ze zijn ingesteld.</p>
 <button id="camera-calibration-close" class="wide" type="button">Sluiten</button>`;
 document.body.append(dialog);
 const q=id=>dialog.querySelector('#camera-calibration-'+id);
 let busy=false,supported=false,stage=null,lastStage='',errorText='';
 async function request(path,options={}){
  const response=await fetch(path,{...options,cache:'no-store',signal:AbortSignal.timeout(timeout)});
  if(response.status===404)throw Error('Werk eerst de NUC bij om vanuit de app te kunnen kalibreren.');
  const data=await response.json();if(!response.ok)throw Error(data.error||'De NUC kon de kalibratie niet uitvoeren.');return data;
 }
 function update(data){
  const value=data?.calibration;if(value)stage=value;
  const running=['starting','calibrating'].includes(stage?.stage);
  if(lastStage!==stage?.stage){if(stage?.stage==='testing'){q('verified').checked=false;q('empty').checked=false;}lastStage=stage?.stage;}
  q('start').disabled=busy||running||!supported||!getStatus()?.connected||!q('empty').checked;
  q('empty').disabled=busy||running;
  q('test').hidden=stage?.stage!=='testing';
  q('resume').disabled=busy||running||!q('verified').checked||stage?.calibrated===false||!!stage?.testError||!stage?.running||!getStatus()?.connected;
  if(stage){q('status').textContent=errorText||stage.message;q('current').textContent=!stage.running?'AutoDarts staat uit. Camera aan / herstart laadt de bestaande kalibratie. Je kunt hieronder ook bewust opnieuw kalibreren.':stage.calibrated===true?`Opgeslagen bordkalibratie${stage.cameras?' · '+stage.cameras+' camera’s':''}`:stage.calibrated===false?'AutoDarts meldt dat het bord nog niet is gekalibreerd.':'Bordkalibratie nog niet bevestigd.';}else if(errorText)q('status').textContent=errorText;
  const hits=stage?.testHits||[],label=hit=>hit.number===0?'MIS':hit.number===25?(hit.mult===2?'BB':'sB'):(hit.mult===3?'T':hit.mult===2?'D':'')+hit.number;
  const darts=q('darts');for(let i=0;i<3;i++){let item=darts.children[i];if(!item){item=document.createElement('span');darts.append(item);}item.textContent=hits[i]?label(hits[i]):'Pijl '+(i+1);}
  q('test-status').textContent=stage?.testError||(!stage?.running?'AutoDarts is nog niet actief; houd het bord leeg.':hits.length?'Vergelijk deze metingen met de darts in het bord.':'Houd het bord leeg totdat de kalibratie klaar is.');
 }
 bind(open,async()=>{errorText='';q('empty').checked=false;q('verified').checked=false;update();dialog.showModal();try{const value=await request('/api/autoscoring/calibration');supported=true;update({calibration:value});}catch(error){supported=false;errorText=error.message;update();q('current').textContent=error.message;}});
 bind(q('close'),()=>dialog.close());
 q('empty').onchange=()=>update();q('verified').onchange=()=>update();
 bind(q('start'),async()=>{
  if(busy||!q('empty').checked)return;busy=true;errorText='';update();
  try{
   if(!canControl()&&!await takeControl())throw Error('Neem eerst de NUC-bediening over.');
   const state=await request('/api/state');
   const data=await request('/api/autoscoring/calibrate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:state.revision,emptyBoardConfirmed:true})});onStatus(data);
  }catch(error){errorText=error.message;}
  finally{busy=false;update();}
 });
 bind(q('resume'),async()=>{
  if(busy||!q('verified').checked)return;busy=true;update();
  try{await resume();if(getStatus()?.enabled)dialog.close();else errorText='Camera-invoer is nog uit. Controleer de NUC-verbinding en probeer opnieuw.';}
  catch(error){errorText=error.message;}
  finally{busy=false;update();}
 });
 return {update};
}
