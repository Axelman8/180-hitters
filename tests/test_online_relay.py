"""Private 2-4 player relay accepts only the active player's next turn."""
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen
import copy, json, subprocess, sys, time

root = Path(__file__).resolve().parents[1]
process = subprocess.Popen([sys.executable, str(root/'online-relay.py'), '--port', '8812'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
base = 'http://127.0.0.1:8812'

def request(path, method='GET', value=None):
    data = json.dumps(value).encode() if value is not None else None
    try:
        with urlopen(Request(base+path, data=data, method=method, headers={'Content-Type':'application/json'}), timeout=3) as response:
            return response.status, json.loads(response.read())
    except HTTPError as error:
        return error.code, json.loads(error.read())

try:
    for _ in range(30):
        try:
            if request('/health')[0] == 200: break
        except OSError: time.sleep(.1)
    match = {'undo':[], 'state':{'version':2,'game':'fourinarow','phase':'playing','active':0,'winner':None,'history':[],
        'players':[{'name':'A'},{'name':'B'},{'name':'C'},{'name':'D'}], 'fourBoard':['bb']*25,'fourOwners':[None]*25}}
    status, host = request('/rooms', 'POST', {'name':'Axel','match':match})
    assert status == 201 and host['role'] == 0 and host['joined'] == 1 and host['capacity'] == 4
    guests=[]
    for name in ('Bert','Cato','Daan'):
        status, guest=request(f"/rooms/{host['code']}/join",'POST',{'name':name})
        assert status == 200; guests.append(guest)
    assert request(f"/rooms/{host['code']}/join",'POST',{'name':'Extra'})[0] == 409
    current=request(f"/rooms/{host['code']}?key={host['key']}")[1]
    wrong=copy.deepcopy(current['match']);wrong['state']['history'].append({'player':1});wrong['state']['active']=2
    assert request(f"/rooms/{host['code']}/state",'POST',{'key':guests[0]['key'],'revision':current['revision'],'match':wrong})[0] == 403
    won=copy.deepcopy(current['match']);won['state']['history'].append({'player':0,'darts':1});won['state'].update(phase='won',winner=0)
    status, final=request(f"/rooms/{host['code']}/state",'POST',{'key':host['key'],'revision':current['revision'],'match':won})
    assert status == 200 and final['match']['state']['phase'] == 'won'
    print('PASS: private online dartbaan supports four players, turn ownership and a winning final dart')
finally:
    process.terminate();process.wait()
