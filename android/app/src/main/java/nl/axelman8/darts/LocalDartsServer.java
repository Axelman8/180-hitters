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
    private final File onlineFile;
    private final GameLibrary library;
    private JSONObject state;
    private JSONArray players;
    private JSONObject display;
    private JSONObject venue;
    private JSONObject online;
    private JSONObject setup = new JSONObject();
    private JSONObject draft;
    private final Map<String, Long> draftSequences = new HashMap<>();
    private long draftTime;
    private String botOwner = "";
    private int botRevision = -1;
    private long botUntil;

    LocalDartsServer(Context context, BluetoothClient bluetooth) throws IOException, JSONException {
        super("127.0.0.1", 8765);
        this.context = context.getApplicationContext();
        this.bluetooth = bluetooth;
        stateFile = new File(context.getFilesDir(), "local-match.json");
        playersFile = new File(context.getFilesDir(), "local-players.json");
        displayFile = new File(context.getFilesDir(), "local-display.json");
        venueFile = new File(context.getFilesDir(), "local-venue.json");
        onlineFile = new File(context.getFilesDir(), "local-online.json");
        state = readObject(stateFile, new JSONObject().put("revision", 0).put("match", JSONObject.NULL));
        library = new GameLibrary(new File(context.getFilesDir(), "local-games"));
        try {
            JSONObject match=state.optJSONObject("match");
            if(match!=null){
                JSONObject saved=null;try{saved=library.get(GameLibrary.identity(match));}catch(Exception ignored){}
                if(saved!=null&&saved.getJSONObject("match").toString().equals(match.toString())&&saved.optJSONObject("draft")!=null){draft=saved.getJSONObject("draft").put("revision",state.getInt("revision"));draftTime=System.currentTimeMillis();}
                else library.record(match,null);
            }
        }catch(Exception error){Log.w("180HittersGames","Partijenlijst laden mislukt",error);}
        players = readArray(playersFile, new JSONArray());
        display = readObject(displayFile, new JSONObject().put("inputCollapsed", false));
        venue = readObject(venueFile, defaultVenue());
        online = readObject(onlineFile, defaultOnline());
        setup.put("version", 0).put("value", JSONObject.NULL);
        start(SOCKET_READ_TIMEOUT, false);
    }

    void setBluetoothMode(boolean enabled) { bluetoothMode = enabled; if (!enabled) bluetooth.closeSocket(); }

    synchronized void importSnapshot(String snapshot) throws JSONException, IOException {
        JSONObject match = new JSONObject(snapshot);
        try{if(library.isDeleted(GameLibrary.identity(match)))throw new IOException("Deze partij is verwijderd. Start een nieuwe partij.");}catch(IOException error){throw error;}catch(Exception error){throw new IOException("Ongeldige partij",error);}
        try{library.record(state.optJSONObject("match"),draft);library.record(match,null);}catch(Exception e){throw new IOException("Partij bewaren mislukt",e);}
        JSONObject updated = new JSONObject().put("revision", state.optInt("revision", 0) + 1).put("match", match);
        writeAtomic(stateFile, updated.toString());
        state = updated;
        draft = null;
        draftSequences.clear();
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
        if(path.startsWith("/api/matches/")){
            try{return json(Response.Status.OK,library.get(path.substring("/api/matches/".length())));}
            catch(java.nio.file.NoSuchFileException error){return json(Response.Status.NOT_FOUND,new JSONObject().put("error","Partij niet gevonden."));}
            catch(IllegalArgumentException error){return json(Response.Status.BAD_REQUEST,new JSONObject().put("error",error.getMessage()));}
        }
        switch (path) {
            case "/api/matches": return json(Response.Status.OK,new JSONObject().put("matches",library.items(state.optJSONObject("match"))).put("canDelete",true).put("revision",state.getInt("revision")));
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
            case "/api/online/local": return json(Response.Status.OK, new JSONObject(online.toString()));
            case "/api/online/tunnel": return json(Response.Status.OK, new JSONObject().put("status", "central").put("url", "").put("error", ""));
            default:
                if (path.startsWith("/api/")) return json(Response.Status.NOT_FOUND, new JSONObject().put("error", "Onbekend verzoek"));
                return asset(path);
        }
    }

    private Response post(String path, IHTTPSession session) throws Exception {
        Map<String, String> files = new HashMap<>();
        session.parseBody(files);
        JSONObject incoming = new JSONObject(files.getOrDefault("postData", "{}"));
        if(incoming.has("_bot")&&(!incoming.optString("_bot").equals(botOwner)||botRevision!=state.getInt("revision")||botUntil<=android.os.SystemClock.elapsedRealtime()))return json(Response.Status.CONFLICT,state);
        switch (path) {
            case "/api/bot/claim": {
                JSONObject match=state.optJSONObject("match"),game=match==null?null:match.optJSONObject("state");
                JSONArray seats=game==null?null:game.optJSONArray("players");int active=game==null?-1:game.optInt("active",-1);
                String owner=incoming.optString("owner");long now=android.os.SystemClock.elapsedRealtime();
                boolean valid=owner.length()>0&&owner.length()<=80&&incoming.optInt("revision",-1)==state.getInt("revision")&&seats!=null&&active>=0&&active<seats.length()&&seats.getJSONObject(active).optBoolean("bot")&&"playing".equals(game.optString("phase"))&&!online.optBoolean("active")&&setup.optJSONObject("value")==null&&match.optJSONObject("editTurn")==null&&(match.optJSONArray("future")==null||match.getJSONArray("future").length()==0)&&(match.optJSONArray("pendingTurns")==null||match.getJSONArray("pendingTurns").length()==0);
                boolean granted=valid&&(botRevision!=state.getInt("revision")||botOwner.equals(owner)||botUntil<=now);
                if(granted){botOwner=owner;botRevision=state.getInt("revision");botUntil=now+7000;}
                return json(Response.Status.OK,new JSONObject().put("granted",granted).put("draft",draft==null?JSONObject.NULL:draft));
            }
            case "/api/state": {
                if (incoming.getInt("revision") != state.getInt("revision")) return json(Response.Status.CONFLICT, state);
                JSONObject match = incoming.getJSONObject("match");
                JSONObject matchState = match.optJSONObject("state");
                if (matchState == null || matchState.optInt("version") != 2) return json(Response.Status.BAD_REQUEST, new JSONObject().put("error", "Ongeldige partij"));
                if(library.isDeleted(GameLibrary.identity(match)))return json(Response.Status.BAD_REQUEST,new JSONObject().put("error","Deze partij is verwijderd. Start een nieuwe partij."));
                if(!String.valueOf(GameLibrary.identity(state.optJSONObject("match"))).equals(GameLibrary.identity(match)))library.record(state.optJSONObject("match"),draft);
                library.record(match,null);
                JSONObject updated = new JSONObject().put("revision", state.getInt("revision") + 1).put("match", match);
                writeAtomic(stateFile, updated.toString()); state = updated; draft = null; draftSequences.clear();
                return json(Response.Status.OK, state);
            }
            case "/api/matches/delete": {
                java.util.ArrayList<String> ids;
                try{ids=GameLibrary.validateIds(incoming.optJSONArray("ids"));}
                catch(IllegalArgumentException error){return json(Response.Status.BAD_REQUEST,new JSONObject().put("error",error.getMessage()));}
                boolean clearsCurrent=ids.contains(GameLibrary.identity(state.optJSONObject("match")));
                if(clearsCurrent){
                    if(incoming.optInt("revision",-1)!=state.getInt("revision"))return json(Response.Status.CONFLICT,new JSONObject().put("error","De huidige partij is gewijzigd. Vernieuw de lijst en bevestig opnieuw."));
                    if(online.optBoolean("active"))return json(Response.Status.CONFLICT,new JSONObject().put("error","Verlaat eerst de online dartbaan voordat je de huidige partij verwijdert."));
                    JSONObject updated=new JSONObject().put("revision",state.getInt("revision")+1).put("match",JSONObject.NULL);
                    writeAtomic(stateFile,updated.toString());state=updated;draft=null;draftSequences.clear();
                    setup.put("version",setup.optInt("version")+1).put("value",JSONObject.NULL);
                }
                JSONArray deleted=library.delete(ids);
                JSONObject result=new JSONObject().put("deleted",deleted).put("matches",library.items(state.optJSONObject("match"))).put("canDelete",true).put("revision",state.getInt("revision")).put("clearedCurrent",clearsCurrent);
                if(clearsCurrent)result.put("state",new JSONObject(state.toString()).put("draft",JSONObject.NULL));
                return json(Response.Status.OK,result);
            }
            case "/api/match/discard": {
                library.record(state.optJSONObject("match"),draft);
                JSONObject updated = new JSONObject().put("revision", state.getInt("revision") + 1).put("match", JSONObject.NULL);
                writeAtomic(stateFile, updated.toString()); state = updated; draft = null; draftSequences.clear();
                setup.put("version", setup.optInt("version") + 1).put("value", JSONObject.NULL);
                return json(Response.Status.OK, state);
            }
            case "/api/matches/resume": {
                if(incoming.optInt("revision",-1)!=state.getInt("revision"))return json(Response.Status.CONFLICT,new JSONObject().put("error","De partij is gewijzigd. Open de lijst opnieuw."));
                JSONObject saved;
                try{saved=library.get(incoming.optString("id"));}catch(Exception e){return json(Response.Status.NOT_FOUND,new JSONObject().put("error","Partij niet gevonden."));}
                JSONObject match=saved.getJSONObject("match");
                if("won".equals(match.getJSONObject("state").optString("phase")))return json(Response.Status.BAD_REQUEST,new JSONObject().put("error","Deze partij is afgerond. Je kunt het rapport bekijken."));
                if(match.getJSONObject("state").optBoolean("seaFog")&&!online.optBoolean("active"))return json(Response.Status.CONFLICT,new JSONObject().put("error","Open de actieve online dartbaan om deze Zeeslag-partij te vervolgen. Het rapport blijft beschikbaar."));
                boolean same=incoming.optString("id").equals(GameLibrary.identity(state.optJSONObject("match")));
                if(online.optBoolean("active")&&!same)return json(Response.Status.CONFLICT,new JSONObject().put("error","Verlaat eerst de online dartbaan om een andere partij te openen."));
                if(same)return json(Response.Status.OK,new JSONObject(state.toString()).put("draft",draft==null?JSONObject.NULL:draft));
                library.record(state.optJSONObject("match"),draft);
                JSONObject updated=new JSONObject().put("revision",state.getInt("revision")+1).put("match",match);
                JSONObject pending=saved.optJSONObject("draft");if(pending!=null)pending.put("revision",updated.getInt("revision"));
                library.record(match,pending);writeAtomic(stateFile,updated.toString());state=updated;draft=pending;draftTime=System.currentTimeMillis();draftSequences.clear();
                setup.put("version",setup.optInt("version")+1).put("value",JSONObject.NULL);
                return json(Response.Status.OK,new JSONObject(state.toString()).put("draft",draft==null?JSONObject.NULL:draft));
            }
            case "/api/draft": {
                if (incoming.getInt("revision") != state.getInt("revision")) return json(Response.Status.CONFLICT, state);
                String owner = incoming.getString("owner"); long sequence = incoming.getLong("seq");
                if (owner.isEmpty() || owner.length() > 80 || sequence < 0) return json(Response.Status.BAD_REQUEST, new JSONObject().put("error", "Ongeldige live worp"));
                if (sequence <= draftSequences.getOrDefault(owner, -1L)) return json(Response.Status.OK, new JSONObject().put("ok", true).put("stale", true));
                draftSequences.put(owner, sequence);
                draft = new JSONObject().put("owner", owner)
                        .put("hits", incoming.optJSONArray("hits") == null ? new JSONArray() : incoming.getJSONArray("hits"))
                        .put("entry", incoming.optString("entry")).put("revision", state.getInt("revision"));
                draftTime = System.currentTimeMillis();
                library.record(state.optJSONObject("match"),draft);
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
            case "/api/online/local": {
                boolean active = incoming.optBoolean("active", false);
                JSONObject updated = defaultOnline().put("active", active);
                if (active) {
                    int role = incoming.optInt("role", -1);
                    String code = incoming.optString("code", "").trim().toUpperCase();
                    String base = incoming.optString("base", "").trim();
                    String key = incoming.optString("key", "").trim();
                    if (role < 0 || role > 3 || !code.matches("[A-Z2-9]{6}") ||
                            !base.startsWith("https://") || key.isEmpty()) {
                        return json(Response.Status.BAD_REQUEST, new JSONObject().put("error", "Ongeldige online dartbaan"));
                    }
                    updated.put("ready", incoming.optBoolean("ready", false)).put("role", role)
                            .put("code", code).put("base", base).put("key", key)
                            .put("remoteRevision", Math.max(0, incoming.optInt("remoteRevision", 0)));
                }
                writeAtomic(onlineFile, updated.toString()); online = updated;
                return json(Response.Status.OK, online);
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
    private static JSONObject defaultOnline() throws JSONException {
        return new JSONObject().put("active", false).put("ready", false).put("role", JSONObject.NULL)
                .put("code", "").put("base", "").put("key", "").put("remoteRevision", 0);
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
