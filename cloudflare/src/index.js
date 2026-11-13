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
    if (url.pathname === '/rooms' && request.method === 'POST') {
      let roomCode = code();
      const body = await request.text();
      const id = env.ROOMS.idFromName(roomCode);
      return env.ROOMS.get(id).fetch(new Request(`${url.origin}/create?code=${roomCode}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body
      }));
    }
    const match = url.pathname.match(/^\/rooms\/([A-Z2-9]{6})(\/(join|state|socket))?$/i);
    if (!match) return response({ error: 'Onbekend verzoek.' }, 404);
    const roomCode = match[1].toUpperCase();
    const id = env.ROOMS.idFromName(roomCode);
    const target = new URL(request.url); target.pathname = match[2] || '/room';
    return env.ROOMS.get(id).fetch(new Request(target, request));
  }
};

export class DartRoom {
  constructor(state) { this.state = state; }

  async load() { return await this.state.storage.get('room'); }
  async save(room) {
    room.updated = Date.now();
    await this.state.storage.put('room', room);
    await this.state.storage.setAlarm(room.updated + MAX_AGE);
  }
  public(room) {
    return { code: room.code, revision: room.revision, match: room.match,
      joined: room.keys.filter(Boolean).length, capacity: room.keys.length, updated: room.updated };
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
        const room = { code: url.searchParams.get('code'), keys, match, revision: 1, updated: Date.now() };
        await this.save(room);
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
        await this.save(room); await this.broadcast(room);
        return response({ ...this.public(room), key: room.keys[role], role });
      }
      if (request.method === 'POST' && url.pathname === '/state') {
        const incoming = await request.json();
        const role = room.keys.indexOf(incoming.key);
        if (role < 0) return response({ error: 'Partijcode of sleutel is ongeldig.' }, 404);
        if (incoming.revision !== room.revision) return response(this.public(room), 409);
        const next = cleanMatch(incoming.match), old = room.match.state, state = next.state;
        if (old.active !== role) return response({ error: 'De tegenstander is aan de beurt.' }, 403);
        if (state.history.length !== old.history.length + 1 || !same(state.history.slice(0, -1), old.history) ||
            state.history.at(-1)?.player !== role || !same(state.fourBoard, old.fourBoard) ||
            !same(state.players.map(player => player.name), old.players.map(player => player.name))) {
          throw new Error('Alleen één nieuwe eigen beurt mag worden verzonden.');
        }
        room.match = next; room.revision++;
        await this.save(room); await this.broadcast(room);
        return response(this.public(room));
      }
      return response({ error: 'Onbekend verzoek.' }, 404);
    } catch (error) {
      return response({ error: error?.message || 'Ongeldige invoer.' }, 400);
    }
  }

  async alarm() { await this.state.storage.deleteAll(); }
  async webSocketMessage() {}
  async webSocketClose(socket) { try { socket.close(1000, 'Gesloten'); } catch {} }
  async webSocketError(socket) { try { socket.close(1011, 'Verbindingsfout'); } catch {} }
}
