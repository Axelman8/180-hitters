package nl.axelman8.darts;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Locale;

final class AppUpdater {
    private static final String LATEST = "https://api.github.com/repos/axelman8/180-hitters/releases/latest";
    private final Activity activity;
    private File pending;
    private static final java.util.concurrent.atomic.AtomicBoolean downloading = new java.util.concurrent.atomic.AtomicBoolean();

    AppUpdater(Activity activity) { this.activity = activity; if(!downloading.get())cleanupDownloads(); }

    private void cleanupDownloads() {
        File[] files=activity.getCacheDir().listFiles();
        if(files==null)return;
        java.util.Arrays.sort(files,(a,b)->Long.compare(b.lastModified(),a.lastModified()));
        boolean retained=pending!=null&&pending.isFile();
        for(File file:files){
            String name=file.getName();
            if(!name.matches("180-Hitters-[0-9]+\\.[0-9]+\\.[0-9]+\\.apk"))continue;
            try{if(!file.getCanonicalFile().getParentFile().equals(activity.getCacheDir().getCanonicalFile()))continue;}catch(Exception e){continue;}
            if(file.equals(pending))continue;
            String version=name.substring(12,name.length()-4);
            if(compare(version,BuildConfig.VERSION_NAME)<=0||retained||file.length()>100L*1024*1024||System.currentTimeMillis()-file.lastModified()>7L*24*60*60*1000){file.delete();}
            else retained=true;
        }
    }

    void check(boolean userInitiated) {
        if (!userInitiated) {
            long last = activity.getPreferences(Activity.MODE_PRIVATE).getLong("last_update_check", 0);
            if (System.currentTimeMillis() - last < 24L * 60 * 60 * 1000) return;
            activity.getPreferences(Activity.MODE_PRIVATE).edit().putLong("last_update_check", System.currentTimeMillis()).apply();
        }
        if (userInitiated) Toast.makeText(activity, "GitHub op updates controleren…", Toast.LENGTH_SHORT).show();
        new Thread(() -> {
            try {
                JSONObject release = readJson(LATEST);
                String version = release.getString("tag_name").replaceFirst("^[vV]", "");
                if (compare(version, BuildConfig.VERSION_NAME) <= 0) {
                    if (userInitiated) activity.runOnUiThread(() -> Toast.makeText(activity,
                            "Je gebruikt al de nieuwste versie (" + BuildConfig.VERSION_NAME + ").", Toast.LENGTH_LONG).show());
                    return;
                }
                JSONArray assets = release.getJSONArray("assets");
                String apk = null, checksum = null;
                for (int i = 0; i < assets.length(); i++) {
                    JSONObject asset = assets.getJSONObject(i);
                    if ("180-Hitters.apk".equals(asset.getString("name"))) apk = asset.getString("browser_download_url");
                    if ("180-Hitters.apk.sha256".equals(asset.getString("name"))) checksum = asset.getString("browser_download_url");
                }
                if (apk == null || checksum == null) throw new IllegalStateException("Release is niet compleet");
                String finalApk = apk, finalChecksum = checksum;
                activity.runOnUiThread(() -> new AlertDialog.Builder(activity)
                        .setTitle("180 Hitters " + version + " beschikbaar")
                        .setMessage("Wil je de nieuwe, ondertekende versie via GitHub downloaden en installeren?")
                        .setPositiveButton("Downloaden", (d,w) -> download(version, finalApk, finalChecksum))
                        .setNegativeButton("Later", null).show());
            } catch (Exception error) {
                if (userInitiated) activity.runOnUiThread(() -> Toast.makeText(activity,
                        "Updatecontrole mislukt. Controleer je internetverbinding.", Toast.LENGTH_LONG).show());
            }
        }, "github-update-check").start();
    }

