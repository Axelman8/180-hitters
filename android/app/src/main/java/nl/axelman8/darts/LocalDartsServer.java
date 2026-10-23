package nl.axelman8.darts;

import android.content.Context;
import android.content.res.AssetManager;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.HashMap;
import java.util.Map;

import fi.iki.elonen.NanoHTTPD;

final class LocalDartsServer extends NanoHTTPD {
    private final Context context;
    private final BluetoothClient bluetooth;
    private volatile boolean bluetoothMode;
    private final File stateFile;
    private final File playersFile;
    private final File displayFile;
    private final File venueFile;
    private JSONObject state;
    private JSONArray players;
    private JSONObject display;
    private JSONObject venue;
    private JSONObject setup = new JSONObject();
    private JSONObject draft;
    private long draftTime;

    LocalDartsServer(Context context, BluetoothClient bluetooth) throws IOException, JSONException {
        super("127.0.0.1", 8765);
        this.context = context.getApplicationContext();
        this.bluetooth = bluetooth;
        stateFile = new File(context.getFilesDir(), "local-match.json");
        playersFile = new File(context.getFilesDir(), "local-players.json");
        displayFile = new File(context.getFilesDir(), "local-display.json");
        venueFile = new File(context.getFilesDir(), "local-venue.json");
        state = readObject(stateFile, new JSONObject().put("revision", 0).put("match", JSONObject.NULL));
        players = readArray(playersFile, new JSONArray());
        display = readObject(displayFile, new JSONObject().put("inputCollapsed", false));
        venue = readObject(venueFile, defaultVenue());
        setup.put("version", 0).put("value", JSONObject.NULL);
        start(SOCKET_READ_TIMEOUT, false);
    }

    void setBluetoothMode(boolean enabled) { bluetoothMode = enabled; if (!enabled) bluetooth.closeSocket(); }

    synchronized void importSnapshot(String snapshot) throws JSONException, IOException {
        JSONObject match = new JSONObject(snapshot);
        JSONObject updated = new JSONObject().put("revision", state.optInt("revision", 0) + 1).put("match", match);
        writeAtomic(stateFile, updated.toString());
        state = updated;
        draft = null;
    }

    synchronized String exportTransfer() throws JSONException {
        if (state.isNull("match")) throw new JSONException("Geen lokale partij");
        return new JSONObject().put("match", state.getJSONObject("match"))
                .put("draft", draft != null && System.currentTimeMillis()-draftTime < 180000 ? draft : JSONObject.NULL)
                .put("requestId", java.util.UUID.randomUUID().toString()).toString();
    }

    @Override public synchronized Response serve(IHTTPSession session) {
        try {
            String path = session.getUri();
            if (bluetoothMode && path.startsWith("/api/")) return proxy(session, path);
            if (Method.GET.equals(session.getMethod())) return get(path, session.getHeaders().get("x-darts-revision"));
            if (Method.POST.equals(session.getMethod())) return post(path, session);
            return json(Response.Status.METHOD_NOT_ALLOWED, new JSONObject().put("error", "Methode niet toegestaan"));
        } catch (Exception error) {
            Log.w("180HittersBluetooth", "API-verzoek mislukt", error);
            try { return json(Response.Status.INTERNAL_ERROR, new JSONObject().put("error", "Lokale opslagfout")); }
            catch (JSONException impossible) { return newFixedLengthResponse(Response.Status.INTERNAL_ERROR, MIME_PLAINTEXT, "Lokale opslagfout"); }
        }
    }

    private Response proxy(IHTTPSession session, String path) throws Exception {
        String body = null;
        if (Method.POST.equals(session.getMethod())) {
            Map<String, String> files = new HashMap<>();
            session.parseBody(files); body = files.getOrDefault("postData", "{}");
        } else if (!Method.GET.equals(session.getMethod())) {
            return json(Response.Status.METHOD_NOT_ALLOWED, new JSONObject().put("error", "Methode niet toegestaan"));
        }
        BluetoothClient.Result result = bluetooth.request(session.getMethod().name(), path, body, session.getHeaders().get("x-darts-revision"));
        return jsonStatus(result.status, result.body);
    }

    private static Response jsonStatus(int code, String body) {
        Response.IStatus status = Response.Status.lookup(code);
        if (code == 423) status = new Response.IStatus() {
            public int getRequestStatus() { return 423; }
            public String getDescription() { return "423 Locked"; }
        };
        if (status == null) status = Response.Status.INTERNAL_ERROR;
        Response response = newFixedLengthResponse(status, "application/json; charset=utf-8", body);
        response.addHeader("Cache-Control", "no-store"); return response;
    }

