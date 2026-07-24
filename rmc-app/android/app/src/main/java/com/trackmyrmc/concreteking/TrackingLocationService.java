package com.trackmyrmc.concreteking;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import androidx.annotation.Nullable;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class TrackingLocationService extends Service implements LocationListener {
    static final String ACTION_START = "com.trackmyrmc.START_TRACKING";
    static final String ACTION_STOP = "com.trackmyrmc.STOP_TRACKING";
    private static final String CHANNEL_ID = "trackmyrmc_live_gps";
    private static final int NOTIFICATION_ID = 1787;

    private final ExecutorService networkExecutor = Executors.newSingleThreadExecutor();
    private LocationManager locationManager;
    private String endpoint = "";
    private String authToken = "";
    private String actorId = "";
    private String role = "driver";
    private long intervalMs = 30000L;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stopTracking();
            return START_NOT_STICKY;
        }

        if (intent != null) {
            endpoint = intent.getStringExtra("endpoint") == null ? "" : intent.getStringExtra("endpoint");
            authToken = intent.getStringExtra("authToken") == null ? "" : intent.getStringExtra("authToken");
            actorId = intent.getStringExtra("actorId") == null ? "" : intent.getStringExtra("actorId");
            role = intent.getStringExtra("role") == null ? "driver" : intent.getStringExtra("role");
            intervalMs = Math.max(15000L, intent.getLongExtra("intervalMs", 30000L));
        }

        startForeground(NOTIFICATION_ID, buildNotification("GPS tracking active"));
        SharedPreferences prefs = getSharedPreferences(LiveWidgetPlugin.PREFS, MODE_PRIVATE);
        prefs.edit().putBoolean("trackingActive", true).apply();
        requestLocationUpdates();
        return START_STICKY;
    }

    private void requestLocationUpdates() {
        if (ActivityCompat.checkSelfPermission(this, android.Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED &&
            ActivityCompat.checkSelfPermission(this, android.Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            stopTracking();
            return;
        }
        locationManager.removeUpdates(this);
        locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, intervalMs, 10f, this);
        locationManager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, intervalMs, 20f, this);
    }

    @Override
    public void onLocationChanged(Location location) {
        SharedPreferences prefs = getSharedPreferences(LiveWidgetPlugin.PREFS, MODE_PRIVATE);
        prefs.edit()
            .putString("latitude", String.valueOf(location.getLatitude()))
            .putString("longitude", String.valueOf(location.getLongitude()))
            .putFloat("accuracy", location.getAccuracy())
            .putLong("lastLocationAt", System.currentTimeMillis())
            .apply();

        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        manager.notify(NOTIFICATION_ID, buildNotification("Location updated • accuracy " + Math.round(location.getAccuracy()) + " m"));
        if (!endpoint.isEmpty()) upload(location);
    }

    private void upload(Location location) {
        networkExecutor.execute(() -> {
            HttpURLConnection connection = null;
            try {
                connection = (HttpURLConnection) new URL(endpoint).openConnection();
                connection.setRequestMethod("POST");
                connection.setConnectTimeout(10000);
                connection.setReadTimeout(10000);
                connection.setRequestProperty("Content-Type", "application/json");
                if (!authToken.isEmpty()) connection.setRequestProperty("Authorization", "Bearer " + authToken);
                connection.setDoOutput(true);
                String json = "{\"actorId\":\"" + escape(actorId) + "\",\"role\":\"" + escape(role) +
                    "\",\"latitude\":" + location.getLatitude() + ",\"longitude\":" + location.getLongitude() +
                    ",\"accuracy\":" + location.getAccuracy() + ",\"speed\":" + location.getSpeed() +
                    ",\"heading\":" + location.getBearing() + ",\"recordedAt\":" + System.currentTimeMillis() + "}";
                try (OutputStream output = connection.getOutputStream()) {
                    output.write(json.getBytes(StandardCharsets.UTF_8));
                }
                connection.getResponseCode();
            } catch (Exception ignored) {
                // The next location update retries automatically; never stop GPS because of a temporary network failure.
            } finally {
                if (connection != null) connection.disconnect();
            }
        });
    }

    private String escape(String value) {
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private android.app.Notification buildNotification(String text) {
        Intent openApp = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 1787, openApp,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("TrackMyRMC live GPS")
            .setContentText(text)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setContentIntent(pendingIntent)
            .build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Live GPS tracking", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Keeps driver and checked-in user location active while the screen is locked.");
            ((NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE)).createNotificationChannel(channel);
        }
    }

    private void stopTracking() {
        if (locationManager != null) locationManager.removeUpdates(this);
        getSharedPreferences(LiveWidgetPlugin.PREFS, MODE_PRIVATE).edit().putBoolean("trackingActive", false).apply();
        stopForeground(STOP_FOREGROUND_REMOVE);
        stopSelf();
    }

    @Override public void onProviderEnabled(String provider) {}
    @Override public void onProviderDisabled(String provider) {}
    @Override public void onStatusChanged(String provider, int status, Bundle extras) {}
    @Nullable @Override public IBinder onBind(Intent intent) { return null; }
    @Override public void onDestroy() { if (locationManager != null) locationManager.removeUpdates(this); networkExecutor.shutdownNow(); super.onDestroy(); }
}
