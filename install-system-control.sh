#!/usr/bin/env bash
set -euo pipefail
if [[ $(id -u) -ne 0 ]]; then echo 'Start met sudo bash install-system-control.sh'; exit 1; fi
APP_USER="${SUDO_USER:-autodarts}"
[[ "$APP_USER" =~ ^[a-z_][a-z0-9_-]*$ ]] || { echo 'Ongeldige gebruikersnaam'; exit 1; }
APP_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
command -v visudo >/dev/null
install -o root -g root -m 0755 "$APP_DIR/system-control.py" /usr/local/sbin/darts-system
TEMP_RULE=$(mktemp)
trap 'rm -f "$TEMP_RULE"' EXIT
printf '%s ALL=(root) NOPASSWD: /usr/local/sbin/darts-system\n' "$APP_USER" > "$TEMP_RULE"
visudo -cf "$TEMP_RULE"
install -o root -g root -m 0440 "$TEMP_RULE" /etc/sudoers.d/darts-system
echo 'Bluetooth- en energiebediening voor de NUC is ingesteld.'
