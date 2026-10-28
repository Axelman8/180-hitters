"""Local AutoDarts reader with explicit wake command; no camera ownership.

All scoring queue access uses the host server's match lock. The browser runs the
existing rules and the server atomically commits its result and event receipt.
Restart/disconnect retains the on/off choice but requires a new empty-board
observation; manual edits rebase the queue without replaying existing darts.
"""
import json
import os
from pathlib import Path
import queue
import shutil
import threading
import time
import uuid
from urllib.request import Request, urlopen


def dart(value):
    if value.get('bouncer'):
        return {'number': 0, 'mult': 1}
    segment = value.get('segment', {})
    number, mult = segment.get('number'), segment.get('multiplier')
    if segment.get('bed') == 'Outside' and type(mult) is int and mult == 0 and type(number) is int and number in (0, *range(1,21),25):
        return {'number': 0, 'mult': 1}
    if segment.get('name') in ('MISS', 'Miss', 'MIS', 'OFF') or number == 0:
        return {'number': 0, 'mult': 1}
    if type(number) is not int or number not in (*range(1, 21), 25) or type(mult) is not int or mult not in (1, 2, 3) or (number == 25 and mult == 3):
        raise ValueError('Onbekende camerameting; controleer de dart handmatig.')
    return {'number': number, 'mult': mult}


