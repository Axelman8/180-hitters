package nl.axelman8.darts;

import android.app.Activity;
import android.app.AlertDialog;
import android.Manifest;
import android.bluetooth.BluetoothDevice;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import android.util.Base64;
import android.util.Log;

import androidx.core.content.FileProvider;

import java.io.File;
import java.io.FileOutputStream;

import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

public final class MainActivity extends Activity {
    private static final int NOTIFICATION_PERMISSION_REQUEST=42;
    private WebView web;
    private LocalDartsServer localServer;
    private BluetoothClient bluetooth;
    private AppUpdater updater;
    private String pendingOnlineInvite="";
    private SharedPreferences preferences;
    private String mode;
    private boolean webPaused;
    private final Object shareLock = new Object();
    private FileOutputStream pendingShareStream;
    private File pendingShareFile;
    private final ArrayList<File> pendingShareFiles = new ArrayList<>();

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        preferences = getSharedPreferences("axelman8", MODE_PRIVATE);
        ClubRequestWorker.createChannel(this);
        if(!preferences.getString("club_admin_token","").isEmpty()) ClubRequestWorker.schedule(this);
        bluetooth = new BluetoothClient();
        updater = new AppUpdater(this);
        readOnlineInvite(getIntent());
        String savedBluetooth = preferences.getString("bluetooth_address", null);
        if (savedBluetooth != null) bluetooth.select(savedBluetooth);
        try { localServer = new LocalDartsServer(this, bluetooth); }
        catch (Exception error) { Toast.makeText(this, "Lokale dartserver kon niet starten.", Toast.LENGTH_LONG).show(); }

        web = new WebView(this);
        setContentView(web);

