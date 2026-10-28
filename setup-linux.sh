#!/usr/bin/env bash
set -euo pipefail
if [[ $(id -u) -ne 0 ]]; then echo 'Start met: sudo bash setup-linux.sh'; exit 1; fi
APP_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
APP_USER="${SUDO_USER:-}"
if [[ -z "$APP_USER" || "$APP_USER" == root ]]; then echo 'Start dit vanuit de aangemelde desktopgebruiker met sudo.'; exit 1; fi
APP_UID="$(id -u "$APP_USER")"
command -v apt-get >/dev/null || { echo 'Dit pakket ondersteunt Ubuntu, Debian en afgeleiden met apt.'; exit 1; }
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y python3 python3-tk network-manager xdotool bluez sudo v4l-utils policykit-1
if ! command -v chromium >/dev/null && ! command -v chromium-browser >/dev/null && ! command -v google-chrome >/dev/null && ! command -v firefox >/dev/null; then
  DEBIAN_FRONTEND=noninteractive apt-get install -y chromium || DEBIAN_FRONTEND=noninteractive apt-get install -y firefox-esr
fi
bash "$APP_DIR/install-network-control.sh"
bash "$APP_DIR/install-system-control.sh"
install -o root -g root -m 0755 "$APP_DIR/calibreer-cameras.py" /usr/local/sbin/calibreer-cameras
ln -sf /usr/local/sbin/calibreer-cameras /usr/local/sbin/calibreer_cameras
cat >/etc/systemd/system/180-hitters-camera-50hz.service <<'SERVICE'
[Unit]
Description=180 Hitters camera anti-flicker 50 Hz
After=systemd-udev-settle.service
Wants=systemd-udev-settle.service
[Service]
Type=oneshot
ExecStart=/usr/local/sbin/calibreer-cameras --frequency-only
RemainAfterExit=yes
[Install]
WantedBy=multi-user.target
SERVICE
systemctl daemon-reload
systemctl enable 180-hitters-camera-50hz.service
runuser -u "$APP_USER" -- env HOME="$(getent passwd "$APP_USER" | cut -d: -f6)" \
  XDG_RUNTIME_DIR="/run/user/$APP_UID" DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/$APP_UID/bus" \
  bash "$APP_DIR/install-linux.sh"
echo
echo '180 Hitters is klaar. De noodhotspot heet "180 Hitters wifi" en heeft standaard wachtwoord "Darts180".'
echo 'Koppel de Android-app via Bluetooth om het eigen wifi-netwerk van de locatie toe te voegen.'
