import importlib.util
import os
from pathlib import Path
import sys
import tarfile
import tempfile
from types import SimpleNamespace
from unittest.mock import patch

if os.name=='nt':sys.modules['fcntl']=SimpleNamespace()
spec=importlib.util.spec_from_file_location('nuc_update',Path(__file__).resolve().parents[1]/'nuc-update.py')
updater=importlib.util.module_from_spec(spec);spec.loader.exec_module(updater)
with tempfile.TemporaryDirectory() as tmp, patch.object(updater.os,'sync',create=True):
 root=Path(tmp)/'installed';root.mkdir();(root/'dist').mkdir()
 for name in ['index.html','app.js','engine.js','style.css']:(root/'dist'/name).write_text('old')
 (root/'dist/club-wifi.json').write_text('{"local":true}')
 (root/'dist/winner-trophy.jpg').write_bytes(b'')
 payload=Path(tmp)/'payload';(payload/'dist').mkdir(parents=True)
 for name in ['index.html','app.js','engine.js','style.css']:(payload/'dist'/name).write_text('new')
 for name in ['server.py','bluetooth-bridge.py','nuc-update.py','kiosk-control.py','camera-calibrate-gui.py']:(payload/name).write_text('# valid')
 (payload/'dist/winner-trophy.jpg').write_bytes(b'valid image')
 bundle=Path(tmp)/'bundle.tar.gz'
 def archive():
  with tarfile.open(bundle,'w:gz') as t:t.add(payload,arcname='.')
 updater.ROOT=root;updater.VERSION=root/'.version'
 archive();updater.install(bundle,'test')
 assert (root/'dist/index.html').read_text()=='new'
 assert (root/'dist.previous/index.html').read_text()=='old'
 assert (root/'dist/club-wifi.json').read_text()=='{"local":true}'
 assert (root/'dist/winner-trophy.jpg').read_bytes()==b'valid image'
 with patch.object(updater.shutil,'disk_usage',return_value=SimpleNamespace(free=1)):
  try:updater.install(bundle,'no-space')
  except OSError:pass
  else:raise AssertionError('Low disk must leave installation intact')
 assert (root/'dist/index.html').read_text()=='new'
 (payload/'dist/index.html').write_bytes(b'');archive()
 try:updater.install(bundle,'invalid')
 except ValueError:pass
 else:raise AssertionError('Empty update must be rejected')
 assert (root/'dist/index.html').read_text()=='new'
 (root/'dist/app.js').write_bytes(b'')
 assert not updater.healthy_dist(root/'dist')
 scratch=Path(tmp)/'temp';scratch.mkdir()
 stale=scratch/'180-hitters-download-old';stale.mkdir();(stale/'bundle').write_text('old')
 fresh=scratch/'180-hitters-update-current';fresh.mkdir()
 unrelated=scratch/'other-project';unrelated.mkdir()
 os.utime(stale,(1,1));os.utime(unrelated,(1,1))
 with patch.object(updater.tempfile,'gettempdir',return_value=str(scratch)),patch.object(updater.os,'getuid',return_value=stale.stat().st_uid,create=True):
  updater.cleanup_stale_updates()
 assert not stale.exists() and fresh.exists() and unrelated.exists()
 print('PASS: staged update verified, backup retained, venue preserved, empty bundle rejected and damaged installation detected')