    private Response get(String path, String knownRevision) throws Exception {
        switch (path) {
            case "/api/state": {
                JSONObject result = String.valueOf(state.getInt("revision")).equals(knownRevision)
                        ? new JSONObject().put("revision", state.getInt("revision")) : new JSONObject(state.toString());
                result.put("draft", draft != null && System.currentTimeMillis() - draftTime < 180000 ? draft : JSONObject.NULL);
                if(context.getFilesDir().getUsableSpace()<100L*1024*1024)result.put("storageWarning","Weinig vrije opslag op deze telefoon; maak ruimte vrij.");
                return json(Response.Status.OK, result);
            }
            case "/api/players": return playerLists();
            case "/api/display": return json(Response.Status.OK, display);
            case "/api/venue": return json(Response.Status.OK, venue);
            case "/api/setup": return json(Response.Status.OK, new JSONObject(setup.toString()).put("revision", state.getInt("revision")));
            case "/api/network": return json(Response.Status.OK, new JSONObject().put("urls", new JSONArray()));
            case "/api/network/control": return json(Response.Status.SERVICE_UNAVAILABLE, new JSONObject().put("error", "Alleen beschikbaar op de NUC"));
            default:
                if (path.startsWith("/api/")) return json(Response.Status.NOT_FOUND, new JSONObject().put("error", "Onbekend verzoek"));
                return asset(path);
        }
    }

    private Response post(String path, IHTTPSession session) throws Exception {
        Map<String, String> files = new HashMap<>();
        session.parseBody(files);
        JSONObject incoming = new JSONObject(files.getOrDefault("postData", "{}"));
        switch (path) {
            case "/api/state": {
                if (incoming.getInt("revision") != state.getInt("revision")) return json(Response.Status.CONFLICT, state);
                JSONObject match = incoming.getJSONObject("match");
                JSONObject matchState = match.optJSONObject("state");
                if (matchState == null || matchState.optInt("version") != 2) return json(Response.Status.BAD_REQUEST, new JSONObject().put("error", "Ongeldige partij"));
                JSONObject updated = new JSONObject().put("revision", state.getInt("revision") + 1).put("match", match);
                writeAtomic(stateFile, updated.toString()); state = updated; draft = null;
                return json(Response.Status.OK, state);
            }
            case "/api/draft": {
                if (incoming.getInt("revision") != state.getInt("revision")) return json(Response.Status.CONFLICT, state);
                draft = new JSONObject().put("owner", incoming.optString("owner"))
                        .put("hits", incoming.optJSONArray("hits") == null ? new JSONArray() : incoming.getJSONArray("hits"))
                        .put("entry", incoming.optString("entry")).put("revision", state.getInt("revision"));
                draftTime = System.currentTimeMillis();
                return json(Response.Status.OK, new JSONObject().put("ok", true));
            }
            case "/api/players": {
                String name = incoming.getString("name").trim(); String action = incoming.getString("action");
                if (name.isEmpty() || name.length() > 24) return json(Response.Status.BAD_REQUEST, new JSONObject().put("error", "Ongeldige naam"));
                JSONArray updated = new JSONArray(); boolean exists = false;
                for (int i=0; i<players.length(); i++) {
                    String current = players.getString(i);
                    if (current.equalsIgnoreCase(name)) { exists = true; if ("remove".equals(action)) continue; }
                    updated.put(current);
                }
                if ("add".equals(action) && !exists) updated.put(name);
                players = sort(updated); writeAtomic(playersFile, players.toString());
                return playerLists();
            }
            case "/api/mobile-players": {
                JSONArray incomingPlayers = incoming.getJSONArray("players");
                if (incomingPlayers.length() > 200) return json(Response.Status.BAD_REQUEST, new JSONObject().put("error", "Te veel spelers"));
                JSONArray updated = new JSONArray();
                for (int i=0; i<incomingPlayers.length(); i++) {
                    String name = incomingPlayers.getString(i).trim();
                    if (name.isEmpty() || name.length() > 24) return json(Response.Status.BAD_REQUEST, new JSONObject().put("error", "Ongeldige naam"));
                    boolean exists=false;
                    for(int j=0;j<updated.length();j++) if(updated.getString(j).equalsIgnoreCase(name)){exists=true;break;}
                    if(!exists) updated.put(name);
                }
                players=sort(updated); writeAtomic(playersFile,players.toString());
                return playerLists();
            }
            case "/api/display": {
                if (incoming.has("inputCollapsed")) display.put("inputCollapsed", incoming.getBoolean("inputCollapsed"));
                if (incoming.has("screensaverActive")) display.put("screensaverActive", incoming.getBoolean("screensaverActive"));
                writeAtomic(displayFile, display.toString()); return json(Response.Status.OK, display);
            }
            case "/api/venue": {
                venue = cleanVenue(incoming);
                writeAtomic(venueFile, venue.toString());
                return json(Response.Status.OK, venue);
            }
            case "/api/setup": {
                if (incoming.getInt("revision") != state.getInt("revision")) return json(Response.Status.CONFLICT, new JSONObject().put("revision", state.getInt("revision")));
                setup.put("version", setup.optInt("version") + 1).put("value", incoming.opt("value"));
                return json(Response.Status.OK, setup);
            }
            case "/api/kiosk/open":
            case "/api/network/switch": return json(Response.Status.SERVICE_UNAVAILABLE, new JSONObject().put("error", "Alleen beschikbaar op de NUC"));
            default: return json(Response.Status.NOT_FOUND, new JSONObject().put("error", "Onbekend verzoek"));
        }
    }

