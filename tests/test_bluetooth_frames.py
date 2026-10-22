"""Run the actual relay without BlueZ; emulate a transport with short writes."""
import ast
import io
import json
from pathlib import Path
from types import SimpleNamespace

source=Path(__file__).resolve().parents[1]/'bluetooth-bridge.py'
tree=ast.parse(source.read_text(encoding='utf-8'))
relay=next(node for node in tree.body if isinstance(node,ast.FunctionDef) and node.name=='relay')
payload={'match':{'history':[{'target':13,'attempts':8,'label':'Mis'} for _ in range(5000)]}}
wire=json.dumps({'id':7,'clientToken':'test','method':'GET','path':'/api/state'}).encode()+b'\n'

class ShortStream(io.BytesIO):
 def write(self,data):
  # A single unbuffered socket write need not transmit the complete frame.
  sent.append(data[:127])
  return min(127,len(data))

class Connection:
 def makefile(self,*args,**kwargs):return ShortStream(wire)
 def sendall(self,data):
  for offset in range(0,len(data),127):sent.append(data[offset:offset+127])
 def close(self):pass

class Upstream:
 def __init__(self,*args,**kwargs):pass
 def request(self,*args,**kwargs):pass
 def getresponse(self):return SimpleNamespace(status=200,read=lambda limit:json.dumps(payload).encode())
 def close(self):pass

sent=[]
env={'json':json,'TOKEN':'test','http':SimpleNamespace(client=SimpleNamespace(HTTPConnection=Upstream)),'release_active':lambda c:None}
exec(compile(ast.Module(body=[relay],type_ignores=[]),str(source),'exec'),env)
env['relay'](Connection(),'test')
response=b''.join(sent)
assert response.endswith(b'\n'),'Incomplete frame makes Android readLine wait until timeout'
decoded=json.loads(response)
assert decoded['id']==7 and decoded['body']==payload
assert len(response)>100_000
print('PASS: large Bluetooth frame remains complete across short transport writes')
