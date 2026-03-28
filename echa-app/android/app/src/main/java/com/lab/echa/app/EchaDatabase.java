package com.lab.echa.app;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * EchaDatabase — SQLite mobile, source de vérité.
 * Stocke sessions, posts, enrichissements.
 * Thread-safe via single-thread executor.
 */
public class EchaDatabase extends SQLiteOpenHelper {

    private static final String TAG = "EchaDB";
    private static final String DB_NAME = "echa.db";
    private static final int DB_VERSION = 1;

    private static EchaDatabase instance;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    // ── Singleton ───────────────────────────────────────────────

    public static synchronized EchaDatabase getInstance(Context context) {
        if (instance == null) {
            instance = new EchaDatabase(context.getApplicationContext());
        }
        return instance;
    }

    private EchaDatabase(Context context) {
        super(context, DB_NAME, null, DB_VERSION);
    }

    // ── Schema ──────────────────────────────────────────────────

    @Override
    public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE sessions (" +
                "id TEXT PRIMARY KEY," +
                "capturedAt INTEGER NOT NULL," +
                "durationSec REAL DEFAULT 0," +
                "totalPosts INTEGER DEFAULT 0," +
                "totalEvents INTEGER DEFAULT 0," +
                "captureMode TEXT DEFAULT 'webview'," +
                "createdAt INTEGER NOT NULL" +
                ")");

        db.execSQL("CREATE TABLE posts (" +
                "id TEXT PRIMARY KEY," +
                "sessionId TEXT NOT NULL," +
                "postId TEXT NOT NULL," +
                "username TEXT NOT NULL DEFAULT ''," +
                "displayName TEXT DEFAULT ''," +
                "caption TEXT DEFAULT ''," +
                "fullCaption TEXT DEFAULT ''," +
                "hashtags TEXT DEFAULT '[]'," +
                "imageAlts TEXT DEFAULT '[]'," +
                "imageUrls TEXT DEFAULT '[]'," +
                "mediaType TEXT DEFAULT 'photo'," +
                "likeCount INTEGER DEFAULT 0," +
                "commentCount INTEGER DEFAULT 0," +
                "isSponsored INTEGER DEFAULT 0," +
                "isSuggested INTEGER DEFAULT 0," +
                "dwellTimeMs INTEGER DEFAULT 0," +
                "attentionLevel TEXT DEFAULT 'skipped'," +
                "allText TEXT DEFAULT ''," +
                "ocrText TEXT DEFAULT ''," +
                "mlkitLabels TEXT DEFAULT '[]'," +
                "dateLabel TEXT DEFAULT ''," +
                "location TEXT DEFAULT ''," +
                "audioTrack TEXT DEFAULT ''," +
                "firstSeenAt INTEGER DEFAULT 0," +
                "lastSeenAt INTEGER DEFAULT 0," +
                "seenCount INTEGER DEFAULT 1," +
                "createdAt INTEGER NOT NULL," +
                "FOREIGN KEY (sessionId) REFERENCES sessions(id)" +
                ")");

        db.execSQL("CREATE TABLE post_enriched (" +
                "id TEXT PRIMARY KEY," +
                "postId TEXT UNIQUE NOT NULL," +
                "provider TEXT DEFAULT 'rules'," +
                "model TEXT DEFAULT 'rules-v1'," +
                "normalizedText TEXT DEFAULT ''," +
                "mainTopics TEXT DEFAULT '[]'," +
                "secondaryTopics TEXT DEFAULT '[]'," +
                "politicalActors TEXT DEFAULT '[]'," +
                "institutions TEXT DEFAULT '[]'," +
                "politicalExplicitnessScore INTEGER DEFAULT 0," +
                "politicalIssueTags TEXT DEFAULT '[]'," +
                "polarizationScore REAL DEFAULT 0," +
                "ingroupOutgroupSignal INTEGER DEFAULT 0," +
                "conflictSignal INTEGER DEFAULT 0," +
                "moralAbsoluteSignal INTEGER DEFAULT 0," +
                "enemyDesignationSignal INTEGER DEFAULT 0," +
                "activismSignal INTEGER DEFAULT 0," +
                "axisEconomic REAL DEFAULT 0," +
                "axisSocietal REAL DEFAULT 0," +
                "axisAuthority REAL DEFAULT 0," +
                "axisSystem REAL DEFAULT 0," +
                "dominantAxis TEXT DEFAULT ''," +
                "mediaCategory TEXT DEFAULT ''," +
                "mediaQuality TEXT DEFAULT ''," +
                "confidenceScore REAL DEFAULT 0," +
                "createdAt INTEGER NOT NULL," +
                "updatedAt INTEGER NOT NULL," +
                "FOREIGN KEY (postId) REFERENCES posts(id)" +
                ")");

