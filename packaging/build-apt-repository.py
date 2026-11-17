"""Create the Linux package index and its OpenPGP trust chain for GitHub Pages.

The public key is pinned in the source tree. Private signing material is supplied
by the release environment and is never written to the published directory.
"""
from pathlib import Path
from datetime import datetime, timedelta, timezone
from email.utils import format_datetime
import argparse
import gzip
import hashlib
import os
import re
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
KEYS = ROOT / 'packaging/linux-signing'


def build(package, output, home):
    fingerprint = (KEYS / 'fingerprint.txt').read_text().strip()
    keys = subprocess.check_output(['gpg', '--homedir', str(home), '--batch',
                                    '--with-colons', '--list-secret-keys', fingerprint], text=True)
    if not any(row.startswith('fpr:') and row.split(':')[9] == fingerprint for row in keys.splitlines()):
        raise ValueError('The signing key does not match the pinned public key')
    control = subprocess.check_output(['dpkg-deb', '--field', str(package)], text=True)
    fields = dict(row.split(': ', 1) for row in control.splitlines() if ': ' in row and not row.startswith(' '))
    version = fields.get('Version', '')
    if fields.get('Package') != 'dartsapp' or fields.get('Architecture') != 'amd64' or not re.fullmatch(r'\d+\.\d+\.\d+', version):
        raise ValueError('Expected a versioned amd64 dartsapp package')
    apt = output / 'apt'
    pool = apt / 'pool'; pool.mkdir(parents=True, exist_ok=True)
    target = pool / f'dartsapp_{version}_amd64.deb'
    shutil.copy2(package, target)
    digest = hashlib.sha256(target.read_bytes()).hexdigest()
    index = (control.rstrip() + f'\nFilename: pool/{target.name}\nSize: {target.stat().st_size}\nSHA256: {digest}\n\n').encode()
    (apt / 'Packages').write_bytes(index)
    (apt / 'Packages.gz').write_bytes(gzip.compress(index, mtime=0))
    now = datetime.now(timezone.utc)
    release = ('Origin: 180 Hitters\nLabel: 180 Hitters\nSuite: stable\nCodename: stable\n'
               'Architectures: amd64\nDescription: 180 Hitters Linux packages\n'
               f'Date: {format_datetime(now, usegmt=True)}\n'
               f'Valid-Until: {format_datetime(now + timedelta(days=90), usegmt=True)}\nSHA256:\n')
    for name in ('Packages', 'Packages.gz'):
        data = (apt / name).read_bytes()
        release += f' {hashlib.sha256(data).hexdigest()} {len(data)} {name}\n'
    (apt / 'Release').write_text(release, encoding='utf-8')
    gpg = ['gpg', '--homedir', str(home), '--batch', '--yes', '--pinentry-mode', 'loopback',
           '--passphrase-fd', '0', '--local-user', fingerprint, '--digest-algo', 'SHA256']
    password = (os.environ.get('LINUX_APT_PASSPHRASE', '') + '\n').encode()
    for options, destination in [(['--clearsign'], 'InRelease'), (['--armor', '--detach-sign'], 'Release.gpg')]:
        subprocess.run([*gpg, '--output', str(apt / destination), *options, str(apt / 'Release')], input=password, check=True)
    # A detached signature is also available for independent verification of
    # a manually downloaded installer. APT uses InRelease and Packages instead.
    subprocess.run([*gpg, '--output', str(apt / (package.name + '.asc')), '--armor', '--detach-sign', str(package)],
                   input=password, check=True)
    for name in ('180-hitters-archive-keyring.gpg', '180-hitters-archive-keyring.asc', '180-hitters.sources', 'fingerprint.txt'):
        shutil.copy2(KEYS / name, apt / name)
    (output / '.nojekyll').touch()
    (output / 'README.txt').write_text(
        '180 Hitters signed Linux package source\n\n'
        f'Latest package: {version}\nSigning fingerprint: {fingerprint}\n\n'
        'Install the official .deb from https://github.com/Axelman8/180-hitters/releases/latest\n'
        'once using your Linux administrator password. It includes the application,\n'
        'this source and its restricted public key. APT then verifies future packages.\n'
        'A downloaded script cannot authorize or trust itself on a new computer.\n', encoding='utf-8')
    print(f'Signed Linux repository: dartsapp {version}, key {fingerprint}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--package', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--gpg-home', type=Path, required=True)
    args = parser.parse_args()
    build(args.package.resolve(), args.output.resolve(), args.gpg_home.resolve())