    private void download(String version, String apkUrl, String checksumUrl) {
        if(!version.matches("[0-9]+\\.[0-9]+\\.[0-9]+")||!downloading.compareAndSet(false,true))return;
        cleanupDownloads();
        Toast.makeText(activity, "Update downloaden…", Toast.LENGTH_LONG).show();
        new Thread(() -> {
            File target = new File(activity.getCacheDir(), "180-Hitters-" + version + ".apk");
            try {
                String expected = readText(checksumUrl).trim().split("\\s+")[0].toLowerCase(Locale.ROOT);
                downloadTo(apkUrl, target);
                if (!expected.equals(sha256(target))) throw new SecurityException("Controlesom klopt niet");
                pending = target;
                cleanupDownloads();
                activity.runOnUiThread(this::installPending);
            } catch (Exception error) {
                target.delete();
                activity.runOnUiThread(() -> Toast.makeText(activity,
                        "Update kon niet worden gedownload. Controleer internet en vrije opslag (minimaal 50 MB extra).", Toast.LENGTH_LONG).show());
            } finally { downloading.set(false); }
        }, "github-update-download").start();
    }

    void resumePendingInstall() { if (pending != null && pending.isFile()) installPending(); }

    private void installPending() {
        if (Build.VERSION.SDK_INT >= 26 && !activity.getPackageManager().canRequestPackageInstalls()) {
            Toast.makeText(activity, "Sta installatie door 180 Hitters eenmalig toe en keer terug.", Toast.LENGTH_LONG).show();
            activity.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + activity.getPackageName())));
            return;
        }
        Uri uri = FileProvider.getUriForFile(activity, activity.getPackageName() + ".updates", pending);
        Intent intent = new Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive")
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        activity.startActivity(intent);
    }

    private static HttpURLConnection connection(String value) throws Exception {
        HttpURLConnection result = (HttpURLConnection) new URL(value).openConnection();
        result.setConnectTimeout(10000); result.setReadTimeout(20000);
        result.setRequestProperty("Accept", "application/vnd.github+json");
        result.setRequestProperty("X-GitHub-Api-Version", "2022-11-28");
        result.setRequestProperty("User-Agent", "180-Hitters-Android");
        return result;
    }
    private static JSONObject readJson(String value) throws Exception { return new JSONObject(readText(value)); }
    private static String readText(String value) throws Exception {
        HttpURLConnection connection = connection(value);
        try (InputStream input = connection.getInputStream()) {
            return new String(readAll(input), java.nio.charset.StandardCharsets.UTF_8);
        } finally { connection.disconnect(); }
    }
    private static void downloadTo(String value, File target) throws Exception {
        HttpURLConnection connection = connection(value);
        try (InputStream input = connection.getInputStream(); FileOutputStream output = new FileOutputStream(target)) {
            byte[] buffer = new byte[32768]; int count;
            long total=0;
            while ((count = input.read(buffer)) != -1) {
                total+=count;
                if(total>100L*1024*1024||target.getParentFile().getUsableSpace()<50L*1024*1024+count)throw new java.io.IOException("Te weinig opslag of update te groot");
                output.write(buffer, 0, count);
            }
            output.getFD().sync();
        } finally { connection.disconnect(); }
    }
    private static String sha256(File file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream input = new FileInputStream(file)) {
            byte[] buffer = new byte[32768]; int count;
            while ((count = input.read(buffer)) != -1) digest.update(buffer, 0, count);
        }
        StringBuilder result = new StringBuilder();
        for (byte value : digest.digest()) result.append(String.format(Locale.ROOT, "%02x", value));
        return result.toString();
    }
    private static byte[] readAll(InputStream input) throws Exception {
        java.io.ByteArrayOutputStream output = new java.io.ByteArrayOutputStream();
        byte[] buffer = new byte[8192]; int count;
        while ((count = input.read(buffer)) != -1) {
            if(output.size()+count>2*1024*1024)throw new java.io.IOException("Update-informatie te groot");
            output.write(buffer, 0, count);
        }
        return output.toByteArray();
    }
    private static int compare(String left, String right) {
        String[] a = left.split("\\."), b = right.split("\\.");
        for (int i=0; i<Math.max(a.length,b.length); i++) {
            int x=i<a.length?number(a[i]):0, y=i<b.length?number(b[i]):0;
            if(x!=y)return Integer.compare(x,y);
        }
        return 0;
    }
    private static int number(String value) { try { return Integer.parseInt(value.replaceAll("[^0-9].*$", "")); } catch(Exception e) { return 0; } }
}
