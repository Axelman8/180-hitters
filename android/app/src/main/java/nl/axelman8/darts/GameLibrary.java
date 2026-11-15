package nl.axelman8.darts;

import org.json.JSONArray;
import org.json.JSONObject;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.MessageDigest;
import java.util.ArrayList;

/** Persistent games, separate from the single active match. */
final class GameLibrary {
    private final File directory;
    GameLibrary(File directory) { this.directory=directory; }
    static String identity(JSONObject match) throws Exception {
        if(match==null||match.optJSONObject("state")==null)return null;
        JSONObject state=match.getJSONObject("state");
        if(state.optJSONArray("players")==null)return null;
        String source=state.optString("game","x01")+":"+state.optString("startedAt",state.getJSONArray("players").toString());
        byte[] hash=MessageDigest.getInstance("SHA-256").digest(source.getBytes(StandardCharsets.UTF_8));
        StringBuilder id=new StringBuilder();for(int index=0;index<16;index++)id.append(String.format("%02x",hash[index]&255));return id.toString();
    }
    JSONObject get(String id) throws Exception {
        if(id==null||!id.matches("[a-f0-9]{32}"))throw new IllegalArgumentException("Ongeldige partij.");
        return new JSONObject(new String(Files.readAllBytes(new File(directory,id+".json").toPath()),StandardCharsets.UTF_8));
    }
    void record(JSONObject match,JSONObject draft) throws Exception {
        String id=identity(match);if(id==null||match.optBoolean("historyNavigation"))return;
        JSONObject previous=null;try{previous=get(id);}catch(Exception ignored){}
        if(previous!=null&&previous.getJSONObject("match").toString().equals(match.toString())&&
                String.valueOf(previous.opt("draft")).equals(String.valueOf(draft==null?JSONObject.NULL:draft)))return;
        if(!directory.exists()&&!directory.mkdirs())throw new java.io.IOException("Partijenmap kon niet worden gemaakt.");
        JSONObject saved=new JSONObject().put("id",id).put("time",System.currentTimeMillis()/1000d).put("match",match).put("draft",draft==null?JSONObject.NULL:draft);
        File target=new File(directory,id+".json"),temporary=new File(directory,id+".tmp");
        try(FileOutputStream output=new FileOutputStream(temporary)){output.write(saved.toString().getBytes(StandardCharsets.UTF_8));output.getFD().sync();}
        try{android.system.Os.rename(temporary.getPath(),target.getPath());}finally{if(temporary.exists())temporary.delete();}
    }
    JSONArray items(JSONObject current) throws Exception {
        ArrayList<JSONObject> items=new ArrayList<>();File[] files=directory.listFiles();String active=identity(current);
        if(files!=null)for(File file:files)try{
            if(!file.getName().matches("[a-f0-9]{32}\\.json"))continue;
            String id=file.getName().substring(0,32);JSONObject saved=get(id),state=saved.getJSONObject("match").getJSONObject("state");JSONArray names=new JSONArray();
            for(int i=0;i<state.getJSONArray("players").length();i++)names.put(state.getJSONArray("players").getJSONObject(i).optString("name"));
            items.add(new JSONObject().put("id",id).put("time",saved.getDouble("time")).put("game",state.optString("game"))
                    .put("training121",state.optBoolean("training121")).put("startedAt",state.opt("startedAt")).put("players",names)
                    .put("phase",state.optString("phase")).put("winner",state.opt("winner"))
                    .put("turns",state.optJSONArray("history")==null?0:state.getJSONArray("history").length()).put("current",id.equals(active)));
        }catch(Exception ignored){}
        items.sort((a,b)->Double.compare(b.optDouble("time"),a.optDouble("time")));return new JSONArray(items);
    }
}
