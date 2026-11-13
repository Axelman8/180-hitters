# 180 Hitters Online

This Cloudflare Worker provides private, temporary online dart lanes for the
180 Hitters four-in-a-row game. Each lane is backed by a SQLite Durable Object,
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

With `ONLINE_TEST_BASE` set to the deployed endpoint, run:

```sh
python test/integration.py
node test/websocket.mjs
```

The tests cover two-to-four-player lane creation, capacity enforcement, turn
ownership, a winning turn and real-time WebSocket broadcasts.
