const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_AGE = 8 * 60 * 60 * 1000;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Cache-Control': 'no-store'
};

function response(value, status = 200) {
  return Response.json(value, { status, headers: cors });
}

function code() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, value => ALPHABET[value % ALPHABET.length]).join('');
}

function cleanMatch(value, allowFinished = true) {
  const phases = allowFinished ? ['playing', 'won'] : ['playing'];
  const state = value?.state;
  if (!value || typeof value !== 'object' || !Array.isArray(value.undo) || state?.version !== 2 ||
      state.game !== 'fourinarow' || !Array.isArray(state.players) || state.players.length < 2 ||
      state.players.length > 4 || !phases.includes(state.phase) || !Array.isArray(state.history) ||
      new TextEncoder().encode(JSON.stringify(value)).length > 2_000_000) {
    throw new Error('Ongeldige 4-op-een-rij-partij.');
  }
  return structuredClone(value);
}

function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const url = new URL(request.url);
    if (url.pathname === '/health') return response({ ok: true, service: '180-hitters-online' });
    if (url.pathname === '/' && request.method === 'GET') {
      const roomCode = String(url.searchParams.get('dartbaan') || '').toUpperCase();
      if (!/^[A-Z2-9]{6}$/.test(roomCode)) return response({ error: 'Ongeldige of ontbrekende dartbaancode.' }, 400);
      const html = `<!doctype html><html lang="nl"><meta name="viewport" content="width=device-width,initial-scale=1"><title>180 Hitters uitnodiging</title><style>body{margin:0;background:#101c23;color:#f4f7f2;font:18px system-ui;display:grid;min-height:100vh;place-items:center}.card{max-width:440px;margin:20px;padding:28px;border:1px solid #587064;border-radius:18px;background:#172a32;text-align:center}a{display:block;margin:22px 0;padding:14px;border-radius:12px;background:#80bd57;color:#102014;font-weight:800;text-decoration:none}.code{font-size:34px;letter-spacing:.14em;color:#f6bd60;font-weight:900}</style><div class="card"><h1>180 Hitters</h1><p>Je bent uitgenodigd voor online 4 op een rij.</p><p class="code">${roomCode}</p><a href="hitters180://join?dartbaan=${roomCode}">Open in 180 Hitters</a><p>Werkt de knop niet? Open 180 Hitters, kies <b>Online darten → Deelnemen</b> en gebruik de ontvangen uitnodigingslink.</p></div></html>`;
      return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
    }
    if (url.pathname === '/lobby' && request.method === 'GET') {
      return env.LOBBY.get(env.LOBBY.idFromName('global')).fetch(request);
    }
    if (url.pathname === '/rooms' && request.method === 'POST') {
      let roomCode = code();
      const body = await request.text();
      const id = env.ROOMS.idFromName(roomCode);
      return env.ROOMS.get(id).fetch(new Request(`${url.origin}/create?code=${roomCode}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body
      }));
    }
    const match = url.pathname.match(/^\/rooms\/([A-Z2-9]{6})(\/(join|leave|starter|draft|state|socket|close))?$/i);
    if (!match) return response({ error: 'Onbekend verzoek.' }, 404);
    const roomCode = match[1].toUpperCase();
    const id = env.ROOMS.idFromName(roomCode);
    const target = new URL(request.url); target.pathname = match[2] || '/room';
    return env.ROOMS.get(id).fetch(new Request(target, request));
  }
};

export class DartRoom {
  constructor(state, env) { this.state = state; this.env = env; }

  async load() { return await this.state.storage.get('room'); }
  async save(room) {
    room.updated = Date.now();
    await this.state.storage.put('room', room);
    await this.state.storage.setAlarm(room.updated + MAX_AGE);
  }
  public(room) {
    return { code: room.code, revision: room.revision, match: room.match,
      joined: room.keys.filter(Boolean).length, capacity: room.keys.length, updated: room.updated,
      public: room.public !== false, starter: Number.isInteger(room.starter) ? room.starter : null,
      starterPending: !room.started && room.keys.every(Boolean), draft: room.draft || null };
  }
  async updateLobby(room, remove = false) {
    const lobby = this.env.LOBBY.get(this.env.LOBBY.idFromName('global'));
    await lobby.fetch('https://lobby.internal/', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: remove ? 'remove' : 'upsert', code: room.code,
        host: room.match?.state?.players?.[0]?.name || 'Onbekend', joined: room.keys.filter(Boolean).length,
        capacity: room.keys.length, updated: room.updated, public: room.public !== false }) });
  }
  async broadcast(room) {
    const message = JSON.stringify(this.public(room));
    for (const socket of this.state.getWebSockets()) {
      try { socket.send(message); } catch { try { socket.close(1011, 'Opnieuw verbinden'); } catch {} }
    }
  }

  async fetch(request) {
    try {
      const url = new URL(request.url);
      if (request.method === 'POST' && url.pathname === '/create') {
        if (await this.load()) return response({ error: 'Dartbaancode bestaat al.' }, 409);
        const incoming = await request.json();
        const name = String(incoming.name || '').trim().slice(0, 24);
        if (!name) throw new Error('Vul jouw naam in.');
        const match = cleanMatch(incoming.match, false);
        match.state.players[0].name = name;
        for (let index = 1; index < match.state.players.length; index++) match.state.players[index].name = `Wachten op speler ${index + 1}`;
        const keys = [crypto.randomUUID(), ...Array(match.state.players.length - 1).fill(null)];
        const room = { code: url.searchParams.get('code'), keys, match, revision: 1,
          updated: Date.now(), public: incoming.public !== false, started: false, starter: null, draft: null };
        await this.save(room);
        await this.updateLobby(room);
        return response({ ...this.public(room), key: keys[0], role: 0 }, 201);
      }

      const room = await this.load();
      if (!room || Date.now() - room.updated > MAX_AGE) return response({ error: 'Dartbaan is verlopen of bestaat niet.' }, 404);
      const key = url.searchParams.get('key');

      if (request.method === 'GET' && url.pathname === '/room') {
        if (!room.keys.includes(key)) return response({ error: 'Partijcode of sleutel is ongeldig.' }, 404);
        return response(this.public(room));
      }
      if (request.method === 'GET' && url.pathname === '/socket') {
        if (!room.keys.includes(key)) return response({ error: 'Partijcode of sleutel is ongeldig.' }, 404);
        const pair = new WebSocketPair();
        const [client, server] = Object.values(pair);
        this.state.acceptWebSocket(server, [key]);
        server.send(JSON.stringify(this.public(room)));
        return new Response(null, { status: 101, webSocket: client, headers: cors });
      }
      if (request.method === 'POST' && url.pathname === '/join') {
        const incoming = await request.json();
        const name = String(incoming.name || '').trim().slice(0, 24);
        if (!name) throw new Error('Vul jouw naam in.');
        const role = room.keys.indexOf(null);
        if (role < 0) return response({ error: 'Deze dartbaan is al vol.' }, 409);
        room.keys[role] = crypto.randomUUID();
        room.match.state.players[role].name = name;
        room.revision++;
        await this.save(room); await this.updateLobby(room); await this.broadcast(room);
        return response({ ...this.public(room), key: room.keys[role], role });
      }
      if (request.method === 'POST' && url.pathname === '/starter') {
        const incoming = await request.json();
        if (!room.keys.includes(incoming.key)) return response({ error: 'Partijcode of sleutel is ongeldig.' }, 404);
        if (room.started) return response({ error: 'De startspeler is al gekozen.' }, 409);
        if (!room.keys.every(Boolean)) return response({ error: 'Wacht tot alle spelers aanwezig zijn.' }, 409);
        const starter = incoming.starter;
        if (!Number.isInteger(starter) || starter < 0 || starter >= room.keys.length) throw new Error('Kies een geldige speler.');
        if (room.match.state.history.length) throw new Error('De partij is al begonnen.');
        room.starter = starter;
        room.match.state.active = starter;
        room.started = true;
        room.draft = null;
        room.revision++;
        await this.save(room); await this.updateLobby(room); await this.broadcast(room);
        return response(this.public(room));
      }
      if (request.method === 'POST' && url.pathname === '/draft') {
        const incoming = await request.json();
        const role = room.keys.indexOf(incoming.key);
        if (role < 0) return response({ error: 'Partijcode of sleutel is ongeldig.' }, 404);
        if (!room.started || !room.keys.every(Boolean)) return response({ error: 'De partij is nog niet gestart.' }, 409);
        if (room.match.state.phase !== 'playing') return response({ error: 'De partij is afgelopen.' }, 409);
        if (room.match.state.active !== role) return response({ error: 'De tegenstander is aan de beurt.' }, 403);
        const seq = incoming.seq, hits = incoming.hits;
        if (!Number.isSafeInteger(seq) || seq < 0 || !Array.isArray(hits) || hits.length > 3) throw new Error('Ongeldige live worp.');
        const cleanHits = hits.map(hit => {
          const number = hit?.number, mult = hit?.mult, cell = hit?.cell;
          if (!Number.isInteger(number) || ![0, ...Array.from({ length: 20 }, (_, index) => index + 1), 25].includes(number) ||
              ![1, 2, 3].includes(mult) || (number === 25 && mult === 3) ||
              !(cell === null || Number.isInteger(cell) && cell >= 0 && cell < 25)) throw new Error('Ongeldige pijl in live worp.');
          return { number, mult, cell: cell ?? null, label: String(hit.label || '').slice(0, 20) };
        });
        if (room.draft?.role === role && seq <= room.draft.seq) return response(this.public(room));
        room.draft = { role, seq, hits: cleanHits };
        await this.save(room); await this.broadcast(room);
        return response(this.public(room));
      }
      if (request.method === 'POST' && url.pathname === '/leave') {
        const incoming = await request.json();
        const role = room.keys.indexOf(incoming.key);
        if (role < 0) return response({ error: 'Partijcode of sleutel is ongeldig.' }, 404);
        if (role === 0) return await this.close(room);
        room.keys[role] = null;
        room.match.state.players[role].name = `Wachten op speler ${role + 1}`;
        room.revision++;
        await this.save(room); await this.updateLobby(room); await this.broadcast(room);
        return response({ ok: true, left: true });
      }
      if (request.method === 'POST' && url.pathname === '/state') {
        const incoming = await request.json();
        const role = room.keys.indexOf(incoming.key);
        if (role < 0) return response({ error: 'Partijcode of sleutel is ongeldig.' }, 404);
        if (!room.started || !room.keys.every(Boolean)) return response({ error: 'Wacht tot alle spelers aanwezig zijn en de startspeler is gekozen.' }, 409);
        if (incoming.revision !== room.revision) return response(this.public(room), 409);
        const next = cleanMatch(incoming.match), old = room.match.state, state = next.state;
        if (old.active !== role) return response({ error: 'De tegenstander is aan de beurt.' }, 403);
        if (state.history.length !== old.history.length + 1 || !same(state.history.slice(0, -1), old.history) ||
            state.history.at(-1)?.player !== role || !same(state.fourBoard, old.fourBoard) ||
            !same(state.players.map(player => player.name), old.players.map(player => player.name))) {
          throw new Error('Alleen één nieuwe eigen beurt mag worden verzonden.');
        }
        const expectedActive = (role + 1) % room.keys.length;
        if (state.phase === 'playing' && state.active !== expectedActive) throw new Error('Na de beurt moet de volgende speler aan de beurt zijn.');
        if (state.phase === 'won' && (![role, null].includes(state.winner) || state.active !== role)) throw new Error('De winnaar en actieve speler komen niet overeen.');
        room.match = next; room.draft = null; room.revision++;
        await this.save(room); await this.updateLobby(room); await this.broadcast(room);
        return response(this.public(room));
      }
      if (request.method === 'POST' && url.pathname === '/close') {
        const incoming = await request.json();
        if (incoming.key !== room.keys[0]) return response({ error: 'Alleen de maker kan de dartbaan leegmaken.' }, 403);
        return await this.close(room);
      }
      return response({ error: 'Onbekend verzoek.' }, 404);
    } catch (error) {
      return response({ error: error?.message || 'Ongeldige invoer.' }, 400);
    }
  }

  async close(room) {
    const message = JSON.stringify({ closed: true, code: room.code, error: 'De maker heeft deze dartbaan gesloten.' });
    for (const socket of this.state.getWebSockets()) {
      try { socket.send(message); socket.close(1000, 'Dartbaan gesloten'); } catch {}
    }
    await this.updateLobby(room, true);
    await this.state.storage.deleteAll();
    return response({ ok: true, closed: true });
  }

  async alarm() { const room = await this.load(); if (room) await this.updateLobby(room, true); await this.state.storage.deleteAll(); }
  async webSocketMessage() {}
  async webSocketClose(socket) { try { socket.close(1000, 'Gesloten'); } catch {} }
  async webSocketError(socket) { try { socket.close(1011, 'Verbindingsfout'); } catch {} }
}

export class Lobby {
  constructor(state) { this.state = state; }

  async fetch(request) {
    const rooms = await this.state.storage.get('rooms') || {};
    const now = Date.now();
    for (const [roomCode, room] of Object.entries(rooms)) {
      if (!room || now - room.updated > MAX_AGE) delete rooms[roomCode];
    }
    if (request.method === 'POST') {
      const incoming = await request.json();
      if (!/^[A-Z2-9]{6}$/.test(incoming.code || '')) return response({ error: 'Ongeldige dartbaan.' }, 400);
      if (incoming.action === 'remove' || incoming.public === false) delete rooms[incoming.code];
      else rooms[incoming.code] = { code: incoming.code, host: String(incoming.host || 'Onbekend').slice(0, 24),
        joined: Number(incoming.joined) || 0, capacity: Number(incoming.capacity) || 2, updated: now };
      await this.state.storage.put('rooms', rooms);
      return response({ ok: true });
    }
    if (request.method !== 'GET') return response({ error: 'Onbekend verzoek.' }, 404);
    await this.state.storage.put('rooms', rooms);
    return response({ rooms: Object.values(rooms).filter(room => room.joined < room.capacity)
      .sort((a, b) => b.updated - a.updated) });
  }
}
