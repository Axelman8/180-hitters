"""Top navigation and editable final visits across all twelve games."""
from pathlib import Path
import json,subprocess,sys,tempfile,time,urllib.request
from playwright.sync_api import sync_playwright,expect

root=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as tmp:
 server=subprocess.Popen([sys.executable,str(root/'server.py'),'--host','127.0.0.1','--port','8851','--data-file',str(Path(tmp)/'match.json')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  for _ in range(50):
   try:urllib.request.urlopen('http://127.0.0.1:8851/api/state',timeout=1).close();break
   except OSError:time.sleep(.1)
  with sync_playwright() as p:
   browser=p.chromium.launch();page=browser.new_page(viewport={'width':393,'height':852});errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
   base='http://127.0.0.1:8851';page.goto(base+'/?remote=1')
   fixtures=page.evaluate("""async()=>{
    const {newMatch,applyTurn,makeDart}=await import('/engine.js'),{botDart,botVisit}=await import('/bot.js');
    let seed=592174;const random=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296),fixtures=[];
    for(const game of ['x01','cricket','tactics','bobs27','gotcha','fourinarow','scram','killer','bull41','twentyone','tenlives','121']){
     let state=newMatch(['Anna','Bert'],game==='gotcha'?301:501,'double',1,{game:game==='121'?'x01':game,training121:game==='121',livesMode:'double',botLevels:[50,50]}),before;
     for(let visit=0;state.phase==='playing'&&visit<1500;visit++){
      let hits=[],turn=null;for(let tries=0;!turn&&tries<100;tries++){if(state.game==='killer'&&state.killerStage==='assigning')hits=[];hits.push(botDart(state,hits,random));turn=botVisit(state,hits);}
      if(!turn)throw Error(game+' no bot turn');before=state;state=applyTurn(state,turn);
     }
     if(state.phase==='playing')throw Error(game+' no end');
     for(const s of [before,state])s.players.forEach(p=>{p.bot=false;p.botLevel=0;});
     fixtures.push({game,before,after:state,input:state.history.at(-1).input});
    }return fixtures;
   }""")
   def saved():return page.request.get(base+'/api/state').json()
   for fixture in fixtures:
    for dialog in page.locator('dialog[open]').all():dialog.evaluate('d=>d.close()')
    page.evaluate("document.dispatchEvent(new Event('close-navigation'))")
    response=page.request.post(base+'/api/state',data={'revision':saved()['revision'],'match':{'state':fixture['after'],'undo':[fixture['before']],'inputPreferenceVersion':1,'preferredMode':'dart'}});assert response.ok,response.text()
    expect(page.locator('body')).to_have_attribute('data-game','x01' if fixture['game']=='121' else fixture['game'])
    expect(page.locator('#result-dialog')).to_be_visible(timeout=12000)
    expect(page.locator('#result-dialog>.dialog-navigation .dialog-back')).to_be_visible()
    page.locator('#result-dialog').evaluate('d=>d.scrollTop=d.scrollHeight')
    box=page.locator('#result-dialog>.dialog-navigation').bounding_box();assert box and box['y']<100,(fixture['game'],box)
    page.locator('#result-undo').click();expect(page.locator('#result-dialog')).to_be_hidden()
    expected=fixture['input'];game=fixture['game']
    if game=='tenlives':
     expect(page.locator('.lives-correction')).to_be_visible();page.locator('#lives-correction-0').click()
     value=not expected.get('trainingHit',False);page.locator('#lives-hit' if value else '#lives-miss').click()
     assert len(saved()['match']['state']['history'])==len(fixture['before']['history'])
     page.locator('#lives-correction-confirm').click()
    else:
     prefix='.four-darts' if game=='fourinarow' else '.sonny-darts' if game in ['scram','killer','bull41','twentyone'] else '#dart-slots'
     index=len(expected['hits'])-1;slots=page.locator(prefix+' button');expect(slots).to_have_count(3)
     for i,hit in enumerate(expected['hits']):
      label=('RAAK' if hit['number']==fixture['before']['bobsTarget'] and hit['mult']==2 else 'MIS') if game=='bobs27' else hit.get('label') if game=='fourinarow' else 'Mis' if not hit['number'] else ('Bull' if hit['mult']==2 else '25') if hit['number']==25 else ('D' if hit['mult']==2 else 'T' if hit['mult']==3 else '')+str(hit['number'])
      expect(slots.nth(i)).to_contain_text(label)
     page.wait_for_timeout(650);assert saved()['match']['editTurn']['hits']==expected['hits']
     slots.nth(index).click()
     if game=='fourinarow':page.locator('.four-miss').click()
     elif game in ['scram','killer','bull41','twentyone']:page.locator('.sonny-actions').get_by_role('button',name='Mis',exact=True).click()
     else:page.locator('#visual-miss' if game in ['cricket','tactics'] else '#miss-dart').click()
     assert len(saved()['match']['state']['history'])==len(fixture['before']['history']),'A correction must wait for confirmation'
     # An early finish may originally have used fewer than three darts.
     for extra in range(len(expected['hits']),3):
      page.locator(prefix+' button').nth(extra).click()
      if game=='fourinarow':page.locator('.four-miss').click()
      elif game in ['scram','killer','bull41','twentyone']:page.locator('.sonny-actions').get_by_role('button',name='Mis',exact=True).click()
      else:page.locator('#visual-miss' if game in ['cricket','tactics'] else '#miss-dart').click()
     confirm='.four-actions .primary' if game=='fourinarow' else '.sonny-actions .primary' if game in ['scram','killer','bull41','twentyone'] else '#submit'
     page.locator(confirm).click()
    deadline=time.monotonic()+7
    while time.monotonic()<deadline:
     current=saved()['match']
     if len(current['state']['history'])>len(fixture['before']['history']):break
     page.wait_for_timeout(100)
    assert len(current['state']['history'])==len(fixture['before']['history'])+1,(game,page.locator('#message').inner_text())
    assert current['editTurn'] is None
    if game!='tenlives':
     actual=current['state']['history'][-1]['input']['hits'];assert actual[index]['number']==0
     assert [(d['number'],d['mult']) for d in actual[:index]]==[(d['number'],d['mult']) for d in expected['hits'][:index]]
    print('PASS final visit correction:',game,flush=True)
   assert not errors,errors;browser.close()
 finally:server.terminate();server.wait()
