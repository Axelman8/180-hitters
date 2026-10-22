# 180 Hitters

An offline-first darts scoring app for Android, touchscreen displays, Linux NUCs, and Windows. Developed by [Axelman8](https://github.com/axelman8).

180 Hitters runs without a camera, account, subscription, or internet connection during play. A Linux NUC can host the shared match display while Android phones connect over Bluetooth or the local network. The Android app can also run matches independently without a NUC.

## Downloads

Download the latest packages from [GitHub Releases](https://github.com/Axelman8/180-hitters/releases/latest):

- `180-Hitters.apk` — signed Android app
- `180-Hitters-Linux-x64.tar.gz` — complete Ubuntu/Debian NUC installer
- `180-Hitters-Windows-x64.zip` — Windows 10/11 package
- `.sha256` files — checksums for verifying each download

The user interface is currently in Dutch. This repository and its technical documentation use English.

## Linux NUC installation

The complete installer targets Ubuntu/Debian with a graphical desktop, systemd, NetworkManager, and BlueZ.

1. Download and extract `180-Hitters-Linux-x64.tar.gz`.
2. Open a terminal in the extracted directory.
3. Run `sudo bash setup-linux.sh`.
4. Sign in to the graphical desktop if it is not already active.

The installer configures:

- the local Python web server;
- kiosk-mode browser startup;
- Bluetooth communication with the Android app;
- restricted NUC power and network controls;
- automatic GitHub update checks;
- the protected `180 Hitters wifi` fallback hotspot.

The existing Autodarts installation is not removed. Disable its kiosk autostart if both applications would otherwise open at sign-in.

For a manual per-user installation, run `bash install-linux.sh` without `sudo`. Open <http://127.0.0.1:8765> after installation. Reinstalling or updating preserves the venue profile, player lists, browser profile, current match, and locally supplied winner artwork.

## Windows installation

1. Install Python 3 from [python.org](https://www.python.org/) and enable **Add Python to PATH**.
2. Download and extract `180-Hitters-Windows-x64.zip`.
3. Double-click `install-windows.cmd`.
4. Allow Python through Windows Firewall on private networks when prompted.

Windows supports standalone play and shared control over the local network. Bluetooth NUC control and phone-driven Wi-Fi provisioning currently require Linux, BlueZ, and NetworkManager.

## Android

Install `180-Hitters.apk` from the latest release. Android may ask for one-time permission to install apps from the browser or file manager used to open the APK.

The Android app supports two modes:

- **Connected mode:** control the match running on a Linux NUC over Bluetooth or Wi-Fi.
- **Standalone mode:** run a complete local match on the phone without a NUC or network.

The app checks GitHub for newer releases. NUC releases are updated independently by the NUC update service.

## Game modes

- X01 with start scores 121, 170, 301, 501, 701, or 901
- Straight, double, or master in
- Straight, double, or master out
- Cricket with Standard, Cut Throat, or No Score scoring
- Tactics with targets 10–20 and bull
- 121 nine-dart checkout training for one to four players
- Gotcha with targets 301, 401, 501, 601, or 701
- One to four players
- Legs, sets, or free play
- Optional round limits and complete-round tie-breaking

X01 supports turn-total entry and per-dart entry. Double/master-in and 50/50-bull configurations require per-dart input so opening and finishing rules can be validated correctly. Busts restore the state from before the turn and count as three darts for averages.

Checkout suggestions use the selected finishing rule. Double-out routes are based on the numerical Winmau PDC Checkout Table, with legal alternatives when the published route does not fit the number of darts or selected bull mode.

## Shared display and mobile control

All connected devices operate on the match hosted by the NUC. Confirmed turns, undo/redo, new legs, and individual dart input are synchronized. Revision checks prevent an older client state from overwriting a newer match state.

When connectivity is lost, input is blocked until the current state can be verified. Match data is written atomically to `match.json`. The first match should be started on the NUC display so it becomes the authoritative shared state.

On the fallback hotspot, open <http://10.42.0.1:8765/?remote=1>. On a venue network, scan the control QR code shown on the NUC display.

## Bluetooth

The Android app communicates with the Linux NUC through a BlueZ RFCOMM service. Bluetooth remains useful when venue Wi-Fi is unavailable or while the NUC changes networks. A newly connected authorized phone takes over the active Bluetooth control channel, closing the previous channel.

The app can request the NUC to enable or disable Bluetooth, restart, or shut down. These actions use narrowly scoped root-owned helpers rather than general shell access.

## Wi-Fi and fallback hotspot

From the connected Android app, open **Wi-Fi / hotspot** and enter the venue SSID and WPA2 password. The Linux NUC then:

1. creates or updates a NetworkManager profile;
2. generates a standard Wi-Fi QR payload;
3. displays that QR code on the main NUC screen;
4. adds the network to the selectable saved-network list.

Network switching runs as an independent systemd task. If the selected network cannot be activated, the NUC attempts to restore `180 Hitters wifi`, followed by the previous connection. The match remains stored during network changes.

The fallback hotspot and a Wi-Fi client connection normally cannot use the same wireless adapter simultaneously. Ethernet can provide internet or management access while the hotspot is active.

## Venue profiles

The same build can be reused at home or by different venues. Open **Menu → Venue** on the NUC or in the Android app to configure:

- venue name and city;
- player-list label and slogan;
- screensaver availability;
- logo and background image;
- optional venue Wi-Fi QR information;
- fallback hotspot instructions.

The profile is stored in `venue.json` next to `server.py` and is not included in public releases or replaced during updates. Large background images are omitted from Bluetooth synchronization to keep transfers responsive; the logo and text branding still synchronize.

## Player lists

The NUC maintains the venue player list. The Android app maintains a separate personal/mobile list. Both lists are combined for player selection without overwriting ownership:

- venue players are managed on the NUC;
- personal players are managed from the Android app;
- names are synchronized and deduplicated case-insensitively;
- removing a saved name does not modify an active match.

## Winner screen and local artwork

The winner screen displays “Game shot and the match”, match statistics, animations, and an optional local photo banner in the upper third of the screen. Third-party venue artwork is intentionally excluded from the public repository when redistribution rights are unclear. Files named `winner-stage*.jpg`, `winner-stage*.jpeg`, and `winner-trophy.jpg` in the installed `dist` directory are preserved by NUC updates.

## Architecture and security

- Python 3 standard-library HTTP server; no npm runtime installation
- browser-based responsive UI
- Java Android wrapper with an embedded local server
- root-owned, allow-listed Linux helpers for network and system control
- control-token checks for privileged Android operations
- origin checks and strict JSON validation for write requests
- atomic state and profile writes
- SHA-256 verification before NUC updates are installed

Use the shared server only on a trusted local network. Anyone who can access the control page can participate in the active match.

## Development and testing

Run the server directly:

```bash
python3 server.py
```

On Windows:

```powershell
python server.py
```

Then open <http://127.0.0.1:8765>.

Browser and integration tests are located in `tests/`. Game-engine tests are in `dist/tests/engine.test.js` and currently cover 67 rule scenarios. The automated suite also checks responsive layouts, shared drafts, history navigation, corrections, venue profiles, player-list synchronization, the Android distribution, and the winner screen.

Build the signed Android release locally with:

```powershell
powershell -ExecutionPolicy Bypass -File .\build-android.ps1
```

The signing keystore and passwords are intentionally excluded from version control.

## Autodarts compatibility note

180 Hitters is an independent scoring application. Its game settings use the official [Autodarts X01 documentation](https://docs.autodarts.com/game-modes/x01/) and [Cricket/Tactics documentation](https://docs.autodarts.com/game-modes/cricket-tactics/) as functional references, but it is not an Autodarts client and does not connect to Autodarts accounts or services.

Camera detection, online opponents, matchmaking, leagues, bots, AI refereeing, and long-term match archives are outside the current scope.

## Disable autostart on Linux

```bash
systemctl --user disable --now oche-darts.service
```

Remove `~/.config/autostart/oche-darts.desktop` to disable kiosk startup. Keep the browser profile if you want to retain its local state.

## License and third-party assets

Review [IMAGE-SOURCES.txt](IMAGE-SOURCES.txt) for external image references. Third-party photographs without confirmed redistribution rights are not included in public release packages.
