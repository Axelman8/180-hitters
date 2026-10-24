#!/usr/bin/env python3
"""Install a verified 180 Hitters NUC bundle from the latest GitHub release."""
from pathlib import Path
from urllib.request import Request, urlopen
import fcntl
import hashlib
import json
import os
import shutil
import subprocess
import tarfile
import tempfile
import time

REPOSITORY = 'https://api.github.com/repos/axelman8/180-hitters/releases/latest'
ROOT = Path(__file__).resolve().parent
STATUS = ROOT / 'update-status.json'
VERSION = ROOT / '.version'


def fetch(url):
    request = Request(url, headers={'Accept': 'application/vnd.github+json',
                                    'X-GitHub-Api-Version': '2022-11-28',
                                    'User-Agent': '180-Hitters-NUC'})
    with urlopen(request, timeout=30) as response:
        data = response.read(2 * 1024 * 1024 + 1)
        if len(data) > 2 * 1024 * 1024: raise ValueError('Update-informatie is te groot')
        return data


def download(url, target):
    request = Request(url, headers={'User-Agent': '180-Hitters-NUC'})
    with urlopen(request, timeout=30) as response, target.open('wb') as output:
        total = 0
        while True:
            chunk = response.read(65536)
            if not chunk: break
            total += len(chunk)
            if total > 200 * 1024 * 1024: raise ValueError('Update-download is te groot')
            if shutil.disk_usage(target.parent).free < 50 * 1024 * 1024 + len(chunk):
                raise OSError('Te weinig vrije opslag voor de update; huidige installatie blijft behouden')
            output.write(chunk)


def digest(path):
    value = hashlib.sha256()
    with Path(path).open('rb') as handle:
        for chunk in iter(lambda: handle.read(65536), b''): value.update(chunk)
    return value.hexdigest()


def cleanup_stale_updates():
    # Only this updater's abandoned temporary directories, owned by this user.
    base = Path(tempfile.gettempdir()).resolve()
    for directory in base.iterdir():
        if not directory.name.startswith(('180-hitters-download-', '180-hitters-update-')) or directory.is_symlink() or not directory.is_dir(): continue
        info = directory.stat()
        if info.st_uid != os.getuid() or time.time()-info.st_mtime < 7*24*3600: continue
        if directory.resolve().parent != base: continue
        shutil.rmtree(directory)


def write_status(**values):
    data = {'time': int(time.time()), **values}
    temporary = STATUS.with_suffix('.tmp')
    temporary.write_text(json.dumps(data, ensure_ascii=False), encoding='utf-8')
    temporary.replace(STATUS)


def version_parts(value):
    result = []
    for part in value.lstrip('vV').split('.'):
        digits = ''.join(c for c in part if c.isdigit())
        result.append(int(digits or 0))
    return tuple(result)


def healthy_dist(directory):
    required = ('index.html', 'app.js', 'engine.js', 'style.css')
    return all((directory / name).is_file() and (directory / name).stat().st_size > 0
               for name in required) and all(p.stat().st_size > 0 for p in directory.rglob('*') if p.is_file())


def durable_copy(source, target):
    # Verify staged data and flush it before making a new installation visible.
    source, target = Path(source), Path(target)
    with source.open('rb') as incoming, target.open('wb') as outgoing:
        shutil.copyfileobj(incoming, outgoing)
        outgoing.flush()
        os.fsync(outgoing.fileno())
    if digest(source) != digest(target):
        raise ValueError('Gekopieerd updatebestand wijkt af: ' + source.name)


