package com.trackmyrmc.concreteking;

import android.Manifest;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

@CapacitorPlugin(
    name = "LiveWidget",
    permissions = {
        @Permission(alias = "location", strings = {
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION
        }),
        @Permission(alias = "backgroundLocation", strings = {
            Manifest.permission.ACCESS_BACKGROUND_LOCATION
        }),
        @Permission(alias = "notifications", strings = {
            Manifest.permission.POST_NOTIFICATIONS
        })
    }
)
public class LiveWidgetPlugin extends Plugin {
    static final String PREFS = "trackmyrmc_live_widget";

    @PluginMethod
    public void setWidgetData(PluginCall call) {
        SharedPreferences.Editor editor = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit();
        editor.putString("role", call.getString("role", "staff"));
        editor.putString("title", call.getString("title", "TrackMyRMC"));
        editor.putString("line1", call.getString("line1", "No active information"));
        editor.putString("line2", call.getString("line2", "Open app to refresh"));
        editor.putString("line3", call.getString("line3", ""));
        editor.putString("deepLink", call.getString("deepLink", "/"));
        editor.putLong("updatedAt", System.currentTimeMillis());
        editor.apply();
        refreshWidgets();
        call.resolve();
    }

    @PluginMethod
    public void startTracking(PluginCall call) {
        String endpoint = call.getString("endpoint", "");
        String authToken = call.getString("authToken", "");
        String actorId = call.getString("actorId", "");
        String role = call.getString("role", "driver");
        long intervalMs = Math.max(15000L, call.getLong("intervalMs", 30000L));

        Intent intent = new Intent(getContext(), TrackingLocationService.class);
        intent.setAction(TrackingLocationService.ACTION_START);
        intent.putExtra("endpoint", endpoint);
        intent.putExtra("authToken", authToken);
        intent.putExtra("actorId", actorId);
        intent.putExtra("role", role);
        intent.putExtra("intervalMs", intervalMs);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(intent);
        } else {
            getContext().startService(intent);
        }
        call.resolve();
    }

    @PluginMethod
    public void stopTracking(PluginCall call) {
        Intent intent = new Intent(getContext(), TrackingLocationService.class);
        intent.setAction(TrackingLocationService.ACTION_STOP);
        getContext().startService(intent);
        call.resolve();
    }

    @PluginMethod
    public void getTrackingState(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        JSObject result = new JSObject();
        result.put("active", prefs.getBoolean("trackingActive", false));
        result.put("latitude", prefs.getString("latitude", ""));
        result.put("longitude", prefs.getString("longitude", ""));
        result.put("accuracy", prefs.getFloat("accuracy", 0f));
        result.put("lastLocationAt", prefs.getLong("lastLocationAt", 0L));
        call.resolve(result);
    }

    private void refreshWidgets() {
        AppWidgetManager manager = AppWidgetManager.getInstance(getContext());
        int[] ids = manager.getAppWidgetIds(new ComponentName(getContext(), TrackMyRmcWidgetProvider.class));
        TrackMyRmcWidgetProvider.updateAll(getContext(), manager, ids);
    }
}
