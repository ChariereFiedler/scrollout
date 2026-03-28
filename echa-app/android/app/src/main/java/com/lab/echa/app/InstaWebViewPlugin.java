package com.lab.echa.app;

import android.app.Activity;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;

import android.util.Log;
import android.view.View;
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
import java.net.URLEncoder;
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
    private String enrichmentScript = "";
    private final List<String> collectedData = new ArrayList<>();
    private boolean instagramVisible = false;

    // ML Kit
    private ImageLabeler labeler;
    private TextRecognizer textRecognizer;
    private final Set<String> analyzedUrls = new HashSet<>();
    private final ExecutorService mlExecutor = Executors.newSingleThreadExecutor();

    // Database
    private EchaDatabase db;
    private String currentSessionId = null;

    // Tab bar height in dp
    private static final int TAB_BAR_HEIGHT_DP = 52;

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

        // Load enrichment.js from assets
        try {
            InputStream is2 = getContext().getAssets().open("public/enrichment.js");
            BufferedReader reader2 = new BufferedReader(new InputStreamReader(is2));
            StringBuilder sb2 = new StringBuilder();
            String line2;
            while ((line2 = reader2.readLine()) != null) {
                sb2.append(line2).append("\n");
            }
            enrichmentScript = sb2.toString();
            reader2.close();
            Log.i(TAG, "Enrichment script loaded: " + enrichmentScript.length() + " chars");
        } catch (Exception e) {
            Log.e(TAG, "Failed to load enrichment.js: " + e.getMessage());
        }

        // Init Database
        db = EchaDatabase.getInstance(getContext());
        Log.i(TAG, "Database initialized");

        // Init ML Kit
        ImageLabelerOptions options = new ImageLabelerOptions.Builder()
                .setConfidenceThreshold(0.5f)
                .build();
        labeler = ImageLabeling.getClient(options);
        textRecognizer = TextRecognition.getClient(new TextRecognizerOptions.Builder().build());
        Log.i(TAG_ML, "ML Kit initialized");
    }

    private int dpToPx(int dp) {
        float density = getContext().getResources().getDisplayMetrics().density;
        return Math.round(dp * density);
    }

    private int getStatusBarHeight() {
        int resourceId = getContext().getResources().getIdentifier("status_bar_height", "dimen", "android");
        if (resourceId > 0) {
            return getContext().getResources().getDimensionPixelSize(resourceId);
        }
        return dpToPx(24); // fallback
    }

    private int getNavigationBarHeight() {
        int resourceId = getContext().getResources().getIdentifier("navigation_bar_height", "dimen", "android");
        if (resourceId > 0) {
            return getContext().getResources().getDimensionPixelSize(resourceId);
        }
        return 0;
    }

    @PluginMethod()
    public void openInstagram(PluginCall call) {
        Activity activity = getActivity();
        activity.runOnUiThread(() -> {
            if (instaWebView != null) {
                // Already opened — just show it
                showInstaWebView();
                JSObject ret = new JSObject();
                ret.put("status", "shown");
                call.resolve(ret);
                return;
            }

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
                                // Inject enrichment engine first, then tracker
                                if (!enrichmentScript.isEmpty()) {
                                    view.evaluateJavascript(enrichmentScript, null);
                                    Log.i(TAG, "Enrichment engine injected");
                                }
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

            // Add WebView with top margin for status bar + bottom margin for tab bar
            FrameLayout rootView = activity.findViewById(android.R.id.content);
            FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            );
            params.topMargin = getStatusBarHeight();
            // Reserve space for Scrollout tab bar + system navigation bar
            params.bottomMargin = dpToPx(TAB_BAR_HEIGHT_DP) + getNavigationBarHeight();
            rootView.addView(instaWebView, params);

            instagramVisible = true;
            instaWebView.loadUrl("https://www.instagram.com/accounts/login/");
            Log.i(TAG, "Instagram WebView opened with bottom margin: " + params.bottomMargin + "px (tab=" + dpToPx(TAB_BAR_HEIGHT_DP) + " + nav=" + getNavigationBarHeight() + ")");

            JSObject ret = new JSObject();
            ret.put("status", "opened");
            call.resolve(ret);
        });
    }

    @PluginMethod()
    public void showInstagram(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            showInstaWebView();
            JSObject ret = new JSObject();
            ret.put("status", instaWebView != null ? "shown" : "not_opened");
            call.resolve(ret);
        });
    }

    @PluginMethod()
    public void hideInstagram(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            hideInstaWebView();
            JSObject ret = new JSObject();
            ret.put("status", "hidden");
            call.resolve(ret);
        });
    }

    @PluginMethod()
    public void isInstagramOpen(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("open", instaWebView != null);
        ret.put("visible", instagramVisible);
        call.resolve(ret);
    }

    private void showInstaWebView() {
        if (instaWebView != null) {
            instaWebView.setVisibility(View.VISIBLE);
            instagramVisible = true;
            runTrackerHook("__echaResumeTracking", "native_show");
        }
    }

    private void hideInstaWebView() {
        if (instaWebView != null) {
            runTrackerHook("__echaPauseTracking", "native_hide");
            instaWebView.setVisibility(View.GONE);
            instagramVisible = false;
        }
    }

    private void runTrackerHook(String hookName, String reason) {
        if (instaWebView == null) return;
        String js = "(function() {" +
                "  try {" +
                "    if (window." + hookName + ") window." + hookName + "('" + reason + "');" +
                "  } catch (e) {}" +
                "})();";
        instaWebView.evaluateJavascript(js, null);
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
                instagramVisible = false;
            }
            JSObject ret = new JSObject();
            ret.put("status", "closed");
            call.resolve(ret);
        });
    }

    @PluginMethod()
    public void openInstagramProfile(PluginCall call) {
        String username = call.getString("username", "").trim();
        if (username.isEmpty()) {
            call.reject("username is required");
            return;
        }
        if (instaWebView == null) {
            call.reject("Instagram WebView is not open");
            return;
        }

        getActivity().runOnUiThread(() -> {
            showInstaWebView();
            instaWebView.loadUrl("https://www.instagram.com/" + username + "/");
            JSObject ret = new JSObject();
            ret.put("status", "opened_profile");
            ret.put("username", username);
            call.resolve(ret);
        });
    }

    @PluginMethod()
    public void openInstagramSearch(PluginCall call) {
        String query = call.getString("query", "").trim();
        if (query.isEmpty()) {
            call.reject("query is required");
            return;
        }
        if (instaWebView == null) {
            call.reject("Instagram WebView is not open");
            return;
        }

        getActivity().runOnUiThread(() -> {
            try {
                String encoded = URLEncoder.encode(query, "UTF-8");
                showInstaWebView();
                instaWebView.loadUrl("https://www.instagram.com/explore/search/keyword/?q=" + encoded);
                JSObject ret = new JSObject();
                ret.put("status", "opened_search");
                ret.put("query", query);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("search failed: " + e.getMessage());
            }
        });
    }

    @Override
    protected void handleOnDestroy() {
        Activity activity = getActivity();
        if (activity != null) {
            activity.runOnUiThread(() -> {
                hideInstaWebView();
                if (instaWebView != null) {
                    FrameLayout rootView = activity.findViewById(android.R.id.content);
                    rootView.removeView(instaWebView);
                    instaWebView.destroy();
                    instaWebView = null;
                }
            });
        }
        super.handleOnDestroy();
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
        if (instaWebView != null && instagramVisible && instaWebView.canGoBack()) {
            instaWebView.goBack();
            return true;
        }
        return false;
    }

    // ─── DB Query Methods (Capacitor @PluginMethod) ─────────

    @PluginMethod()
    public void querySessions(PluginCall call) {
        db.runAsync(() -> {
            try {
                JSONArray sessions = db.getSessions();
                JSObject ret = new JSObject();
                ret.put("sessions", sessions.toString());
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("querySessions error: " + e.getMessage());
            }
        });
    }

    @PluginMethod()
    public void queryPosts(PluginCall call) {
        String sessionId = call.getString("sessionId", "");
        int offset = call.getInt("offset", 0);
        int limit = call.getInt("limit", 50);

        db.runAsync(() -> {
            try {
                JSONArray posts = (sessionId == null || sessionId.isEmpty())
                        ? db.getAllPosts(offset, limit)
                        : db.getPostsBySession(sessionId, offset, limit);
                JSObject ret = new JSObject();
                ret.put("posts", posts.toString());
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("queryPosts error: " + e.getMessage());
            }
        });
    }

    @PluginMethod()
    public void queryStats(PluginCall call) {
        db.runAsync(() -> {
            try {
                JSONObject stats = db.getStats();
                JSObject ret = new JSObject();
                // Copy all fields from stats to ret
                java.util.Iterator<String> keys = stats.keys();
                while (keys.hasNext()) {
                    String key = keys.next();
                    ret.put(key, stats.get(key));
                }
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("queryStats error: " + e.getMessage());
            }
        });
    }

    @PluginMethod()
    public void queryCognitiveThemes(PluginCall call) {
        String sessionId = call.getString("sessionId", "");
        db.runAsync(() -> {
            try {
                JSONObject cognitiveThemes = db.getCognitiveThemesBySession(sessionId);
                JSObject ret = new JSObject();
                ret.put("themes", cognitiveThemes.getJSONArray("themes").toString());
                ret.put("totalPosts", cognitiveThemes.getInt("totalPosts"));
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("queryCognitiveThemes error: " + e.getMessage());
            }
        });
    }

    @PluginMethod()
    public void queryExportSession(PluginCall call) {
        String sessionId = call.getString("sessionId", "");
        db.runAsync(() -> {
            try {
                JSONObject export_ = db.exportSessionAsJson(sessionId);
                JSObject ret = new JSObject();
                ret.put("data", export_.toString());
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("queryExportSession error: " + e.getMessage());
            }
        });
    }

    // ─── Enrichment Daemon Methods (Capacitor @PluginMethod) ──

    @PluginMethod()
    public void queryUnenrichedPosts(PluginCall call) {
        int limit = call.getInt("limit", 20);
        db.runAsync(() -> {
            try {
                JSONArray posts = db.getUnenrichedPosts(limit);
                JSObject ret = new JSObject();
                ret.put("posts", posts.toString());
                ret.put("count", posts.length());
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("queryUnenrichedPosts error: " + e.getMessage());
            }
        });
    }

    @PluginMethod()
    public void countUnenrichedPosts(PluginCall call) {
        db.runAsync(() -> {
            try {
                int count = db.countUnenrichedPosts();
                JSObject ret = new JSObject();
                ret.put("count", count);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("countUnenrichedPosts error: " + e.getMessage());
            }
        });
    }

    @PluginMethod()
    public void saveEnrichmentFromApp(PluginCall call) {
        String dbPostId = call.getString("dbPostId", "");
        String enrichmentJson = call.getString("enrichment", "{}");

        if (dbPostId.isEmpty()) {
            call.reject("dbPostId is required");
            return;
        }

        db.runAsync(() -> {
            try {
                JSONObject enrichment = new JSONObject(enrichmentJson);
                db.upsertEnrichment(dbPostId, enrichment);
                JSObject ret = new JSObject();
                ret.put("success", true);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("saveEnrichmentFromApp error: " + e.getMessage());
            }
        });
    }

    @PluginMethod()
    public void purgeEmptyEnrichments(PluginCall call) {
        db.runAsync(() -> {
            try {
                int deleted = db.purgeEmptyEnrichments();
                JSObject ret = new JSObject();
                ret.put("deleted", deleted);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("purgeEmptyEnrichments error: " + e.getMessage());
            }
        });
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

                                // Persist ML Kit results to DB
                                db.runAsync(() -> db.updatePostML(postId, jsonLabels.toString(), ocrText));

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
            // Logcat fallback (transitoire)
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
                        String firstUrl = imageUrls.getString(0);
                        analyzeImageFromUrl(firstUrl, postId, username);
                    }
                }
            } catch (Exception e) {
                Log.e(TAG, "Failed to parse bridge data: " + e.getMessage());
            }
        }

        // ── DB-first methods ────────────────────────────────────

        @JavascriptInterface
        public String startSession() {
            currentSessionId = db.insertSession("webview");
            Log.i(TAG, "Session started: " + currentSessionId);
            return currentSessionId;
        }

        @JavascriptInterface
        public void endSession(int totalPosts, int totalEvents) {
            if (currentSessionId == null) return;
            double durationSec = (System.currentTimeMillis() - Long.parseLong(currentSessionId)) / 1000.0;
            db.runAsync(() -> {
                db.updateSession(currentSessionId, durationSec, totalPosts, totalEvents);
                Log.i(TAG, "Session ended: " + currentSessionId + " (" + totalPosts + " posts, " + Math.round(durationSec) + "s)");
            });
        }

        @JavascriptInterface
        public void savePost(String postJson) {
            if (currentSessionId == null) {
                currentSessionId = db.insertSession("webview");
            }
            db.runAsync(() -> {
                try {
                    JSONObject post = new JSONObject(postJson);
                    db.insertPost(currentSessionId, post);

                    // Trigger ML Kit analysis (OCR + labels) on image
                    String imageUrlsStr = post.optString("imageUrls", "[]");
                    String postId = post.optString("postId", "");
                    String username = post.optString("username", "");
                    try {
                        JSONArray imageUrls = new JSONArray(imageUrlsStr);
                        if (imageUrls.length() > 0) {
                            String firstUrl = imageUrls.getString(0);
                            analyzeImageFromUrl(firstUrl, postId, username);
                        }
                    } catch (Exception ignored) {}
                } catch (Exception e) {
                    Log.e(TAG, "savePost error: " + e.getMessage());
                }
            });
        }

        @JavascriptInterface
        public void updateDwell(String postId, String username, int dwellTimeMs) {
            if (currentSessionId == null) return;
            db.runAsync(() -> db.updateDwell(currentSessionId, postId, username, dwellTimeMs));
        }

        @JavascriptInterface
        public void saveEnrichment(String postId, String enrichmentJson) {
            db.runAsync(() -> {
                try {
                    JSONObject enrichment = new JSONObject(enrichmentJson);
                    db.insertEnrichment(postId, enrichment);
                } catch (Exception e) {
                    Log.e(TAG, "saveEnrichment error: " + e.getMessage());
                }
            });
        }

        @JavascriptInterface
        public void saveMLKit(String postId, String labelsJson, String ocrText) {
            db.runAsync(() -> db.updatePostML(postId, labelsJson, ocrText));
        }

        @JavascriptInterface
        public String getSessions() {
            try {
                return db.getSessions().toString();
            } catch (Exception e) {
                Log.e(TAG, "getSessions error: " + e.getMessage());
                return "[]";
            }
        }

        @JavascriptInterface
        public String getPostsBySession(String sessionId, int offset, int limit) {
            try {
                return db.getPostsBySession(sessionId, offset, limit).toString();
            } catch (Exception e) {
                Log.e(TAG, "getPostsBySession error: " + e.getMessage());
                return "[]";
            }
        }

        @JavascriptInterface
        public String getStats() {
            try {
                return db.getStats().toString();
            } catch (Exception e) {
                Log.e(TAG, "getStats error: " + e.getMessage());
                return "{}";
            }
        }

        @JavascriptInterface
        public String getSessionId() {
            return currentSessionId != null ? currentSessionId : "";
        }
    }
}