class AutoDartsBridge:
    def __init__(self, lock, directory, base='http://127.0.0.1:3180'):
        self.lock, self.directory, self.base = lock, Path(directory), base
        self.enabled = False
        self.recording = True
        self.connected = False
        self.message = 'Handmatige invoer'
        self.pending = []
        self.armed = False
        self.closed = False
        self.seen = []
        self.expected_revision = None
        self.latest = None
        self.available = False
        self.jobs = queue.Queue(maxsize=3)
        self.dropped = 0
        self.capture_error = ''
        self.last_sample = None
        self.analysis_status = 'Nog geen vergelijkbare worp'
        self.starting_until = 0
        self.blocked = ''
        self.resume_blocker = lambda: ''

    def status(self):
        return dict(available=self.available, connected=self.connected,
                    enabled=self.enabled, recording=self.recording,
                    armed=self.armed, message=self.message,
                    pending=self.pending[0] if self.pending else None,
                    droppedCaptures=self.dropped, captureError=self.capture_error,
                    analysis=self.analysis_status, waiting=self.enabled and not self.armed)

    def pause(self, reason='Camera-invoer gepauzeerd; controleer de beurt en hervat met leeg bord.'):
        self.armed = False
        self.closed = False
        self.seen = []
        self.pending.clear()
        self.message = reason

    def follow(self, revision, blocked='', continue_visit=False):
        """Rebase after a manual edit, retaining the user's on/off choice.

        A corrected per-dart draft can continue the same physical visit only
        when the caller verified its length against the detector snapshot.
        Committed/manual totals and history changes require a fresh empty board.
        """
        self.expected_revision = revision
        self.blocked = blocked
        self.pending.clear()
        self.closed = False
        self.armed = False
        self.seen = []
        if not self.enabled:
            return
        self.message = blocked or 'Camera aan; haal de darts uit het bord om verder te spelen.'
        if continue_visit and not blocked and self.latest and self.latest.get('running'):
            try:
                self.seen = [dart(t) for t in self.latest.get('throws', [])]
                self.armed = True
                self.message = 'Camera-invoer actief; handmatige correctie overgenomen.'
            except (ValueError, TypeError, AttributeError):
                pass

    def configure(self, enabled, recording, revision):
        if enabled and self.latest and not self.latest.get('running'):
            # Official local lifecycle endpoint, verified against Detection 2.0.2.
            # Wake only on explicit user request; never alter calibration/account.
            with urlopen(Request(self.base+'/api/start', method='PUT'), timeout=3) as r:
                r.read(1024)
            self.starting_until = time.monotonic()+10
        self.recording = recording
        self.pending.clear()
        self.enabled = enabled
        self.armed = False
        self.closed = False
        self.seen = []
        self.expected_revision = revision
        self.blocked = ''
        self.message = 'Haal alle darts uit het bord om te beginnen.' if enabled else 'Handmatige invoer'

    def reset_detector(self):
        """Clear Detection's current visit without changing calibration or cameras."""
        with urlopen(Request(self.base + '/api/reset', method='POST'), timeout=4) as response:
            response.read(1024)
        self.pending.clear()
        self.armed = False
        self.closed = False
        self.seen = []
        self.blocked = ''
        self.message = "Camera's gereset; wacht op een leeg bord."

    def push(self, kind, hit=None):
        if len(self.pending) >= 8:
            self.pause('Te veel onverwerkte cameraworpen. Controleer de stand en hervat.')
            return
        self.pending.append(dict(id=uuid.uuid4().hex, kind=kind, hit=hit))

    def acknowledge(self, event_id, revision, closed=False):
        if not self.pending or self.pending[0]['id'] != event_id:
            raise ValueError('Deze cameraworp is al verwerkt of vervallen.')
        event = self.pending.pop(0)
        self.expected_revision = revision
        if event['kind'] == 'removed':
            self.closed = False
        if closed:
            self.closed = True
            self.pending = [p for p in self.pending if p['kind'] == 'removed']
        self.message = 'Beurt verwerkt; haal de darts uit het bord.' if self.closed else 'Camera-invoer actief'

    def observe(self, value):
        self.available = self.connected = True
        self.latest = value
        n = value.get('numThrows')
        throws = value.get('throws', [])
        if type(n) is not int or not 0 <= n <= 3 or not isinstance(throws, list) or len(throws) != n:
            if self.enabled: self.pause('Onvolledige camerameting. Controleer de beurt.')
            return
        if not value.get('running'):
            if self.enabled and time.monotonic() < self.starting_until:
                self.message = 'AutoDarts start de camera’s; houd het bord leeg.'
                return
            if self.enabled: self.pause('AutoDarts is gestopt. Hervat na controle.')
            return
        self.starting_until = 0
        empty = n == 0 and value.get('status') == 'Throw'
        if not self.enabled:
            return
        if self.blocked:
            self.message = self.blocked
            return
        if not self.armed:
            if empty:
                reason = self.resume_blocker()
                if reason:
                    self.message = reason
                    return
                self.armed = True
                self.seen = []
                self.message = 'Camera-invoer actief'
            return
        try:
            hits = [dart(t) for t in throws]
        except (ValueError, TypeError, AttributeError):
            self.pause('Onbekende camerameting. Controleer de dart handmatig en hervat.')
            return
        if empty and self.seen:
            # Keep removal ordered behind all still pending darts.
            self.push('removed')
            self.seen = []
            return
        if hits and any(e['kind'] == 'removed' for e in self.pending):
            self.pause('Nieuwe worp voordat de vorige beurt is verwerkt. Controleer de stand.')
            return
        if hits[:len(self.seen)] != self.seen:
            self.pause('AutoDarts heeft een bestaande worp gewijzigd. Controleer de beurt handmatig.')
            return
        for hit in hits[len(self.seen):]:
            if not self.closed: self.push('dart', hit)
        self.seen = hits

    def fetch(self, endpoint, limit=4_000_000):
        with urlopen(self.base + '/api/' + endpoint, timeout=1.5) as r:
            data = r.read(limit + 1)
            if len(data) > limit: raise ValueError('Diagnostisch antwoord te groot')
            return data

    def start(self):
        threading.Thread(target=self.poll, daemon=True, name='autodarts-poll').start()
        threading.Thread(target=self.record, daemon=True, name='autodarts-observations').start()

    def poll(self):
        previous = None
        while True:
            started = time.monotonic()
            try:
                raw = self.fetch('state', 100_000)
                value = json.loads(raw)
                if not isinstance(value, dict): raise ValueError('Ongeldige camerastatus')
                with self.lock:
                    self.observe(value)
                    capture = self.recording and raw != previous
                if capture:
                    try: self.jobs.put_nowait((time.time(), value))
                    except queue.Full: self.dropped += 1
                previous = raw
            except Exception:
                with self.lock:
                    self.connected = False
                    if self.enabled: self.pause('Camera aan; verbinding verloren. Herstel volgt automatisch met een leeg bord.')
                previous = None
            time.sleep(max(.05, .15 - (time.monotonic() - started)))

    def prune(self):
        # Only our generated UUID observation directories, no links or other files.
        if self.directory.is_symlink(): raise OSError('Opnamemap mag geen koppeling zijn')
        self.directory.mkdir(parents=True, exist_ok=True)
        items = []
        for p in self.directory.iterdir():
            if p.is_symlink() or not p.is_dir() or len(p.name) != 32 or any(c not in '0123456789abcdef' for c in p.name): continue
            size = sum(f.stat().st_size for f in p.iterdir() if f.is_file() and not f.is_symlink())
            items.append((p.stat().st_mtime, p, size))
        items.sort()
        total = sum(x[2] for x in items)
        while items and (len(items) >= 80 or total > 96 * 1024 * 1024 or items[0][0] < time.time() - 7*86400):
            _, p, size = items.pop(0)
            shutil.rmtree(p)
            total -= size

    def record(self):
        while True:
            stamp, state = self.jobs.get()
            try:
                if not self.recording: continue
                self.prune()
                if shutil.disk_usage(self.directory).free < 300*1024*1024:
                    raise OSError('Te weinig vrije opslag voor cameraonderzoek')
                folder = self.directory / uuid.uuid4().hex
                folder.mkdir()
                before_state = json.loads(self.fetch('state', 100_000))
                meta = dict(time=stamp, detector='autodarts', state=state,
                            verifiedByHuman=False, previousCapture=self.last_sample,
                            note='Sequential diagnostic snapshots, not synchronized impact frames; automatic scores are not ground truth.')
                paths = ['state/motion', 'config/calibration/geometry', 'config/calibration/ellipses',
                         'img/cams/0', 'img/cams/1', 'img/cams/2', 'img/detection']
                errors = {}
                for endpoint in paths:
                    try:
                        data = self.fetch(endpoint)
                        suffix = '.jpg' if endpoint.startswith('img/') else '.json'
                        (folder / (endpoint.replace('/', '-') + suffix)).write_bytes(data)
                    except Exception as exc: errors[endpoint] = type(exc).__name__
                meta['errors'] = errors
                after_state = json.loads(self.fetch('state', 100_000))
                meta['consistentVisit'] = (state.get('throws',[]) == before_state.get('throws',[]) == after_state.get('throws',[])
                                           and state.get('numThrows') == before_state.get('numThrows') == after_state.get('numThrows'))
                (folder / 'observation.json').write_text(json.dumps(meta), encoding='utf-8')
                try:
                    from camera_research import analyze
                    report = analyze(folder, self.directory/self.last_sample if self.last_sample else None)
                    (folder/'analysis.json').write_text(json.dumps(report), encoding='utf-8')
                    self.analysis_status = report['status']
                except Exception as exc:
                    self.analysis_status = 'Analyse niet beschikbaar: ' + type(exc).__name__
                self.last_sample = folder.name
                self.capture_error = ''
                summary = {'note':'Agreement with AutoDarts is not independently measured accuracy.',
                           'retained':0, 'estimated':0, 'agreement':0, 'humanVerified':0, 'statuses':{}}
                for p in self.directory.glob('*/analysis.json'):
                    if p.is_symlink() or p.parent.is_symlink(): continue
                    report = json.loads(p.read_text())
                    summary['retained'] += 1
                    status = report.get('status','unknown')
                    summary['statuses'][status] = summary['statuses'].get(status,0)+1
                    summary['estimated'] += int('candidateLabel' in report)
                    summary['agreement'] += int(report.get('agreesWithAutodarts') is True)
                temp = self.directory/'research-summary.tmp'
                temp.write_text(json.dumps(summary,indent=2),encoding='utf-8')
                temp.replace(self.directory/'research-summary.json')
            except Exception as exc:
                self.capture_error = str(exc)
            finally:
                self.jobs.task_done()
