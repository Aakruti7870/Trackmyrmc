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
 * Home-screen widget for the Customer role.
 * Shows the authenticated customer's active order (order no, plant, grade,
 * quantity, status, loading/dispatch/challan state, vehicle, delivery progress).
 *
 * Security: reads ONLY from PREFS_CUSTOMER (customer-scoped prefs namespace).
 * Never reads driver or staff prefs. Auth token is stored in PREFS_AUTH and
 * revalidated on every background HTTP fetch; a 401/403 from the API clears
 * the loggedIn flag and shows "Login required".
 *
 * On logout the JS layer calls LiveWidgetPlugin.clearWidgetData() which clears
 * all role prefs and sets loggedIn=false — the next render then shows the
 * "Login required" placeholder automatically.
 */
public class CustomerWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        // goAsync() lets us make a network call without ANR; must call finish().
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
        // Re-render the resized widget (compact ↔ medium ↔ expanded).
        updateAll(ctx, mgr, new int[]{ id });
    }

    /** Called by LiveWidgetPlugin when JS pushes fresh data (app in foreground). */
    static void updateAll(Context context, AppWidgetManager manager, int[] ids) {
        SharedPreferences prefs = context.getSharedPreferences(
                LiveWidgetPlugin.PREFS_CUSTOMER, Context.MODE_PRIVATE);
        SharedPreferences auth = context.getSharedPreferences(
                LiveWidgetPlugin.PREFS_AUTH, Context.MODE_PRIVATE);

        boolean loggedIn  = auth.getBoolean("loggedIn",  false);
        boolean suspended = auth.getBoolean("suspended", false);
        String  role      = auth.getString("role", "");
        boolean roleOk    = "client".equals(role) || "customer".equals(role);

        for (int id : ids) {
            int minWidth = manager.getAppWidgetOptions(id)
                    .getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 250);
            int layoutId = pickLayout(minWidth,
                    R.layout.widget_customer_medium,
                    R.layout.widget_customer_expanded);

            RemoteViews views = new RemoteViews(context.getPackageName(), layoutId);
            bindTap(context, views, R.id.widget_root, "/my-orders", 2000 + id);

            if (suspended) {
                fillSuspended(views, layoutId);
            } else if (!loggedIn || !roleOk) {
                fillLoggedOut(views, layoutId);
            } else {
                fillCustomer(views, layoutId, prefs);
            }
            manager.updateAppWidget(id, views);
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private static int pickLayout(int minWidth, int medium, int expanded) {
        if (minWidth < 190) return R.layout.widget_compact;
        if (minWidth >= 360) return expanded;
        return medium;
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

    private static void fillCustomer(RemoteViews v, int layout, SharedPreferences p) {
        String orderNo   = p.getString("orderNo",          "No active order");
        String plantName = p.getString("plantName",        "—");
        String grade     = p.getString("grade",            "—");
        String quantity  = p.getString("quantity",         "—");
        String status    = p.getString("status",           "—");
        String vehicleNo = p.getString("vehicleNo",        "");
        String progress  = p.getString("deliveryProgress", "");
        String updated   = p.getString("updatedAt",        "");

        v.setTextViewText(R.id.widget_role, "CUSTOMER ORDER");
        v.setTextViewText(R.id.widget_title, orderNo);

        if (layout == R.layout.widget_compact) {
            v.setTextViewText(R.id.widget_status, status);

        } else if (layout == R.layout.widget_customer_expanded) {
            v.setTextViewText(R.id.widget_plant,    plantName);
            v.setTextViewText(R.id.widget_grade_qty, grade + " · " + quantity);
            v.setTextViewText(R.id.widget_status,   "Status: " + status);
            v.setTextViewText(R.id.widget_loading,  "Loading: "  + p.getString("loadingStatus",  "Pending"));
            v.setTextViewText(R.id.widget_dispatch, "Dispatch: " + p.getString("dispatchStatus", "Pending"));
            v.setTextViewText(R.id.widget_challan,  "Challan: "  + p.getString("challanStatus",  "Pending"));
            v.setTextViewText(R.id.widget_vehicle,
                    vehicleNo.isEmpty() ? "Vehicle: Assigning…" : "Vehicle: " + vehicleNo);
            v.setTextViewText(R.id.widget_progress, progress);
            v.setTextViewText(R.id.widget_updated,
                    updated.isEmpty() ? "" : "Updated " + updated);

        } else { // medium
            v.setTextViewText(R.id.widget_line_1, plantName + " · " + grade + " · " + quantity);
            v.setTextViewText(R.id.widget_line_2, "Status: " + status);
            v.setTextViewText(R.id.widget_line_3,
                    vehicleNo.isEmpty() ? "" : "Vehicle: " + vehicleNo);
        }
    }

    private static void fillLoggedOut(RemoteViews v, int layout) {
        v.setTextViewText(R.id.widget_role,  "CUSTOMER ORDER");
        v.setTextViewText(R.id.widget_title, "Login required");
        if (layout == R.layout.widget_compact) {
            v.setTextViewText(R.id.widget_status, "Tap to sign in");
        } else {
            v.setTextViewText(R.id.widget_line_1, "Open TrackMyRMC and sign in");
            v.setTextViewText(R.id.widget_line_2, "to see your order status");
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
            v.setTextViewText(R.id.widget_line_2, "Contact support for assistance.");
            v.setTextViewText(R.id.widget_line_3, "");
        }
    }

    // ── Background API fetch (runs in goAsync thread) ─────────────────────

    private void refreshFromApi(Context context) {
        SharedPreferences auth = context.getSharedPreferences(
                LiveWidgetPlugin.PREFS_AUTH, Context.MODE_PRIVATE);
        if (!auth.getBoolean("loggedIn", false)) return;
        String token   = auth.getString("token",   "");
        String apiBase = auth.getString("apiBase", "");
        if (token.isEmpty() || apiBase.isEmpty()) return;

        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URL(apiBase + "/api/widget/customer").openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(10_000);
            conn.setReadTimeout(10_000);
            conn.setRequestProperty("Authorization", "Bearer " + token);
            conn.setRequestProperty("Accept", "application/json");

            int code = conn.getResponseCode();
            if (code == 401 || code == 403) {
                // Token expired or wrong role — mark logged out so widget shows placeholder.
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
            // Network error — keep showing stale data; retry on next update cycle.
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private void applyJson(Context context, String json) {
        SharedPreferences.Editor ed = context.getSharedPreferences(
                LiveWidgetPlugin.PREFS_CUSTOMER, Context.MODE_PRIVATE).edit();
        ed.putString("orderNo",          js(json, "orderNo",          "No active order"));
        ed.putString("plantName",        js(json, "plantName",        "—"));
        ed.putString("grade",            js(json, "grade",            "—"));
        ed.putString("quantity",         js(json, "quantity",         "—"));
        ed.putString("status",           js(json, "status",           "—"));
        ed.putString("loadingStatus",    js(json, "loadingStatus",    "Pending"));
        ed.putString("dispatchStatus",   js(json, "dispatchStatus",   "Pending"));
        ed.putString("challanStatus",    js(json, "challanStatus",    "Pending"));
        ed.putString("vehicleNo",        js(json, "vehicleNo",        ""));
        ed.putString("deliveryProgress", js(json, "deliveryProgress", ""));
        ed.putString("updatedAt",        js(json, "updatedAt",        ""));
        ed.apply();
    }

    /** Minimal flat-JSON string extractor — avoids pulling in Gson as a dep. */
    static String js(String json, String key, String fallback) {
        String needle = "\"" + key + "\":\"";
        int s = json.indexOf(needle);
        if (s < 0) return fallback;
        s += needle.length();
        int e = json.indexOf('"', s);
        if (e < 0) return fallback;
        return json.substring(s, e).replace("\\\"", "\"").replace("\\\\", "\\");
    }
}
