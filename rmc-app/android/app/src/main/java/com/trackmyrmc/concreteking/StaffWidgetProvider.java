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
 * Home-screen widget for Owner / Admin / Supervisor / Authority roles.
 * Shows a live plant-operations summary: production (m³), pending orders,
 * transit mixers on route, active dispatches, and plant status.
 *
 * Security: only shows plant data for plants the authenticated user is
 * authorised to access (enforced by requireRole + plantScope on the API).
 * Reads ONLY from PREFS_STAFF — never reads customer or driver prefs.
 *
 * On logout, clearWidgetData() clears all prefs. On suspension, the widget
 * immediately stops rendering live data and shows the suspension message.
 */
public class StaffWidgetProvider extends AppWidgetProvider {

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
                LiveWidgetPlugin.PREFS_STAFF, Context.MODE_PRIVATE);
        SharedPreferences auth = context.getSharedPreferences(
                LiveWidgetPlugin.PREFS_AUTH, Context.MODE_PRIVATE);

        boolean loggedIn  = auth.getBoolean("loggedIn",  false);
        boolean suspended = auth.getBoolean("suspended", false);
        String  role      = auth.getString("role", "");
        boolean roleOk    = "admin".equals(role) || "authority".equals(role)
                         || "plant_owner".equals(role) || "supervisor".equals(role)
                         || "dispatcher".equals(role);

        for (int id : ids) {
            int minWidth = manager.getAppWidgetOptions(id)
                    .getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 250);
            int layoutId = minWidth < 190 ? R.layout.widget_compact
                         : minWidth >= 360 ? R.layout.widget_staff_expanded
                         : R.layout.widget_staff_medium;

            RemoteViews views = new RemoteViews(context.getPackageName(), layoutId);
            bindTap(context, views, R.id.widget_root, "/", 4000 + id);

            if (suspended) {
                fillSuspended(views, layoutId);
            } else if (!loggedIn || !roleOk) {
                fillLoggedOut(views, layoutId);
            } else {
                fillStaff(views, layoutId, prefs);
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

    private static void fillStaff(RemoteViews v, int layout, SharedPreferences p) {
        String plantName    = p.getString("plantName",    "Plant");
        String todayM3      = p.getString("todayM3",      "0");
        String pending      = p.getString("pendingOrders","0");
        String tmRoute      = p.getString("tmOnRoute",    "0");
        String dispatches   = p.getString("activeDispatches", "0");
        String plantStatus  = p.getString("plantStatus",  "ACTIVE");
        String updated      = p.getString("updatedAt",    "");

        v.setTextViewText(R.id.widget_role,  "PLANT OPERATIONS");
        v.setTextViewText(R.id.widget_title, plantName);

        if (layout == R.layout.widget_compact) {
            v.setTextViewText(R.id.widget_status, todayM3 + " m³ today");

        } else if (layout == R.layout.widget_staff_expanded) {
            v.setTextViewText(R.id.widget_production, "Today: " + todayM3 + " m³");
            v.setTextViewText(R.id.widget_pending,    "Pending orders: " + pending);
            v.setTextViewText(R.id.widget_tm_route,   "TM on route: " + tmRoute);
            v.setTextViewText(R.id.widget_dispatches, "Active dispatches: " + dispatches);
            v.setTextViewText(R.id.widget_plant_status, "Plant: " + plantStatus);
            v.setTextViewText(R.id.widget_updated,
                    updated.isEmpty() ? "" : "Updated " + updated);

        } else { // medium
            v.setTextViewText(R.id.widget_line_1, "Today: " + todayM3 + " m³ production");
            v.setTextViewText(R.id.widget_line_2, tmRoute + " TM on route · " + pending + " pending");
            v.setTextViewText(R.id.widget_line_3, "Plant: " + plantStatus);
        }
    }

    private static void fillLoggedOut(RemoteViews v, int layout) {
        v.setTextViewText(R.id.widget_role,  "PLANT OPERATIONS");
        v.setTextViewText(R.id.widget_title, "Login required");
        if (layout == R.layout.widget_compact) {
            v.setTextViewText(R.id.widget_status, "Tap to sign in");
        } else {
            v.setTextViewText(R.id.widget_line_1, "Open TrackMyRMC and sign in");
            v.setTextViewText(R.id.widget_line_2, "to see plant operations");
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
            v.setTextViewText(R.id.widget_line_2, "Contact the platform administrator.");
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
            conn = (HttpURLConnection) new URL(apiBase + "/api/widget/plant").openConnection();
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
                LiveWidgetPlugin.PREFS_STAFF, Context.MODE_PRIVATE).edit();
        ed.putString("plantName",       CustomerWidgetProvider.js(json, "plantName",       "Plant"));
        ed.putString("todayM3",         CustomerWidgetProvider.js(json, "todayM3",         "0"));
        ed.putString("pendingOrders",   CustomerWidgetProvider.js(json, "pendingOrders",   "0"));
        ed.putString("tmOnRoute",       CustomerWidgetProvider.js(json, "tmOnRoute",       "0"));
        ed.putString("activeDispatches",CustomerWidgetProvider.js(json, "activeDispatches","0"));
        ed.putString("plantStatus",     CustomerWidgetProvider.js(json, "plantStatus",     "ACTIVE"));
        ed.putString("updatedAt",       CustomerWidgetProvider.js(json, "updatedAt",       ""));
        ed.apply();
    }
}
