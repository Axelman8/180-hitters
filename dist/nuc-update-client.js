// Both NUC update entry points follow the same job and verify the running server.
let activeUpdate=null;
export function updateNuc({request,status,reload=()=>location.reload(),timeout=300000,pause=()=>new Promise(resolve=>setTimeout(resolve,1000))}){
 if(activeUpdate)return activeUpdate;
 activeUpdate=run().finally(()=>{activeUpdate=null;});return activeUpdate;
 async function run(){
  status('Updates zoeken. De NUC heeft hiervoor zelf internet nodig.');
  const start=await request('/api/update/check',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  status(start.message||'NUC controleert GitHub op updates.');
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline){
   await pause();
   let data;
   try{data=await request('/api/update/status',{cache:'no-store'});}
   catch{status('De NUC herstart; verbinding herstellen…');continue;}
   if((data.time||0)<(start.requestedAt||0))continue;
   if(data.message)status(data.message);
   if(data.state==='error')throw Error(data.message||'Bijwerken is mislukt.');
   if(!['current','updated'].includes(data.state))continue;
   let running;
   try{running=await request('/api/desktop-installation',{cache:'no-store'});}
   catch{status('Wachten tot de nieuwe NUC-versie bereikbaar is…');continue;}
   if((running.runningVersion||running.version)!==data.version){status('De nieuwe versie wordt nog gestart…');continue;}
   if(data.state==='updated'){status(`NUC is bijgewerkt naar ${data.version}. Het scherm wordt vernieuwd.`);reload();}
   return data;
  }
  throw Error('Nog geen bevestiging van de update ontvangen. Controleer internet op de NUC en bekijk de updatestatus opnieuw.');
 }
}
