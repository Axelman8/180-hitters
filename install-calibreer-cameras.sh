#!/bin/sh
set -eu

if [ "$(id -u)" -ne 0 ]; then
  echo "Start met sudo: curl -fsSL https://raw.githubusercontent.com/Axelman8/180-hitters/main/install-calibreer-cameras.sh | sudo sh" >&2
  exit 1
fi

command -v python3 >/dev/null 2>&1 || { echo "Python 3 ontbreekt." >&2; exit 1; }
command -v curl >/dev/null 2>&1 || { echo "curl ontbreekt." >&2; exit 1; }
if ! command -v v4l2-ctl >/dev/null 2>&1; then
  apt-get update
  apt-get install -y v4l-utils
fi

url=https://raw.githubusercontent.com/Axelman8/180-hitters/main/calibreer-cameras.py
temporary=$(mktemp)
trap 'rm -f "$temporary"' EXIT HUP INT TERM
curl --fail --location --proto '=https' --tlsv1.2 "$url" --output "$temporary"
install -o root -g root -m 0755 "$temporary" /usr/local/sbin/calibreer-cameras
ln -sf /usr/local/sbin/calibreer-cameras /usr/local/sbin/calibreer_cameras

cat >/etc/systemd/system/180-hitters-camera-50hz.service <<'EOF'
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
EOF

systemctl daemon-reload
systemctl enable 180-hitters-camera-50hz.service
echo "Installatie gereed. Start met: sudo calibreer-cameras"
