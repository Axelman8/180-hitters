"""Retention never deletes active data or newest backup, even above the cap."""
from pathlib import Path
import importlib.util, tempfile, os
from types import SimpleNamespace
from unittest.mock import patch
root=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('darts_server',root/'server.py')
server=importlib.util.module_from_spec(spec);spec.loader.exec_module(server)
with tempfile.TemporaryDirectory() as directory:
 base=Path(directory);backups=base/'match-backups';backups.mkdir()
 active=base/'match.json';active.write_text('active party')
 unrelated=backups/'notes.json';unrelated.write_text('keep')
 def populate(n,size=10):
  for i in range(n):
   p=backups/(f'{i:032x}'+'.json');p.write_bytes(b'x'*size);os.utime(p,(100+i,100+i))
 populate(35)
 server.prune_backups(backups)
 assert len(list(backups.glob('0*.json')))==30
 assert not (backups/(f'{0:032x}'+'.json')).exists()
 assert (backups/(f'{34:032x}'+'.json')).exists()
 server.prune_backups(backups,max_bytes=25)
 assert len(list(backups.glob('0*.json')))==2
 newest=backups/(f'{34:032x}'+'.json')
 newest.write_bytes(b'x'*100);os.utime(newest,(1000,1000))
 server.prune_backups(backups,max_bytes=25)
 assert newest.exists() and len(list(backups.glob('0*.json')))==1
 assert active.read_text()=='active party' and unrelated.read_text()=='keep'
 with patch.object(server.shutil,'disk_usage',return_value=SimpleNamespace(free=server.STORAGE_RESERVE)):
  assert not server.room_for(base,{'match':'some data'})
 with patch.object(server.shutil,'disk_usage',return_value=SimpleNamespace(free=server.STORAGE_RESERVE+10000)):
  assert server.room_for(base,{'match':'some data'})
 try:
  link=base/'linked';link.symlink_to(backups,target_is_directory=True)
 except OSError:pass
 else:
  server.prune_backups(link,max_bytes=0)
  assert newest.exists()
 print('PASS: count/byte limits, newest preservation, unrelated/active data, linked directory and low-space guard')
