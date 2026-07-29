package com.trackmyrmc.concreteking;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.app.PendingIntent;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Home-screen widget for the Driver role.
 * Shows ONLY the authenticated driver's own assigned work — challan, customer,
 * site, grade, quantity, vehicle, trip status — and quick-action deep links
 * (Start Trip, Navigate, Delivered) in the expanded size.
 *
 * Security: reads ONLY from PREFS_DRIVER. The API endpoint /api/widget/driver
 * is guarded by requireRole('driver') and returns only the requesting driver's
 * own data. A driver can never see another driver's orders, challans, customers,
 * vehicles, payment data, or GPS data through this widget.
 *
 * On 401/403 the loggedIn flag is cleared and the widget shows "Login required".
 * On account suspension the widget shows "Account suspended" with no order data.
 * On logout, LiveWidgetPlugin.clearWidgetData() wipes all role prefs.
 */
public class DriverWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        final PendingResult pr = goAsync();
        new Thread(() -> {
            try { refreshFromApi(context); }
            finally {
                updateAll(context, manager, appWidgetIds);
                pr.finish();
            }
        }).start();
    }

    @Override
    public void onAppWidgetOptionsChanged(Context ctx, AppWidgetManager mgr,
                                          int id, Bundle opts) {
        updateAll(ctx, mgr, new int[]{ id });
    }

    static void updateAll(Context context, AppWidgetManager manager, int[] ids) {
        SharedPreferences prefs = context.getSharedPreferences(
                LiveWidgetPlugin.PREFS_DRIVER, Context.MODE_PRIVATE);
        SharedPreferences auth = context.getSharedPreferences(
                LiveWidgetPlugin.PREFS_AUTH, Context.MODE_PRIVATE);

        boolean loggedIn  = auth.getBoolean("loggedIn",  false);
        boolean suspended = auth.getBoolean("suspended", false);
        boolean roleOk    = "driver".equals(auth.getString("role", ""));

        for (int id : ids) {
            int minWidth = manager.getAppWidgetOptions(id)
                    .getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 250);
            int layoutId = minWidth < 190 ? R.layout.widget_compact
                         : minWidth >= 360 ? R.layout.widget_driver_expanded
                         : R.layout.widget_driver_medium;

            RemoteViews views = new RemoteViews(context.getPackageName(), layoutId);
            bindTap(context, views, R.id.widget_root, "/my-trips", 3000 + id);

            if (suspended) {
                fillSuspended(views, layoutId);
            } else if (!loggedIn || !roleOk) {
                fillLoggedOut(views, layoutId);
            } else {
                fillDriver(context, views, layoutId, prefs, id);
            }
            manager.updateAppWidget(id, views);
        }
    }

    private static void bindTap(Context ctx, RemoteViews v, int viewId,
                                 String deepLink, int reqCode) {
        Intent i = new Intent(ctx, MainActivity.class);
        i.setAction(Intent.ACTION_VIEW);
        i.setData(Uri.parse("trackmyrmc://app" + deepLink));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        v.setOnClickPendingIntent(viewId, PendingIntent.getActivity(ctx, reqCode, i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
    }

    private static void fillDriver(Context ctx, RemoteViews v, int layout,
                                    SharedPreferences p, int widgetId) {
        String orderNo     = p.getString("orderNo",     "No assignment");
        String challanNo   = p.getString("challanNo",   "—");
        String customer    = p.getString("customerName","—");
        String site        = p.getString("siteName",    "—");
        String grade       = p.getString("grade",       "—");
        String quantity    = p.getString("quantity",    "—");
        String vehicleNo   = p.getString("vehicleNo",   "—");
        String tripStatus  = p.getString("tripStatus",  "ASSIGNED");
        String updated     = p.getString("updatedAt",   "");

        v.setTextViewText(R.id.widget_role,  "DRIVER");
        v.setTextViewText(R.id.widget_title, orderNo);

        if (layout == R.layout.widget_compact) {
            v.setTextViewText(R.id.widget_status, tripStatus);

        } else if (layout == R.layout.widget_driver_expanded) {
            v.setTextViewText(R.id.widget_challan,    "Challan: " + challanNo);
            v.setTextViewText(R.id.widget_customer,   customer);
            v.setTextViewText(R.id.widget_site,       site);
            v.setTextViewText(R.id.widget_grade_qty,  grade + " · " + quantity);
            v.setTextViewText(R.id.widget_vehicle,    "Vehicle: " + vehicleNo);
            v.setTextViewText(R.id.widget_trip_status, "Trip: " + tripStatus);
            v.setTextViewText(R.id.widget_updated,
                    updated.isEmpty() ? "" : "Updated " + updated);

            // Action buttons — deep links into the app for authentication revalidation.
            bindTap(ctx, v, R.id.btn_start_trip, "/my-trips?action=start",     3100 + widgetId);
            bindTap(ctx, v, R.id.btn_navigate,   "/my-trips?action=navigate",  3200 + widgetId);
            bindTap(ctx, v, R.id.btn_delivered,  "/my-trips?action=delivered", 3300 + widgetId);

        } else { // medium
            v.setTextViewText(R.id.widget_line_1, customer + " · " + grade + " · " + quantity);
            v.setTextViewText(R.id.widget_line_2, "Vehicle: " + vehicleNo + " · " + tripStatus);
            v.setTextViewText(R.id.widget_line_3, site);
        }
    }

    private static void fillLoggedOut(RemoteViews v, int layout) {
        v.setTextViewText(R.id.widget_role,  "DRIVER");
        v.setTextViewText(R.id.widget_title, "Login required");
        if (layout == R.layout.widget_compact) {
            v.setTextViewText(R.id.widget_status, "Tap to sign in");
        } else {
            v.setTextViewText(R.id.widget_line_1, "Open TrackMyRMC and sign in");
            v.setTextViewText(R.id.widget_line_2, "to see your assignment");
            v.setTextViewText(R.id.widget_line_3, "");
        }
    }

    private static void fillSuspended(RemoteViews v, int layout) {
        v.setTextViewText(R.id.widget_role,  "ACCOUNT SUSPENDED");
        v.setTextViewText(R.id.widget_title, "Account suspended");
        if (layout == R.layout.widget_compact) {
            v.setTextViewText(R.id.widget_status, "Tap for details");
        } else {
            v.setTextViewText(R.id.widget_line_1, "Your account has been suspended.");
            v.setTextViewText(R.id.widget_line_2, "Contact your plant manager.");
            v.setTextViewText(R.id.widget_line_3, "");
        }
    }

    // ── Background API fetch ──────────────────────────────────────────────

    private void refreshFromApi(Context context) {
        SharedPreferences auth = context.getSharedPreferences(
                LiveWidgetPlugin.PREFS_AUTH, Context.MODE_PRIVATE);
        if (!auth.getBoolean("loggedIn", false)) return;
        String token   = auth.getString("token",   "");
        String apiBase = auth.getString("apiBase", "");
        if (token.isEmpty() || apiBase.isEmpty()) return;

        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URL(apiBase + "/api/widget/driver").openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(10_000);
            conn.setReadTimeout(10_000);
            conn.setRequestProperty("Authorization", "Bearer " + token);
            conn.setRequestProperty("Accept", "application/json");

            int code = conn.getResponseCode();
            if (code == 401 || code == 403) {
                auth.edit().putBoolean("loggedIn", false).apply();
                return;
            }
            if (code != 200) return;

            StringBuilder sb = new StringBuilder();
            try (BufferedReader br = new BufferedReader(
                    new InputStreamReader(conn.getInputStream()))) {
                String line;
                while ((line = br.readLine()) != null) sb.append(line);
            }
            applyJson(context, sb.toString());
        } catch (Exception ignored) {
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private void applyJson(Context context, String json) {
        SharedPreferences.Editor ed = context.getSharedPreferences(
                LiveWidgetPlugin.PREFS_DRIVER, Context.MODE_PRIVATE).edit();
        ed.putString("orderNo",      CustomerWidgetProvider.js(json, "orderNo",      "No assignment"));
        ed.putString("challanNo",    CustomerWidgetProvider.js(json, "challanNo",    "—"));
        ed.putString("customerName", CustomerWidgetProvider.js(json, "customerName", "—"));
        ed.putString("siteName",     CustomerWidgetProvider.js(json, "siteName",     "—"));
        ed.putString("grade",        CustomerWidgetProvider.js(json, "grade",        "—"));
        ed.putString("quantity",     CustomerWidgetProvider.js(json, "quantity",     "—"));
        ed.putString("vehicleNo",    CustomerWidgetProvider.js(json, "vehicleNo",    "—"));
        ed.putString("tripStatus",   CustomerWidgetProvider.js(json, "tripStatus",   "ASSIGNED"));
        ed.putString("updatedAt",    CustomerWidgetProvider.js(json, "updatedAt",    ""));
        ed.apply();
    }
}
