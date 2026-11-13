package nl.axelman8.darts;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONObject;
import org.json.JSONArray;

import java.io.OutputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.TimeUnit;

public final class ClubRequestWorker extends Worker {
    static final String CHANNEL = "club_requests";
    private static final String PERIODIC = "club-request-check";
    private static final String IMMEDIATE = "club-request-check-now";
    private static final String ENDPOINT = "https://180-hitters-online.180-hitters-online.workers.dev/club/admin/list";
    private static final String INVITATIONS_ENDPOINT = "https://180-hitters-online.180-hitters-online.workers.dev/club/invitations";

    public ClubRequestWorker(@NonNull Context context, @NonNull WorkerParameters params) { super(context, params); }

    static void createChannel(Context context) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationChannel channel = new NotificationChannel(CHANNEL, "Clubmeldingen", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("Nieuwe clubaanvragen en uitnodigingen om online te darten");
        context.getSystemService(NotificationManager.class).createNotificationChannel(channel);
    }

    static void schedule(Context context) {
        Constraints online = new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
        PeriodicWorkRequest periodic = new PeriodicWorkRequest.Builder(ClubRequestWorker.class, 15, TimeUnit.MINUTES).setConstraints(online).build();
        WorkManager manager = WorkManager.getInstance(context);
        manager.enqueueUniquePeriodicWork(PERIODIC, ExistingPeriodicWorkPolicy.UPDATE, periodic);
        manager.enqueueUniqueWork(IMMEDIATE, ExistingWorkPolicy.REPLACE, new OneTimeWorkRequest.Builder(ClubRequestWorker.class).setConstraints(online).build());
    }

    static void cancel(Context context) {
        WorkManager manager = WorkManager.getInstance(context);
        manager.cancelUniqueWork(IMMEDIATE); manager.cancelUniqueWork(PERIODIC);
    }

    static boolean allowed(Context context) {
        if (Build.VERSION.SDK_INT >= 33 && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return false;
        return NotificationManagerCompat.from(context).areNotificationsEnabled();
    }

    static void show(Context context, int pending) {
        if (pending <= 0 || !allowed(context)) return;
        Intent launch = new Intent(context, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent open = PendingIntent.getActivity(context, 180, launch, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        String text = pending == 1 ? "Er wacht 1 nieuwe speler op jouw goedkeuring." : "Er wachten " + pending + " spelers op jouw goedkeuring.";
        NotificationCompat.Builder notification = new NotificationCompat.Builder(context, CHANNEL)
                .setSmallIcon(R.drawable.ic_launcher).setContentTitle("Nieuwe clubaanvraag")
                .setContentText(text).setStyle(new NotificationCompat.BigTextStyle().bigText(text))
                .setPriority(NotificationCompat.PRIORITY_HIGH).setAutoCancel(true).setContentIntent(open)
                .setNumber(pending).setOnlyAlertOnce(false);
        NotificationManagerCompat.from(context).notify(180, notification.build());
    }

    static void showInvitation(Context context, String id, String fromName, String code) {
        if (id == null || id.isEmpty() || !allowed(context)) return;
        Intent launch = new Intent(context, MainActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP)
                .putExtra("open_club_invitations", true);
        int requestCode = 1000 + Math.abs(id.hashCode() % 100000);
        PendingIntent open = PendingIntent.getActivity(context, requestCode, launch,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        String sender = fromName == null || fromName.trim().isEmpty() ? "Een clubspeler" : fromName.trim();
        String text = sender + " nodigt je uit voor dartbaan " + code + ". Tik om de uitnodiging te openen.";
        NotificationCompat.Builder notification = new NotificationCompat.Builder(context, CHANNEL)
                .setSmallIcon(R.drawable.ic_launcher).setContentTitle("Nieuwe dartuitnodiging")
                .setContentText(text).setStyle(new NotificationCompat.BigTextStyle().bigText(text))
                .setPriority(NotificationCompat.PRIORITY_HIGH).setAutoCancel(true).setContentIntent(open)
                .setOnlyAlertOnce(true);
        NotificationManagerCompat.from(context).notify(requestCode, notification.build());
    }

    private static JSONObject post(String endpoint, String key, String token) throws Exception {
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection)new URL(endpoint).openConnection();
            connection.setRequestMethod("POST"); connection.setConnectTimeout(10000); connection.setReadTimeout(10000);
            connection.setRequestProperty("Content-Type", "application/json"); connection.setDoOutput(true);
            byte[] body = new JSONObject().put(key, token).toString().getBytes(StandardCharsets.UTF_8);
            try(OutputStream output = connection.getOutputStream()){ output.write(body); }
            int status = connection.getResponseCode();
            if (status == 403) return new JSONObject().put("forbidden", true);
            if (status != 200) throw new java.io.IOException("HTTP " + status);
            ByteArrayOutputStream received = new ByteArrayOutputStream();
            try(InputStream input = connection.getInputStream()){ byte[] buffer = new byte[4096]; int count; while((count=input.read(buffer))!=-1)received.write(buffer,0,count); }
            return new JSONObject(new String(received.toByteArray(), StandardCharsets.UTF_8));
        } finally { if (connection != null) connection.disconnect(); }
    }

    @NonNull @Override public Result doWork() {
        SharedPreferences preferences = getApplicationContext().getSharedPreferences("axelman8", Context.MODE_PRIVATE);
        String adminToken = preferences.getString("club_admin_token", "");
        String accessToken = preferences.getString("club_access_token", "");
        if (adminToken.isEmpty() && accessToken.isEmpty()) return Result.success();
        try {
            if (!adminToken.isEmpty()) {
                JSONObject data = post(ENDPOINT, "adminToken", adminToken);
                if (data.optBoolean("forbidden")) preferences.edit().remove("club_admin_token").apply();
                else {
                    int pending = data.optInt("pending", 0), previous = preferences.getInt("club_pending_notified", 0);
                    if (pending == 0 || allowed(getApplicationContext())) preferences.edit().putInt("club_pending_notified", pending).apply();
                    if (pending > 0 && pending != previous) show(getApplicationContext(), pending);
                }
            }
            if (!accessToken.isEmpty()) {
                JSONObject data = post(INVITATIONS_ENDPOINT, "accessToken", accessToken);
                if (data.optBoolean("forbidden")) preferences.edit().remove("club_access_token").apply();
                else {
                    JSONArray invitations = data.optJSONArray("invitations");
                    if (invitations != null) for (int index=0; index<invitations.length(); index++) {
                        JSONObject invite = invitations.optJSONObject(index); if (invite == null) continue;
                        String id=invite.optString("id"), notifiedKey="club_invite_notified_"+id;
                        if (!id.isEmpty() && !preferences.getBoolean(notifiedKey, false) && allowed(getApplicationContext())) {
                            showInvitation(getApplicationContext(), id, invite.optString("fromName"), invite.optString("code"));
                            preferences.edit().putBoolean(notifiedKey, true).apply();
                        }
                    }
                }
            }
            return Result.success();
        } catch (Exception error) { return Result.retry(); }
    }
}
