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

    public ClubRequestWorker(@NonNull Context context, @NonNull WorkerParameters params) { super(context, params); }

    static void createChannel(Context context) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationChannel channel = new NotificationChannel(CHANNEL, "Clubaanvragen", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("Nieuwe aanvragen om online te mogen darten");
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

    @NonNull @Override public Result doWork() {
        SharedPreferences preferences = getApplicationContext().getSharedPreferences("axelman8", Context.MODE_PRIVATE);
        String token = preferences.getString("club_admin_token", "");
        if (token.isEmpty()) return Result.success();
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection)new URL(ENDPOINT).openConnection();
            connection.setRequestMethod("POST"); connection.setConnectTimeout(10000); connection.setReadTimeout(10000);
            connection.setRequestProperty("Content-Type", "application/json"); connection.setDoOutput(true);
            byte[] body = new JSONObject().put("adminToken", token).toString().getBytes(StandardCharsets.UTF_8);
            try(OutputStream output = connection.getOutputStream()){ output.write(body); }
            if (connection.getResponseCode() == 403) { preferences.edit().remove("club_admin_token").apply(); cancel(getApplicationContext()); return Result.success(); }
            if (connection.getResponseCode() != 200) return Result.retry();
            ByteArrayOutputStream received = new ByteArrayOutputStream();
            try(InputStream input = connection.getInputStream()){ byte[] buffer = new byte[4096]; int count; while((count=input.read(buffer))!=-1)received.write(buffer,0,count); }
            String json = new String(received.toByteArray(), StandardCharsets.UTF_8);
            int pending = new JSONObject(json).optInt("pending", 0), previous = preferences.getInt("club_pending_notified", 0);
            if (pending == 0 || allowed(getApplicationContext())) preferences.edit().putInt("club_pending_notified", pending).apply();
            if (pending > 0 && pending != previous) show(getApplicationContext(), pending);
            return Result.success();
        } catch (Exception error) { return Result.retry(); }
        finally { if (connection != null) connection.disconnect(); }
    }
}