def install(bundle, version):
    with tempfile.TemporaryDirectory(prefix='180-hitters-update-') as directory:
        extracted = Path(directory) / 'payload'
        extracted.mkdir()
        with tarfile.open(bundle, 'r:gz') as archive:
            size = sum(member.size for member in archive.getmembers())
            if size > 512 * 1024 * 1024: raise ValueError('Uitgepakte update is te groot')
            if any(shutil.disk_usage(place).free < size + 50 * 1024 * 1024 for place in (ROOT, extracted)):
                raise OSError('Te weinig vrije opslag voor de update; huidige installatie blijft behouden')
            for member in archive.getmembers():
                target = (extracted / member.name).resolve()
                if extracted.resolve() not in target.parents and target != extracted.resolve():
                    raise ValueError('Onveilig pad in update')
            archive.extractall(extracted, filter='data')
        required = ['dist', 'server.py', 'bluetooth-bridge.py', 'nuc-update.py']
        if any(not (extracted / item).exists() for item in required):
            raise ValueError('NUC-update is niet compleet')
        if not healthy_dist(extracted / 'dist'):
            raise ValueError('NUC-update bevat lege of ontbrekende appbestanden')
        next_dist = ROOT / 'dist.next'
        old_dist = ROOT / 'dist.previous'
        shutil.rmtree(next_dist, ignore_errors=True)
        shutil.copytree(extracted / 'dist', next_dist, copy_function=durable_copy)
        # Venue-owned data and licensed/local winner artwork are not distributed
        # through GitHub and must survive an atomic application update.
        preserved = ['club-wifi.json']
        preserved.extend(path.name for path in (ROOT / 'dist').glob('winner-stage*.jpg'))
        preserved.extend(path.name for path in (ROOT / 'dist').glob('winner-stage*.jpeg'))
        preserved.append('winner-trophy.jpg')
        for name in dict.fromkeys(preserved):
            local = ROOT / 'dist' / name
            if local.is_file() and local.stat().st_size > 0:
                durable_copy(local, next_dist / name)
        if not healthy_dist(next_dist):
            raise ValueError('Nieuwe appbestanden zijn niet compleet; huidige versie blijft behouden')
        os.sync()
        shutil.rmtree(old_dist, ignore_errors=True)
        if (ROOT / 'dist').exists(): (ROOT / 'dist').replace(old_dist)
        next_dist.replace(ROOT / 'dist')
        for name in ('autodarts_bridge.py', 'camera_research.py', 'server.py', 'bluetooth-bridge.py', 'nuc-update.py'):
            if name in ('autodarts_bridge.py', 'camera_research.py') and not (extracted / name).exists(): continue
            temporary = ROOT / (name + '.next')
            durable_copy(extracted / name, temporary)
            temporary.replace(ROOT / name)
        VERSION.write_text(version + '\n', encoding='utf-8')
        os.sync()
        # Keep the previous installation available for recovery after a restart.


def main():
    lock_path = ROOT / '.update.lock'
    with lock_path.open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        try:
            try: cleanup_stale_updates()
            except OSError: pass
            write_status(state='checking', message='GitHub op updates controleren…')
            release = json.loads(fetch(REPOSITORY))
            latest = release['tag_name'].lstrip('vV')
            current = VERSION.read_text(encoding='utf-8').strip() if VERSION.exists() else '0.0.0'
            if version_parts(latest) <= version_parts(current) and healthy_dist(ROOT / 'dist'):
                write_status(state='current', version=current, message=f'NUC is actueel ({current}).')
                return
            assets = {asset['name']: asset['browser_download_url'] for asset in release['assets']}
            with tempfile.TemporaryDirectory(prefix='180-hitters-download-') as directory:
                bundle = Path(directory) / '180-hitters-nuc.tar.gz'
                download(assets['180-hitters-nuc.tar.gz'], bundle)
                expected = fetch(assets['180-hitters-nuc.tar.gz.sha256']).decode().split()[0].lower()
                actual = digest(bundle)
                if actual != expected: raise ValueError('Controlesom van NUC-update klopt niet')
                write_status(state='installing', version=latest, message=f'NUC-versie {latest} installeren…')
                install(bundle, latest)
            write_status(state='updated', version=latest, message=f'NUC is bijgewerkt naar {latest}.')
            subprocess.run(['systemctl', '--user', 'restart', 'oche-darts-bluetooth.service'], check=False)
            subprocess.run(['systemctl', '--user', 'restart', 'oche-darts.service'], check=False)
        except Exception as error:
            write_status(state='error', message=f'NUC-update mislukt: {error}')
            raise


if __name__ == '__main__':
    main()
