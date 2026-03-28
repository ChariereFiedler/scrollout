package com.lab.echa;

import android.accessibilityservice.AccessibilityService;
import android.graphics.Point;
import android.util.Log;
import android.view.Display;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;

import org.json.JSONException;
import org.json.JSONObject;

public class InstagramAccessibilityService extends AccessibilityService {

    private static final String TAG = "ECHA_DATA";
    private static final String INSTAGRAM_PACKAGE = "com.instagram.android";
    private static final int CHUNK_SIZE = 3900;
    private static final long THROTTLE_CONTENT_MS = 300;  // CONTENT_CHANGED: réactif (nouveau contenu)
    private static final long THROTTLE_SCROLL_MS = 800;   // SCROLLED: lent (état transitoire)
    private static final long THROTTLE_STATE_MS = 500;    // STATE_CHANGED: modéré
    private static final long SUMMARY_INTERVAL_MS = 10000; // emit session summary every 10s

    private long lastContentTime = 0;
    private long lastScrollTime = 0;
    private long lastStateTime = 0;
    private long lastSummaryTime = 0;
    private String lastContentHash = "";
    private int chunkSequenceId = 0;
    private int screenHeight = 2400; // default, updated on connect

    private final PostTracker postTracker = new PostTracker();

    @Override
    public void onServiceConnected() {
        super.onServiceConnected();

        // Get screen dimensions
        Display display = getSystemService(android.view.WindowManager.class).getDefaultDisplay();
        Point size = new Point();
        display.getRealSize(size);
        screenHeight = size.y;

        Log.i(TAG, "SERVICE_STARTED|screenHeight=" + screenHeight);
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null) return;

        CharSequence packageName = event.getPackageName();
        if (packageName == null || !INSTAGRAM_PACKAGE.equals(packageName.toString())) {
            return;
        }

        long now = System.currentTimeMillis();
        int eventType = event.getEventType();

        // Throttle différencié par type d'événement
        if (eventType == AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED) {
            if (now - lastContentTime < THROTTLE_CONTENT_MS) return;
            lastContentTime = now;
        } else if (eventType == AccessibilityEvent.TYPE_VIEW_SCROLLED) {
            if (now - lastScrollTime < THROTTLE_SCROLL_MS) return;
            lastScrollTime = now;
        } else if (eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            if (now - lastStateTime < THROTTLE_STATE_MS) return;
            lastStateTime = now;
        } else {
            return;
        }

        AccessibilityNodeInfo rootNode = getRootInActiveWindow();
        if (rootNode == null) return;

        try {
            // Extract full tree (existing)
            JSONObject treeData = NodeExtractor.extractTree(rootNode);

            // Track posts and dwell time
            // SCROLLED events: détecte les posts visibles mais ne met pas à jour le dwell
            // (l'état visuel est transitoire pendant l'animation de scroll)
            boolean updateDwell = (eventType != AccessibilityEvent.TYPE_VIEW_SCROLLED);
            JSONObject trackingData = postTracker.analyzeScreen(rootNode, screenHeight, updateDwell);

            // Build payload
            JSONObject payload = new JSONObject();
            payload.put("timestamp", now);
            payload.put("eventType", eventTypeToString(eventType));
            payload.put("screenType", trackingData.optString("screenType", "unknown"));
            payload.put("nodeCount", treeData.optInt("nodeCount", 0));
            payload.put("nodes", treeData.optJSONArray("nodes"));
            payload.put("imageDescriptions", treeData.optJSONArray("imageDescriptions"));

            // Post tracking data
            payload.put("focusedPostId", trackingData.optString("focusedPostId", ""));
            payload.put("focusedPost", trackingData.opt("focusedPost"));
            payload.put("visiblePosts", trackingData.optJSONArray("visiblePosts"));
            payload.put("dwellTimes", trackingData.optJSONObject("dwellTimes"));

            String json = payload.toString();

            // Dedup
            String contentHash = String.valueOf(json.hashCode());
            if (contentHash.equals(lastContentHash)) {
                rootNode.recycle();
                return;
            }
            lastContentHash = contentHash;

            logChunked(json);

            // Periodic session summary
            if (now - lastSummaryTime > SUMMARY_INTERVAL_MS) {
                JSONObject summary = postTracker.getSessionSummary();
                summary.put("type", "SESSION_SUMMARY");
                summary.put("timestamp", now);
                Log.i(TAG, "SUMMARY|" + summary.toString());
                lastSummaryTime = now;
            }

        } catch (JSONException e) {
            Log.e(TAG, "ERROR|" + e.getMessage());
        } finally {
            rootNode.recycle();
        }
    }

    private void logChunked(String json) {
        int total = (int) Math.ceil((double) json.length() / CHUNK_SIZE);

        if (total <= 1) {
            Log.i(TAG, "DATA|" + json);
        } else {
            int seqId = chunkSequenceId++;
            for (int i = 0; i < total; i++) {
                int start = i * CHUNK_SIZE;
                int end = Math.min(start + CHUNK_SIZE, json.length());
                // Format: CHUNK|seqId|index|total|data
                Log.i(TAG, "CHUNK|" + seqId + "|" + i + "|" + total + "|" + json.substring(start, end));
            }
            Log.i(TAG, "END|" + seqId + "|" + System.currentTimeMillis());
        }
    }

    private String eventTypeToString(int type) {
        switch (type) {
            case AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED: return "CONTENT_CHANGED";
            case AccessibilityEvent.TYPE_VIEW_SCROLLED: return "SCROLLED";
            case AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED: return "STATE_CHANGED";
            default: return "OTHER_" + type;
        }
    }

    @Override
    public void onInterrupt() {
        Log.i(TAG, "SERVICE_INTERRUPTED");
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        // Emit final session summary
        JSONObject summary = postTracker.getSessionSummary();
        try {
            summary.put("type", "FINAL_SUMMARY");
            summary.put("timestamp", System.currentTimeMillis());
        } catch (JSONException ignored) {}
        Log.i(TAG, "SUMMARY|" + summary.toString());
        Log.i(TAG, "SERVICE_DESTROYED");
    }
}
