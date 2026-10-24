#!/usr/bin/env bash
set -euo pipefail
APP_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
command -v python3 >/dev/null || { echo 'Installeer eerst Python: sudo apt install python3'; exit 1; }
command -v xdotool >/dev/null || { echo "Installeer eerst xdotool: sudo apt install xdotool"; exit 1; }
BROWSER=""
for candidate in google-chrome chromium chromium-browser firefox; do
  if command -v "$candidate" >/dev/null; then BROWSER="$(command -v "$candidate")"; break; fi
done
if [[ -z "$BROWSER" ]]; then echo 'Installeer eerst Chromium of Firefox via de softwarewinkel.'; exit 1; fi
mkdir -p "$HOME/.local/share/oche-darts" "$HOME/.config/systemd/user" "$HOME/.config/autostart"
cp -r "$APP_DIR/dist" "$HOME/.local/share/oche-darts/"
cp "$APP_DIR/server.py" "$HOME/.local/share/oche-darts/"
cp "$APP_DIR/autodarts_bridge.py" "$APP_DIR/camera_research.py" "$HOME/.local/share/oche-darts/"
cp "$APP_DIR/bluetooth-bridge.py" "$HOME/.local/share/oche-darts/"
cp "$APP_DIR/nuc-update.py" "$HOME/.local/share/oche-darts/"
[[ ! -f "$APP_DIR/.version" ]] || cp "$APP_DIR/.version" "$HOME/.local/share/oche-darts/.version"
cat > "$HOME/.config/systemd/user/oche-darts.service" <<'SERVICE'
[Unit]
Description=180 Hitters lokale server
After=network.target
[Service]
ExecStart=/usr/bin/python3 "%h/.local/share/oche-darts/server.py"
Restart=on-failure
[Install]
WantedBy=default.target
SERVICE
LAUNCHER="$HOME/.local/share/oche-darts/start-kiosk.sh"
printf '#!/usr/bin/env bash\nset -e\n' > "$LAUNCHER"
printf 'BROWSER=%q\n' "$BROWSER" >> "$LAUNCHER"
cat >> "$LAUNCHER" <<'LAUNCH'
if [[ -f "$HOME/.config/oche-display.sh" ]]; then
  bash "$HOME/.config/oche-display.sh"
fi
for attempt in {1..30}; do
  if /usr/bin/python3 -c 'import urllib.request; urllib.request.urlopen("http://127.0.0.1:8765", timeout=1)' >/dev/null 2>&1; then break; fi
  sleep 1
done
if [[ "$BROWSER" == *firefox* ]]; then
  exec "$BROWSER" --kiosk http://127.0.0.1:8765
else
  PROFILE="$HOME/.local/share/oche-darts/browser-profile"
  if [[ "$BROWSER" == *chromium* ]] && { [[ "$BROWSER" == /snap/* ]] || { command -v snap >/dev/null && snap list chromium >/dev/null 2>&1; }; }; then
    PROFILE="$HOME/snap/chromium/common/oche-profile"
  fi
  mkdir -p "$PROFILE"
  exec "$BROWSER" --kiosk --no-first-run --no-default-browser-check --disable-features=Translate --lang=nl --password-store=basic --user-data-dir="$PROFILE" http://127.0.0.1:8765
fi
LAUNCH
chmod +x "$LAUNCHER"
cat > "$HOME/.config/autostart/oche-darts.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=180 Hitters
Icon=$HOME/.local/share/oche-darts/dist/avatar.jpg
Exec="$LAUNCHER"
Terminal=false
X-GNOME-Autostart-enabled=true
DESKTOP
systemctl --user daemon-reload
systemctl --user enable --now oche-darts.service
cat > "$HOME/.config/systemd/user/oche-darts-bluetooth.service" <<'SERVICE'
[Unit]
Description=180 Hitters Bluetooth-verbinding
After=bluetooth.target oche-darts.service
Requires=oche-darts.service
[Service]
Environment=DARTS_CONTROL_TOKEN=d7c87006c31f4da2a4348eeb05b59c8b
ExecStartPre=/usr/bin/bluetoothctl power on
ExecStartPre=/usr/bin/bluetoothctl pairable on
ExecStartPre=/usr/bin/bluetoothctl discoverable on
ExecStart=/usr/bin/python3 "%h/.local/share/oche-darts/bluetooth-bridge.py"
Restart=on-failure
RestartSec=3
[Install]
WantedBy=default.target
SERVICE
systemctl --user daemon-reload
systemctl --user enable --now oche-darts-bluetooth.service
cat > "$HOME/.config/systemd/user/oche-darts-update.service" <<'SERVICE'
[Unit]
Description=180 Hitters GitHub-update controleren
After=network-online.target
[Service]
Type=oneshot
ExecStart=/usr/bin/python3 "%h/.local/share/oche-darts/nuc-update.py"
SERVICE
cat > "$HOME/.config/systemd/user/oche-darts-update.timer" <<'TIMER'
[Unit]
Description=Controleer 180 Hitters-updates
[Timer]
OnBootSec=5min
OnUnitActiveSec=6h
RandomizedDelaySec=10min
Persistent=true
[Install]
WantedBy=timers.target
TIMER
[[ -f "$HOME/.local/share/oche-darts/.version" ]] || printf '1.7.0\n' > "$HOME/.local/share/oche-darts/.version"
systemctl --user daemon-reload
systemctl --user enable --now oche-darts-update.timer
echo 'Geïnstalleerd. Open http://127.0.0.1:8765 of meld opnieuw aan voor kioskmodus.'