    private Response asset(String uri) throws IOException {
        String path = uri.equals("/") ? "index.html" : uri.substring(1);
        if (path.contains("..")) return newFixedLengthResponse(Response.Status.FORBIDDEN, MIME_PLAINTEXT, "Verboden");
        AssetManager assets = context.getAssets();
        try (InputStream input = assets.open("www/" + path)) {
            byte[] data = readAll(input);
            Response response = newFixedLengthResponse(Response.Status.OK, mime(path), new ByteArrayInputStream(data), data.length);
            response.addHeader("Cache-Control", "no-store");
            response.addHeader("X-Content-Type-Options", "nosniff");
            return response;
        } catch (IOException missing) {
            return newFixedLengthResponse(Response.Status.NOT_FOUND, MIME_PLAINTEXT, "Niet gevonden");
        }
    }

    private static String mime(String path) {
        if (path.endsWith(".html")) return "text/html; charset=utf-8";
        if (path.endsWith(".js")) return "text/javascript; charset=utf-8";
        if (path.endsWith(".css")) return "text/css; charset=utf-8";
        if (path.endsWith(".json")) return "application/json; charset=utf-8";
        if (path.endsWith(".svg")) return "image/svg+xml";
        if (path.endsWith(".png")) return "image/png";
        if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
        return "application/octet-stream";
    }

    private static Response json(Response.Status status, JSONObject value) {
        Response response = newFixedLengthResponse(status, "application/json; charset=utf-8", value.toString());
        response.addHeader("Cache-Control", "no-store"); return response;
    }
    private static JSONObject defaultVenue() throws JSONException {
        return new JSONObject().put("venueName", "180 Hitters").put("city", "")
                .put("playerListName", "Clubspelers").put("slogan", "Samen aan de oche.")
                .put("screensaverEnabled", true).put("logoData", "").put("backgroundData", "")
                .put("clubWifiName", "").put("clubWifiQr", "")
                .put("hotspotName", "180 Hitters wifi").put("hotspotPassword", "");
    }
    private static JSONObject cleanVenue(JSONObject input) throws JSONException {
        JSONObject result=new JSONObject();
        String[] strings={"venueName","city","playerListName","slogan","logoData","backgroundData","clubWifiName","clubWifiQr","hotspotName","hotspotPassword"};
        for(String key:strings){if(!input.has(key)||!(input.get(key) instanceof String))throw new JSONException("Ongeldig locatieprofiel");result.put(key,input.getString(key).trim());}
        if(!input.has("screensaverEnabled"))throw new JSONException("Ongeldig locatieprofiel");
        result.put("screensaverEnabled",input.getBoolean("screensaverEnabled"));
        if(result.getString("venueName").isEmpty()||result.getString("playerListName").isEmpty()||result.getString("hotspotName").isEmpty())throw new JSONException("Ongeldig locatieprofiel");
        if(result.getString("venueName").length()>60||result.getString("city").length()>60||result.getString("playerListName").length()>40||result.getString("slogan").length()>100||result.getString("clubWifiQr").length()>500||result.getString("logoData").length()>2500000||result.getString("backgroundData").length()>2500000)throw new JSONException("Locatieprofiel te groot");
        return result;
    }
    private Response playerLists() throws JSONException {
        return json(Response.Status.OK, new JSONObject().put("players", players)
                .put("venuePlayers", new JSONArray()).put("mobilePlayers", players));
    }
    private static JSONObject readObject(File file, JSONObject fallback) { try { return file.exists() ? new JSONObject(new String(Files.readAllBytes(file.toPath()), StandardCharsets.UTF_8)) : fallback; } catch (Exception e) { return fallback; } }
    private static JSONArray readArray(File file, JSONArray fallback) { try { return file.exists() ? new JSONArray(new String(Files.readAllBytes(file.toPath()), StandardCharsets.UTF_8)) : fallback; } catch (Exception e) { return fallback; } }
    private static void writeAtomic(File target, String value) throws IOException {
        File tmp = new File(target.getPath()+".tmp");
        try {
            try(FileOutputStream out=new FileOutputStream(tmp)){out.write(value.getBytes(StandardCharsets.UTF_8));out.getFD().sync();}
            android.system.Os.rename(tmp.getPath(),target.getPath());
        } catch(android.system.ErrnoException e){throw new IOException("Opslaan mislukt; vorige bestand behouden",e);}
        finally { if(tmp.exists())tmp.delete(); }
    }
    private static byte[] readAll(InputStream in) throws IOException { byte[] buffer=new byte[8192]; java.io.ByteArrayOutputStream out=new java.io.ByteArrayOutputStream(); int n; while((n=in.read(buffer))!=-1)out.write(buffer,0,n); return out.toByteArray(); }
    private static JSONArray sort(JSONArray array) throws JSONException { java.util.List<String> list=new java.util.ArrayList<>(); for(int i=0;i<array.length();i++)list.add(array.getString(i)); list.sort(String.CASE_INSENSITIVE_ORDER); JSONArray result=new JSONArray(); for(String value:list)result.put(value); return result; }
}
