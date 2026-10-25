"""Build the Debian package on a Linux release runner."""
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile

version = sys.argv[1]
camera_bundle = '--cameras' in sys.argv[2:]
assert re.fullmatch(r'\d+\.\d+\.\d+', version)
with tempfile.TemporaryDirectory(prefix='dartsapp-package-') as tmp:
    root = Path(tmp)
    root.chmod(0o755)
    def write(name, text, executable=False):
        path = root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding='utf-8')
        path.chmod(0o755 if executable else 0o644)

    shutil.copytree('dist', root / 'usr/lib/dartsapp/dist')
    shutil.copy2('server.py', root / 'usr/lib/dartsapp/server.py')
    for name in ('autodarts_bridge.py', 'camera_research.py'):
        shutil.copy2(name, root / 'usr/lib/dartsapp' / name)
    shutil.copy2('packaging/camera-setup.py', root / 'usr/lib/dartsapp/camera-setup.py')
    write('usr/share/icons/hicolor/scalable/apps/dartsapp.svg', Path('packaging/dartsapp.svg').read_text())
    write('usr/bin/dartsapp-camera', '#!/bin/sh\nexec python3 /usr/lib/dartsapp/camera-setup.py "$@"\n', True)
    write('etc/xdg/autostart/dartsapp-camera.desktop', '''[Desktop Entry]
Type=Application
Name=180 Hitters camera-opstart
Exec=dartsapp-camera --autostart
Terminal=false
X-GNOME-Autostart-enabled=true
''')
    write('usr/share/applications/dartsapp-camera.desktop', '''[Desktop Entry]
Type=Application
Name=Camera's instellen
Comment=180 Hitters camera-installatie en kalibratie
Exec=dartsapp-camera
Icon=dartsapp
Terminal=false
Categories=Game;Sports;
''')
    write('usr/share/doc/dartsapp/CAMERA-INSTALLATIE.txt', Path('packaging/CAMERA-INSTALLATIE.txt').read_text())
    write('usr/share/applications/dartsapp-display.desktop', '''[Desktop Entry]
Type=Application
Name=Schermrichting instellen
Comment=Landscape of portrait kiezen voor 180 Hitters
Exec=gnome-control-center display
Icon=video-display
Terminal=false
Categories=Settings;
''')
    write('usr/lib/dartsapp/.version', version + '\n')
    write('usr/lib/dartsapp/.desktop-platform', 'linux\n')
    write('usr/share/doc/dartsapp/INSTALLER-HELP.txt', Path('packaging/INSTALLER-HELP.txt').read_text())
    write('DEBIAN/control', f'''Package: dartsapp
Version: {version}
Section: games
Priority: optional
Architecture: amd64
Maintainer: Axelman8 <noreply@users.noreply.github.com>
Depends: python3 (>= 3.10), systemd, adduser, xdg-utils, xdg-user-dirs, libglib2.0-bin, python3-tk, curl, ca-certificates, gnome-control-center
Recommends: firefox-esr | firefox | chromium | chromium-browser
Homepage: https://github.com/Axelman8/180-hitters
Description: 180 Hitters touchscreen darts scoreboard
 Local darts scoreboard with mobile control over the local network.
''')
    write('lib/systemd/system/dartsapp.service', '''[Unit]
Description=DartsApp - 180 Hitters
After=network.target
[Service]
Type=simple
User=dartsapp
Group=dartsapp
StateDirectory=dartsapp
WorkingDirectory=/var/lib/dartsapp
ExecStart=/usr/bin/python3 /usr/lib/dartsapp/server.py --data-file /var/lib/dartsapp/match.json
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
[Install]
WantedBy=multi-user.target
''')
    write('DEBIAN/postinst', ('''#!/bin/sh
set -e
if [ "$1" = configure ]; then
  if ! getent passwd dartsapp >/dev/null; then
    adduser --system --group --home /var/lib/dartsapp --no-create-home dartsapp
  fi
  @CAMERA_ENABLE@
  if [ -d /run/systemd/system ]; then
    systemctl daemon-reload
    systemctl enable dartsapp.service
    systemctl restart dartsapp.service
  fi
fi
''').replace('@CAMERA_ENABLE@', 'mkdir -p /etc/dartsapp; touch /etc/dartsapp/camera-enabled' if camera_bundle else ':'), True)
    write('DEBIAN/prerm', '''#!/bin/sh
set -e
if [ -d /run/systemd/system ]; then
  case "$1" in remove|deconfigure) systemctl stop dartsapp.service; systemctl disable dartsapp.service ;; esac
fi
''', True)
    write('DEBIAN/postrm', '''#!/bin/sh
set -e
if [ -d /run/systemd/system ]; then systemctl daemon-reload; fi
# Preserve saved games, including on purge.
''', True)
    write('usr/bin/dartsapp', '#!/bin/sh\nexec xdg-open http://127.0.0.1:8765\n', True)
    write('usr/share/applications/dartsapp.desktop', '''[Desktop Entry]
Type=Application
Name=180 Hitters
Comment=180 Hitters dartscorebord
Exec=dartsapp
Icon=dartsapp
Terminal=false
Categories=Game;Sports;
StartupNotify=false
''')
    subprocess.run(['dpkg-deb', '--root-owner-group', '--build', tmp,
                    '180-Hitters-NUC-Cameras-Ubuntu-amd64.deb' if camera_bundle else 'DartsApp-Ubuntu-Debian-amd64.deb'], check=True)