        WebSettings settings = web.getSettings(); settings.setJavaScriptEnabled(true); settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true); settings.setMediaPlaybackRequiresUserGesture(false); settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        web.setBackgroundColor(Color.rgb(16,28,35)); web.addJavascriptInterface(new Bridge(), "DartsAndroid");
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri target=request.getUrl(); if (trusted(target)) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW,target)); } catch(ActivityNotFoundException ignored) {}
                return true;
            }
        });
        web.setDownloadListener((url,userAgent,contentDisposition,mimetype,length)->{
            try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); } catch(ActivityNotFoundException ignored) {}
        });
        if(hasBluetoothPermission() && !preferences.getBoolean("bluetooth_default_done",false)) {
            for(BluetoothDevice device:bluetooth.pairedDevices()) {
                String name=device.getName()==null?"":device.getName();
                if("darten".equalsIgnoreCase(name) || name.toLowerCase().contains("venhoeve nuc")) {
                    bluetooth.select(device.getAddress());
                    preferences.edit().putString("bluetooth_address",device.getAddress())
                            .putBoolean("bluetooth_default_done",true).apply();
                    loadMode("bluetooth");
                    updater.check(false);
                    return;
                }
            }
        }
        mode = preferences.getString("mode", null);
        // Older versions could control the NUC over wifi. Migrate that saved
        // choice so NUC control can only run through Bluetooth.
        if ("nuc".equals(mode)) {
            preferences.edit().remove("mode").remove("nuc_url").apply();
            mode = null;
        }
        if (mode == null) showModeChooser(); else loadMode(mode);
        updater.check(false);
    }

    private boolean trusted(Uri target) {
        String host=target.getHost(); if (host==null) return false;
        if ("127.0.0.1".equals(host) || "localhost".equals(host)) return true;
        return false;
    }

    private void showModeChooser() {
        new AlertDialog.Builder(this).setTitle("Waar wil je spelen?")
                .setItems(new String[]{"Lokaal op deze telefoon", "NUC via Bluetooth"}, (dialog, which)->{
                    if(which==0) chooseLocal(); else chooseBluetooth();
                }).setNegativeButton("Annuleren", null).show();
    }

    private boolean hasBluetoothPermission() {
        return Build.VERSION.SDK_INT < 31 || checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED;
    }

    private void requestClubNotificationPermission() {
        ClubRequestWorker.createChannel(this);
        if(ClubRequestWorker.allowed(this)){ClubRequestWorker.schedule(this);return;}
        if(Build.VERSION.SDK_INT<33||checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)==PackageManager.PERMISSION_GRANTED){openClubNotificationSettings();return;}
        boolean asked=preferences.getBoolean("club_notifications_asked",false);
        if(!asked||shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS)){
            preferences.edit().putBoolean("club_notifications_asked",true).apply();
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},NOTIFICATION_PERMISSION_REQUEST);
            return;
        }
        new AlertDialog.Builder(this).setTitle("Meldingen inschakelen")
                .setMessage("Meldingen zijn voor 180 Hitters uitgeschakeld. Schakel Clubaanvragen in zodat je nieuwe spelers direct ziet.")
                .setPositiveButton("Meldinginstellingen",(dialog,which)->openClubNotificationSettings()).setNegativeButton("Later",null).show();
    }

    private void openClubNotificationSettings(){startActivity(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE,getPackageName()));}

    @Override public void onRequestPermissionsResult(int requestCode,String[] permissions,int[] results){
        super.onRequestPermissionsResult(requestCode,permissions,results);
        if(requestCode==NOTIFICATION_PERMISSION_REQUEST&&results.length>0&&results[0]==PackageManager.PERMISSION_GRANTED)ClubRequestWorker.schedule(this);
    }

    private void chooseBluetooth() {
        if (!bluetooth.isAvailable()) { Toast.makeText(this, "Deze telefoon heeft geen Bluetooth.", Toast.LENGTH_LONG).show(); return; }
        if (!hasBluetoothPermission()) {
            requestPermissions(new String[]{Manifest.permission.BLUETOOTH_CONNECT, Manifest.permission.BLUETOOTH_SCAN}, 41);
            return;
        }
        List<BluetoothDevice> devices = bluetooth.pairedDevices();
        if (devices.isEmpty()) {
            new AlertDialog.Builder(this).setTitle("Koppel eerst met darten")
                    .setMessage("Open Bluetooth-instellingen, kies de NUC ‘darten’ en bevestig de eenmalige koppeling.")
                    .setPositiveButton("Bluetooth-instellingen", (d,w)->startActivity(new Intent(Settings.ACTION_BLUETOOTH_SETTINGS)))
                    .setNegativeButton("Annuleren", null).show();
            return;
        }
        String[] labels = new String[devices.size()+1];
        for(int i=0;i<devices.size();i++) {
            String name=devices.get(i).getName();
            labels[i]=(name==null?"Onbekend apparaat":name)+"\n"+devices.get(i).getAddress();
        }
        labels[devices.size()]="Ander apparaat koppelen…";
        new AlertDialog.Builder(this).setTitle("Kies de Bluetooth-NUC").setItems(labels,(d,which)->{
            if(which==devices.size()) { startActivity(new Intent(Settings.ACTION_BLUETOOTH_SETTINGS)); return; }
            String address=devices.get(which).getAddress();
            bluetooth.select(address); preferences.edit().putString("bluetooth_address",address).apply();
            loadMode("bluetooth");
        }).setNegativeButton("Annuleren",null).show();
    }

    private void chooseLocal() {
        String snapshot=preferences.getString("last_snapshot","");
        if("bluetooth".equals(mode)&&!snapshot.isEmpty()) {
            new AlertDialog.Builder(this).setTitle("Laatste NUC-stand meenemen?")
                    .setMessage("Kies Overnemen om na verlies van Bluetooth lokaal verder te spelen vanaf de laatst bevestigde stand.")
                    .setPositiveButton("Overnemen",(d,w)->{try{localServer.importSnapshot(snapshot);}catch(Exception e){Toast.makeText(this,"Stand kon niet worden overgenomen.",Toast.LENGTH_LONG).show();}loadMode("local");})
                    .setNegativeButton("Lokale partij openen",(d,w)->loadMode("local")).show();
        } else loadMode("local");
    }

    private void loadMode(String selected) {
        if (!"local".equals(selected) && !"bluetooth".equals(selected)) selected="bluetooth";
        mode=selected; preferences.edit().putString("mode",selected).apply();
        if(localServer!=null)localServer.setBluetoothMode("bluetooth".equals(selected));
        if("local".equals(selected)) web.loadUrl("http://127.0.0.1:8765/?android=1");
        else web.loadUrl("http://127.0.0.1:8765/?remote=1&android=1&transport=bluetooth");
    }

    @Override public void onBackPressed(){if(web.canGoBack())web.goBack();else super.onBackPressed();}
    @Override protected void onResume(){
        super.onResume();
        if(web!=null&&webPaused){
            web.resumeTimers();
            web.onResume();
            webPaused=false;
        }
        if(updater!=null)updater.resumePendingInstall();
    }
    @Override protected void onPause(){
        if(web!=null&&!webPaused){
            web.onPause();
            web.pauseTimers();
            webPaused=true;
        }
        if(bluetooth!=null)bluetooth.closeSocket();
        super.onPause();
    }
    @Override protected void onDestroy(){if(localServer!=null)localServer.stop(); if(bluetooth!=null)bluetooth.shutdown(); if(web!=null)web.destroy(); super.onDestroy();}

    @Override protected void onNewIntent(Intent intent){super.onNewIntent(intent);setIntent(intent);readOnlineInvite(intent);if(web!=null)web.reload();}
    private void readOnlineInvite(Intent intent){
        Uri uri=intent==null?null:intent.getData();String code=uri==null?null:uri.getQueryParameter("dartbaan");
        if(code!=null&&code.matches("[A-Za-z2-9]{6}"))pendingOnlineInvite="https://180-hitters-online.180-hitters-online.workers.dev/?dartbaan="+code.toUpperCase();
    }

    private final class Bridge {
        @JavascriptInterface public void prepareNucTransfer(){runOnUiThread(()->{
            if(!"local".equals(mode))return;
            try {
                String pending=localServer.exportTransfer();
                if(!preferences.edit().putString("pending_nuc_transfer",pending).commit())throw new java.io.IOException("Overdracht niet opgeslagen");
                new AlertDialog.Builder(MainActivity.this).setTitle("Partij overzetten naar NUC")
                    .setMessage("De partij wordt via Bluetooth overgezet. Op de NUC bevestig je het overzetten; de bestaande partij wordt eerst als herstelkopie opgeslagen.")
                    .setPositiveButton("Verbinden via Bluetooth",(d,w)->chooseBluetooth())
                    .setNegativeButton("Annuleren",(d,w)->preferences.edit().remove("pending_nuc_transfer").apply()).show();
            } catch(Exception e){Toast.makeText(MainActivity.this,"Geen lokale partij beschikbaar om over te zetten.",Toast.LENGTH_LONG).show();}
        });}
        @JavascriptInterface public String getPendingNucTransfer(){return "local".equals(mode)?"":preferences.getString("pending_nuc_transfer","");}
        @JavascriptInterface public void clearPendingNucTransfer(){preferences.edit().remove("pending_nuc_transfer").commit();}
        @JavascriptInterface public void chooseMode(){runOnUiThread(MainActivity.this::showModeChooser);}
        @JavascriptInterface public boolean isLocalMode(){return "local".equals(mode);}
        @JavascriptInterface public String takeOnlineInvite(){String value=pendingOnlineInvite;pendingOnlineInvite="";return value;}
        @JavascriptInterface public String getConnectionMode(){return mode==null?"local":mode;}
        @JavascriptInterface public String getConnectionInfo(){
            try {
                return new JSONObject()
                        .put("versionName",BuildConfig.VERSION_NAME)
                        .put("mode",mode==null?"local":mode)
                        .put("bluetoothAvailable",bluetooth!=null&&bluetooth.isAvailable())
                        .put("bluetoothEnabled",bluetooth!=null&&bluetooth.isEnabled())
                        .put("bluetoothConnected",bluetooth!=null&&bluetooth.isConnected())
                        .put("bluetoothAddress",bluetooth==null?"":bluetooth.selectedAddress())
                        .put("bluetoothName",bluetooth==null?"":bluetooth.selectedName())
                        .toString();
            } catch(Exception error){return "{}";}
        }
        @JavascriptInterface public void repairConnection(){if(bluetooth!=null)bluetooth.closeSocket();}
        @JavascriptInterface public String getControlToken(){return "d7c87006c31f4da2a4348eeb05b59c8b";}
        @JavascriptInterface public void checkForUpdate(){runOnUiThread(()->updater.check(true));}
        @JavascriptInterface public void configureClubNotifications(String adminToken){
            if(adminToken==null||adminToken.length()<40||adminToken.length()>200)return;
            preferences.edit().putString("club_admin_token",adminToken).apply();
            runOnUiThread(()->{ClubRequestWorker.createChannel(MainActivity.this);if(!preferences.getBoolean("club_notifications_asked",false))requestClubNotificationPermission();ClubRequestWorker.schedule(MainActivity.this);});
        }
        @JavascriptInterface public boolean clubNotificationsEnabled(){return ClubRequestWorker.allowed(MainActivity.this);}
        @JavascriptInterface public void requestClubNotifications(){runOnUiThread(MainActivity.this::requestClubNotificationPermission);}
        @JavascriptInterface public void notifyClubRequests(int pending){
            if(pending<0||pending>30)return;
            int previous=preferences.getInt("club_pending_notified",0);
            if(pending==0||ClubRequestWorker.allowed(MainActivity.this))preferences.edit().putInt("club_pending_notified",pending).apply();
            if(pending>0&&pending!=previous)ClubRequestWorker.show(MainActivity.this,pending);
        }
        @JavascriptInterface public void shareText(String text){
            if(text==null||text.isEmpty()||text.length()>4000)return;
            runOnUiThread(()->{try {
                Intent send=new Intent(Intent.ACTION_SEND).setType("text/plain")
                        .putExtra(Intent.EXTRA_SUBJECT,"180 Hitters dartbaan")
                        .putExtra(Intent.EXTRA_TEXT,text);
                startActivity(Intent.createChooser(send,"Uitnodiging delen"));
            } catch(Exception error){Toast.makeText(MainActivity.this,"Geen app gevonden om de uitnodiging te delen.",Toast.LENGTH_LONG).show();}});
        }
        @JavascriptInterface public void logShare(String message){Log.i("180HittersShare",message==null?"":message);}
        @JavascriptInterface public boolean beginPngShareCollection(){
            synchronized(shareLock){
                try {if(pendingShareStream!=null){pendingShareStream.close();pendingShareStream=null;}pendingShareFile=null;pendingShareFiles.clear();File directory=new File(getCacheDir(),"shared");if(!directory.exists()&&!directory.mkdirs())return false;File[] old=directory.listFiles();if(old!=null)for(File file:old)file.delete();return true;}
                catch(Exception error){Log.e("180HittersShare","set starten mislukt",error);return false;}
            }
        }
        @JavascriptInterface public boolean beginPngSharePart(String filename){
            synchronized(shareLock){
                try {if(pendingShareStream!=null)return false;File directory=new File(getCacheDir(),"shared");if(!directory.exists()&&!directory.mkdirs())return false;String safe=filename==null?"hitters-challenge.png":filename.replaceAll("[^A-Za-z0-9._-]","_");if(!safe.endsWith(".png"))safe+=".png";pendingShareFile=new File(directory,safe);pendingShareStream=new FileOutputStream(pendingShareFile);return true;}
                catch(Exception error){Log.e("180HittersShare","deel starten mislukt",error);pendingShareStream=null;pendingShareFile=null;return false;}
            }
        }
        @JavascriptInterface public boolean finishPngSharePart(){
            synchronized(shareLock){
                try {if(pendingShareStream==null||pendingShareFile==null)return false;pendingShareStream.flush();pendingShareStream.close();if(pendingShareFile.length()<8||pendingShareFile.length()>30000000)return false;pendingShareFiles.add(pendingShareFile);pendingShareStream=null;pendingShareFile=null;return true;}
                catch(Exception error){Log.e("180HittersShare","deel afronden mislukt",error);pendingShareStream=null;pendingShareFile=null;return false;}
            }
        }
        @JavascriptInterface public boolean finishPngShareCollection(){
            final ArrayList<Uri> uris=new ArrayList<>();synchronized(shareLock){if(pendingShareStream!=null||pendingShareFiles.isEmpty())return false;try {for(File file:pendingShareFiles)uris.add(FileProvider.getUriForFile(MainActivity.this,getPackageName()+".updates",file));}catch(Exception error){Log.e("180HittersShare","providers mislukt",error);return false;}}
            try {Intent send=new Intent(Intent.ACTION_SEND_MULTIPLE).setType("image/png").putParcelableArrayListExtra(Intent.EXTRA_STREAM,uris).putExtra(Intent.EXTRA_SUBJECT,"Hitters Challenge-resultaat").putExtra(Intent.EXTRA_TEXT,"Mijn Hitters Challenge-resultaat - 180 Hitters").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);ClipData clip=ClipData.newRawUri("Hitters Challenge",uris.get(0));for(int index=1;index<uris.size();index++)clip.addItem(new ClipData.Item(uris.get(index)));send.setClipData(clip);Intent chooser=Intent.createChooser(send,"Hitters Challenge delen");chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);chooser.setClipData(clip);Log.i("180HittersShare","chooser openen, afbeeldingen="+uris.size());runOnUiThread(()->{try{startActivity(chooser);}catch(Exception error){Log.e("180HittersShare","chooser mislukt",error);Toast.makeText(MainActivity.this,"Geen app gevonden om de afbeeldingen te delen.",Toast.LENGTH_LONG).show();}});return true;}
            catch(Exception error){Log.e("180HittersShare","set delen mislukt",error);return false;}
        }
        @JavascriptInterface public boolean beginPngShare(String filename){
            synchronized(shareLock){
                try {
                    if(pendingShareStream!=null){try{pendingShareStream.close();}catch(Exception ignored){}pendingShareStream=null;}
                    File directory=new File(getCacheDir(),"shared");if(!directory.exists()&&!directory.mkdirs())return false;
                    File[] old=directory.listFiles();if(old!=null)for(File file:old)file.delete();
                    String safe=filename==null?"hitters-challenge.png":filename.replaceAll("[^A-Za-z0-9._-]","_");if(!safe.endsWith(".png"))safe+=".png";
                    pendingShareFile=new File(directory,safe);pendingShareStream=new FileOutputStream(pendingShareFile);Log.i("180HittersShare","bestand gestart: "+safe);return true;
                } catch(Exception error){Log.e("180HittersShare","begin mislukt",error);pendingShareStream=null;pendingShareFile=null;return false;}
            }
        }
        @JavascriptInterface public boolean appendPngShare(String chunk){
            if(chunk==null||chunk.isEmpty()||chunk.length()>300000)return false;
            synchronized(shareLock){
                try {if(pendingShareStream==null||pendingShareFile==null||pendingShareFile.length()>30000000)return false;pendingShareStream.write(Base64.decode(chunk,Base64.NO_WRAP));return true;}
                catch(Exception error){Log.e("180HittersShare","blok mislukt",error);return false;}
            }
        }
        @JavascriptInterface public boolean finishPngShare(){
            final File output;
            synchronized(shareLock){
                try {if(pendingShareStream==null||pendingShareFile==null)return false;pendingShareStream.flush();pendingShareStream.close();output=pendingShareFile;pendingShareStream=null;pendingShareFile=null;if(output.length()<8||output.length()>30000000)return false;}
                catch(Exception error){Log.e("180HittersShare","afronden mislukt",error);pendingShareStream=null;pendingShareFile=null;return false;}
            }
            try {
                Uri uri=FileProvider.getUriForFile(MainActivity.this,getPackageName()+".updates",output);
                Intent send=new Intent(Intent.ACTION_SEND).setType("image/png").putExtra(Intent.EXTRA_STREAM,uri)
                        .putExtra(Intent.EXTRA_SUBJECT,"Hitters Challenge-resultaat")
                        .putExtra(Intent.EXTRA_TEXT,"Mijn Hitters Challenge-resultaat - 180 Hitters")
                        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                send.setClipData(ClipData.newRawUri("Hitters Challenge",uri));
                Intent chooser=Intent.createChooser(send,"Hitters Challenge delen");chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);chooser.setClipData(send.getClipData());
                Log.i("180HittersShare","chooser openen, bytes="+output.length());runOnUiThread(()->{try{startActivity(chooser);}catch(Exception error){Log.e("180HittersShare","chooser mislukt",error);Toast.makeText(MainActivity.this,"Geen app gevonden om de afbeelding te delen.",Toast.LENGTH_LONG).show();}});return true;
            } catch(Exception error){Log.e("180HittersShare","provider mislukt",error);return false;}
        }
        @JavascriptInterface public void sharePng(String encoded,String filename){
            if(encoded==null||encoded.isEmpty()||encoded.length()>30000000)return;
            new Thread(()->{
                try {
                    byte[] image=Base64.decode(encoded,Base64.DEFAULT);
                    if(image.length<8||image[0]!=(byte)0x89||image[1]!=(byte)0x50||image[2]!=(byte)0x4e||image[3]!=(byte)0x47)throw new IllegalArgumentException("Geen PNG");
                    File directory=new File(getCacheDir(),"shared");if(!directory.exists()&&!directory.mkdirs())throw new java.io.IOException("Map ontbreekt");
                    File[] old=directory.listFiles();if(old!=null)for(File file:old)file.delete();
                    String safe=filename==null?"hitters-challenge.png":filename.replaceAll("[^A-Za-z0-9._-]","_");if(!safe.endsWith(".png"))safe+=".png";
                    File output=new File(directory,safe);try(FileOutputStream stream=new FileOutputStream(output)){stream.write(image);}
                    Uri uri=FileProvider.getUriForFile(MainActivity.this,getPackageName()+".updates",output);
                    Intent send=new Intent(Intent.ACTION_SEND).setType("image/png").putExtra(Intent.EXTRA_STREAM,uri)
                            .putExtra(Intent.EXTRA_TEXT,"Mijn Hitters Challenge-resultaat - 180 Hitters")
                            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    send.setClipData(ClipData.newRawUri("Hitters Challenge",uri));
                    runOnUiThread(()->{try{startActivity(Intent.createChooser(send,"Hitters Challenge delen"));}catch(Exception error){Toast.makeText(MainActivity.this,"Geen app gevonden om de afbeelding te delen.",Toast.LENGTH_LONG).show();}});
                } catch(Exception error){runOnUiThread(()->Toast.makeText(MainActivity.this,"Afbeelding delen is niet gelukt.",Toast.LENGTH_LONG).show());}
            },"hitters-share").start();
        }
        @JavascriptInterface public void saveSnapshot(String json){if(json!=null&&json.length()<10000000)preferences.edit().putString("last_snapshot",json).apply();}
        @JavascriptInterface public String getMobilePlayers(){return preferences.getString("mobile_players","[]");}
        @JavascriptInterface public boolean hasMobilePlayers(){return preferences.contains("mobile_players");}
        @JavascriptInterface public String getVenuePlayers(){return preferences.getString("venue_players","[]");}
        @JavascriptInterface public void saveVenuePlayers(String json){savePlayerArray("venue_players",json);}
        @JavascriptInterface public void saveMobilePlayers(String json){
            savePlayerArray("mobile_players",json);
        }
        private void savePlayerArray(String key,String json){
            try {
                JSONArray input=new JSONArray(json), clean=new JSONArray();
                if(input.length()>200)return;
                for(int i=0;i<input.length();i++){
                    String name=input.getString(i).trim(); if(name.isEmpty()||name.length()>24)return;
                    boolean exists=false; for(int j=0;j<clean.length();j++)if(clean.getString(j).equalsIgnoreCase(name)){exists=true;break;}
                    if(!exists)clean.put(name);
                }
                preferences.edit().putString(key,clean.toString()).apply();
            } catch(Exception ignored) {}
        }
    }
}
