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
    for name in ('autodarts_bridge.py', 'camera_research.py', 'bluetooth-bridge.py', 'nuc-update.py', 'kiosk-control.py'):
        shutil.copy2(name, root / 'usr/lib/dartsapp' / name)
    (root / 'usr/local/sbin').mkdir(parents=True, exist_ok=True)
    shutil.copy2('system-control.py', root / 'usr/local/sbin/darts-system')
    (root / 'usr/local/sbin/darts-system').chmod(0o755)
    write('etc/sudoers.d/dartsapp-system', 'dartsapp ALL=(root) NOPASSWD: /usr/local/sbin/darts-system\n')
    (root / 'etc/sudoers.d/dartsapp-system').chmod(0o440)
    shutil.copy2('packaging/camera-setup.py', root / 'usr/lib/dartsapp/camera-setup.py')
    shutil.copy2('camera-calibrate-gui.py', root / 'usr/lib/dartsapp/camera-calibrate-gui.py')
    (root / 'usr/sbin').mkdir(parents=True, exist_ok=True)
    shutil.copy2('calibreer-cameras.py', root / 'usr/sbin/calibreer-cameras')
    (root / 'usr/sbin/calibreer-cameras').chmod(0o755)
    write('usr/share/icons/hicolor/scalable/apps/dartsapp.svg', Path('packaging/dartsapp.svg').read_text())
    write('usr/bin/dartsapp-camera', '#!/bin/sh\nexec python3 /usr/lib/dartsapp/camera-setup.py "$@"\n', True)
    write('usr/bin/dartsapp-camera-calibrate', '#!/bin/sh\nexec python3 /usr/lib/dartsapp/camera-calibrate-gui.py "$@"\n', True)
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
    write('usr/share/applications/dartsapp-camera-calibrate.desktop', '''[Desktop Entry]
Type=Application
Name=Camera's 50 Hz + kalibreren
Comment=USB-camera's detecteren en AutoDarts opnieuw kalibreren
Exec=dartsapp-camera-calibrate
Icon=dartsapp
Terminal=false
Categories=Settings;Utility;
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
Depends: python3 (>= 3.10), python3-dbus, python3-gi, bluez, systemd, sudo, adduser, xdg-utils, xdg-user-dirs, libglib2.0-bin, python3-tk, curl, ca-certificates, gnome-control-center, v4l-utils, policykit-1
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
    write('lib/systemd/system/dartsapp-bluetooth.service', '''[Unit]
Description=180 Hitters Bluetooth bridge
Wants=bluetooth.service
Requires=dartsapp.service
After=bluetooth.service dartsapp.service
ConditionPathExists=/sys/class/bluetooth/hci0
[Service]
Type=simple
Environment=DARTS_CONTROL_TOKEN=d7c87006c31f4da2a4348eeb05b59c8b
ExecStartPre=/usr/bin/bluetoothctl --timeout 5 power on
ExecStartPre=/usr/bin/bluetoothctl --timeout 5 pairable on
ExecStartPre=/usr/bin/bluetoothctl --timeout 5 discoverable on
ExecStart=/usr/bin/python3 /usr/lib/dartsapp/bluetooth-bridge.py
Restart=on-failure
RestartSec=3
TimeoutStartSec=20
[Install]
WantedBy=multi-user.target
''')
    write('lib/systemd/system/dartsapp-update.service', '''[Unit]
Description=Update 180 Hitters from GitHub
After=network-online.target
[Service]
Type=oneshot
ExecStartPre=/usr/bin/rm -f /var/lib/dartsapp/update.request
ExecStart=/usr/bin/python3 /usr/lib/dartsapp/nuc-update.py
''')
    write('lib/systemd/system/dartsapp-update.path', '''[Unit]
Description=Watch for a 180 Hitters update request
[Path]
PathExists=/var/lib/dartsapp/update.request
Unit=dartsapp-update.service
[Install]
WantedBy=multi-user.target
''')
    write('lib/systemd/system/180-hitters-camera-50hz.service', '''[Unit]
Description=180 Hitters camera anti-flicker 50 Hz
After=systemd-udev-settle.service
Wants=systemd-udev-settle.service
[Service]
Type=oneshot
ExecStart=/usr/sbin/calibreer-cameras --frequency-only
RemainAfterExit=yes
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
    systemctl enable dartsapp.service dartsapp-bluetooth.service dartsapp-update.path @CAMERA_SERVICE@
    systemctl restart dartsapp.service
    # A missing or temporarily unavailable Bluetooth adapter must not block
    # package installation; systemd retries the bridge when hardware appears.
    systemctl restart --no-block dartsapp-bluetooth.service
    systemctl restart dartsapp-update.path
  fi
fi
''').replace('@CAMERA_ENABLE@', 'mkdir -p /etc/dartsapp; touch /etc/dartsapp/camera-enabled' if camera_bundle else ':').replace('@CAMERA_SERVICE@', '180-hitters-camera-50hz.service' if camera_bundle else ''), True)
    write('DEBIAN/prerm', '''#!/bin/sh
set -e
if [ -d /run/systemd/system ]; then
  case "$1" in remove|deconfigure)
    systemctl disable --now 180-hitters-camera-50hz.service 2>/dev/null || true
    systemctl stop dartsapp-update.path dartsapp-bluetooth.service dartsapp.service
    systemctl disable dartsapp-update.path dartsapp-bluetooth.service dartsapp.service
  ;; esac
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
