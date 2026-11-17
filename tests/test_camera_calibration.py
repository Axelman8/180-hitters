"""Native Detection compatibility and isolated calibration jobs; no real cameras."""
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
import json,sys,tempfile,threading,time,unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from autodarts_bridge import AutoDartsBridge,dart

def native(hits):
 return {'connected':True,'running':True,'status':'takeout' if len(hits)==3 else 'throw','throws':[{'segmentNumber':n,'multiplier':m,'segmentName':'S'+str(n),'bed':'SingleInner','failed':False} for n,m in hits]}

class Detector(BaseHTTPRequestHandler):
 posts=[];starts=0;failure='';release=threading.Event();transient=False;value=native([])
 def log_message(self,*args):pass
 def do_GET(self):
  if self.failure=='backup' and self.path.endswith('/ellipses'):self.send_error(500);return
  value=self.value if self.path=='/api/state' else {'calibrated':bool(self.value['running']),'numCams':3 if self.value['running'] else 0,'cams':[]} if self.path.endswith('/geometry') else {'0':{},'1':{},'2':{}}
  self.send_response(200);self.end_headers();self.wfile.write(json.dumps(value).encode())
 def do_PUT(self):
  assert self.path=='/api/start';Detector.starts+=1;Detector.value=native([])
  self.send_response(204);self.end_headers()
 def do_POST(self):
  Detector.posts.append((self.path,self.headers.get('Content-Type'),self.rfile.read(int(self.headers.get('Content-Length','0')))))
  self.release.wait(3)
  if self.failure=='post':self.send_error(500);return
  if self.transient and len(self.posts)==1:self.send_error(400);return
  self.send_response(204);self.end_headers()

class CalibrationTest(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.server=ThreadingHTTPServer(('127.0.0.1',0),Detector);threading.Thread(target=cls.server.serve_forever,daemon=True).start()
 @classmethod
 def tearDownClass(cls):cls.server.shutdown();cls.server.server_close()
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
  Detector.posts=[];Detector.starts=0;Detector.value=native([]);Detector.failure='';Detector.transient=False;Detector.release=threading.Event();Detector.release.set()
  self.bridge=AutoDartsBridge(threading.Lock(),Path(self.temp.name)/'observations','http://127.0.0.1:'+str(self.server.server_port))
  self.bridge.observe(native([]));self.bridge.configure(True,False,7);self.bridge.observe(native([]))
 def wait(self,stage):
  end=time.monotonic()+6
  while time.monotonic()<end:
   if self.bridge.calibration['stage']==stage:return
   time.sleep(.02)
  self.fail(self.bridge.status())
 def test_flat_and_nested_darts_and_lowercase_visits(self):
  b=self.bridge;b.observe(native([(2,1)]));self.assertEqual(b.pending[0]['hit'],{'number':2,'mult':1})
  self.assertEqual(b.latest['numThrows'],1);self.assertEqual(b.latest['status'],'Throw')
  b.observe(native([(2,1)]));self.assertEqual(len(b.pending),1)
  b.observe(native([(2,1),(20,2),(25,2)]));self.assertEqual(len(b.pending),3)
  b.observe(native([]));self.assertEqual(b.pending[-1]['kind'],'removed')
  self.assertEqual(dart({'segment':{'number':20,'multiplier':3}}),{'number':20,'mult':3})
  self.assertEqual(dart({'segmentNumber':20,'multiplier':0,'bed':'Outside'}),{'number':0,'mult':1})
  with self.assertRaises(ValueError):dart({'segmentNumber':20,'multiplier':1,'failed':True})
  b.observe({**native([]),'numThrows':2});self.assertFalse(b.armed)
 def test_calibration_backs_up_retries_and_never_scores_test_darts(self):
  Detector.transient=True;saved=[]
  with self.bridge.lock:self.bridge.start_calibration(lambda:saved.append(False))
  self.wait('testing');self.assertEqual(saved,[False]);self.assertFalse(self.bridge.enabled)
  self.assertEqual(len(Detector.posts),2)
  self.assertTrue(all(path=='/api/config/calibration/auto' and kind is None and body==b'' for path,kind,body in Detector.posts))
  folders=list((Path(self.temp.name)/'camera-calibration-backups').iterdir());self.assertEqual(len(folders),1)
  self.assertEqual(json.loads((folders[0]/'geometry.json').read_text())['numCams'],3)
  self.bridge.observe(native([(20,1),(19,3),(25,2)]));self.assertFalse(self.bridge.pending)
  self.assertEqual(self.bridge.calibration_status()['testHits'],[{'number':20,'mult':1},{'number':19,'mult':3},{'number':25,'mult':2}])
  self.bridge.configure(True,False,7);self.assertFalse(self.bridge.armed)
  self.bridge.observe(native([]));self.assertTrue(self.bridge.armed);self.assertFalse(self.bridge.pending)
 def test_busy_duplicate_and_resume_rejected(self):
  Detector.release.clear()
  try:
   with self.bridge.lock:self.bridge.start_calibration()
   with self.assertRaises(ValueError):self.bridge.start_calibration()
   with self.assertRaises(ValueError):self.bridge.configure(True,False,7)
   with self.assertRaises(ValueError):self.bridge.reset_detector()
  finally:Detector.release.set();self.wait('testing')
  self.assertEqual(len(Detector.posts),1)
 def test_board_not_empty_does_not_disable_existing_input(self):
  self.bridge.observe(native([(1,1)]))
  with self.assertRaises(ValueError):self.bridge.start_calibration()
  self.assertTrue(self.bridge.enabled);self.assertFalse(Detector.posts)
 def test_backup_failure_never_requests_calibration(self):
  Detector.failure='backup'
  with self.bridge.lock:self.bridge.start_calibration()
  self.wait('error');self.assertFalse(Detector.posts);self.assertFalse(self.bridge.enabled)
 def test_error_keeps_scoring_off(self):
  Detector.failure='post'
  with self.bridge.lock:self.bridge.start_calibration()
  self.wait('error');self.assertFalse(self.bridge.enabled);self.assertIn('500',self.bridge.calibration['message'])
 def test_restart_resumes_stopped_detector_without_calibrating(self):
  self.bridge.observe({**native([]),'running':False,'status':'stopped'})
  self.bridge.reset_detector();self.assertEqual(Detector.starts,1);self.assertFalse(Detector.posts)
  self.assertEqual(self.bridge.calibration['stage'],'idle');self.assertFalse(self.bridge.armed)
  self.bridge.observe(native([]));self.assertTrue(self.bridge.armed)
 def test_calibration_can_wake_stopped_detector(self):
  Detector.value={**native([]),'running':False,'status':'stopped'};self.bridge.observe(Detector.value)
  with self.bridge.lock:self.bridge.start_calibration()
  self.wait('testing');self.assertEqual(Detector.starts,1);self.assertEqual(len(Detector.posts),1);self.assertFalse(self.bridge.enabled)
  folder=next((Path(self.temp.name)/'camera-calibration-backups').iterdir())
  self.assertEqual(json.loads((folder/'geometry.json').read_text())['numCams'],3,'Back up the loaded saved calibration, not the stopped detector runtime')

if __name__=='__main__':unittest.main()
