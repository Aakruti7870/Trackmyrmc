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

/**
 * Capacitor plugin exposed to JavaScript as "LiveWidget".
 *
 * Manages four SharedPreferences namespaces:
 *   PREFS          — GPS tracking state (shared with TrackingLocationService)
 *   PREFS_CUSTOMER — customer order data for CustomerWidgetProvider
 *   PREFS_DRIVER   — driver assignment data for DriverWidgetProvider
 *   PREFS_STAFF    — plant ops data for StaffWidgetProvider
 *   PREFS_AUTH     — authentication token, role, suspended/loggedIn flags
 *
 * Auth token security note: stored in MODE_PRIVATE SharedPreferences (only
 * accessible to this app process). For enhanced security on production builds,
 * migrate PREFS_AUTH to androidx.security:security-crypto EncryptedSharedPreferences.
 */
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

    // Shared prefs namespaces — keep these in sync with every provider.
    static final String PREFS          = "trackmyrmc_live_widget";   // GPS tracking
    static final String PREFS_CUSTOMER = "trackmyrmc_widget_customer";
    static final String PREFS_DRIVER   = "trackmyrmc_widget_driver";
    static final String PREFS_STAFF    = "trackmyrmc_widget_staff";
    static final String PREFS_AUTH     = "trackmyrmc_widget_auth";

    // ── setWidgetData ─────────────────────────────────────────────────────────
    /**
     * Called by JS to push live data into the widget immediately (app in foreground).
     * Writes to the role-specific namespace so the right provider is updated.
     * The generic line1/line2/line3 fields are written to the matching role prefs
     * so providers reading those namespace keys see fresh data.
     */
    @PluginMethod
    public void setWidgetData(PluginCall call) {
        String role     = call.getString("role", "staff");
        String title    = call.getString("title",   "TrackMyRMC");
        String line1    = call.getString("line1",   "No active information");
        String line2    = call.getString("line2",   "Open app to refresh");
        String line3    = call.getString("line3",   "");
        String deepLink = call.getString("deepLink", "/");

        // Legacy generic prefs (keeps TrackMyRmcWidgetProvider in sync).
        SharedPreferences.Editor legacy = getContext()
                .getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit();
        legacy.putString("role", role).putString("title", title)
              .putString("line1", line1).putString("line2", line2)
              .putString("line3", line3).putString("deepLink", deepLink)
              .putLong("updatedAt", System.currentTimeMillis()).apply();

        // Role-specific prefs.
        String ns = nsForRole(role);
        SharedPreferences.Editor ed = getContext().getSharedPreferences(ns, Context.MODE_PRIVATE).edit();
        ed.putString("title",    title);
        ed.putString("line1",    line1);
        ed.putString("line2",    line2);
        ed.putString("line3",    line3);
        ed.putString("deepLink", deepLink);

        // Forward structured fields when caller sends them.
        putIfPresent(call, ed, "orderNo", "plantName", "grade", "quantity", "status",
                "loadingStatus", "dispatchStatus", "challanStatus", "vehicleNo",
                "deliveryProgress", "updatedAt",
                "challanNo", "customerName", "siteName", "tripStatus",
                "todayM3", "pendingOrders", "tmOnRoute", "activeDispatches", "plantStatus");
        ed.apply();

        refreshWidgets();
        call.resolve();
    }

    // ── setAuthToken ──────────────────────────────────────────────────────────
    /**
     * Call immediately after a successful login. Stores the bearer token and API
     * base URL so widget providers can fetch fresh data during background updates.
     * Sets loggedIn=true and clears any previous suspended flag.
     *
     * @param token   — JWT bearer token (short-lived; refresh on re-login)
     * @param apiBase — absolute API origin, e.g. "https://trackmyrmc.com"
     * @param role    — logged-in role (client/driver/admin/authority/plant_owner/supervisor)
     * @param userId  — user id (string) for audit purposes
     */
    @PluginMethod
    public void setAuthToken(PluginCall call) {
        String token   = call.getString("token",   "");
        String apiBase = call.getString("apiBase", "");
        String role    = call.getString("role",    "");
        String userId  = call.getString("userId",  "");

        getContext().getSharedPreferences(PREFS_AUTH, Context.MODE_PRIVATE).edit()
            .putString("token",     token)
            .putString("apiBase",   apiBase)
            .putString("role",      role)
            .putString("userId",    userId)
            .putBoolean("loggedIn",  true)
            .putBoolean("suspended", false)
            .apply();

        refreshWidgets();
        call.resolve();
    }

    // ── clearWidgetData ───────────────────────────────────────────────────────
    /**
     * Call on logout. Clears all four role namespaces and marks loggedIn=false.
     * All widget providers then render the "Login required" placeholder immediately.
     * The auth token is also erased so no background refresh can occur.
     */
    @PluginMethod
    public void clearWidgetData(PluginCall call) {
        // Wipe role data — never keep stale order/trip/plant data after logout.
        for (String ns : new String[]{ PREFS_CUSTOMER, PREFS_DRIVER, PREFS_STAFF }) {
            getContext().getSharedPreferences(ns, Context.MODE_PRIVATE).edit().clear().apply();
        }
        // Wipe auth (token + flags).
        getContext().getSharedPreferences(PREFS_AUTH, Context.MODE_PRIVATE).edit()
            .putBoolean("loggedIn",  false)
            .putBoolean("suspended", false)
            .putString("token",   "")
            .putString("apiBase", "")
            .putString("role",    "")
            .putString("userId",  "")
            .apply();

        refreshWidgets();
        call.resolve();
    }

    // ── setSuspendedState ─────────────────────────────────────────────────────
    /**
     * Call when the server returns a suspended-account error.
     * Stops serving live widget data immediately and shows the suspension banner.
     * Does NOT erase the token — re-authentication clears the flag.
     */
    @PluginMethod
    public void setSuspendedState(PluginCall call) {
        boolean suspended = Boolean.TRUE.equals(call.getBoolean("suspended", true));
        getContext().getSharedPreferences(PREFS_AUTH, Context.MODE_PRIVATE).edit()
            .putBoolean("suspended", suspended).apply();
        refreshWidgets();
        call.resolve();
    }

    // ── setWidgetMode ─────────────────────────────────────────────────────────
    /**
     * Stores the user's preferred widget mode: "compact" or "detailed".
     * Providers read this preference and can override the size-based layout choice
     * if the user has explicitly picked compact mode.
     */
    @PluginMethod
    public void setWidgetMode(PluginCall call) {
        String mode = call.getString("mode", "detailed");
        getContext().getSharedPreferences(PREFS_AUTH, Context.MODE_PRIVATE).edit()
            .putString("widgetMode", mode).apply();
        refreshWidgets();
        call.resolve();
    }

    // ── GPS tracking (unchanged from original) ────────────────────────────────
    @PluginMethod
    public void startTracking(PluginCall call) {
        String endpoint  = call.getString("endpoint",  "");
        String authToken = call.getString("authToken", "");
        String actorId   = call.getString("actorId",   "");
        String role      = call.getString("role",      "driver");
        long intervalMs  = Math.max(15000L, call.getLong("intervalMs", 30000L));

        Intent intent = new Intent(getContext(), TrackingLocationService.class);
        intent.setAction(TrackingLocationService.ACTION_START);
        intent.putExtra("endpoint",  endpoint);
        intent.putExtra("authToken", authToken);
        intent.putExtra("actorId",   actorId);
        intent.putExtra("role",      role);
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
        result.put("active",        prefs.getBoolean("trackingActive", false));
        result.put("latitude",      prefs.getString("latitude", ""));
        result.put("longitude",     prefs.getString("longitude", ""));
        result.put("accuracy",      prefs.getFloat("accuracy", 0f));
        result.put("lastLocationAt", prefs.getLong("lastLocationAt", 0L));
        call.resolve(result);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** Refresh all registered widget providers. */
    private void refreshWidgets() {
        AppWidgetManager manager = AppWidgetManager.getInstance(getContext());

        // Legacy single-role provider.
        int[] legacyIds = manager.getAppWidgetIds(
                new ComponentName(getContext(), TrackMyRmcWidgetProvider.class));
        if (legacyIds.length > 0)
            TrackMyRmcWidgetProvider.updateAll(getContext(), manager, legacyIds);

        // Role-specific providers.
        int[] customerIds = manager.getAppWidgetIds(
                new ComponentName(getContext(), CustomerWidgetProvider.class));
        if (customerIds.length > 0)
            CustomerWidgetProvider.updateAll(getContext(), manager, customerIds);

        int[] driverIds = manager.getAppWidgetIds(
                new ComponentName(getContext(), DriverWidgetProvider.class));
        if (driverIds.length > 0)
            DriverWidgetProvider.updateAll(getContext(), manager, driverIds);

        int[] staffIds = manager.getAppWidgetIds(
                new ComponentName(getContext(), StaffWidgetProvider.class));
        if (staffIds.length > 0)
            StaffWidgetProvider.updateAll(getContext(), manager, staffIds);
    }

    private static String nsForRole(String role) {
        if ("client".equals(role) || "customer".equals(role)) return PREFS_CUSTOMER;
        if ("driver".equals(role))                             return PREFS_DRIVER;
        return PREFS_STAFF;
    }

    /** Copy a string field from the JS call into the SharedPreferences editor if present. */
    private static void putIfPresent(PluginCall call, SharedPreferences.Editor ed,
                                     String... keys) {
        for (String key : keys) {
            String val = call.getString(key, null);
            if (val != null) ed.putString(key, val);
        }
    }
}
