"""Temporary 2-4 player 4-in-a-row relay for a Cloudflare Quick Tunnel."""
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from threading import Lock
from urllib.parse import urlsplit, parse_qs
import argparse, copy, json, secrets, string, time

lock = Lock()
rooms = {}
ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

def reply(handler, status, value):
    body=json.dumps(value,ensure_ascii=False,allow_nan=False).encode()
    handler.send_response(status);handler.send_header('Content-Type','application/json')
    handler.send_header('Access-Control-Allow-Origin','*');handler.send_header('Access-Control-Allow-Headers','Content-Type')
    handler.send_header('Cache-Control','no-store');handler.send_header('Content-Length',str(len(body)));handler.end_headers();handler.wfile.write(body)

def clean_match(match, allow_finished=True):
    if not isinstance(match,dict) or not isinstance(match.get('undo',[]),list): raise ValueError('Ongeldige partij.')
    state=match.get('state') or {};players=state.get('players')
    phases=('playing','won') if allow_finished else ('playing',)
    if state.get('version')!=2 or state.get('game')!='fourinarow' or not isinstance(players,list) or not 2<=len(players)<=4 or state.get('phase') not in phases: raise ValueError('Online test ondersteunt alleen een 4-op-een-rij-partij met twee tot vier spelers.')
    if not isinstance(state.get('history'),list) or len(json.dumps(match,ensure_ascii=False).encode())>2_000_000: raise ValueError('Ongeldige partijgegevens.')
    return copy.deepcopy(match)

def public(room):
    return {'code':room['code'],'revision':room['revision'],'match':room['match'],'joined':sum(key is not None for key in room['keys']),'capacity':len(room['keys']),'updated':room['updated']}

class Handler(BaseHTTPRequestHandler):
    def log_message(self,*_): pass
    def do_OPTIONS(self):
        self.send_response(204);self.send_header('Access-Control-Allow-Origin','*');self.send_header('Access-Control-Allow-Headers','Content-Type');self.send_header('Access-Control-Allow-Methods','GET,POST,OPTIONS');self.end_headers()
    def read(self):
        length=int(self.headers.get('Content-Length','0'))
        if not 0<length<=2_000_000: raise ValueError('Ongeldige berichtgrootte.')
        return json.loads(self.rfile.read(length))
    def room(self,code,key):
        room=rooms.get(code)
        if not room or key not in room['keys']: return None
        return room
    def do_GET(self):
        parsed=urlsplit(self.path);parts=parsed.path.strip('/').split('/');query=parse_qs(parsed.query)
        if parsed.path=='/health': return reply(self,200,{'ok':True})
        if len(parts)==2 and parts[0]=='rooms':
            with lock:
                room=self.room(parts[1].upper(),query.get('key',[''])[0])
                return reply(self,200,public(room)) if room else reply(self,404,{'error':'Partijcode of sleutel is ongeldig.'})
        reply(self,404,{'error':'Onbekend verzoek.'})
    def do_POST(self):
        try: incoming=self.read()
        except (ValueError,TypeError,json.JSONDecodeError) as error: return reply(self,400,{'error':str(error) or 'Ongeldige invoer.'})
        parsed=urlsplit(self.path);parts=parsed.path.strip('/').split('/')
        try:
            with lock:
                now=time.time()
                for code in list(rooms):
                    if now-rooms[code]['updated']>8*3600: rooms.pop(code,None)
                if parsed.path=='/rooms':
                    match=clean_match(incoming.get('match'),False);name=str(incoming.get('name','')).strip()[:24]
                    if not name: raise ValueError('Vul jouw naam in.')
                    code=''.join(secrets.choice(ALPHABET) for _ in range(6))
                    while code in rooms: code=''.join(secrets.choice(ALPHABET) for _ in range(6))
                    match['state']['players'][0]['name']=name
                    for index in range(1,len(match['state']['players'])):match['state']['players'][index]['name']=f'Wachten op speler {index+1}'
                    keys=[secrets.token_urlsafe(24),*([None]*(len(match['state']['players'])-1))]
                    room={'code':code,'keys':keys,'match':match,'revision':1,'updated':now};rooms[code]=room
                    return reply(self,201,{**public(room),'key':keys[0],'role':0})
                if len(parts)==3 and parts[0]=='rooms' and parts[2]=='join':
                    room=rooms.get(parts[1].upper());name=str(incoming.get('name','')).strip()[:24]
                    if not room:return reply(self,404,{'error':'Partij niet gevonden.'})
                    try:role=room['keys'].index(None)
                    except ValueError:return reply(self,409,{'error':'Deze partij is al vol.'})
                    if not name:raise ValueError('Vul jouw naam in.')
                    room['keys'][role]=secrets.token_urlsafe(24);room['match']['state']['players'][role]['name']=name;room['revision']+=1;room['updated']=now
                    return reply(self,200,{**public(room),'key':room['keys'][role],'role':role})
                if len(parts)==3 and parts[0]=='rooms' and parts[2]=='state':
                    code=parts[1].upper();key=incoming.get('key');room=self.room(code,key)
                    if not room:return reply(self,404,{'error':'Partijcode of sleutel is ongeldig.'})
                    if incoming.get('revision')!=room['revision']:return reply(self,409,public(room))
                    role=room['keys'].index(key);old=room['match']['state'];match=clean_match(incoming.get('match'));new=match['state']
                    if old.get('active')!=role: return reply(self,403,{'error':'De tegenstander is aan de beurt.'})
                    if len(new['history'])!=len(old['history'])+1 or new['history'][:-1]!=old['history'] or new['history'][-1].get('player')!=role: raise ValueError('Alleen één nieuwe eigen beurt mag worden verzonden.')
                    if new.get('fourBoard')!=old.get('fourBoard') or [p.get('name') for p in new['players']]!=[p.get('name') for p in old['players']]:raise ValueError('Bord of spelers zijn onverwacht gewijzigd.')
                    room['match']=match;room['revision']+=1;room['updated']=now
                    return reply(self,200,public(room))
        except (ValueError,TypeError) as error:return reply(self,400,{'error':str(error)})
        reply(self,404,{'error':'Onbekend verzoek.'})

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--host',default='127.0.0.1');parser.add_argument('--port',type=int,default=8790);args=parser.parse_args()
    ThreadingHTTPServer((args.host,args.port),Handler).serve_forever()
