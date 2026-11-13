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

## Verification

With `ONLINE_TEST_BASE` set to the deployed endpoint, run:

```sh
python test/integration.py
node test/websocket.mjs
```

The tests cover two-to-four-player lane creation, capacity enforcement, turn
ownership, a winning turn and real-time WebSocket broadcasts.
