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
        return response.read()


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


def install(bundle, version):
    with tempfile.TemporaryDirectory(prefix='180-hitters-update-') as directory:
        extracted = Path(directory) / 'payload'
        extracted.mkdir()
        with tarfile.open(bundle, 'r:gz') as archive:
            for member in archive.getmembers():
                target = (extracted / member.name).resolve()
                if extracted.resolve() not in target.parents and target != extracted.resolve():
                    raise ValueError('Onveilig pad in update')
            archive.extractall(extracted, filter='data')
        required = ['dist', 'server.py', 'bluetooth-bridge.py', 'nuc-update.py']
        if any(not (extracted / item).exists() for item in required):
            raise ValueError('NUC-update is niet compleet')
        next_dist = ROOT / 'dist.next'
        old_dist = ROOT / 'dist.previous'
        shutil.rmtree(next_dist, ignore_errors=True)
        shutil.copytree(extracted / 'dist', next_dist)
        # Legacy venue wifi remains in dist; the current venue.json lives next
        # to the server and is therefore never replaced by an application update.
        for name in ('club-wifi.json',):
            local = ROOT / 'dist' / name
            if local.is_file(): shutil.copy2(local, next_dist / name)
        shutil.rmtree(old_dist, ignore_errors=True)
        if (ROOT / 'dist').exists(): (ROOT / 'dist').replace(old_dist)
        next_dist.replace(ROOT / 'dist')
        for name in ('server.py', 'bluetooth-bridge.py', 'nuc-update.py'):
            temporary = ROOT / (name + '.next')
            shutil.copy2(extracted / name, temporary)
            temporary.replace(ROOT / name)
        VERSION.write_text(version + '\n', encoding='utf-8')
        shutil.rmtree(old_dist, ignore_errors=True)


def main():
    lock_path = ROOT / '.update.lock'
    with lock_path.open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        try:
            write_status(state='checking', message='GitHub op updates controleren…')
            release = json.loads(fetch(REPOSITORY))
            latest = release['tag_name'].lstrip('vV')
            current = VERSION.read_text(encoding='utf-8').strip() if VERSION.exists() else '0.0.0'
            if version_parts(latest) <= version_parts(current):
                write_status(state='current', version=current, message=f'NUC is actueel ({current}).')
                return
            assets = {asset['name']: asset['browser_download_url'] for asset in release['assets']}
            with tempfile.TemporaryDirectory(prefix='180-hitters-download-') as directory:
                bundle = Path(directory) / '180-hitters-nuc.tar.gz'
                bundle.write_bytes(fetch(assets['180-hitters-nuc.tar.gz']))
                expected = fetch(assets['180-hitters-nuc.tar.gz.sha256']).decode().split()[0].lower()
                actual = hashlib.sha256(bundle.read_bytes()).hexdigest()
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
