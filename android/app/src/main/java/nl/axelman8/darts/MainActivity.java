package nl.axelman8.darts;

import android.app.Activity;
import android.app.AlertDialog;
import android.Manifest;
import android.bluetooth.BluetoothDevice;
import android.content.ActivityNotFoundException;
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
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.Toast;

import java.net.URI;
import java.util.List;
import org.json.JSONArray;

public final class MainActivity extends Activity {
    private WebView web;
    private LocalDartsServer localServer;
    private BluetoothClient bluetooth;
    private AppUpdater updater;
    private SharedPreferences preferences;
    private String mode;
    private boolean webPaused;

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        preferences = getSharedPreferences("axelman8", MODE_PRIVATE);
        bluetooth = new BluetoothClient();
        updater = new AppUpdater(this);
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
                if("darten".equalsIgnoreCase(device.getName())) {
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
        if (mode == null) showModeChooser(); else loadMode(mode);
        updater.check(false);
    }

    private boolean trusted(Uri target) {
        String host=target.getHost(); if (host==null) return false;
        if ("127.0.0.1".equals(host) || "localhost".equals(host)) return true;
        try { return host.equalsIgnoreCase(URI.create(preferences.getString("nuc_url","http://10.42.0.1:8765")).getHost()); }
        catch(Exception ignored){ return false; }
    }

    private void showModeChooser() {
        new AlertDialog.Builder(this).setTitle("Waar wil je spelen?")
                .setItems(new String[]{"Lokaal op deze telefoon", "NUC via Bluetooth", "NUC via wifi"}, (dialog, which)->{
                    if(which==0) chooseLocal(); else if(which==1) chooseBluetooth(); else askNucAddress();
                }).setNegativeButton("Annuleren", null).show();
    }

    private boolean hasBluetoothPermission() {
        return Build.VERSION.SDK_INT < 31 || checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED;
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
        if("nuc".equals(mode)&&!snapshot.isEmpty()) {
            new AlertDialog.Builder(this).setTitle("Laatste NUC-stand meenemen?")
                    .setMessage("Kies Overnemen om bij wifi-uitval lokaal verder te spelen vanaf de laatst bevestigde stand.")
                    .setPositiveButton("Overnemen",(d,w)->{try{localServer.importSnapshot(snapshot);}catch(Exception e){Toast.makeText(this,"Stand kon niet worden overgenomen.",Toast.LENGTH_LONG).show();}loadMode("local");})
                    .setNegativeButton("Lokale partij openen",(d,w)->loadMode("local")).show();
        } else loadMode("local");
    }

    private void askNucAddress() {
        EditText input=new EditText(this); input.setSingleLine(true); input.setText(preferences.getString("nuc_url","http://10.42.0.1:8765")); input.setSelectAllOnFocus(true);
        int pad=dp(22); FrameLayout box=new FrameLayout(this); box.setPadding(pad,0,pad,0); box.addView(input,new FrameLayout.LayoutParams(-1,-2));
        new AlertDialog.Builder(this).setTitle("Adres van de NUC").setMessage("Het standaardadres van de 180 Hitters wifi-hotspot is al ingevuld.")
                .setView(box).setPositiveButton("Verbinden",(d,w)->{
                    String value=input.getText().toString().trim(); if(!value.startsWith("http://")&&!value.startsWith("https://"))value="http://"+value;
                    while(value.endsWith("/"))value=value.substring(0,value.length()-1);
                    preferences.edit().putString("nuc_url",value).apply(); loadMode("nuc");
                }).setNegativeButton("Annuleren",null).show();
    }

    private void loadMode(String selected) {
        mode=selected; preferences.edit().putString("mode",selected).apply();
        if(localServer!=null)localServer.setBluetoothMode("bluetooth".equals(selected));
        if("local".equals(selected)) web.loadUrl("http://127.0.0.1:8765/?android=1");
        else if("bluetooth".equals(selected)) web.loadUrl("http://127.0.0.1:8765/?remote=1&android=1&transport=bluetooth");
        else web.loadUrl(preferences.getString("nuc_url","http://10.42.0.1:8765")+"/?remote=1&android=1&transport=wifi");
    }

    private int dp(int value){return Math.round(value*getResources().getDisplayMetrics().density);}
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

    private final class Bridge {
        @JavascriptInterface public void chooseMode(){runOnUiThread(MainActivity.this::showModeChooser);}
        @JavascriptInterface public boolean isLocalMode(){return "local".equals(mode);}
        @JavascriptInterface public String getConnectionMode(){return mode==null?"local":mode;}
        @JavascriptInterface public String getControlToken(){return "d7c87006c31f4da2a4348eeb05b59c8b";}
        @JavascriptInterface public void checkForUpdate(){runOnUiThread(()->updater.check(true));}
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
