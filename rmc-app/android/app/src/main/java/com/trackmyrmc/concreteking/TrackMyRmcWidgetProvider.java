package com.trackmyrmc.concreteking;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.widget.RemoteViews;

public class TrackMyRmcWidgetProvider extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        updateAll(context, manager, appWidgetIds);
    }

    static void updateAll(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        SharedPreferences prefs = context.getSharedPreferences(LiveWidgetPlugin.PREFS, Context.MODE_PRIVATE);
        String role = prefs.getString("role", "staff");
        String title = prefs.getString("title", roleTitle(role));
        String line1 = prefs.getString("line1", "Open TrackMyRMC to load live data");
        String line2 = prefs.getString("line2", "");
        String line3 = prefs.getString("line3", "");
        String deepLink = prefs.getString("deepLink", "/");

        Intent launch = new Intent(context, MainActivity.class);
        launch.setAction(Intent.ACTION_VIEW);
        launch.setData(Uri.parse("trackmyrmc://app" + deepLink));
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            context,
            1001,
            launch,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        for (int id : appWidgetIds) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.trackmyrmc_widget);
            views.setTextViewText(R.id.widget_title, title);
            views.setTextViewText(R.id.widget_role, roleLabel(role));
            views.setTextViewText(R.id.widget_line_1, line1);
            views.setTextViewText(R.id.widget_line_2, line2);
            views.setTextViewText(R.id.widget_line_3, line3);
            views.setOnClickPendingIntent(R.id.widget_root, pendingIntent);
            manager.updateAppWidget(id, views);
        }
    }

    private static String roleTitle(String role) {
        if ("driver".equals(role)) return "Active Delivery";
        if ("customer".equals(role) || "client".equals(role)) return "Your Concrete Order";
        return "Plant Live Summary";
    }

    private static String roleLabel(String role) {
        if ("driver".equals(role)) return "DRIVER • GPS ON";
        if ("customer".equals(role) || "client".equals(role)) return "CUSTOMER ORDER";
        return "PLANT OPERATIONS";
    }
}
