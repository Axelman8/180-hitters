// Update a playfield in place. Its measured frames, focus, scroll position and
// unchanged SVG geometry survive a new dart or a synchronized server revision.
const fitted=new Set(['--four-size','--fitted-width','--fitted-height','--killer-available','--lives-board-size']);
const handlers=['onclick','onkeydown','oninput','onchange','onpointerdown','onpointerup'];
const decoration=n=>n.nodeType===1&&(n.id==='bot-status'||n.matches('.game-player-action,.game-bot-slot,.appearance-summary,.appearance-marker'));
function key(n){
 if(n.nodeType!==1)return n.nodeName;
 if(n.id)return '#'+n.id;
 for(const attr of ['data-cell','data-number','data-score-info','data-field','data-ring'])if(n.hasAttribute(attr))return n.nodeName+':'+attr+':'+n.getAttribute(attr);
 const cls=n.getAttribute('class')||'';
 const structural=cls.split(/\s+/).find(c=>/^(four-|killer-|sea-|party-|visual-|graphic-|sonny-|lives-|life-|stage-board-frame|player-top|remaining|stats|match-score|player-statistics)/.test(c));
 return n.nodeName+(structural?'.'+structural:'');
}
const same=(a,b)=>a.nodeType===b.nodeType&&a.nodeName===b.nodeName&&key(a)===key(b);
function styles(current,next){
 const frame=current.classList.contains('stage-board-frame');
 for(const name of Array.from(current.style))if(!next.style.getPropertyValue(name)&&!fitted.has(name)&&!(frame&&['height','flex','flex-grow','flex-shrink','flex-basis'].includes(name)))current.style.removeProperty(name);
 for(const name of Array.from(next.style))if(current.style.getPropertyValue(name)!==next.style.getPropertyValue(name)||current.style.getPropertyPriority(name)!==next.style.getPropertyPriority(name))current.style.setProperty(name,next.style.getPropertyValue(name),next.style.getPropertyPriority(name));
}
function attributes(current,next){
 // Hitters' guide visibility is owned by its viewport measurement, not by the
 // fresh renderer's initially-hidden placeholder.
 const measured=current.classList.contains('lives-board-frame');
 for(const attr of Array.from(current.attributes))if(attr.name!=='style'&&!(measured&&attr.name==='hidden')&&!next.hasAttribute(attr.name))current.removeAttribute(attr.name);
 for(const attr of Array.from(next.attributes)){
  if(attr.name==='style'||measured&&attr.name==='hidden')continue;
  if(current.getAttribute(attr.name)!==attr.value)current.setAttribute(attr.name,attr.value);
 }
 styles(current,next);
 for(const name of handlers)if(current[name]!==next[name])current[name]=next[name];
}
function normalizeFrames(current,next){
 for(const image of Array.from(next.children).filter(n=>n.matches('.graphic-dartboard,.killer-dartboard,.golf-course'))){
  const prior=Array.from(current.children).find(n=>n.classList.contains('stage-board-frame'));
  if(prior){const frame=prior.cloneNode(false);image.replaceWith(frame);frame.append(image);}
 }
}
function children(current,next){
 normalizeFrames(current,next);
 const old=Array.from(current.childNodes).filter(n=>!decoration(n)),used=new Set();
 let cursor=current.firstChild;
 for(const fresh of Array.from(next.childNodes)){
  while(cursor&&decoration(cursor))cursor=cursor.nextSibling;
  const kept=(cursor&&!used.has(cursor)&&same(cursor,fresh)?cursor:old.find(n=>!used.has(n)&&same(n,fresh)))||fresh;
  if(kept!==fresh){used.add(kept);patchView(kept,fresh);}
  if(kept!==cursor)current.insertBefore(kept,cursor);
  cursor=kept.nextSibling;
 }
 for(const node of old)if(!used.has(node)&&node.parentNode===current)node.remove();
}
export function patchView(current,next){
 if(current.nodeType!==1){if(current.nodeValue!==next.nodeValue)current.nodeValue=next.nodeValue;return current;}
 attributes(current,next);children(current,next);return current;
}
export const draftView=root=>root.cloneNode(false);
export function replaceViewChildren(root,...nodes){const draft=draftView(root);draft.append(...nodes);return patchView(root,draft);}
