"""A NUC restart keeps the online lane key; invalid saved destinations stay inactive."""
from pathlib import Path
from urllib.request import Request,urlopen
import json,subprocess,sys,tempfile,time
ROOT=Path(__file__).resolve().parents[1];URL='http://127.0.0.1:8866'
with tempfile.TemporaryDirectory() as temp:
 path=Path(temp)/'match.json';process=None
 def start():
  global process
  process=subprocess.Popen([sys.executable,str(ROOT/'server.py'),'--host','127.0.0.1','--port','8866','--data-file',str(path)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  for attempt in range(50):
   try:urlopen(URL+'/api/state',timeout=1).close();return
   except OSError:time.sleep(.1)
  raise RuntimeError('Server did not start')
 def get():return json.load(urlopen(URL+'/api/online/local',timeout=3))
 try:
  start();saved={'active':True,'ready':True,'role':1,'code':'ABC234','key':'local-fixture-key-1234567890','base':'https://180-hitters-online.180-hitters-online.workers.dev','remoteRevision':9}
  result=json.load(urlopen(Request(URL+'/api/online/local',data=json.dumps(saved).encode(),headers={'Content-Type':'application/json'})));assert result==saved
  process.terminate();process.wait();start();assert get()==saved
  process.terminate();process.wait();path.with_name('match-online.json').write_text(json.dumps({**saved,'base':'http://untrusted.invalid'}));start();assert get()['active'] is False
  print('PASS: online lane survives NUC restart; invalid saved relay rejected')
 finally:
  if process:process.terminate();process.wait()
