export const botLevel=player=>player?.bot?Number(player.botLevel)===40?40:50:0;
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
// Complete-match MPR references for the same geometric accuracy as 501 levels
// 40/50. Marks, never scoreboard points, indicate skill in closing games.
export const botMarkReferences={
 cricket:{standard:[1.96,2.51],'cut-throat':[1.95,2.52],'no-score':[1.86,2.31]},
 tactics:{standard:[2.20,2.70],'cut-throat':[2.16,2.71],'no-score':[2.03,2.48]}
};
export function botDifficulty(state,index=state?.active){
 const base=botLevel(state?.players?.[index]);
 if(!base)return {base:0,level:0,adaptive:false};
 const marks=['cricket','tactics'].includes(state.game),points=['x01','gotcha'].includes(state.game);
 // Double-target drills and positional games do not have a comparable scoring
 // average. Their number values must not be mistaken for playing strength.
 if(!marks&&!points)return {base,level:base,adaptive:false};
 const references=botMarkReferences[state.game]?.[state.scoring||'standard']||botMarkReferences[state.game]?.standard;
 const humans=state.players.filter(p=>!p.bot&&p.darts>=9).map(p=>{
  const average=3*(marks?p.totalMarks:p.points)/p.darts;
  const equivalent=marks?40+(average-references[0])*10/(references[1]-references[0]):average;
  return {average,equivalent,darts:p.darts};
 }).filter(value=>Number.isFinite(value.average)&&Number.isFinite(value.equivalent));
 const strongest=humans.sort((a,b)=>b.equivalent-a.equivalent)[0];
 const level=strongest?Math.round(clamp(base+Math.max(0,strongest.equivalent-base)/2,base,100)*10)/10:base;
 return {base,level,adaptive:!!strongest,reference:strongest?.average,metric:marks?'MPR':'gemiddelde',samples:strongest?.darts||0};
}
export function botSpread(level){
 const table=[[40,20],[45,17.7],[50,16],[55,14.4],[60,13.2],[70,11.1],[80,9.3],[90,7.7],[100,6.3]];
 level=clamp(Number(level)||50,40,100);
 for(let i=1;i<table.length;i++)if(level<=table[i][0]){const [low,s0]=table[i-1],[high,s1]=table[i];return s0+(s1-s0)*(level-low)/(high-low);}
 return table.at(-1)[1];
}
