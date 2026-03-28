package com.lab.echa.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(InstaWebViewPlugin.class);
        registerPlugin(ImageAnalyzerPlugin.class);
        super.onCreate(savedInstanceState);
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
