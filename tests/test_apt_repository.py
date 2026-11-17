"""Use real APT, isolated lists/cache and no installation or root permissions."""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import hashlib
import os
import shutil
import subprocess
import sys
import tempfile
import threading

ROOT = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1]).resolve()
public_key = ROOT / 'packaging/linux-signing/180-hitters-archive-keyring.gpg'


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


with tempfile.TemporaryDirectory(prefix='180-hitters-apt-test-') as temporary:
    folder = Path(temporary)
    site = folder / 'site'; shutil.copytree(source, site)
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(site)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        def config(label, key=public_key):
            work = folder / label; work.mkdir()
            for name in ('lists/partial', 'cache/archives/partial', 'downloads'):
                (work / name).mkdir(parents=True)
            sources = work / 'source.list'
            sources.write_text(f'deb [arch=amd64 signed-by={key}] http://127.0.0.1:{server.server_port}/apt/ ./\n')
            options = ['-o', 'Dir::Etc::sourcelist=' + str(sources), '-o', 'Dir::Etc::sourceparts=-',
                       '-o', 'Dir::State::lists=' + str(work / 'lists'), '-o', 'Dir::Cache=' + str(work / 'cache'),
                       '-o', 'Dir::State::status=/dev/null', '-o', 'Acquire::Retries=0',
                       '-o', 'APT::Update::Error-Mode=any']
            return work, options

        def apt(work, options, *args):
            return subprocess.run(['apt-get', *options, *args], cwd=work / 'downloads',
                                  capture_output=True, text=True, timeout=45, env={**os.environ, 'LC_ALL': 'C'})

        work, options = config('valid')
        result = apt(work, options, 'update')
        assert result.returncode == 0, result.stdout + result.stderr
        result = apt(work, options, 'download', 'dartsapp')
        assert result.returncode == 0, result.stdout + result.stderr
        package = next((site / 'apt/pool').glob('*.deb'))
        downloaded = next((work / 'downloads').glob('*.deb'))
        assert hashlib.sha256(downloaded.read_bytes()).digest() == hashlib.sha256(package.read_bytes()).digest()
        subprocess.run(['gpgv', '--keyring', str(public_key), str(site / 'apt/DartsApp-Ubuntu-Debian-amd64.deb.asc'),
                        str(package)], check=True, capture_output=True)
        print('PASS: real APT accepts the signed source and verifies the downloaded installer')

        # Downloaded package bytes must match the signature-protected index.
        changed = bytearray(package.read_bytes()); changed[-1] ^= 1
        package.write_bytes(changed); downloaded.unlink()
        result = apt(work, options, 'download', 'dartsapp')
        assert result.returncode != 0 and 'Hash Sum mismatch' in result.stderr, result.stdout + result.stderr
        print('PASS: real APT rejects a changed installer')

        # An attacker cannot substitute a package index with a different hash.
        for name in ('Packages', 'Packages.gz'):
            (site / 'apt' / name).write_bytes((site / 'apt' / name).read_bytes() + b'TAMPERED')
        work, options = config('bad-index')
        result = apt(work, options, 'update')
        assert result.returncode != 0, result.stdout + result.stderr
        print('PASS: real APT rejects a changed package index')

        shutil.copy2(source / 'apt/Packages', site / 'apt/Packages')
        shutil.copy2(source / 'apt/Packages.gz', site / 'apt/Packages.gz')
        empty = folder / 'wrong-keyring.gpg'; empty.touch()
        work, options = config('wrong-key', empty)
        result = apt(work, options, 'update')
        assert result.returncode != 0, result.stdout + result.stderr
        print('PASS: real APT rejects an untrusted signing key')

        (site / 'apt/InRelease').unlink(); (site / 'apt/Release.gpg').unlink()
        work, options = config('unsigned')
        result = apt(work, options, 'update')
        assert result.returncode != 0 and 'not signed' in result.stderr, result.stdout + result.stderr
        print('PASS: real APT rejects an unsigned source; no trust bypass is used')
    finally:
        server.shutdown(); server.server_close()
