# 180 Hitters

Offline darts scoring and training for Android phones, Android tablets, Linux NUC displays and Windows. Developed by [Axelman8](https://github.com/axelman8).

Play independently on your device or control a shared Linux NUC over Bluetooth. Local play needs no account, subscription, internet connection or cameras. Optional AutoDarts camera scoring and private online lanes for **4 in a Row, Killer, Zeeslag Darts, Dartgolf and Shanghai** are available. The app interface and narrated tutorial videos are currently in Dutch; repository documentation is in English.

## Downloads

| Device | Latest installer | Requirements |
| --- | --- | --- |
| Android phone / modern tablet | [180-Hitters.apk](https://github.com/Axelman8/180-hitters/releases/latest/download/180-Hitters.apk) | Android 8+. Open the APK and allow installation from its source when Android asks. |
| Dedicated old tablet | [Android 4.2 tablet APK](https://github.com/Axelman8/180-hitters/releases/latest/download/180-Hitters-Tablet-Android-4.apk) | Separate legacy launcher and browser-compatible client. |
| Linux NUC / desktop | [Ubuntu/Debian installer](https://github.com/Axelman8/180-hitters/releases/latest/download/DartsApp-Ubuntu-Debian-amd64.deb) | Ubuntu 22.04+ / Debian 12+, Intel/AMD 64-bit and systemd. Open with Software Install. |
| Linux NUC with cameras | [NUC camera installer](https://github.com/Axelman8/180-hitters/releases/latest/download/180-Hitters-NUC-Cameras-Ubuntu-amd64.deb) | Includes camera setup and calibration tools. |
| Windows 10/11 | [Windows installer](https://github.com/Axelman8/180-hitters/releases/latest/download/DartsApp-Setup-Windows-x64.exe) | Intel/AMD 64-bit. Python is included. |

All packages and SHA-256 checksums are in [GitHub Releases](https://github.com/Axelman8/180-hitters/releases/latest). Linux installs dependencies through the distribution's package manager and may request your administrator password. The Windows installer does not have a publisher certificate.

Advanced packages: `180-Hitters-Linux-x64.tar.gz` and `180-Hitters-Windows-x64.zip`. Linux source installation uses `sudo bash setup-linux.sh`; manual per-user installation uses `bash install-linux.sh`. Use one dartserver installation per NUC. See [installation and recovery help](packaging/INSTALLER-HELP.txt).

## Menus

The app starts at its main menu while keeping the current match. The version is centered in the top bar. **TERUG** (Back) is at the top of app menus, dialogs and the match wizard, including long reports. Back restores the immediately preceding menu, including its section and scroll position. Nested dialogs return one level at a time. Android Back follows the same app navigation on modern phones; the legacy tablet uses the same behavior for its on-screen and touch controls. Back returns to the immediately preceding screen or menu section, preserving its scroll position and form state. Nested access screens and Android Bluetooth pickers return one level at a time; Android Back and Escape follow the same navigation where available.

Every human player has a name field and a player-list selector directly inside their player card, including when another player is a BOT. Choose a NUC player, a player saved on the current phone/tablet, or an approved online friend, or type a name for the match. List synchronization preserves typing focus and the on-screen keyboard. This applies to all fifteen games and the selected members of teams.

| App menu | Contents |
| --- | --- |
| **Spelen** (Play) | Start or change a match, show screen input, browse saved games and resume unfinished matches. |
| **Online darten** (Online darts) | Create or join a dart lane, send invitations, browse online friends and manage access. |
| **Spelers & teams** (Players and teams) | NUC players, personal players, online friends, team order, substitutes and replacements. |
| **NUC & verbinding** (NUC and connection) | Connect, take control, transfer a match, remote mouse, NUC display, Bluetooth and cameras. |
| **App-instellingen** (App settings) | Local display options, updates and application information. |

**Spelers & teams** shows three separate sources with the same list layout: **NUC-spelers** (NUC players), **Mijn spelers** (personal names) and **Online vrienden** (approved online friends). The Online friends item under Online darts opens that same list. Friend names are available in match and team selectors without copying them into the NUC or personal roster. Previously fetched names remain selectable for local play during an internet outage; online access still requires approval. Online lane forms, invitations and access screens use the main menu's dark panels, lime action buttons, responsive cards and top Back control. Registration, approvals and notification preferences are under **Toegang en meldingen** (Access and notifications).

**NUC & verbinding** uses the same dark panels, lime actions and top Back control throughout its connection status, NUC management, display, mouse and network screens. Native Android connection menus share this palette. NUC management groups connections separately from software and power, with the active radio state highlighted. Device settings remain open while live match revisions arrive.

The NUC connection, diagnostics, mouse, display and management screens share the main menu's dark panels, lime actions and touch-sized controls. Native Android mode/Bluetooth choosers use the same palette. NUC management separates connection switches from software and power actions, and highlights the active connection state. Incoming match updates keep these settings screens open.

NUC-only controls appear when connected. The connection indicator shows whether the device controls the NUC. Android system settings and installer screens use Android's own navigation.

On connected phones and tablets, **Camera aan / herstart** and **Camera uit** appear as two direct controls beside **Menu** in the top bar. They are hidden during local play and when the Bluetooth connection is lost. The NUC display keeps its camera controls under **NUC & verbinding**. If the connection is lost or another device has control, a recovery button reconnects to the selected NUC, takes control and confirms the current match before scoring resumes. Recovery never discards a match. Starting a new match from a connected device also acquires control before opening the setup wizard. If an online dart lane is still active, **Nieuwe partij** explains this and offers to leave it before opening game selection. An unavailable online relay cannot trap the player; the NUC connection stays available and the previous match is preserved until a new match is started. The NUC display and its controllers refresh their shared online status so leaving on one device releases the controls on the others.

## Graphical games and online game discovery

Gotcha now puts each player's coloured race track and reset action in their score card. Cricket and Tactics show a dartboard with closure indicators and a player-coloured marks table. Phones start with the readable table and compact dart controls; the board button switches views, and expanded turn controls retain correction and total-entry options. Bob's 27 highlights the current double and shows progress through D1-D20 and bull. Existing scoring variants, team members, bots and correction rules remain available.

Three new games support up to four players, BOT 40/50, camera scoring, saved reports and sharing:

- **Zeeslag Darts (Sea Battle)** is an original variant. Each player has randomly placed ships of 3, 2 and 2 cells on the numbers 1-20. Each ship cell has two life points. A single inflicts one damage and a double or triple up to two on that cell; bull and water do no damage. A shot attacks all opponents on the same number, while fleet tabs only change the view. Eliminated players are skipped and the final sinking dart ends the game immediately. For online play, unhit enemy positions remain on the relay; only the struck cells are revealed.
- **Dartgolf** offers 9 or 18 holes. Double = 1 stroke, triple = 2, single = 3, other number/miss = 5. Choose best of three or last dart; with last dart, use **Hole afronden** to stop early. Fewest total strokes wins; equal totals are a draw. This is the [best/last-dart golf variant](https://thedarts.app/guides/golf-darts).
- **Shanghai** offers rounds 1-7 or 1-20. Only the round's target scores. A single, double and triple of that target in one visit wins immediately; otherwise the highest total after all rounds wins. Equal totals are a draw. See [AutoDarts' Shanghai rules](https://docs.autodarts.com/game-modes/party/shanghai/).

The game picker labels the five supported online games **Online mogelijk**, and their settings screen includes **Online dartbaan maken**. That opens lane creation with the chosen game and settings; it does not create or invite anyone automatically. Online play needs internet and approved access. Local play and Bluetooth NUC control remain available without internet.

## Killer: a board built for four players

Killer now has a responsive, original SVG dartboard with each player's number in their own colour. Four player cards show names, target numbers, three-hit KILLER progress and three lives. The active player and target are highlighted, and each pending dart previews its effect. On phones, the board uses the space left after the player cards and touch controls, keeping entry separate from the board. Larger NUC screens show a bigger board with player cards beside it. New matches use three hits to become Killer and three lives per player. Singles count once, doubles twice and triples three times. The winning dart ends play immediately. Saved six-letter matches retain their original rules.

When creating an online dart lane, choose **4 in a Row**, **Killer**, **Zeeslag Darts**, **Dartgolf** or **Shanghai**, with two to four players. Invitations, the public lane list and the agreed starting player work for all five games. Killer synchronizes the initial number selection and each dart, skips eliminated players and shows the winner on every device. All participants need version 1.9.39 or newer to join Killer, and 1.9.40 or newer for the three new games. Existing 4 in a Row lanes remain compatible.

## All games and tutorial videos

All fifteen games support up to four player seats, including **BOT 40** and **BOT 50**. Games that require opponents need at least two participants; a bot can fill a seat. Supported match games also offer temporary teams with up to five members each.

Every game has a written explanation and **Bekijk uitlegvideo** (Watch tutorial) in the new-match wizard. The player streams the Dutch narrated MP4 directly from GitHub, without first saving it to Downloads. Streaming needs internet access.

| Game | Objective | Tutorial MP4 |
| --- | --- | --- |
| X01 | Count down to zero with straight, double or master opening/finishing rules. | [X01](https://github.com/Axelman8/180-hitters/releases/latest/download/180-Hitters-X01-uitleg.mp4) |
| Cricket | Close 15-20 and bull; Standard, Cut Throat or No Score. | [Cricket](https://github.com/Axelman8/180-hitters/releases/latest/download/180-Hitters-Cricket-uitleg.mp4) |
| Tactics | Close 10-20 and bull, with the same scoring variants. | [Tactics](https://github.com/Axelman8/180-hitters/releases/latest/download/180-Hitters-Tactics-uitleg.mp4) |
| 121 | Finish within nine darts; multiplayer participants alternate three-dart visits. | [121](https://github.com/Axelman8/180-hitters/releases/latest/download/180-Hitters-121-uitleg.mp4) |
| Gotcha | Reach the target exactly and reset opponents whose scores you match. | [Gotcha](https://github.com/Axelman8/180-hitters/releases/latest/download/180-Hitters-Gotcha-uitleg.mp4) |
| Bob's 27 | Doubles training from D1 through D20 and bull, starting at 27. | [Bob's 27](https://github.com/Axelman8/180-hitters/releases/latest/download/180-Hitters-Bobs-27-uitleg.mp4) |
| Hitters Challenge | Progress through double or triple targets while managing lives and attempts. | [Hitters Challenge](https://github.com/Axelman8/180-hitters/releases/latest/download/180-Hitters-Hitters-Challenge-uitleg.mp4) |
| 4 in a Row | Claim cells on a randomized 5x5 dartboard grid and connect four. | [4 in a Row](https://github.com/Axelman8/180-hitters/releases/latest/download/180-Hitters-4-op-een-rij-uitleg.mp4) |
| Zeeslag Darts | Sink opposing fleets on a numbered ocean grid. | [Zeeslag Darts](https://github.com/Axelman8/180-hitters/releases/latest/download/180-Hitters-Zeeslag-Darts-uitleg.mp4) |
| Dartgolf | Score the fewest strokes over 9 or 18 numbered holes. | [Dartgolf](https://github.com/Axelman8/180-hitters/releases/latest/download/180-Hitters-Dartgolf-uitleg.mp4) |
| Shanghai | Score on the round target or finish with its single-double-triple combination. | [Shanghai](https://github.com/Axelman8/180-hitters/releases/latest/download/180-Hitters-Shanghai-uitleg.mp4) |
| Scram | Alternate stopping numbers and scoring on those still open. | [Scram](https://github.com/Axelman8/180-hitters/releases/latest/download/180-Hitters-Scram-uitleg.mp4) |
| Killer | Choose unique numbers, build KILLER and eliminate opponents. | [Killer](https://github.com/Axelman8/180-hitters/releases/latest/download/180-Hitters-Killer-uitleg.mp4) |
| Bull / 41 | Alternate bull marks and scoring the part of a visit above 41. | [Bull / 41](https://github.com/Axelman8/180-hitters/releases/latest/download/180-Hitters-Bull-41-uitleg.mp4) |
| 21 | Move through targets 1 to bull using singles, doubles and triples. | [21](https://github.com/Axelman8/180-hitters/releases/latest/download/180-Hitters-21-uitleg.mp4) |

The [online darts tutorial](https://github.com/Axelman8/180-hitters/releases/latest/download/180-Hitters-Online-darten-uitleg.mp4) covers dart-lane creation and invitations.

### Scoring and bots

X01 offers visit-total and per-dart entry. Rules that depend on individual segments, such as double-in, require per-dart input. In solo Cricket/Tactics, excess hits after closing a target earn personal points; No Score counts marks only. Multiplayer Standard and Cut Throat keep their opponent-based scoring rules.

Bob's 27 uses only **MIS** (miss) and **RAAK** (hit) for the current double or bull. Each press records one dart; the third dart saves the visit automatically. Restored visits use the same controls to correct a selected dart. Gotcha puts an **op 0** reset button directly on each opponent's score card, including bots, so it remains reachable with screen input collapsed. Resetting an opponent preserves the current player's pending darts.

In 4 in a Row, a number needs three marks in one visit; unclaimed marks expire. Single bull and double bull each claim their cell with one dart. With AutoDarts cameras, available single-bull corners glow until the player chooses a cell. Darts two and three continue to register immediately. Multiple bull choices can be completed during or after throwing, including after removing the darts; the visit completes once its choices are resolved. Double bull still maps directly to the center cell. The game ends on the winning dart. Scram, Killer, Bull / 41 and 21 adapt games 1, 6, 8 and 13 from [Sonny's dart games](https://sonnysdarts.wordpress.com/21-dart-spellen/), with fair role rotation for multiplayer games.

Choose a human, BOT 40 or BOT 50 for each seat. Bots throw separate darts with varied, natural pauses. The original aiming model uses board geometry and two-dimensional scatter, including neighbouring segments and misses. No third-party bot implementation is bundled.

The selected level targets a three-dart average over complete 501 straight-in/double-out legs, including checkouts and busts. Individual matches vary. Each other game uses a strategy suited to its objective.

Bots re-evaluate their plan after each dart. Zeeslag avoids known water and wrecks, ignores eliminated fleets and uses only observed enemy positions; its banner distinguishes a planned search from finishing a damaged cell. Shanghai switches to point scoring when a combination is no longer reachable, last-dart Golf banks useful strokes and Killer uses a single when one hit is enough. See the [strategy review for all fifteen games](docs/bot-strategies.md), including scoring variants and regression checks. Natural misses remain possible on both levels.

After nine human darts in X01, 121 or Gotcha, the bot follows half of the positive gap above its base: a human averaging 50 against BOT 40 gives a target of 45. The strongest human provides the reference, without bots feeding back into one another. Cricket/Tactics use marks-per-round references and actively address point deficits, scoring opportunities and legal finishes. Other drills retain base accuracy. The live banner shows the current target and base.

Bot turns are coordinated across the NUC and controllers to prevent duplicates. Camera input waits during bot turns. Online lanes currently use human participants.

In Gotcha, BOT 40 and BOT 50 deliberately aim to match an opponent's score and reset it to zero. They plan routes using up to three remaining darts, prefer broad singles where practical and recalculate after every hit or miss. A legal one-dart win takes priority; otherwise the highest-scoring reachable opponent is targeted, including near the finish. The BOT banner displays its intended segment and opponent. Physical accuracy and natural misses remain governed by the selected skill level.

Hitters Challenge saves each bot dart immediately while retaining the three visible dart slots across state updates. A new three-dart group or a change of player starts again at slot 1; reconnecting reconstructs the visible group from the shared recorded history.

## Saved matches, corrections and reports

**Spelen > Mijn partijen** lists saved games newest first in a table with game, players, last played date and status. Resume an unfinished match or open its report. NUC mode uses the shared NUC match and report; standalone mode uses local data.

Large checkboxes select individual games or all search results. **Verwijderen** asks for confirmation and identifies whether the selected games are stored on the NUC or on this device. Deleting the current game also ends it; other games and player lists remain available. Deleted games stay deleted after a restart, including their recovery copies. Update the NUC as well as the Android app to enable deletion in shared mode.

The result screen shows the winner and a game-specific report with timestamps, total darts, relevant scores, tables and charts. On Android, share readable image sections through WhatsApp or another compatible app. Long tables are split into separate images.

**Laatste beurt herstellen** restores the recorded input. Select a dart, enter the correct hit and confirm. Other darts stay filled in. Matches recorded only as visit totals restore that total; individual darts cannot be reconstructed from a total. Undo/redo and X01 history correction preserve the later timeline where the game rules permit replay.

## Standalone, Bluetooth and NUC control

Standalone Android runs a complete match on the device. Linux and Windows can also run independently. Wi-Fi loss does not stop local play.

In shared mode, the Linux NUC owns the match, confirmed history and synchronized draft. Android phones and the dedicated tablet use Bluetooth for score control. One device controls input at a time; another can take over under **NUC & verbinding**. The NUC display remains usable. Revision checks reject stale writes.

A connection loss blocks shared scoring until the current state can be verified; return controls remain available. Connection tools can transfer a local match to the NUC, with a backup before replacing a match.

The NUC needs its own Ethernet or Wi-Fi connection for updates, online play and streamed tutorials. Bluetooth control does not share phone internet. NUC network settings are separate from Android score control. Advanced Linux setup provides NetworkManager controls and an optional fallback hotspot. Windows supports local play and browser control over the local network; Bluetooth NUC services require Linux.

## Players, teams and venue setup

The NUC has a venue player list and mobile devices have separate personal lists. Names synchronize for selection without replacing the other list. Removing a saved player does not change an active match.

Temporary teams contain up to five members. During a match, change their order, add a substitute or replace a member. The active member is highlighted and the team shares one score.

Under **NUC & verbinding > Locatie & presentatie**, configure the venue name, city, player-list label, logo, screensaver and background. Large background images are omitted from Bluetooth updates to keep transfers small. Venue configuration and local winner artwork survive application updates. Private venue artwork is excluded from public releases.

## Online 4 in a Row

Private dart lanes support two to four human participants. Create or join a lane, invite a club member or share an invitation, and choose the starting player after participants arrive. Individual darts, turns and results synchronize. Hosts can clear a lane for a new game; participants can leave and return to game selection.

Club access uses a club code, an access request and administrator approval for the device. Android notifications require user permission. See [the Cloudflare service documentation](cloudflare/README.md) for hosting and access configuration. Other game modes currently use local/shared-NUC play rather than online multiplayer.

## Updates and recovery

Linux NUC: use **App-instellingen > Update > Controleren en bijwerken** or **NUC & verbinding > NUC beheren > NUC bijwerken**. Both show progress, tolerate the restart and verify the running version before success. The screen refreshes when an update starts from another device or the background timer.

The updater verifies SHA-256 checksums, retains previous app files and preserves matches, player lists, venue settings and local artwork. Update between matches because the server restarts briefly.

For **1.8.22 or a broken older updater**, install [the Linux package](https://github.com/Axelman8/180-hitters/releases/latest/download/DartsApp-Ubuntu-Debian-amd64.deb) once over the existing version, confirm with the Linux administrator password and restart the NUC. The installer retires the old per-user server to prevent competition for port 8765. It imports players and saved games while preserving an existing system match. Legacy backups remain in `/var/lib/dartsapp/legacy-backups`.

Android checks GitHub before downloading a newer APK, then opens the installer. Modern Android and the dedicated Android 4.2 tablet use separate packages. NUC updates run independently; updating a phone does not update the NUC. Windows offers a newer installer to download, run and relaunch.

Data locations: `/var/lib/dartsapp` for Linux system installs, `~/.local/share/oche-darts` for older per-user installs, `%LOCALAPPDATA%/180 Hitters` for Windows, and private app storage on Android. Removing a desktop package preserves game data.

## Optional AutoDarts cameras

180 Hitters is independent of AutoDarts accounts and its online platform. It can consume local camera detections from an optional AutoDarts installation on the Linux NUC. Manual scoring works without cameras.

Use **Camera aan / herstart** to start/restart detection and **Camera uit** to stop it. Camera input follows each game's rules, including misses and early winning darts. A single bull in 4 in a Row asks the controller which free corner to claim.

The camera installer provides graphical setup and **Camera's 50 Hz + kalibreren**. The helper expects three USB capture cameras, backs up configuration, repairs stale device locations, applies anti-flicker settings and requests calibration. Keep identical cameras in marked hub ports; software cannot reliably identify physically swapped devices with identical serial numbers.

An existing compatible NUC can install the standalone helper with:

```bash
curl -fsSL https://raw.githubusercontent.com/Axelman8/180-hitters/main/install-calibreer-cameras.sh | sudo sh
sudo calibreer-cameras
```

## Development and validation

The shared UI is HTML/CSS/JavaScript. The local server uses Python's standard library. The modern Android wrapper is Java; the dedicated old tablet uses a legacy browser-compatible bundle. Linux system actions use narrowly scoped helpers.

Start `python3 server.py` (Windows: `python server.py`) and open <http://127.0.0.1:8765>. Rule tests are in `dist/tests/engine.test.js`; browser/integration tests are in `tests/`. Coverage includes twelve games, bots, cameras, corrections, responsive layouts, reports, shared control and update recovery. Release validation also tests migration from a user server occupying port 8765.

Build Android with `build-android.ps1`, or use the signed GitHub release. Signing keys and passwords are excluded from version control. Use the local server on trusted networks: local input ownership coordinates devices and is not public internet authentication. Club approval controls access to the private online service.

## Assets and references

See [IMAGE-SOURCES.txt](IMAGE-SOURCES.txt) for image references. Third-party venue photos without confirmed redistribution rights are excluded. NUC updates preserve installed `winner-stage*.jpg`, `winner-stage*.jpeg` and `winner-trophy.jpg` files.

Game-setting references include official [AutoDarts X01 documentation](https://docs.autodarts.com/game-modes/x01/) and [Cricket/Tactics documentation](https://docs.autodarts.com/game-modes/cricket-tactics/). These are functional references rather than an affiliation with AutoDarts.