        // Indexes
        db.execSQL("CREATE INDEX idx_posts_sessionId ON posts(sessionId)");
        db.execSQL("CREATE INDEX idx_posts_username ON posts(username)");
        db.execSQL("CREATE INDEX idx_posts_attentionLevel ON posts(attentionLevel)");
        db.execSQL("CREATE INDEX idx_posts_isSponsored ON posts(isSponsored)");
        db.execSQL("CREATE INDEX idx_enriched_postId ON post_enriched(postId)");
        db.execSQL("CREATE INDEX idx_enriched_politicalScore ON post_enriched(politicalExplicitnessScore)");
        db.execSQL("CREATE INDEX idx_enriched_polarization ON post_enriched(polarizationScore)");

        Log.i(TAG, "Database created (v" + DB_VERSION + ")");
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        // Future migrations here
        Log.i(TAG, "Database upgrade " + oldVersion + " → " + newVersion);
    }

    // ── Session CRUD ────────────────────────────────────────────

    public String insertSession(String captureMode) {
        long now = System.currentTimeMillis();
        String id = String.valueOf(now);
        ContentValues cv = new ContentValues();
        cv.put("id", id);
        cv.put("capturedAt", now);
        cv.put("captureMode", captureMode);
        cv.put("createdAt", now);
        getWritableDatabase().insertWithOnConflict("sessions", null, cv, SQLiteDatabase.CONFLICT_IGNORE);
        Log.i(TAG, "Session created: " + id);

        // Push to visualizer via WebSocket
        EchaWebSocketClient ws = EchaWebSocketClient.getInstance();
        if (ws != null) ws.sendSessionStart(id, captureMode);

        return id;
    }

    public void updateSession(String sessionId, double durationSec, int totalPosts, int totalEvents) {
        ContentValues cv = new ContentValues();
        cv.put("durationSec", durationSec);
        cv.put("totalPosts", totalPosts);
        cv.put("totalEvents", totalEvents);
        getWritableDatabase().update("sessions", cv, "id = ?", new String[]{sessionId});
    }

    // ── Post CRUD ───────────────────────────────────────────────

    public void insertPost(String sessionId, JSONObject post) {
        long now = System.currentTimeMillis();
        String postId = post.optString("postId", "unknown");
        String id = sessionId + ":" + post.optString("username", "") + ":" + postId;

        ContentValues cv = new ContentValues();
        cv.put("id", id);
        cv.put("sessionId", sessionId);
        cv.put("postId", postId);
        cv.put("username", post.optString("username", ""));
        cv.put("displayName", post.optString("displayName", ""));
        cv.put("caption", post.optString("caption", ""));
        cv.put("fullCaption", post.optString("fullCaption", ""));
        cv.put("hashtags", post.optString("hashtags", "[]"));
        cv.put("imageAlts", post.optString("imageAlts", "[]"));
        cv.put("imageUrls", post.optString("imageUrls", "[]"));
        cv.put("mediaType", post.optString("mediaType", "photo"));
        cv.put("likeCount", parseLikeCount(post.optString("likeCount", "0")));
        cv.put("commentCount", parseLikeCount(post.optString("commentCount", "0")));
        cv.put("isSponsored", post.optBoolean("isSponsored", false) ? 1 : 0);
        cv.put("isSuggested", post.optBoolean("isSuggested", false) ? 1 : 0);
        cv.put("dwellTimeMs", post.optInt("dwellTimeMs", 0));
        cv.put("attentionLevel", classifyAttention(post.optInt("dwellTimeMs", 0)));
        cv.put("allText", post.optString("allText", ""));
        cv.put("dateLabel", post.optString("date", ""));
        cv.put("location", post.optString("location", ""));
        cv.put("audioTrack", post.optString("audioTrack", ""));
        cv.put("firstSeenAt", post.optLong("firstSeen", now));
        cv.put("lastSeenAt", post.optLong("lastSeen", now));
        cv.put("seenCount", post.optInt("seenCount", 1));
        cv.put("createdAt", now);

        getWritableDatabase().insertWithOnConflict("posts", null, cv, SQLiteDatabase.CONFLICT_REPLACE);

        // Push to visualizer via WebSocket
        EchaWebSocketClient ws = EchaWebSocketClient.getInstance();
        if (ws != null) ws.sendPost(sessionId, post);
    }

    public void updateDwell(String sessionId, String postId, String username, int dwellTimeMs) {
        String id = sessionId + ":" + username + ":" + postId;
        String attention = classifyAttention(dwellTimeMs);
        ContentValues cv = new ContentValues();
        cv.put("dwellTimeMs", dwellTimeMs);
        cv.put("attentionLevel", attention);
        cv.put("lastSeenAt", System.currentTimeMillis());
        int rows = getWritableDatabase().update("posts", cv, "id = ?", new String[]{id});
        if (rows == 0) {
            // Post might not exist yet — try with just postId match
            getWritableDatabase().update("posts", cv, "sessionId = ? AND postId = ?",
                    new String[]{sessionId, postId});
        }

        // Push to visualizer via WebSocket
        EchaWebSocketClient ws = EchaWebSocketClient.getInstance();
        if (ws != null) ws.sendDwell(sessionId, postId, username, dwellTimeMs);
    }

    // ── Enrichment CRUD ─────────────────────────────────────────

    public void insertEnrichment(String postId, JSONObject enrichment) {
        long now = System.currentTimeMillis();
        String id = "e_" + now + "_" + postId.hashCode();

        // Find the actual DB post id from postId
        String dbPostId = findPostDbId(postId);
        if (dbPostId == null) {
            Log.w(TAG, "insertEnrichment: post not found for " + postId);
            return;
        }

        ContentValues cv = new ContentValues();
        cv.put("id", id);
        cv.put("postId", dbPostId);
        cv.put("provider", enrichment.optString("provider", "rules"));
        cv.put("model", enrichment.optString("model", "rules-v1"));
        cv.put("normalizedText", enrichment.optString("normalizedText", ""));
        cv.put("mainTopics", jsonArrayToString(enrichment, "mainTopics"));
        cv.put("secondaryTopics", jsonArrayToString(enrichment, "secondaryTopics"));
        cv.put("politicalActors", jsonArrayToString(enrichment, "politicalActors"));
        cv.put("institutions", jsonArrayToString(enrichment, "institutions"));
        cv.put("politicalExplicitnessScore", enrichment.optInt("politicalExplicitnessScore", 0));
        cv.put("politicalIssueTags", jsonArrayToString(enrichment, "politicalIssueTags"));
        cv.put("polarizationScore", enrichment.optDouble("polarizationScore", 0));
        cv.put("ingroupOutgroupSignal", enrichment.optBoolean("ingroupOutgroupSignal", false) ? 1 : 0);
        cv.put("conflictSignal", enrichment.optBoolean("conflictSignal", false) ? 1 : 0);
        cv.put("moralAbsoluteSignal", enrichment.optBoolean("moralAbsoluteSignal", false) ? 1 : 0);
        cv.put("enemyDesignationSignal", enrichment.optBoolean("enemyDesignationSignal", false) ? 1 : 0);
        cv.put("activismSignal", enrichment.optBoolean("activismSignal", false) ? 1 : 0);
        cv.put("axisEconomic", enrichment.optDouble("axisEconomic", 0));
        cv.put("axisSocietal", enrichment.optDouble("axisSocietal", 0));
        cv.put("axisAuthority", enrichment.optDouble("axisAuthority", 0));
        cv.put("axisSystem", enrichment.optDouble("axisSystem", 0));
        cv.put("dominantAxis", enrichment.optString("dominantAxis", ""));
        cv.put("mediaCategory", enrichment.optString("mediaCategory", ""));
        cv.put("mediaQuality", enrichment.optString("mediaQuality", ""));
        cv.put("confidenceScore", enrichment.optDouble("confidenceScore", 0));
        cv.put("createdAt", now);
        cv.put("updatedAt", now);

        getWritableDatabase().insertWithOnConflict("post_enriched", null, cv, SQLiteDatabase.CONFLICT_REPLACE);

        // Push to visualizer via WebSocket
        EchaWebSocketClient ws = EchaWebSocketClient.getInstance();
        if (ws != null) ws.sendEnrichment(postId, enrichment);
    }

    public void updatePostML(String postId, String labelsJson, String ocrText) {
        ContentValues cv = new ContentValues();
        cv.put("mlkitLabels", labelsJson);
        cv.put("ocrText", ocrText);
        // Try matching by postId column
        getWritableDatabase().update("posts", cv, "postId = ?", new String[]{postId});

        // Push to visualizer via WebSocket
        EchaWebSocketClient ws = EchaWebSocketClient.getInstance();
        if (ws != null) ws.sendMLKit(postId, labelsJson, ocrText);
    }

    // ── Query methods ───────────────────────────────────────────

    public JSONArray getSessions() throws JSONException {
        JSONArray result = new JSONArray();
        Cursor c = getReadableDatabase().rawQuery(
                "SELECT s.*, COUNT(p.id) as postCount FROM sessions s " +
                "LEFT JOIN posts p ON p.sessionId = s.id " +
                "GROUP BY s.id ORDER BY s.capturedAt DESC LIMIT 50", null);
        while (c.moveToNext()) {
            JSONObject session = new JSONObject();
            session.put("id", c.getString(c.getColumnIndexOrThrow("id")));
            session.put("capturedAt", c.getLong(c.getColumnIndexOrThrow("capturedAt")));
            session.put("durationSec", c.getDouble(c.getColumnIndexOrThrow("durationSec")));
            session.put("totalPosts", c.getInt(c.getColumnIndexOrThrow("totalPosts")));
            session.put("captureMode", c.getString(c.getColumnIndexOrThrow("captureMode")));
            session.put("postCount", c.getInt(c.getColumnIndexOrThrow("postCount")));
            result.put(session);
        }
        c.close();
        return result;
    }

    public JSONArray getPostsBySession(String sessionId, int offset, int limit) throws JSONException {
        JSONArray result = new JSONArray();
        Cursor c = getReadableDatabase().rawQuery(
                "SELECT p.*, e.politicalExplicitnessScore, e.polarizationScore, " +
                "e.mainTopics as enrichTopics, e.confidenceScore, e.axisEconomic, " +
                "e.axisSocietal, e.axisAuthority, e.axisSystem, e.dominantAxis, " +
                "e.mediaCategory, e.mediaQuality " +
                "FROM posts p LEFT JOIN post_enriched e ON e.postId = p.id " +
                "WHERE p.sessionId = ? ORDER BY p.dwellTimeMs DESC LIMIT ? OFFSET ?",
                new String[]{sessionId, String.valueOf(limit), String.valueOf(offset)});
        while (c.moveToNext()) {
            result.put(cursorToPostJson(c));
        }
        c.close();
        return result;
    }

    public JSONObject getStats() throws JSONException {
        JSONObject stats = new JSONObject();
        SQLiteDatabase db = getReadableDatabase();

        // Total counts
        Cursor c1 = db.rawQuery("SELECT COUNT(*) FROM sessions", null);
        c1.moveToFirst(); stats.put("totalSessions", c1.getInt(0)); c1.close();

        Cursor c2 = db.rawQuery("SELECT COUNT(*) FROM posts", null);
        c2.moveToFirst(); stats.put("totalPosts", c2.getInt(0)); c2.close();

        Cursor c3 = db.rawQuery("SELECT COUNT(*) FROM post_enriched", null);
        c3.moveToFirst(); stats.put("totalEnriched", c3.getInt(0)); c3.close();

        // Attention distribution
        JSONObject attention = new JSONObject();
        Cursor c4 = db.rawQuery("SELECT attentionLevel, COUNT(*) as cnt FROM posts GROUP BY attentionLevel", null);
        while (c4.moveToNext()) {
            attention.put(c4.getString(0), c4.getInt(1));
        }
        c4.close();
        stats.put("attention", attention);

        // Top categories
        JSONArray topCategories = new JSONArray();
        Cursor c5 = db.rawQuery(
                "SELECT mediaCategory, COUNT(*) as cnt FROM post_enriched " +
                "WHERE mediaCategory != '' GROUP BY mediaCategory ORDER BY cnt DESC LIMIT 10", null);
        while (c5.moveToNext()) {
            JSONObject cat = new JSONObject();
            cat.put("category", c5.getString(0));
            cat.put("count", c5.getInt(1));
            topCategories.put(cat);
        }
        c5.close();
        stats.put("topCategories", topCategories);

        // Political score distribution
        JSONObject political = new JSONObject();
        Cursor c6 = db.rawQuery(
                "SELECT politicalExplicitnessScore, COUNT(*) as cnt FROM post_enriched " +
                "GROUP BY politicalExplicitnessScore ORDER BY politicalExplicitnessScore", null);
        while (c6.moveToNext()) {
            political.put(String.valueOf(c6.getInt(0)), c6.getInt(1));
        }
        c6.close();
        stats.put("political", political);

        // Average axes
        Cursor c7 = db.rawQuery(
                "SELECT AVG(axisEconomic), AVG(axisSocietal), AVG(axisAuthority), AVG(axisSystem), " +
                "AVG(polarizationScore), AVG(confidenceScore) " +
                "FROM post_enriched WHERE axisEconomic != 0 OR axisSocietal != 0 OR axisAuthority != 0 OR axisSystem != 0", null);
        if (c7.moveToFirst()) {
            JSONObject axes = new JSONObject();
            axes.put("economic", Math.round(c7.getDouble(0) * 100.0) / 100.0);
            axes.put("societal", Math.round(c7.getDouble(1) * 100.0) / 100.0);
            axes.put("authority", Math.round(c7.getDouble(2) * 100.0) / 100.0);
            axes.put("system", Math.round(c7.getDouble(3) * 100.0) / 100.0);
            stats.put("axes", axes);
            stats.put("avgPolarization", Math.round(c7.getDouble(4) * 100.0) / 100.0);
            stats.put("avgConfidence", Math.round(c7.getDouble(5) * 100.0) / 100.0);
        }
        c7.close();

        // Top usernames
        JSONArray topUsers = new JSONArray();
        Cursor c8 = db.rawQuery(
                "SELECT username, COUNT(*) as cnt, SUM(dwellTimeMs) as totalDwell " +
                "FROM posts WHERE username != '' GROUP BY username ORDER BY cnt DESC LIMIT 20", null);
        while (c8.moveToNext()) {
            JSONObject user = new JSONObject();
            user.put("username", c8.getString(0));
            user.put("count", c8.getInt(1));
            user.put("totalDwellMs", c8.getLong(2));
            topUsers.put(user);
        }
        c8.close();
        stats.put("topUsers", topUsers);

        return stats;
    }

    public JSONObject exportSessionAsJson(String sessionId) throws JSONException {
        JSONObject result = new JSONObject();

        // Session info
        Cursor sc = getReadableDatabase().rawQuery("SELECT * FROM sessions WHERE id = ?", new String[]{sessionId});
        if (sc.moveToFirst()) {
            result.put("id", sc.getString(sc.getColumnIndexOrThrow("id")));
            result.put("capturedAt", sc.getLong(sc.getColumnIndexOrThrow("capturedAt")));
            result.put("durationSec", sc.getDouble(sc.getColumnIndexOrThrow("durationSec")));
            result.put("totalPosts", sc.getInt(sc.getColumnIndexOrThrow("totalPosts")));
        }
        sc.close();

        // Posts + enrichment
        result.put("posts", getPostsBySession(sessionId, 0, 1000));

        return result;
    }

    // ── Helpers ──────────────────────────────────────────────────

    private String findPostDbId(String postId) {
        Cursor c = getReadableDatabase().rawQuery(
                "SELECT id FROM posts WHERE postId = ? ORDER BY createdAt DESC LIMIT 1",
                new String[]{postId});
        String result = null;
        if (c.moveToFirst()) result = c.getString(0);
        c.close();
        return result;
    }

    private JSONObject cursorToPostJson(Cursor c) throws JSONException {
        JSONObject post = new JSONObject();
        post.put("id", c.getString(c.getColumnIndexOrThrow("id")));
        post.put("sessionId", c.getString(c.getColumnIndexOrThrow("sessionId")));
        post.put("postId", c.getString(c.getColumnIndexOrThrow("postId")));
        post.put("username", c.getString(c.getColumnIndexOrThrow("username")));
        post.put("caption", c.getString(c.getColumnIndexOrThrow("caption")));
        post.put("mediaType", c.getString(c.getColumnIndexOrThrow("mediaType")));
        post.put("likeCount", c.getInt(c.getColumnIndexOrThrow("likeCount")));
        post.put("isSponsored", c.getInt(c.getColumnIndexOrThrow("isSponsored")) == 1);
        post.put("isSuggested", c.getInt(c.getColumnIndexOrThrow("isSuggested")) == 1);
        post.put("dwellTimeMs", c.getInt(c.getColumnIndexOrThrow("dwellTimeMs")));
        post.put("attentionLevel", c.getString(c.getColumnIndexOrThrow("attentionLevel")));
        post.put("allText", c.getString(c.getColumnIndexOrThrow("allText")));
        post.put("seenCount", c.getInt(c.getColumnIndexOrThrow("seenCount")));

        // Enrichment fields (may be null if LEFT JOIN)
        int polIdx = c.getColumnIndex("politicalExplicitnessScore");
        if (polIdx >= 0 && !c.isNull(polIdx)) {
            JSONObject enrichment = new JSONObject();
            enrichment.put("politicalScore", c.getInt(polIdx));
            enrichment.put("polarizationScore", c.getDouble(c.getColumnIndex("polarizationScore")));
            enrichment.put("confidenceScore", c.getDouble(c.getColumnIndex("confidenceScore")));
            enrichment.put("mainTopics", c.getString(c.getColumnIndex("enrichTopics")));
            enrichment.put("axisEconomic", c.getDouble(c.getColumnIndex("axisEconomic")));
            enrichment.put("axisSocietal", c.getDouble(c.getColumnIndex("axisSocietal")));
            enrichment.put("axisAuthority", c.getDouble(c.getColumnIndex("axisAuthority")));
            enrichment.put("axisSystem", c.getDouble(c.getColumnIndex("axisSystem")));
            enrichment.put("dominantAxis", c.getString(c.getColumnIndex("dominantAxis")));
            enrichment.put("mediaCategory", c.getString(c.getColumnIndex("mediaCategory")));
            enrichment.put("mediaQuality", c.getString(c.getColumnIndex("mediaQuality")));
            post.put("enrichment", enrichment);
        }

        return post;
    }

    private static String classifyAttention(int ms) {
        if (ms < 500) return "skipped";
        if (ms < 2000) return "glanced";
        if (ms < 5000) return "viewed";
        return "engaged";
    }

    private static int parseLikeCount(String raw) {
        if (raw == null || raw.isEmpty()) return 0;
        try {
            String cleaned = raw.replaceAll("[^\\d]", "");
            return cleaned.isEmpty() ? 0 : Integer.parseInt(cleaned);
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private static String jsonArrayToString(JSONObject obj, String key) {
        JSONArray arr = obj.optJSONArray(key);
        return arr != null ? arr.toString() : "[]";
    }

    /**
     * Execute a DB operation on the background executor.
     */
    public void runAsync(Runnable task) {
        executor.execute(() -> {
            try {
                task.run();
            } catch (Exception e) {
                Log.e(TAG, "Async DB error: " + e.getMessage(), e);
            }
        });
    }
}
