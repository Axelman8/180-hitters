import {appearanceDefaults,getAppearance,saveAppearance,symbolNames} from './appearance-settings.js';
import {applyAppearanceDocument,playerMarker} from './appearance-game.js';
import {dartboard} from './graphic-board.js';
const $=id=>document.getElementById(id),actions=$('top-actions');
const dialog=document.createElement('dialog');dialog.id='appearance-dialog';dialog.className='app-dialog';dialog.setAttribute('aria-labelledby','appearance-title');
dialog.innerHTML=`<h2 id="appearance-title">Weergave aanpassen</h2><p>Deze voorkeuren gelden alleen voor dit apparaat. Je partij en de weergave op andere apparaten veranderen niet.</p>
<div class="appearance-layout"><section class="appearance-fields">
<fieldset><legend>Speelveld en invoer</legend><label>Ruimteverdeling<select id="appearance-space"><option value="auto">Automatisch passend</option><option value="board">Groter speelveld</option><option value="input">Grotere invoer</option></select></label><p>De scorebediening staat tussen de spelers en het bord. Kies compacte bediening voor meer speelveld, of grotere aanraakknoppen. Ingeklapte invoer blijft ingeklapt.</p></fieldset>
<fieldset><legend>Scorebord</legend><label>Informatie op spelerskaarten<select id="appearance-score-mode"><option value="standard">Standaard van het spel</option><option value="custom">Zelf kiezen</option></select></label><div id="appearance-score-options" class="appearance-checks"></div><p>Je ziet alleen gegevens die bij het spel passen. Actuele scores, doelen en levens blijven altijd zichtbaar.</p></fieldset>
<fieldset><legend>Spelerherkenning</legend><label>Spelerskleuren<select id="appearance-color-mode"><option value="standard">Standaardkleuren</option><option value="custom">Eigen kleuren</option></select></label><div id="appearance-player-options"></div><label>Markering bij de naam<select id="appearance-markers"><option value="none">Alleen de naam</option><option value="shapes">Naam met symbool</option><option value="numbers">Naam met spelersnummer</option></select></label><label>Actieve speler<select id="appearance-emphasis"><option value="standard">Standaard markering</option><option value="strong">Dikkere omranding</option><option value="contrast">Duidelijk contrast</option></select></label><p>Bij 4 op een rij blijft het wedstrijdsymbool leidend, zodat naam en geclaimde vakken overeenkomen.</p></fieldset>
<fieldset><legend>Dartbord</legend><label>Bordstijl<select id="appearance-board"><option value="standard">Huidige stijl</option><option value="classic">Klassiek dartbord</option><option value="calm">Rustig en vereenvoudigd</option></select></label><p>Voor de ronde dartborden van Killer, Cricket, Tactics, Shanghai en Bob's 27. De doelen blijven gemarkeerd.</p></fieldset>
<fieldset><legend>Rustig speelscherm</legend><label class="appearance-check"><input id="appearance-focus" type="checkbox"> Minder uitleg en aanvullende informatie tijdens het spelen</label><p>Menu, verbinding, camera- en scorebediening blijven bereikbaar. Gegevens die je zelf op het scorebord kiest blijven staan.</p></fieldset>
</section><aside class="appearance-preview" aria-label="Voorbeeld van de weergave"><h3>Direct voorbeeld</h3><div id="appearance-preview-players"></div><div id="appearance-preview-layout"><div id="appearance-preview-board"></div><div class="appearance-preview-input"><b>Invoer</b><span>Single</span><span>Dubbel</span><span>Triple</span><span>MIS</span></div></div><p id="appearance-preview-note">De scorebediening staat tussen de spelers en het bord. Er worden geen scores ingevoerd.</p></aside></div>
<p id="appearance-status" role="status" aria-live="polite"></p><button id="appearance-reset" class="wide" type="button">Standaard herstellen</button><button id="appearance-close" class="wide" type="button">Sluiten</button>`;
document.body.append(dialog);
const open=document.createElement('button');open.id='appearance-open';open.type='button';open.textContent='Weergave aanpassen';open.onclick=()=>{fill();dialog.showModal();};actions.append(open);
const scoreLabels={average:'Gemiddelde / MPR',legs:'Legs en sets',best:'Beste beurt',darts:'Aantal gegooide darts',last:'Laatste beurt'};
for(const [key,text] of Object.entries(scoreLabels)){
 const label=document.createElement('label');label.className='appearance-check';const input=document.createElement('input');input.type='checkbox';input.id='appearance-score-'+key;label.append(input,document.createTextNode(text));$('appearance-score-options').append(label);
}
for(let i=0;i<4;i++){
 const row=document.createElement('div');row.className='appearance-player-row';const colorLabel=document.createElement('label'),color=document.createElement('input');color.type='color';color.id='appearance-color-'+i;colorLabel.append(document.createTextNode('Speler '+(i+1)),color);
 const symbolLabel=document.createElement('label'),symbol=document.createElement('select');symbol.id='appearance-symbol-'+i;symbolLabel.append(document.createTextNode('Symbool '+(i+1)),symbol);
 symbolNames.forEach((name,index)=>{const option=document.createElement('option');option.value=name;option.textContent=['Rondje','Kruis','Driehoek','Vierkant'][index];symbol.append(option);});row.append(colorLabel,symbolLabel);$('appearance-player-options').append(row);
}
function fill(){
 const p=getAppearance();for(const [field,key] of [['space','space'],['board','board'],['markers','markers'],['emphasis','emphasis'],['color-mode','colorMode']])$('appearance-'+field).value=p[key];$('appearance-score-mode').value=p.scoreboard.mode;$('appearance-focus').checked=p.focus;
 for(const key of Object.keys(scoreLabels)){$('appearance-score-'+key).checked=p.scoreboard[key];$('appearance-score-'+key).disabled=p.scoreboard.mode!=='custom';}
 for(let i=0;i<4;i++){$('appearance-color-'+i).value=p.colors[i];$('appearance-color-'+i).disabled=p.colorMode!=='custom';$('appearance-symbol-'+i).value=p.symbols[i];$('appearance-symbol-'+i).disabled=p.markers!=='shapes';}
 preview(p);
}
function preview(p){
 const panel=$('appearance-preview-players');panel.replaceChildren();panel.dataset.emphasis=p.emphasis;
 for(let i=0;i<2;i++){
  const card=document.createElement('article');card.className=i===0?'active':'';card.style.setProperty('--preview-color',p.colorMode==='custom'?p.colors[i]:['#5ce0ed','#ff78bc'][i]);const name=document.createElement('strong');name.textContent=['Speler 1','Speler 2'][i];if(p.markers!=='none')name.prepend(playerMarker(p.markers==='numbers'?'numbers':p.symbols[i],i));const score=document.createElement('b');score.textContent=['125','80'][i];card.append(name,score);
  if(p.scoreboard.mode==='custom')for(const [key,label] of Object.entries(scoreLabels))if(p.scoreboard[key]){const value=document.createElement('small');value.textContent=label+': '+({average:'45,2',legs:'1',best:'100',darts:'24',last:'T20 / 20 / 5'}[key]);card.append(value);}panel.append(card);
 }
 $('appearance-preview-board').replaceChildren(dartboard({target:20}));$('appearance-preview-layout').dataset.space=p.space;$('appearance-preview-note').hidden=p.focus;
}
function update(event){
 const previous=getAppearance(),p=getAppearance();
 for(const [field,key] of [['space','space'],['board','board'],['markers','markers'],['emphasis','emphasis'],['color-mode','colorMode']])p[key]=$('appearance-'+field).value;p.focus=$('appearance-focus').checked;p.scoreboard.mode=$('appearance-score-mode').value;
 for(const key of Object.keys(scoreLabels))p.scoreboard[key]=$('appearance-score-'+key).checked;
 for(let i=0;i<4;i++){p.colors[i]=$('appearance-color-'+i).value;p.symbols[i]=$('appearance-symbol-'+i).value;}
 const index=p.symbols.findIndex((s,i)=>event.target.id==='appearance-symbol-'+i);if(index>=0){const other=p.symbols.findIndex((s,i)=>i!==index&&s===p.symbols[index]);if(other>=0)p.symbols[other]=previous.symbols[index];}
 const saved=saveAppearance(p);$('appearance-status').textContent=saved?'Opgeslagen op dit apparaat.':'Toegepast voor deze sessie. Opslaan op dit apparaat is niet gelukt.';fill();
}
dialog.addEventListener('change',event=>{if(event.target.matches('input,select'))update(event);});
$('appearance-reset').onclick=()=>{saveAppearance(appearanceDefaults());fill();$('appearance-status').textContent='Standaardweergave hersteld.';};$('appearance-close').onclick=()=>dialog.close();
window.addEventListener('hitters-appearance',()=>{applyAppearanceDocument();if(dialog.open)fill();});applyAppearanceDocument();
