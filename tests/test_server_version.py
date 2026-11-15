"""An update on disk must not claim that an old server process is current."""
from pathlib import Path
import json,os,shutil,subprocess,sys,tempfile,time,urllib.request

root=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as tmp:
 app=Path(tmp)
 for name in ['server.py','autodarts_bridge.py','camera_research.py']:shutil.copy2(root/name,app/name)
 (app/'.version').write_text('1.8.22');(app/'.desktop-platform').write_text('linux')
 def start():
  return subprocess.Popen([sys.executable,str(app/'server.py'),'--host','127.0.0.1','--port','8798','--data-file',str(app/'match.json')],env={**os.environ,'DARTS_AUTODARTS_URL':'http://127.0.0.1:1'},stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 def info():
  with urllib.request.urlopen('http://127.0.0.1:8798/api/desktop-installation',timeout=2) as response:return json.load(response)
 def ready():
  for attempt in range(40):
   try:return info()
   except OSError:time.sleep(.1)
  raise AssertionError('Version-test server did not start')
 process=start()
 try:
  assert ready()['version']=='1.8.22'
  (app/'.version').write_text('1.9.25')
  assert info()=={'platform':'linux','version':'1.8.22','runningVersion':'1.8.22','installedVersion':'1.9.25','nativeUpdate':False}
  process.terminate();process.wait();process=start()
  assert ready()['runningVersion']=='1.9.25'
 finally:process.terminate();process.wait()
print('PASS: running and installed versions remain distinct until the replacement server starts')
