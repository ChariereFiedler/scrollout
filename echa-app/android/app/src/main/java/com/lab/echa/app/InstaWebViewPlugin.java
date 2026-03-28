package com.lab.echa.app;

import android.app.Activity;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Log;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.JavascriptInterface;
import android.widget.FrameLayout;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.label.ImageLabel;
import com.google.mlkit.vision.label.ImageLabeler;
import com.google.mlkit.vision.label.ImageLabeling;
import com.google.mlkit.vision.label.defaults.ImageLabelerOptions;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileWriter;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import org.json.JSONArray;
import org.json.JSONObject;

@CapacitorPlugin(name = "InstaWebView")
public class InstaWebViewPlugin extends Plugin {

    private static final String TAG = "ECHA_INSTA";
    private static final String TAG_ML = "ECHA_ANALYZER";
    private WebView instaWebView;
    private String trackerScript = "";
    private final List<String> collectedData = new ArrayList<>();

    // ML Kit
    private ImageLabeler labeler;
    private TextRecognizer textRecognizer;
    private final Set<String> analyzedUrls = new HashSet<>();
    private final ExecutorService mlExecutor = Executors.newSingleThreadExecutor();

    @Override
    public void load() {
        // Load tracker.js from assets
        try {
            InputStream is = getContext().getAssets().open("public/tracker.js");
            BufferedReader reader = new BufferedReader(new InputStreamReader(is));
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line).append("\n");
            }
            trackerScript = sb.toString();
            reader.close();
            Log.i(TAG, "Tracker script loaded: " + trackerScript.length() + " chars");
        } catch (Exception e) {
            Log.e(TAG, "Failed to load tracker.js: " + e.getMessage());
        }

        // Init ML Kit
        ImageLabelerOptions options = new ImageLabelerOptions.Builder()
                .setConfidenceThreshold(0.5f)
                .build();
        labeler = ImageLabeling.getClient(options);
        textRecognizer = TextRecognition.getClient(new TextRecognizerOptions.Builder().build());
        Log.i(TAG_ML, "ML Kit initialized");
    }

    @PluginMethod()
    public void openInstagram(PluginCall call) {
        Activity activity = getActivity();
        activity.runOnUiThread(() -> {
            // Create WebView
            instaWebView = new WebView(activity);
            WebSettings settings = instaWebView.getSettings();
            settings.setJavaScriptEnabled(true);
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);
            settings.setUserAgentString(
                "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) " +
                "Chrome/120.0.0.0 Mobile Safari/537.36"
            );
            settings.setLoadWithOverviewMode(true);
            settings.setUseWideViewPort(true);
            settings.setMediaPlaybackRequiresUserGesture(false);
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

            // Enable cookies (needed for Instagram login)
            CookieManager cookieManager = CookieManager.getInstance();
            cookieManager.setAcceptCookie(true);
            cookieManager.setAcceptThirdPartyCookies(instaWebView, true);

            // JS bridge — receives data from injected tracker
            instaWebView.addJavascriptInterface(new EchaBridge(), "EchaBridge");

            // Script to remove "open app" banners and prompts
            final String killAppBanners =
                "(function() {" +
                "  function nuke() {" +
                "    document.querySelectorAll('[role=\"dialog\"], [class*=\"RnEpo\"], [class*=\"Bottom\"]').forEach(function(el) {" +
                "      var t = el.textContent || '';" +
                "      if (t.match(/open.*(app|instagram)|ouvrir|t.l.charger|get the app|not now|pas maintenant/i)) {" +
                "        el.style.display = 'none';" +
                "      }" +
                "    });" +
                "    document.querySelectorAll('div[style*=\"fixed\"], div[style*=\"sticky\"]').forEach(function(el) {" +
                "      var t = el.textContent || '';" +
                "      if (t.match(/open.*(app|instagram)|ouvrir|t.l.charger|get the app/i)) {" +
                "        el.style.display = 'none';" +
                "      }" +
                "    });" +
                "    document.querySelectorAll('button, a[role=\"button\"]').forEach(function(btn) {" +
                "      var t = (btn.textContent || '').trim().toLowerCase();" +
                "      if (t === 'not now' || t === 'pas maintenant' || t === 'plus tard') {" +
                "        btn.click();" +
                "      }" +
                "    });" +
                "  }" +
                "  nuke();" +
                "  new MutationObserver(nuke).observe(document.body, { childList: true, subtree: true });" +
                "  setInterval(nuke, 2000);" +
                "})();";

            // WebView client — inject script on page load
            instaWebView.setWebViewClient(new WebViewClient() {
                @Override
                public void onPageFinished(WebView view, String url) {
                    super.onPageFinished(view, url);
                    Log.i(TAG, "Page loaded: " + url);

                    if (url.contains("instagram.com")) {
                        view.evaluateJavascript(killAppBanners, null);
                        Log.i(TAG, "App banner killer injected");

                        if (!trackerScript.isEmpty()) {
                            view.postDelayed(() -> {
                                view.evaluateJavascript(trackerScript, null);
                                Log.i(TAG, "Tracker injected into: " + url);
                            }, 2000);
                        }
                    }

                    JSObject ret = new JSObject();
                    ret.put("url", url);
                    notifyListeners("pageLoaded", ret);
                }

                @Override
                public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                    String url = request.getUrl().toString();
                    if (url.startsWith("intent://") || url.startsWith("instagram://")) {
                        Log.i(TAG, "Blocked app redirect: " + url);
                        return true;
                    }
                    if (url.contains("instagram.com") || url.contains("facebook.com") ||
                        url.contains("accounts.google.com")) {
                        return false;
                    }
                    return true;
                }
            });

            instaWebView.setWebChromeClient(new WebChromeClient());

            FrameLayout rootView = activity.findViewById(android.R.id.content);
            FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            );
            rootView.addView(instaWebView, params);

            instaWebView.loadUrl("https://www.instagram.com/accounts/login/");
            Log.i(TAG, "Instagram WebView opened");

            JSObject ret = new JSObject();
            ret.put("status", "opened");
            call.resolve(ret);
        });
    }

    @PluginMethod()
    public void closeInstagram(PluginCall call) {
        Activity activity = getActivity();
        activity.runOnUiThread(() -> {
            if (instaWebView != null) {
                FrameLayout rootView = activity.findViewById(android.R.id.content);
                rootView.removeView(instaWebView);
                instaWebView.destroy();
                instaWebView = null;
            }
            JSObject ret = new JSObject();
            ret.put("status", "closed");
            call.resolve(ret);
        });
    }

    @PluginMethod()
    public void exportSession(PluginCall call) {
        if (instaWebView == null) {
            call.reject("No active Instagram session");
            return;
        }

        getActivity().runOnUiThread(() -> {
            instaWebView.evaluateJavascript(
                "(function() { return JSON.stringify(window.__echaExport ? window.__echaExport() : {}); })()",
                value -> {
                    String json = value;
                    if (json.startsWith("\"")) {
                        json = json.substring(1, json.length() - 1)
                            .replace("\\\"", "\"")
                            .replace("\\\\", "\\");
                    }

                    try {
                        File dir = new File(getContext().getExternalFilesDir(null), "echa");
                        dir.mkdirs();
                        File file = new File(dir, "session_" + System.currentTimeMillis() + ".json");
                        FileWriter writer = new FileWriter(file);
                        writer.write(json);
                        writer.close();

                        JSObject ret = new JSObject();
                        ret.put("path", file.getAbsolutePath());
                        ret.put("data", json);
                        call.resolve(ret);
                        Log.i(TAG, "Session exported to: " + file.getAbsolutePath());
                    } catch (Exception e) {
                        call.reject("Export failed: " + e.getMessage());
                    }
                }
            );
        });
    }

    @PluginMethod()
    public void getCollectedData(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("count", collectedData.size());
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < collectedData.size(); i++) {
            if (i > 0) sb.append(",");
            sb.append(collectedData.get(i));
        }
        sb.append("]");
        ret.put("data", sb.toString());
        call.resolve(ret);
    }

    public boolean handleBack() {
        if (instaWebView != null && instaWebView.canGoBack()) {
            instaWebView.goBack();
            return true;
        }
        return false;
    }

    // ─── ML Kit: download image and analyze ─────────────────

    private void analyzeImageFromUrl(String imageUrl, String postId, String username) {
        if (analyzedUrls.contains(imageUrl)) {
            Log.i(TAG_ML, "SKIP (dedup): " + imageUrl.substring(0, Math.min(80, imageUrl.length())));
            return;
        }
        analyzedUrls.add(imageUrl);

        mlExecutor.execute(() -> {
            try {
                // Download image
                HttpURLConnection conn = (HttpURLConnection) new URL(imageUrl).openConnection();
                conn.setRequestProperty("User-Agent", "Mozilla/5.0");
                conn.setConnectTimeout(5000);
                conn.setReadTimeout(10000);
                InputStream is = conn.getInputStream();
                Bitmap fullBitmap = BitmapFactory.decodeStream(is);
                is.close();
                conn.disconnect();

                if (fullBitmap == null) {
                    Log.w(TAG_ML, "Failed to decode: " + imageUrl.substring(0, Math.min(80, imageUrl.length())));
                    return;
                }

                // Crop: center square (removes Instagram UI chrome if any)
                int w = fullBitmap.getWidth();
                int h = fullBitmap.getHeight();
                Bitmap bitmap = fullBitmap;
                // Instagram images are usually square, but just in case
                if (w > 0 && h > 0 && Math.abs(w - h) > 50) {
                    int size = Math.min(w, h);
                    int x = (w - size) / 2;
                    int y = (h - size) / 2;
                    bitmap = Bitmap.createBitmap(fullBitmap, x, y, size, size);
                }

                InputImage inputImage = InputImage.fromBitmap(bitmap, 0);

                // Label
                Bitmap finalBitmap = bitmap;
                labeler.process(inputImage)
                    .addOnSuccessListener(labels -> {
                        StringBuilder labelStr = new StringBuilder();
                        JSONArray jsonLabels = new JSONArray();
                        for (ImageLabel label : labels) {
                            labelStr.append(label.getText())
                                    .append("(").append(Math.round(label.getConfidence() * 100)).append("%) ");
                            try {
                                JSONObject jl = new JSONObject();
                                jl.put("text", label.getText());
                                jl.put("confidence", Math.round(label.getConfidence() * 100));
                                jsonLabels.put(jl);
                            } catch (Exception ignored) {}
                        }

                        Log.i(TAG_ML, "POST @" + username + " [" + postId + "]: " + labelStr.toString().trim());

                        // OCR
                        textRecognizer.process(inputImage)
                            .addOnSuccessListener(text -> {
                                String ocrText = text.getText().replace("\n", " ").trim();
                                if (!ocrText.isEmpty()) {
                                    Log.i(TAG_ML, "OCR @" + username + ": " + ocrText.substring(0, Math.min(100, ocrText.length())));
                                }

                                // Send results back to tracker via JS
                                sendAnalysisToTracker(postId, jsonLabels.toString(), ocrText);

                                // Notify Capacitor listeners
                                JSObject result = new JSObject();
                                result.put("postId", postId);
                                result.put("username", username);
                                result.put("labels", jsonLabels.toString());
                                result.put("ocrText", ocrText);
                                notifyListeners("imageAnalysis", result);
                            })
                            .addOnFailureListener(e -> {
                                sendAnalysisToTracker(postId, jsonLabels.toString(), "");
                            });
                    })
                    .addOnFailureListener(e -> {
                        Log.e(TAG_ML, "Labeling failed for @" + username + ": " + e.getMessage());
                    });

            } catch (Exception e) {
                Log.e(TAG_ML, "Download failed: " + e.getMessage());
            }
        });
    }

    private void sendAnalysisToTracker(String postId, String labelsJson, String ocrText) {
        if (instaWebView == null) return;
        String escapedOcr = ocrText.replace("\\", "\\\\").replace("'", "\\'").replace("\n", " ");
        String js = "(function() {" +
                "  if (window.__echaSetAnalysis) {" +
                "    window.__echaSetAnalysis('" + postId + "', " + labelsJson + ", '" + escapedOcr + "');" +
                "  }" +
                "})();";
        getActivity().runOnUiThread(() -> instaWebView.evaluateJavascript(js, null));
    }

    // ─── JS Bridge ──────────────────────────────────────────

    private static final int BRIDGE_CHUNK_SIZE = 3900;
    private int bridgeMsgSeq = 0;

    private void logBridgeChunked(String json) {
        int total = (int) Math.ceil((double) json.length() / BRIDGE_CHUNK_SIZE);
        if (total <= 1) {
            Log.i(TAG, "BRIDGE_DATA|" + json);
        } else {
            int seq = bridgeMsgSeq++;
            for (int i = 0; i < total; i++) {
                int start = i * BRIDGE_CHUNK_SIZE;
                int end = Math.min(start + BRIDGE_CHUNK_SIZE, json.length());
                Log.i(TAG, "BRIDGE_CHUNK|" + seq + "|" + i + "|" + total + "|" + json.substring(start, end));
            }
            Log.i(TAG, "BRIDGE_END|" + seq);
        }
    }

    class EchaBridge {
        @JavascriptInterface
        public void onData(String jsonData) {
            logBridgeChunked(jsonData);
            collectedData.add(jsonData);

            // Forward to Capacitor listeners
            try {
                JSObject obj = new JSObject(jsonData);
                notifyListeners("trackerData", obj);

                // Trigger ML Kit analysis on new posts
                String type = obj.getString("type");
                if ("new_post".equals(type)) {
                    JSONObject post = new JSONObject(jsonData).getJSONObject("post");
                    JSONObject data = post.getJSONObject("data");
                    String postId = post.getString("postId");
                    String username = data.optString("username", "unknown");
                    JSONArray imageUrls = data.optJSONArray("imageUrls");

                    if (imageUrls != null && imageUrls.length() > 0) {
                        // Analyze only the first (main) image of the post
                        String firstUrl = imageUrls.getString(0);
                        analyzeImageFromUrl(firstUrl, postId, username);
                    }
                }
            } catch (Exception e) {
                Log.e(TAG, "Failed to parse bridge data: " + e.getMessage());
            }
        }
    }
}
