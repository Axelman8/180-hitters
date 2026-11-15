"""Upgrade a 1.8.22-style user installation without losing club data."""
from pathlib import Path
import importlib.util,json,tempfile
from types import SimpleNamespace
from unittest.mock import patch

root=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('legacy',root/'packaging/migrate-legacy.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
for existing in [False,True]:
 with tempfile.TemporaryDirectory() as tmp:
  base=Path(tmp);home=base/'home';source=home/'.local/share/oche-darts';source.mkdir(parents=True)
  units=home/'.config/systemd/user';units.mkdir(parents=True)
  for name in module.UNITS:(units/name).write_text('old unit')
  (source/'server.py').write_text('old server');(source/'.version').write_text('1.8.22')
  old={'match':{'state':{'game':'tactics','startedAt':100,'players':[{'name':'Legacy'}],'history':[{'score':20}]}},'revision':7}
  (source/'match.json').write_text(json.dumps(old));(source/'match-players.json').write_text('["Legacy"]');(source/'venue.json').write_text('{"venueName":"Club"}')
  (source/'dist').mkdir();(source/'dist/winner-stage-custom.jpg').write_bytes(b'club artwork')
  data=base/'data';data.mkdir();app=base/'app';(app/'dist').mkdir(parents=True)
  current={'match':{'state':{'game':'x01','startedAt':200,'players':[{'name':'Current'}]}}} if existing else {'match':None}
  (data/'match.json').write_text(json.dumps(current));(data/'match-players.json').write_text('["Current"]' if existing else '[]')
  account=SimpleNamespace(pw_dir=str(home),pw_uid=1000,pw_name='test');stopped=[]
  assert module.migrate(account,data,app,stop=lambda *args:stopped.append(True))
  assert stopped==[True]
  assert json.loads((data/'match.json').read_text())==(current if existing else old)
  assert json.loads((data/'match-players.json').read_text())==(['Current','Legacy'] if existing else ['Legacy'])
  assert json.loads((data/'legacy-backups/1000/match.json').read_text())==old
  assert (app/'dist/winner-stage-custom.jpg').read_bytes()==b'club artwork'
  assert len(list((data/'match-games').glob('*.json')))==1
  assert all((units/name).is_symlink() and (units/name).readlink()==Path('/dev/null') for name in module.UNITS)
  assert not module.migrate(account,data,app,stop=lambda *args:stopped.append(True))
  assert stopped==[True] and (source/'match.json').is_file()
  kiosk=data/'kiosk-1000';kiosk.mkdir();(kiosk/'.kiosk-switch.lock').write_text('desktop user file')
  owners=[]
  with patch.object(module.os,'chown',create=True,side_effect=lambda path,*args:owners.append(Path(path))):module.set_data_owner(data,SimpleNamespace(pw_uid=123,pw_gid=123))
  assert data/'match.json' in owners and all(path!=kiosk and kiosk not in path.parents for path in owners)
print('PASS: legacy service retirement, data migration, existing-game preservation, archive import, artwork, backup and repeat installation')
