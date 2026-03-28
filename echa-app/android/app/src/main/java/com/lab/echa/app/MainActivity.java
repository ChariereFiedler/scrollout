package com.lab.echa.app;

import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(InstaWebViewPlugin.class);
        registerPlugin(ImageAnalyzerPlugin.class);
        super.onCreate(savedInstanceState);

        // Force opaque dark status bar — no transparency, no edge-to-edge
        Window window = getWindow();
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.setStatusBarColor(Color.parseColor("#0a0a0a"));
        window.setNavigationBarColor(Color.parseColor("#141414"));
        // Light status bar icons = false → white icons on dark background
        View decorView = window.getDecorView();
        decorView.setSystemUiVisibility(
            decorView.getSystemUiVisibility() & ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
        );
    }

    @Override
    public void onBackPressed() {
        // Let the plugin handle back navigation in Instagram WebView
        InstaWebViewPlugin plugin = (InstaWebViewPlugin) bridge.getPlugin("InstaWebView").getInstance();
        if (plugin != null && plugin.handleBack()) {
            return;
        }
        super.onBackPressed();
    }
}
