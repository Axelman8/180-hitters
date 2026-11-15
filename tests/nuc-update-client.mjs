import assert from 'node:assert/strict';
import {updateNuc} from '../dist/nuc-update-client.js';

for(const outcome of ['updated','current','error']){
 let polls=0,checks=0,reloads=0;const messages=[];
 const request=async path=>{
  if(path.endsWith('/check')){checks++;return{requestedAt:100};}
  if(path.endsWith('/status')){
   polls++;
   if(polls===1)return{time:99,state:'updated',version:'old'};
   if(polls===2)throw Error('Service restarting');
   return{time:101,state:outcome,version:'1.9.25',message:outcome==='error'?'Download mislukt':'Klaar'};
  }
  return{version:'1.9.25',runningVersion:polls===3?'1.8.22':'1.9.25'};
 };
 const run=()=>updateNuc({request,status:text=>messages.push(text),reload:()=>{reloads++;},pause:async()=>{},timeout:1000});
 if(outcome==='error')await assert.rejects(run(),/Download mislukt/);
 else{
  const first=run(),second=run();assert.equal(first,second,'Only one update request may run at once');await first;
  assert.equal(reloads,outcome==='updated'?1:0);assert.equal(polls,4);
 }
 assert.equal(checks,1);assert.ok(messages.some(s=>s.includes('verbinding herstellen')));
}
console.log('PASS: both update entry points, stale status, transient disconnects, real server readiness, current/error states and one shared job');
