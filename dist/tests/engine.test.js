import {newMatch,applyTurn,nextLeg,makeDart,checkout,setupShot,possibleTotal,previewCricket,previewGotcha,previewBobs27} from '../engine.js';
export function runTests(){
 const results=[];
 const test=(name,fn)=>{fn();results.push(name);};
 const assert=(v)=>{if(!v)throw Error('Assertion failed');};
 const throws=fn=>{let error=false;try{fn();}catch{error=true;}assert(error);};
 const d=makeDart,miss=d(0),turn=(s,...hits)=>applyTurn(s,{hits}),pad=(s,...hits)=>turn(s,...hits,...Array(3-hits.length).fill(miss));
 const x=(options={},start=501,out='double',target=3)=>newMatch(['A','B'],start,out,target,options);
 const c=(options={})=>x({game:'cricket',...options});
 const almost=s=>{s.numbers.forEach(n=>s.players[0].marks[n]=3);s.players[0].marks[25]=2;return s;};
 test('180 valid; 179, negatives and oversized darts rejected',()=>{assert(possibleTotal(180));assert(!possibleTotal(179));assert(!possibleTotal(-1));assert(!possibleTotal(20,4));});
 test('170 checkout and 169 bogey',()=>{assert(checkout(170).join(',')==='T20,T20,Bull');assert(checkout(169)===null);});
 test('Master out permits a treble; double out does not',()=>{assert(checkout(60,'master',1)[0]==='T20');assert(checkout(60,'double',1)===null);});
 test('Total scoring is immutable and rotates player',()=>{const s=x(),n=applyTurn(s,{score:180});assert(s.players[0].remaining===501);assert(n.players[0].remaining===321&&n.active===1);});
 test('Leave one and overshoot are busts',()=>{for(const score of [39,60]){const s=x({},40),n=applyTurn(s,{score});assert(n.players[0].remaining===40&&n.history[0].bust&&n.players[0].points===0);}});
 test('Double-in ignores singles before opening',()=>{const n=turn(x({inMode:'double'}),d(20),d(20,2),d(20,3));assert(n.players[0].remaining===401&&n.players[0].opened);});
 test('Master-in opens on a treble',()=>{const n=turn(x({inMode:'master'}),d(20),d(20,3),d(5));assert(n.players[0].remaining===436);});
 test('Opening followed by bust restores unopened state',()=>{const n=pad(x({inMode:'double'},40),d(19,2));assert(n.players[0].opened);const s=x({inMode:'double'},40);const b=turn(s,d(20,3),d(19,2),d(1));assert(b.history[0].bust&&!b.players[0].opened&&b.players[0].remaining===40);});
 test('Opening modes accept valid totals and retain unopened zero/bust',()=>{
 for(const inMode of ['double','master']){
  let s=x({inMode});let n=applyTurn(s,{score:60});assert(n.players[0].opened&&n.players[0].remaining===441);
  n=applyTurn(s,{score:0});assert(!n.players[0].opened);
  n=applyTurn(s,{score:0,forceBust:true});assert(!n.players[0].opened);
  throws(()=>applyTurn(s,{score:1}));
 }
 throws(()=>applyTurn(x({inMode:'double'}),{score:180}));
 assert(applyTurn(x({inMode:'master'}),{score:180}).players[0].remaining===321);
});
 test('Total finish validates opening and out rule together',()=>{
  throws(()=>applyTurn(x({inMode:'double'},60,'master'),{score:60,darts:1}));
  assert(applyTurn(x({inMode:'double'},60,'double'),{score:60,darts:2}).phase==='leg');
  assert(applyTurn(x({inMode:'master'},60,'master'),{score:60,darts:1}).phase==='leg');
  throws(()=>applyTurn(x({bull:'50/50'},25,'single'),{score:25,darts:1}));
 });
 test('Wrong finishing segment busts immediately',()=>{const n=turn(x({},20),d(20));assert(n.history[0].bust&&n.players[0].remaining===20);});
 test('Extra darts after an early bust are rejected',()=>throws(()=>turn(x({},20),d(20),d(1))));
 test('Nonterminal partial visit is rejected',()=>throws(()=>turn(x(),d(20))));
 test('One-dart finish records one dart and wins leg',()=>{const n=turn(x({},40),d(20,2));assert(n.phase==='leg'&&n.players[0].darts===1&&n.players[0].legs===1);});
 test('Master-out finish on treble',()=>{assert(turn(x({},60,'master'),d(20,3)).phase==='leg');});
 test('50/50 outer bull scores 50 but remains a single',()=>{const n=pad(x({bull:'50/50'}),d(25));assert(n.players[0].remaining===451);assert(turn(x({bull:'50/50'},50),d(25)).history[0].bust);});
 test('Inside bull opens double-in',()=>{const n=pad(x({inMode:'double'}),d(25,2));assert(n.players[0].remaining===451&&n.players[0].opened);});
 test('Next leg rotates starter and clears opening status',()=>{const n=nextLeg(turn(x({inMode:'double'},40),d(20,2)));assert(n.active===1&&n.players[0].remaining===40&&!n.players[0].opened);});
 test('First to legs wins the match',()=>assert(turn(x({},40,'double',1),d(20,2)).phase==='won'));
 test('Sets award only after required legs, reset set legs',()=>{let s=x({matchMode:'sets',legsPerSet:2},40,'double',2);s=turn(s,d(20,2));assert(s.players[0].sets===0);s=nextLeg(s);s=pad(s);s=turn(s,d(20,2));assert(s.players[0].sets===1&&s.setComplete&&s.phase==='leg');s=nextLeg(s);assert(s.set===2&&s.players[0].setLegs===0&&s.players[0].legs===2);s.players[0].setLegs=1;s=turn(s,d(20,2));assert(s.phase==='won'&&s.players[0].sets===2);});
 test('Free play never automatically wins the match',()=>assert(turn(x({matchMode:'off'},40,'double',1),d(20,2)).phase==='leg'));
 test('Cricket and Tactics have distinct target lists',()=>{assert(c().numbers.length===7);assert(c({game:'tactics'}).numbers.length===12);assert(c({game:'tactics'}).numbers.includes(10));});
 test('Triple closes number; later hits score',()=>{const n=turn(c(),d(20,3),d(20),miss);assert(n.players[0].marks[20]===3&&n.players[0].cricketPoints===20&&n.players[0].totalMarks===4);});
 test('Overflow within same dart scores only extra marks',()=>{const n=turn(c(),d(20,2),d(20,3),miss);assert(n.players[0].cricketPoints===40);});
 test('Closed by everyone gives no points or effective marks',()=>{let s=c();s.players[1].marks[20]=3;const n=turn(s,d(20,3),d(20,3),miss);assert(n.players[0].cricketPoints===0&&n.players[0].totalMarks===3);});
 test('Cut Throat assigns only to open opponents',()=>{let s=newMatch(['A','B','C'],501,'double',3,{game:'cricket',scoring:'cut-throat'});s.players[2].marks[20]=3;const n=turn(s,d(20,3),d(20,2),miss);assert(n.players[0].cricketPoints===0&&n.players[1].cricketPoints===40&&n.players[2].cricketPoints===0);});
 test('No Score closes without points',()=>{const n=turn(c({scoring:'no-score'}),d(20,3),d(20,3),miss);assert(n.players[0].cricketPoints===0&&n.players[0].totalMarks===3);});
 test('Bull is one or two marks and 25 points per excess',()=>{const n=turn(c(),d(25,2),d(25,2),miss);assert(n.players[0].marks[25]===3&&n.players[0].cricketPoints===25);});
 test('Tactics scores 10; Cricket ignores 10',()=>{assert(turn(c({game:'tactics'}),d(10,3),d(10),miss).players[0].cricketPoints===10);assert(pad(c(),d(10,3)).players[0].totalMarks===0);});
 test('Closing all with equal score wins immediately',()=>{const n=turn(almost(c()),d(25));assert(n.phase==='leg'&&n.players[0].darts===1);});
 test('Closed all but behind must keep scoring',()=>{const s=almost(c());s.players[1].cricketPoints=100;assert(pad(s,d(25)).phase==='playing');});
 test('Cut Throat requires lowest score',()=>{let s=almost(c({scoring:'cut-throat'}));s.players[0].cricketPoints=100;assert(pad(s,d(25)).phase==='playing');s=almost(c({scoring:'cut-throat'}));s.players[1].cricketPoints=100;assert(turn(s,d(25)).phase==='leg');});
 test('No Score victory ignores points',()=>{let s=almost(c({scoring:'no-score'}));s.players[1].cricketPoints=100;assert(turn(s,d(25)).phase==='leg');});
 test('Cricket new leg resets board and points, retains stats',()=>{let s=turn(almost(c()),d(25));s=nextLeg(s);assert(Object.keys(s.players[0].marks).length===0&&s.players[0].cricketPoints===0&&s.players[0].darts===1);});
 test('Round cap waits for all players and selects low X01 score',()=>{let s=x({maxRounds:1});s=applyTurn(s,{score:60});assert(s.phase==='playing');s=applyTurn(s,{score:20});assert(s.winner===0&&s.reason==='round-limit');});
 test('Tied cap continues full rounds',()=>{let s=x({maxRounds:1});s=applyTurn(applyTurn(s,{score:60}),{score:60});assert(s.tiebreak&&s.phase==='playing');s=applyTurn(applyTurn(s,{score:60}),{score:20});assert(s.winner===0);});
 test('No Score cap uses marks',()=>{let s=c({scoring:'no-score',maxRounds:1});s=pad(s,d(20,3));s=pad(s,d(19));assert(s.winner===0);});
 test('Invalid segment and triple bull rejected',()=>{throws(()=>d(25,3));throws(()=>d(21));throws(()=>d(0,2));});
 for(const game of ['cricket','tactics']){
  test(game+' live points are immutable and agree with confirmed points',()=>{let s=c({game});s.players[0].marks[20]=3;const before=JSON.stringify(s),hits=[d(20),d(20,2),d(20,3)];assert(previewCricket(s,hits.slice(0,1)).players[0].cricketPoints===20);assert(previewCricket(s,hits.slice(0,2)).players[0].cricketPoints===60);assert(previewCricket(s,hits).players[0].cricketPoints===120);assert(JSON.stringify(s)===before);assert(turn(s,...hits).players[0].cricketPoints===120);assert(previewCricket(s,[]).players[0].cricketPoints===0);});
  test(game+' partial closure scores only excess hits',()=>{let s=c({game});s.players[0].marks[20]=2;assert(previewCricket(s,[d(20,3)]).players[0].cricketPoints===40);});
  test(game+' Cut Throat preview only penalizes open opponents',()=>{let s=newMatch(['A','B','C'],501,'double',3,{game,scoring:'cut-throat'});s.players[0].marks[20]=3;s.players[2].marks[20]=3;const p=previewCricket(s,[d(20,2)]).players;assert(p[0].cricketPoints===0&&p[1].cricketPoints===40&&p[2].cricketPoints===0);});
  test(game+' no points when everyone closed or No Score selected',()=>{let s=c({game});s.players.forEach(p=>p.marks[20]=3);assert(previewCricket(s,[d(20,3)]).players[0].cricketPoints===0);s.scoring='no-score';s.players[1].marks[20]=0;assert(previewCricket(s,[d(20,3)]).players[0].cricketPoints===0);});
 }
 test('Live bull scoring and early finish',()=>{let s=c();s.players[0].marks[25]=3;assert(previewCricket(s,[d(25,2)]).players[0].cricketPoints===50);s=almost(c());const p=previewCricket(s,[d(25),d(20,3)]);assert(p.finished&&p.used===1&&p.players[0].cricketPoints===0);});
 const training=()=>newMatch(['A'],501,'single',1,{training121:true,inMode:'double',maxRounds:1});
 test('Training normalizes settings and accepts multiple players',()=>{const s=training();assert(s.start===121&&s.out==='double'&&s.inMode==='single'&&s.maxRounds===0);assert(newMatch(['A','B'],121,'double',1,{training121:true}).players.length===2);});
 test('Training four-dart finish adds six and resets next attempt',()=>{const original=training();let s=turn(original,d(20,3),d(20),d(1));s=turn(s,d(20,2));assert(s.trainingDarts===4&&s.trainingNext===127&&s.trainingChange===6&&s.phase==='leg');assert(original.trainingDarts===0&&original.players[0].remaining===121);throws(()=>turn(s,miss));s=nextLeg(s);assert(s.start===127&&s.players[0].remaining===127&&s.trainingDarts===0&&s.leg===2&&s.trainingBest===127);for(let i=0;i<3;i++)s=pad(s);assert(s.trainingNext===126&&s.trainingChange===-1&&!s.trainingSuccess);});
 test('Training failure never goes below 121',()=>{let s=training();for(let i=0;i<3;i++)s=pad(s);assert(s.trainingNext===121&&s.trainingChange===0&&s.trainingDarts===9);});
 test('Training finish on ninth dart adds one',()=>{let s=pad(pad(training()));s=turn(s,d(20,3),d(11),d(25,2));assert(s.trainingNext===122&&s.trainingDarts===9&&s.trainingSuccess);});
 test('Training bust consumes visit and restores remaining score',()=>{let s=turn(training(),d(20,3),d(20,3));assert(s.trainingDarts===3&&s.players[0].remaining===121);s=turn(s,d(20,3),d(20,3));s=turn(s,d(20,3),d(20,3));assert(s.phase==='leg'&&s.trainingNext===121);});
 test('Training accepts totals and rejects early continuation and extra finish darts',()=>{assert(applyTurn(training(),{score:60}).trainingDarts===3);throws(()=>nextLeg(training()));throws(()=>turn(training(),d(20,3),d(11),d(25,2),miss));});
 test('Regular X01 121 remains separate',()=>{const s=turn(x({},121),d(20,3),d(11),d(25,2));assert(!s.training121&&s.phase==='leg'&&nextLeg(s).start===121);});
 const g=()=>newMatch(['A','B','C'],301,'single',3,{game:'gotcha'});
 test('Gotcha starts at zero, requires opponents and counts upward',()=>{throws(()=>newMatch(['A'],301,'single',1,{game:'gotcha'}));let s=g();assert(s.players.every(p=>p.remaining===0));s=turn(s,d(20,3),d(20,2),d(25,2));assert(s.players[0].remaining===150&&s.active===1);assert(applyTurn(s,{score:60}).players[s.active].remaining===60);});
 test('Gotcha resets every matched opponent per dart without mutating source',()=>{const s=g();s.players[1].remaining=20;s.players[2].remaining=40;const v=previewGotcha(s,[d(20),d(20)]);assert(v.players[1].remaining===0&&v.players[2].remaining===0&&s.players[1].remaining===20);assert(previewGotcha(s,[]).players[1].remaining===20);const n=pad(s,d(20),d(20));assert(n.players[1].remaining===0&&n.players[2].remaining===0&&n.players[0].remaining===40);});
 test('Gotcha bust restores own visit but preserves earlier opponent reset',()=>{const s=g();s.players[0].remaining=260;s.players[1].remaining=280;const n=turn(s,d(20),d(20,3));assert(n.players[0].remaining===260&&n.players[1].remaining===0&&n.history[0].bust&&n.players[0].darts===3);throws(()=>turn(s,d(20),d(20,3),miss));});
 test('Gotcha exact finish on single wins immediately',()=>{const s=g();s.players[0].remaining=300;const n=turn(s,d(1));assert(n.phase==='won'&&n.players[0].remaining===301&&n.players[0].darts===1);throws(()=>turn(s,d(1),miss));});
 test('Gotcha supports all targets and double-out',()=>{for(const target of [301,401,501,601,701]){const s=newMatch(['A','B'],target,'double',1,{game:'gotcha'});s.players[0].remaining=target-40;assert(turn(s,d(20,2)).phase==='won');const bad=turn(s,d(20),d(20));assert(bad.history[0].bust&&bad.players[0].remaining===target-40);const one=turn(s,d(13,3));assert(one.history[0].bust);}});
 test('Gotcha master-out finishes with triple and rejects single',()=>{const s=newMatch(['A','B'],501,'master',1,{game:'gotcha'});s.players[0].remaining=441;assert(turn(s,d(20,3)).phase==='won');s.players[0].remaining=481;assert(turn(s,d(20)).history[0].bust);});
 test("Bob's 27 starts at 27, is solo and scores only the target double",()=>{throws(()=>newMatch(['A','B'],27,'double',1,{game:'bobs27'}));const s=newMatch(['A'],27,'double',1,{game:'bobs27'}),v=previewBobs27(s,[d(1,2),d(1),d(2,2)]);assert(v.hits===1&&v.delta===2&&v.score===29);const n=turn(s,d(1,2),d(1),d(2,2));assert(n.players[0].remaining===29&&n.bobsTarget===2&&n.players[0].bobsHits===1);});
 test("Bob's 27 subtracts a blank target and eliminates at zero or below",()=>{let s=newMatch(['A'],27,'double',1,{game:'bobs27'});s.bobsTarget=14;s.players[0].remaining=28;const n=pad(s);assert(n.players[0].remaining===0&&n.phase==='won'&&n.reason==='bobs-eliminated'&&n.winner===null);});
 test("Bob's 27 perfect game includes double bull and scores 1437",()=>{let s=newMatch(['A'],27,'double',1,{game:'bobs27'});for(const target of [...Array.from({length:20},(_,i)=>i+1),25])s=turn(s,d(target,2),d(target,2),d(target,2));assert(s.phase==='won'&&s.reason==='bobs-complete'&&s.players[0].remaining===1437&&s.players[0].bobsHits===63);});
 test('121 multiplayer keeps independent levels and rotates after complete attempt',()=>{let s=newMatch(['A','B'],121,'double',1,{training121:true});s=turn(s,d(20,3),d(20),d(1));assert(s.active===0&&s.trainingDarts===3);s=turn(s,d(20,2));assert(s.players[0].trainingLevel===127&&s.players[1].trainingLevel===121);s=nextLeg(s);assert(s.active===1&&s.start===121&&s.trainingDarts===0);for(let i=0;i<3;i++)s=pad(s);assert(s.trainingNext===121);s=nextLeg(s);assert(s.active===0&&s.start===127&&s.players[0].remaining===127&&s.trainingDarts===0);});
 test('121 respects selected starter with four players',()=>{let s=newMatch(['A','B','C','D'],121,'double',1,{training121:true,starter:3});assert(s.active===3);for(let i=0;i<3;i++)s=pad(s);assert(s.active===3);assert(nextLeg(s).active===0);});
 test('Preferred checkouts use singles and respect available darts',()=>{assert(checkout(25).join(',')==='S9,D8');assert(checkout(25,'double',2).join(',')==='S9,D8');assert(checkout(25,'double',1)===null);assert(checkout(50).join(',')==='S18,D16');assert(checkout(50,'double',1)[0]==='Bull');assert(checkout(110).join(',')==='T20,S10,D20');assert(checkout(110,'double',2).join(',')==='T20,Bull');});
 test('Every recommended checkout is legal for its score, darts and bull mode',()=>{for(const bull of ['25/50','50/50'])for(let n=1;n<=3;n++)for(let score=2;score<=170;score++){const route=checkout(score,'double',n,bull);if(!route)continue;assert(route.length<=n);let total=0;for(const label of route){if(label==='Bull')total+=50;else {const m=label.match(/^([SDT])(\d+)$/);assert(m);const value=Number(m[2]);assert(value>=1&&(value<=20||value===25));assert(!(value===25&&bull==='50/50'));total+=value*({S:1,D:2,T:3}[m[1]]);}}assert(total===score);assert(route.at(-1)==='Bull'||route.at(-1).startsWith('D'));}});
 test('Last dart setup follows chart without claiming a checkout',()=>{const advice=setupShot(25);assert(advice.label==='S9'&&advice.remaining===16&&advice.next.join(',')==='D8');assert(setupShot(40)===null);assert(setupShot(50)===null);assert(setupShot(25,'double',2)===null);assert(setupShot(25,'double',0)===null);assert(setupShot(170).label==='T20');assert(setupShot(169)===null);});
 test('Gotcha total end score and manual intermediate resets are distinct',()=>{
  const s=g();s.players[1].remaining=20;s.players[2].remaining=60;
  const end=applyTurn(s,{score:60});assert(end.players[1].remaining===20&&end.players[2].remaining===0);
  const manual=applyTurn(s,{score:60,gotchaRule:'manual',resets:[1]});assert(manual.players[1].remaining===0&&manual.players[2].remaining===0);
  assert(s.players[1].remaining===20);assert(manual.history[0].input.resets[0]===1);
  const bust=applyTurn(s,{score:0,forceBust:true,gotchaRule:'manual',resets:[1]});assert(bust.players[0].remaining===0&&bust.players[1].remaining===0&&bust.players[0].darts===3);
 });
 test('Gotcha total double finish and overshoot',()=>{
  const s=newMatch(['A','B'],301,'double',1,{game:'gotcha'});s.players[0].remaining=261;
  assert(applyTurn(s,{score:40,darts:1}).phase==='won');
  assert(applyTurn(s,{score:60}).players[0].remaining===261);
  assert(applyTurn(s,{score:39,darts:1}).history.at(-1).bust);
 });
 return {passed:results.length,tests:results};
}
