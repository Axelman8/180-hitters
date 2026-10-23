"""Run the actual relay without BlueZ; emulate a transport with short writes."""
import ast
import io
import json
import gzip
import base64
from pathlib import Path
from types import SimpleNamespace

source=Path(__file__).resolve().parents[1]/'bluetooth-bridge.py'
tree=ast.parse(source.read_text(encoding='utf-8'))
functions=[node for node in tree.body if isinstance(node,ast.FunctionDef) and node.name in ('relay','send_frame','decode_body','encode_response')]
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
  assert len(data)<=1024,'Large RFCOMM writes can stall on the real device'
  for offset in range(0,len(data),127):sent.append(data[offset:offset+127])
 def close(self):pass

class Upstream:
 def __init__(self,*args,**kwargs):pass
 def request(self,*args,**kwargs):pass
 def getresponse(self):return SimpleNamespace(status=200,read=lambda limit:json.dumps(payload).encode())
 def close(self):pass

sent=[]
env={'json':json,'gzip':gzip,'base64':base64,'io':io,'TOKEN':'test','http':SimpleNamespace(client=SimpleNamespace(HTTPConnection=Upstream)),'release_active':lambda c:None}
exec(compile(ast.Module(body=functions,type_ignores=[]),str(source),'exec'),env)
env['relay'](Connection(),'test')
response=b''.join(sent)
assert response.endswith(b'\n'),'Incomplete frame makes Android readLine wait until timeout'
decoded=json.loads(response)
assert decoded['id']==7 and decoded['body']==payload
assert len(response)>100_000
print('PASS: large Bluetooth frame remains complete across short transport writes')

legacy_size=len(response)
sent.clear()
request={'id':8,'clientToken':'test','method':'POST','path':'/api/state','acceptEncoding':'gzip','bodyGzip':base64.b64encode(gzip.compress(json.dumps(payload).encode())).decode()}
assert json.loads(env['decode_body'](request))==payload
wire=json.dumps(request).encode()+b'\n'
env['relay'](Connection(),'compressed-test')
response=b''.join(sent);decoded=json.loads(response)
assert decoded['id']==8 and decoded['capabilities']==['gzip']
assert json.loads(gzip.decompress(base64.b64decode(decoded['bodyGzip'])))==payload
assert len(response)<legacy_size/10
assert env['encode_response']({},200,payload)['body']==payload
assert env['encode_response']({'acceptEncoding':'gzip'},409,payload)['status']==409
assert env['encode_response']({'acceptEncoding':'gzip'},200,{'ok':True})['body']=={'ok':True}
assert json.loads(env['decode_body']({'body':{'value':'Ren?'}}))=={'value':'Ren?'}
try:env['decode_body']({'bodyGzip':base64.b64encode(gzip.compress(b' ' * 10000001)).decode()})
except ValueError:pass
else:raise AssertionError('Decompressed size limit must be enforced')
print(f'PASS: request/response compression, legacy compatibility, errors and size limit; {legacy_size} -> {len(response)} bytes')
