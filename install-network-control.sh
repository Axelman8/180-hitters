#!/usr/bin/env bash
set -euo pipefail
if [[ $(id -u) -ne 0 ]]; then echo 'Start met sudo bash install-network-control.sh'; exit 1; fi
APP_USER="${SUDO_USER:-autodarts}"
[[ "$APP_USER" =~ ^[a-z_][a-z0-9_-]*$ ]] || { echo 'Ongeldige gebruikersnaam'; exit 1; }
APP_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
command -v nmcli >/dev/null
command -v visudo >/dev/null
python3 - <<'PY'
import json,subprocess
from pathlib import Path
def read(*args):
 return subprocess.check_output(['/usr/bin/nmcli','-g',*args],text=True).strip()
profiles=[]
for uid in read('UUID','connection','show').splitlines():
 if read('connection.type','connection','show','uuid',uid)!='802-11-wireless':continue
 ssid=read('802-11-wireless.ssid','connection','show','uuid',uid)
 mode=read('802-11-wireless.mode','connection','show','uuid',uid)
 if mode=='ap' and ssid!='180 Hitters wifi':continue
 profiles.append({'uuid':uid,'name':ssid,'mode':'hotspot' if mode=='ap' else 'wifi'})
hotspot=next((p['uuid'] for p in profiles if p['mode']=='hotspot' and p['name']=='180 Hitters wifi'),None)
if not hotspot:raise SystemExit('Configureer eerst de beveiligde 180 Hitters wifi-hotspot.')
path=Path('/etc/darts-network.json')
path.write_text(json.dumps({'hotspot':hotspot,'profiles':profiles},ensure_ascii=False))
path.chmod(0o644)
PY
install -o root -g root -m 0755 "$APP_DIR/network-control.py" /usr/local/sbin/darts-network
TEMP_RULE=$(mktemp)
trap 'rm -f "$TEMP_RULE"' EXIT
printf '%s ALL=(root) NOPASSWD: /usr/local/sbin/darts-network\n' "$APP_USER" > "$TEMP_RULE"
visudo -cf "$TEMP_RULE"
install -o root -g root -m 0440 "$TEMP_RULE" /etc/sudoers.d/darts-network
echo 'Netwerkkeuze voor opgeslagen wifi en 180 Hitters wifi is ingesteld.'
