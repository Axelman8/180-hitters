# 180 Hitters Online

This Cloudflare Worker provides private, temporary online dart lanes for the
180 Hitters Four in a Row, Killer, Zeeslag Darts, Dartgolf and Shanghai games. Each lane is backed by a SQLite Durable Object,
uses unguessable player keys, validates turn ownership on the server and
broadcasts state changes through hibernatable WebSockets.

## Deployment

```sh
npm install
npm run check
npm run deploy
```

The production endpoint is:

`https://180-hitters-online.180-hitters-online.workers.dev`

The Android app, tablet interface and NUC client use the same endpoint. A lane
expires automatically eight hours after its last activity.

## Club access

Online play uses a small private club registry in a SQLite Durable Object. A
player enters the shared club code, the administrator approves the request,
and the device receives its own access token. Registration is limited per IP
address and both pending and approved account totals are capped.

Set the two Worker secrets before deploying:

```sh
npx wrangler secret put CLUB_CODE
npx wrangler secret put ADMIN_SETUP_CODE
```

The first secret is shared with club members. The second is only used by the
administrator to activate the approval screen on a device.

## Verification

Use an isolated local Wrangler instance without production club secrets. The default test endpoint is `http://127.0.0.1:8787`. Run:

```sh
python test/integration.py
node test/websocket.mjs
node test/killer.mjs
node test/party.mjs
```

The tests cover two-to-four-player lane creation, capacity enforcement, turn
ownership, a winning turn and real-time WebSocket broadcasts.

Killer turn validation replays the submitted visit with the same rule engine used
by manual entry, AutoDarts and bots. Tests cover agreed starters, unique number
assignment, per-dart drafts, eliminated-player skipping and the final winning dart.
Existing six-letter saved matches remain compatible; new matches use three-hit
activation and three lives. Joining Killer requires an updated client.

The three new games require version 1.9.40 or newer. Visits are replayed with
the shared game engine. Zeeslag fleets are generated and stored on the relay:
each player receives only their own fleet and previously struck enemy cells.
The active player's per-dart reveal request is validated against the current
visit, dart slot and hidden fleet; repeated requests are idempotent. Full fleets
are revealed after the match ends. WebSocket messages are filtered for each
player role, and tests cover privacy, per-dart updates and complete games with
two, three and four players.
