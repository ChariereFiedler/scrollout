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

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
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
    private static final int DB_VERSION = 3;

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
                "tone TEXT DEFAULT ''," +
                "semanticSummary TEXT DEFAULT ''," +
                "primaryEmotion TEXT DEFAULT ''," +
                "narrativeFrame TEXT DEFAULT ''," +
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
        db.execSQL("CREATE INDEX idx_enriched_confidence ON post_enriched(confidenceScore)");
        db.execSQL("CREATE INDEX idx_enriched_provider ON post_enriched(provider)");

        Log.i(TAG, "Database created (v" + DB_VERSION + ")");
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        Log.i(TAG, "Database upgrade " + oldVersion + " → " + newVersion);
        if (oldVersion < 2) {
            // Add LLM enrichment fields
            safeAddColumn(db, "post_enriched", "tone", "TEXT DEFAULT ''");
            safeAddColumn(db, "post_enriched", "semanticSummary", "TEXT DEFAULT ''");
            safeAddColumn(db, "post_enriched", "primaryEmotion", "TEXT DEFAULT ''");
            safeAddColumn(db, "post_enriched", "narrativeFrame", "TEXT DEFAULT ''");
        }
        if (oldVersion < 3) {
            // Add confidence + provider indexes for smart enrichment cascade
            safeExecSQL(db, "CREATE INDEX IF NOT EXISTS idx_enriched_confidence ON post_enriched(confidenceScore)");
            safeExecSQL(db, "CREATE INDEX IF NOT EXISTS idx_enriched_provider ON post_enriched(provider)");
            // Add audioTranscription + reviewFlag if missing
            safeAddColumn(db, "post_enriched", "audioTranscription", "TEXT DEFAULT ''");
            safeAddColumn(db, "post_enriched", "reviewFlag", "INTEGER DEFAULT 0");
            safeAddColumn(db, "post_enriched", "reviewReason", "TEXT DEFAULT ''");
        }
    }

    private void safeExecSQL(SQLiteDatabase db, String sql) {
        try { db.execSQL(sql); } catch (Exception e) { /* already exists */ }
    }

    private void safeAddColumn(SQLiteDatabase db, String table, String column, String type) {
        try {
            db.execSQL("ALTER TABLE " + table + " ADD COLUMN " + column + " " + type);
        } catch (Exception e) {
            // Column already exists
        }
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
                "e.mainTopics as enrichTopics, e.secondaryTopics as enrichSecondaryTopics, " +
                "e.confidenceScore, e.axisEconomic, " +
                "e.axisSocietal, e.axisAuthority, e.axisSystem, e.dominantAxis, " +
                "e.mediaCategory, e.mediaQuality, e.tone as enrichTone, " +
                "e.semanticSummary, e.primaryEmotion, e.narrativeFrame, " +
                "e.politicalActors as enrichActors, e.activismSignal as enrichActivism, " +
                "e.conflictSignal as enrichConflict " +
                "FROM posts p LEFT JOIN post_enriched e ON e.postId = p.id " +
                "WHERE p.sessionId = ? ORDER BY p.dwellTimeMs DESC LIMIT ? OFFSET ?",
                new String[]{sessionId, String.valueOf(limit), String.valueOf(offset)});
        while (c.moveToNext()) {
            result.put(cursorToPostJson(c));
        }
        c.close();
        return result;
    }

    public JSONArray getAllPosts(int offset, int limit) throws JSONException {
        JSONArray result = new JSONArray();
        Cursor c = getReadableDatabase().rawQuery(
                "SELECT p.*, e.politicalExplicitnessScore, e.polarizationScore, " +
                "e.mainTopics as enrichTopics, e.secondaryTopics as enrichSecondaryTopics, " +
                "e.confidenceScore, e.axisEconomic, " +
                "e.axisSocietal, e.axisAuthority, e.axisSystem, e.dominantAxis, " +
                "e.mediaCategory, e.mediaQuality, e.tone as enrichTone, " +
                "e.semanticSummary, e.primaryEmotion, e.narrativeFrame, " +
                "e.politicalActors as enrichActors, e.activismSignal as enrichActivism, " +
                "e.conflictSignal as enrichConflict " +
                "FROM posts p LEFT JOIN post_enriched e ON e.postId = p.id " +
                "ORDER BY p.dwellTimeMs DESC LIMIT ? OFFSET ?",
                new String[]{String.valueOf(limit), String.valueOf(offset)});
        while (c.moveToNext()) {
            result.put(cursorToPostJson(c));
        }
        c.close();
        return result;
    }

    public JSONObject getCognitiveThemesBySession(String sessionId) throws JSONException {
        JSONObject result = new JSONObject();
        JSONArray themes = new JSONArray();
        int totalPosts = 0;
        boolean allSessions = sessionId == null || sessionId.trim().isEmpty();
        Cursor c = getReadableDatabase().rawQuery(
                "SELECT p.id, p.postId, p.username, p.dwellTimeMs, p.attentionLevel, " +
                "e.politicalExplicitnessScore, e.polarizationScore, e.confidenceScore, " +
                "e.mainTopics as enrichTopics, e.mediaCategory " +
                "FROM posts p LEFT JOIN post_enriched e ON e.postId = p.id " +
                (allSessions ? "" : "WHERE p.sessionId = ? ") +
                "ORDER BY p.dwellTimeMs DESC",
                allSessions ? new String[]{} : new String[]{sessionId});

        Map<String, ThemeBucket> buckets = new LinkedHashMap<>();
        while (c.moveToNext()) {
            totalPosts += 1;

            String themeLabel = "non classifié";
            String source = "fallback";

            int topicsIdx = c.getColumnIndex("enrichTopics");
            if (topicsIdx >= 0 && !c.isNull(topicsIdx)) {
                String firstTopic = firstTopicFromJson(c.getString(topicsIdx));
                if (!firstTopic.isEmpty()) {
                    themeLabel = firstTopic;
                    source = "mainTopics";
                }
            }

            int mediaCategoryIdx = c.getColumnIndex("mediaCategory");
            if ("fallback".equals(source) && mediaCategoryIdx >= 0 && !c.isNull(mediaCategoryIdx)) {
                String mediaCategory = c.getString(mediaCategoryIdx);
                if (mediaCategory != null && !mediaCategory.trim().isEmpty()) {
                    themeLabel = mediaCategory.trim();
                    source = "mediaCategory";
                }
            }

            String themeId = normalizeThemeId(themeLabel);
            ThemeBucket bucket = buckets.get(themeId);
            if (bucket == null) {
                bucket = new ThemeBucket(themeId, themeLabel, source);
                buckets.put(themeId, bucket);
            }

            int dwellTimeMs = c.getInt(c.getColumnIndexOrThrow("dwellTimeMs"));
            String attentionLevel = c.getString(c.getColumnIndexOrThrow("attentionLevel"));
            bucket.postCount += 1;
            bucket.totalDwellTimeMs += Math.max(0, dwellTimeMs);
            int attentionScore = resolveAttentionScore(attentionLevel, dwellTimeMs);
            bucket.attentionSum += attentionScore;
            if (attentionScore >= 66) bucket.engagedCount += 1;

            int politicalIdx = c.getColumnIndex("politicalExplicitnessScore");
            if (politicalIdx >= 0 && !c.isNull(politicalIdx)) {
                bucket.enrichedPostCount += 1;
                bucket.politicalSum += c.getDouble(politicalIdx);
                bucket.politicalCount += 1;
                bucket.polarizationSum += clamp(c.getDouble(c.getColumnIndexOrThrow("polarizationScore")), 0, 1);
                bucket.polarizationCount += 1;
                bucket.confidenceSum += clamp(c.getDouble(c.getColumnIndexOrThrow("confidenceScore")), 0, 1);
                bucket.confidenceCount += 1;
            }

            String postId = c.getString(c.getColumnIndexOrThrow("postId"));
            if (postId != null && !postId.isEmpty() && bucket.samplePostIds.size() < 5) {
                bucket.samplePostIds.add(postId);
            }
            String username = c.getString(c.getColumnIndexOrThrow("username"));
            if (username != null && !username.isEmpty()) {
                bucket.sampleUsers.add(username);
            }
        }
        c.close();

        List<ThemeBucket> orderedBuckets = new ArrayList<>(buckets.values());
        orderedBuckets.sort((a, b) -> {
            if (b.totalDwellTimeMs != a.totalDwellTimeMs) {
                return Long.compare(b.totalDwellTimeMs, a.totalDwellTimeMs);
            }
            if (b.postCount != a.postCount) {
                return Integer.compare(b.postCount, a.postCount);
            }
            return a.themeLabel.compareToIgnoreCase(b.themeLabel);
        });

        for (ThemeBucket bucket : orderedBuckets) {
            JSONObject theme = new JSONObject();
            double averageDwellTimeMs = bucket.postCount > 0 ? (double) bucket.totalDwellTimeMs / bucket.postCount : 0;
            double engagementScore = bucket.postCount > 0 ? bucket.attentionSum / bucket.postCount : 0;
            double engagedShare = bucket.postCount > 0 ? (bucket.engagedCount * 100.0) / bucket.postCount : 0;
            double politicalScoreAverage = bucket.politicalCount > 0 ? bucket.politicalSum / bucket.politicalCount : 0;
            double polarizationAverage = bucket.polarizationCount > 0 ? bucket.polarizationSum / bucket.polarizationCount : 0;
            double confidenceAverage = bucket.confidenceCount > 0 ? bucket.confidenceSum / bucket.confidenceCount : 0;

            theme.put("themeId", bucket.themeId);
            theme.put("themeLabel", bucket.themeLabel);
            theme.put("source", bucket.source);
            theme.put("postCount", bucket.postCount);
            theme.put("totalDwellTimeMs", bucket.totalDwellTimeMs);
            theme.put("averageDwellTimeMs", averageDwellTimeMs);
            theme.put("engagementScore", engagementScore);
            theme.put("engagedShare", engagedShare);
            theme.put("politicalScoreAverage", politicalScoreAverage);
            theme.put("polarizationAverage", polarizationAverage);
            theme.put("confidenceAverage", confidenceAverage);
            theme.put("enrichedPostCount", bucket.enrichedPostCount);
            theme.put("samplePostIds", new JSONArray(bucket.samplePostIds));
            theme.put("sampleUsers", new JSONArray(new ArrayList<>(bucket.sampleUsers)));
            themes.put(theme);
        }

        result.put("themes", themes);
        result.put("totalPosts", totalPosts);
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

        // Average polarization & confidence (all enriched posts)
        Cursor cAvg = db.rawQuery(
                "SELECT AVG(polarizationScore), AVG(confidenceScore) FROM post_enriched", null);
        if (cAvg.moveToFirst()) {
            stats.put("avgPolarization", Math.round(cAvg.getDouble(0) * 100.0) / 100.0);
            stats.put("avgConfidence", Math.round(cAvg.getDouble(1) * 100.0) / 100.0);
        }
        cAvg.close();

        // Average axes (only posts with political content)
        Cursor c7 = db.rawQuery(
                "SELECT AVG(axisEconomic), AVG(axisSocietal), AVG(axisAuthority), AVG(axisSystem) " +
                "FROM post_enriched WHERE axisEconomic != 0 OR axisSocietal != 0 OR axisAuthority != 0 OR axisSystem != 0", null);
        if (c7.moveToFirst() && !c7.isNull(0)) {
            JSONObject axes = new JSONObject();
            axes.put("economic", Math.round(c7.getDouble(0) * 100.0) / 100.0);
            axes.put("societal", Math.round(c7.getDouble(1) * 100.0) / 100.0);
            axes.put("authority", Math.round(c7.getDouble(2) * 100.0) / 100.0);
            axes.put("system", Math.round(c7.getDouble(3) * 100.0) / 100.0);
            stats.put("axes", axes);
        }
        c7.close();

        // Total dwell time
        Cursor cDwell = db.rawQuery("SELECT COALESCE(SUM(dwellTimeMs),0) FROM posts", null);
        cDwell.moveToFirst(); stats.put("totalDwellMs", cDwell.getLong(0)); cDwell.close();

        // Top topics (parse JSON arrays from mainTopics column)
        stats.put("topTopics", aggregateJsonArrayField(db, "mainTopics", 15));

        // Top domains (from secondaryTopics or mainTopics as domain proxy)
        // Use mainTopics as "domains" since domains field is often empty
        stats.put("topDomains", aggregateJsonArrayField(db, "mainTopics", 10));

        // Top tones
        JSONArray topTones = new JSONArray();
        Cursor cTones = db.rawQuery(
                "SELECT tone, COUNT(*) as cnt FROM post_enriched " +
                "WHERE tone != '' AND tone IS NOT NULL GROUP BY tone ORDER BY cnt DESC LIMIT 10", null);
        while (cTones.moveToNext()) {
            JSONObject t = new JSONObject();
            t.put("tone", cTones.getString(0));
            t.put("count", cTones.getInt(1));
            topTones.put(t);
        }
        cTones.close();
        stats.put("topTones", topTones);

        // Top narratives
        JSONArray topNarratives = new JSONArray();
        Cursor cNarr = db.rawQuery(
                "SELECT narrativeFrame, COUNT(*) as cnt FROM post_enriched " +
                "WHERE narrativeFrame != '' AND narrativeFrame IS NOT NULL GROUP BY narrativeFrame ORDER BY cnt DESC LIMIT 10", null);
        while (cNarr.moveToNext()) {
            JSONObject n = new JSONObject();
            n.put("narrative", cNarr.getString(0));
            n.put("count", cNarr.getInt(1));
            topNarratives.put(n);
        }
        cNarr.close();
        stats.put("topNarratives", topNarratives);

        // Top political actors
        stats.put("topActors", aggregateJsonArrayField(db, "politicalActors", 10));

        // Top subjects & precise subjects (deeper taxonomy)
        stats.put("topSubjects", aggregateJsonArrayField(db, "subjects", 15));
        stats.put("topPreciseSubjects", aggregateJsonArrayField(db, "preciseSubjects", 15));

        // Top domains (from domains field)
        stats.put("topDomainsReal", aggregateJsonArrayField(db, "domains", 10));

        // ── Cross-analyses avancées ──────────────────────────────

        // Attention × Politique: est-ce que tu t'arrêtes plus sur le contenu politique ?
        JSONObject attentionPolitical = new JSONObject();
        Cursor cAP = db.rawQuery(
                "SELECT p.attentionLevel, AVG(e.politicalExplicitnessScore) as avgPol, " +
                "AVG(e.polarizationScore) as avgPolar, COUNT(*) as cnt " +
                "FROM posts p JOIN post_enriched e ON e.postId = p.id " +
                "GROUP BY p.attentionLevel", null);
        while (cAP.moveToNext()) {
            JSONObject row = new JSONObject();
            row.put("avgPolitical", Math.round(cAP.getDouble(1) * 100.0) / 100.0);
            row.put("avgPolarization", Math.round(cAP.getDouble(2) * 100.0) / 100.0);
            row.put("count", cAP.getInt(3));
            attentionPolitical.put(cAP.getString(0), row);
        }
        cAP.close();
        stats.put("attentionPolitical", attentionPolitical);

        // Top comptes par polarisation moyenne (qui te polarise le plus)
        JSONArray polarizingAccounts = new JSONArray();
        Cursor cPA = db.rawQuery(
                "SELECT p.username, AVG(e.polarizationScore) as avgPolar, " +
                "AVG(e.politicalExplicitnessScore) as avgPol, COUNT(*) as cnt, " +
                "SUM(p.dwellTimeMs) as totalDwell " +
                "FROM posts p JOIN post_enriched e ON e.postId = p.id " +
                "WHERE p.username != '' " +
                "GROUP BY p.username HAVING cnt >= 1 " +
                "ORDER BY avgPolar DESC LIMIT 10", null);
        while (cPA.moveToNext()) {
            JSONObject acc = new JSONObject();
            acc.put("username", cPA.getString(0));
            acc.put("avgPolarization", Math.round(cPA.getDouble(1) * 100.0) / 100.0);
            acc.put("avgPolitical", Math.round(cPA.getDouble(2) * 100.0) / 100.0);
            acc.put("count", cPA.getInt(3));
            acc.put("totalDwellMs", cPA.getLong(4));
            polarizingAccounts.put(acc);
        }
        cPA.close();
        stats.put("polarizingAccounts", polarizingAccounts);

        // Sponsored vs organic
        JSONObject sponsoredStats = new JSONObject();
        Cursor cSp = db.rawQuery(
                "SELECT p.isSponsored, COUNT(*) as cnt, AVG(p.dwellTimeMs) as avgDwell, " +
                "AVG(e.politicalExplicitnessScore) as avgPol " +
                "FROM posts p LEFT JOIN post_enriched e ON e.postId = p.id " +
                "GROUP BY p.isSponsored", null);
        while (cSp.moveToNext()) {
            String key = cSp.getInt(0) == 1 ? "sponsored" : "organic";
            JSONObject row = new JSONObject();
            row.put("count", cSp.getInt(1));
            row.put("avgDwellMs", Math.round(cSp.getDouble(2)));
            row.put("avgPolitical", Math.round(cSp.getDouble(3) * 100.0) / 100.0);
            sponsoredStats.put(key, row);
        }
        cSp.close();
        stats.put("sponsoredStats", sponsoredStats);

        // Signaux d'alerte (conflict, activism, enemy designation, moral absolutes)
        JSONObject signals = new JSONObject();
        Cursor cSig = db.rawQuery(
                "SELECT " +
                "SUM(CASE WHEN activismSignal = 1 THEN 1 ELSE 0 END) as activism, " +
                "SUM(CASE WHEN conflictSignal = 1 THEN 1 ELSE 0 END) as conflict, " +
                "SUM(CASE WHEN moralAbsoluteSignal = 1 THEN 1 ELSE 0 END) as moralAbsolute, " +
                "SUM(CASE WHEN enemyDesignationSignal = 1 THEN 1 ELSE 0 END) as enemyDesignation, " +
                "SUM(CASE WHEN ingroupOutgroupSignal = 1 THEN 1 ELSE 0 END) as ingroupOutgroup, " +
                "COUNT(*) as total " +
                "FROM post_enriched", null);
        if (cSig.moveToFirst()) {
            signals.put("activism", cSig.getInt(0));
            signals.put("conflict", cSig.getInt(1));
            signals.put("moralAbsolute", cSig.getInt(2));
            signals.put("enemyDesignation", cSig.getInt(3));
            signals.put("ingroupOutgroup", cSig.getInt(4));
            signals.put("total", cSig.getInt(5));
        }
        cSig.close();
        stats.put("signals", signals);

        // Emotions
        JSONArray topEmotions = new JSONArray();
        Cursor cEmo = db.rawQuery(
                "SELECT primaryEmotion, COUNT(*) as cnt FROM post_enriched " +
                "WHERE primaryEmotion != '' AND primaryEmotion IS NOT NULL " +
                "GROUP BY primaryEmotion ORDER BY cnt DESC LIMIT 8", null);
        while (cEmo.moveToNext()) {
            JSONObject e = new JSONObject();
            e.put("emotion", cEmo.getString(0));
            e.put("count", cEmo.getInt(1));
            topEmotions.put(e);
        }
        cEmo.close();
        stats.put("topEmotions", topEmotions);

        // Dwell time moyen par topic (sur quoi tu passes le plus de temps)
        // Parse mainTopics JSON per post, aggregate dwell time
        JSONArray dwellByTopic = new JSONArray();
        java.util.Map<String, long[]> topicDwell = new java.util.LinkedHashMap<>();
        Cursor cDT = db.rawQuery(
                "SELECT e.mainTopics, p.dwellTimeMs FROM posts p " +
                "JOIN post_enriched e ON e.postId = p.id " +
                "WHERE e.mainTopics IS NOT NULL AND e.mainTopics != '[]'", null);
        while (cDT.moveToNext()) {
            String topicsJson = cDT.getString(0);
            long dwell = cDT.getLong(1);
            try {
                JSONArray topics = new JSONArray(topicsJson);
                for (int ti = 0; ti < topics.length(); ti++) {
                    String topic = topics.getString(ti).trim().toLowerCase();
                    if (!topic.isEmpty()) {
                        long[] vals = topicDwell.getOrDefault(topic, new long[]{0, 0});
                        vals[0] += dwell; // total dwell
                        vals[1]++;        // count
                        topicDwell.put(topic, vals);
                    }
                }
            } catch (Exception ignored) {}
        }
        cDT.close();
        java.util.List<java.util.Map.Entry<String, long[]>> sortedDwell = new java.util.ArrayList<>(topicDwell.entrySet());
        sortedDwell.sort((a1, b1) -> Long.compare(b1.getValue()[0], a1.getValue()[0]));
        for (int di = 0; di < Math.min(sortedDwell.size(), 10); di++) {
            java.util.Map.Entry<String, long[]> entry = sortedDwell.get(di);
            JSONObject item = new JSONObject();
            item.put("topic", entry.getKey());
            item.put("totalDwellMs", entry.getValue()[0]);
            item.put("avgDwellMs", entry.getValue()[1] > 0 ? entry.getValue()[0] / entry.getValue()[1] : 0);
            item.put("count", entry.getValue()[1]);
            dwellByTopic.put(item);
        }
        stats.put("dwellByTopic", dwellByTopic);

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

        // ── Media type distribution (photo, video, carousel, reel, story) ──
        JSONArray mediaTypes = new JSONArray();
        Cursor cmt = getReadableDatabase().rawQuery(
                "SELECT mediaType, COUNT(*) as cnt, SUM(dwellTimeMs) as totalDwell " +
                "FROM posts GROUP BY mediaType ORDER BY cnt DESC", null);
        while (cmt.moveToNext()) {
            JSONObject mt = new JSONObject();
            mt.put("type", cmt.getString(0));
            mt.put("count", cmt.getInt(1));
            mt.put("totalDwellMs", cmt.getLong(2));
            mediaTypes.put(mt);
        }
        cmt.close();
        stats.put("mediaTypes", mediaTypes);

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

    // ── Unenriched posts query ────────────────────────────────────

    public JSONArray getUnenrichedPosts(int limit) throws JSONException {
        JSONArray result = new JSONArray();
        Cursor c = getReadableDatabase().rawQuery(
                "SELECT p.id, p.postId, p.username, p.caption, p.fullCaption, " +
                "p.hashtags, p.imageAlts, p.allText, p.ocrText, p.mlkitLabels, " +
                "p.mediaType, p.isSponsored, p.isSuggested, p.imageUrls, p.videoUrl " +
                "FROM posts p LEFT JOIN post_enriched e ON e.postId = p.id " +
                "WHERE e.id IS NULL AND length(p.allText) > 10 " +
                "ORDER BY p.createdAt DESC LIMIT ?",
                new String[]{String.valueOf(limit)});
        while (c.moveToNext()) {
            JSONObject post = new JSONObject();
            post.put("id", c.getString(c.getColumnIndexOrThrow("id")));
            post.put("postId", c.getString(c.getColumnIndexOrThrow("postId")));
            post.put("username", c.getString(c.getColumnIndexOrThrow("username")));
            post.put("caption", c.getString(c.getColumnIndexOrThrow("caption")));
            post.put("fullCaption", c.getString(c.getColumnIndexOrThrow("fullCaption")));
            post.put("hashtags", c.getString(c.getColumnIndexOrThrow("hashtags")));
            post.put("imageAlts", c.getString(c.getColumnIndexOrThrow("imageAlts")));
            post.put("allText", c.getString(c.getColumnIndexOrThrow("allText")));
            post.put("ocrText", c.getString(c.getColumnIndexOrThrow("ocrText")));
            post.put("mlkitLabels", c.getString(c.getColumnIndexOrThrow("mlkitLabels")));
            post.put("mediaType", c.getString(c.getColumnIndexOrThrow("mediaType")));
            post.put("isSponsored", c.getInt(c.getColumnIndexOrThrow("isSponsored")) == 1);
            post.put("isSuggested", c.getInt(c.getColumnIndexOrThrow("isSuggested")) == 1);
            post.put("imageUrls", c.getString(c.getColumnIndexOrThrow("imageUrls")));
            post.put("videoUrl", c.getString(c.getColumnIndexOrThrow("videoUrl")));
            result.put(post);
        }
        c.close();
        return result;
    }

    public int countUnenrichedPosts() {
        Cursor c = getReadableDatabase().rawQuery(
                "SELECT COUNT(*) FROM posts p LEFT JOIN post_enriched e ON e.postId = p.id " +
                "WHERE e.id IS NULL AND length(p.allText) > 10", null);
        c.moveToFirst();
        int count = c.getInt(0);
        c.close();
        return count;
    }

    /**
     * Insert or update enrichment with extended LLM fields.
     * Supports both rules-only and LLM-enriched data.
     */
    public void upsertEnrichment(String dbPostId, JSONObject enrichment) {
        long now = System.currentTimeMillis();

        ContentValues cv = new ContentValues();
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
        // LLM-specific fields
        cv.put("tone", enrichment.optString("tone", ""));
        cv.put("semanticSummary", enrichment.optString("semanticSummary", ""));
        cv.put("primaryEmotion", enrichment.optString("primaryEmotion", ""));
        cv.put("narrativeFrame", enrichment.optString("narrativeFrame", ""));
        cv.put("updatedAt", now);

        // Try update first, insert if not found
        int rows = getWritableDatabase().update("post_enriched", cv,
                "postId = ?", new String[]{dbPostId});
        if (rows == 0) {
            String id = "e_" + now + "_" + dbPostId.hashCode();
            cv.put("id", id);
            cv.put("createdAt", now);
            getWritableDatabase().insertWithOnConflict("post_enriched", null, cv, SQLiteDatabase.CONFLICT_REPLACE);
        }
    }

    /**
     * Delete enrichments with empty mainTopics (broken by imageAlts bug).
     * Returns number of rows deleted.
     */
    public int purgeEmptyEnrichments() {
        // Purge enrichments missing LLM data (no tone = never processed by LLM)
        int deleted = getWritableDatabase().delete("post_enriched",
                "tone IS NULL OR tone = '' OR mainTopics IS NULL OR mainTopics = '[]' OR mainTopics = ''", null);
        Log.i(TAG, "Purged " + deleted + " enrichments (no LLM data)");
        return deleted;
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

    private static final class ThemeBucket {
        final String themeId;
        final String themeLabel;
        final String source;
        int postCount = 0;
        long totalDwellTimeMs = 0;
        double attentionSum = 0;
        int engagedCount = 0;
        double politicalSum = 0;
        int politicalCount = 0;
        double polarizationSum = 0;
        int polarizationCount = 0;
        double confidenceSum = 0;
        int confidenceCount = 0;
        int enrichedPostCount = 0;
        final List<String> samplePostIds = new ArrayList<>();
        final Set<String> sampleUsers = new LinkedHashSet<>();

        ThemeBucket(String themeId, String themeLabel, String source) {
            this.themeId = themeId;
            this.themeLabel = themeLabel;
            this.source = source;
        }
    }

    private static double clamp(double value, double min, double max) {
        return Math.max(min, Math.min(max, value));
    }

    private static int resolveAttentionScore(String attentionLevel, int dwellTimeMs) {
        if ("skipped".equals(attentionLevel)) return 0;
        if ("glanced".equals(attentionLevel)) return 33;
        if ("viewed".equals(attentionLevel)) return 66;
        if ("engaged".equals(attentionLevel)) return 100;
        return attentionScoreFromDwell(dwellTimeMs);
    }

    private static int attentionScoreFromDwell(int dwellTimeMs) {
        if (dwellTimeMs < 500) return 0;
        if (dwellTimeMs < 2000) return 33;
        if (dwellTimeMs < 5000) return 66;
        return 100;
    }

    private static String firstTopicFromJson(String json) {
        if (json == null || json.trim().isEmpty()) return "";
        try {
            JSONArray arr = new JSONArray(json);
            if (arr.length() == 0) return "";
            String first = arr.optString(0, "");
            return first == null ? "" : first.trim();
        } catch (Exception ignored) {
            return "";
        }
    }

    private static String normalizeThemeId(String label) {
        String normalized = Normalizer.normalize(label == null ? "" : label.trim().toLowerCase(), Normalizer.Form.NFKD)
                .replaceAll("\\p{M}", "")
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-+|-+$", "");
        return normalized.isEmpty() ? "non-classe" : normalized;
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
            // Extended LLM fields
            int toneIdx = c.getColumnIndex("enrichTone");
            if (toneIdx >= 0 && !c.isNull(toneIdx)) enrichment.put("tone", c.getString(toneIdx));
            int summaryIdx = c.getColumnIndex("semanticSummary");
            if (summaryIdx >= 0 && !c.isNull(summaryIdx)) enrichment.put("semanticSummary", c.getString(summaryIdx));
            int emotionIdx = c.getColumnIndex("primaryEmotion");
            if (emotionIdx >= 0 && !c.isNull(emotionIdx)) enrichment.put("primaryEmotion", c.getString(emotionIdx));
            int narrIdx = c.getColumnIndex("narrativeFrame");
            if (narrIdx >= 0 && !c.isNull(narrIdx)) enrichment.put("narrativeFrame", c.getString(narrIdx));
            int actorsIdx = c.getColumnIndex("enrichActors");
            if (actorsIdx >= 0 && !c.isNull(actorsIdx)) enrichment.put("politicalActors", c.getString(actorsIdx));
            int secTopicsIdx = c.getColumnIndex("enrichSecondaryTopics");
            if (secTopicsIdx >= 0 && !c.isNull(secTopicsIdx)) enrichment.put("secondaryTopics", c.getString(secTopicsIdx));
            int activismIdx = c.getColumnIndex("enrichActivism");
            if (activismIdx >= 0 && !c.isNull(activismIdx)) enrichment.put("activismSignal", c.getInt(activismIdx) == 1);
            int conflictIdx = c.getColumnIndex("enrichConflict");
            if (conflictIdx >= 0 && !c.isNull(conflictIdx)) enrichment.put("conflictSignal", c.getInt(conflictIdx) == 1);
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

    /**
     * Parse JSON array strings from a column, aggregate counts, return top N.
     * E.g. mainTopics: '["culture","humour"]' → {topic: "culture", count: 15}
     */
    private JSONArray aggregateJsonArrayField(SQLiteDatabase db, String column, int limit) throws JSONException {
        java.util.Map<String, Integer> counts = new java.util.LinkedHashMap<>();
        Cursor c = db.rawQuery(
                "SELECT " + column + " FROM post_enriched WHERE " + column + " IS NOT NULL AND " + column + " != '[]'", null);
        while (c.moveToNext()) {
            String jsonStr = c.getString(0);
            try {
                JSONArray arr = new JSONArray(jsonStr);
                for (int i = 0; i < arr.length(); i++) {
                    String val = arr.getString(i).trim().toLowerCase();
                    if (!val.isEmpty()) {
                        counts.put(val, counts.getOrDefault(val, 0) + 1);
                    }
                }
            } catch (Exception ignored) {}
        }
        c.close();

        // Sort by count desc
        java.util.List<java.util.Map.Entry<String, Integer>> sorted = new java.util.ArrayList<>(counts.entrySet());
        sorted.sort((a, b) -> b.getValue() - a.getValue());

        JSONArray result = new JSONArray();
        int i = 0;
        // Use "topic" as generic key name for compat with frontend
        for (java.util.Map.Entry<String, Integer> entry : sorted) {
            if (i++ >= limit) break;
            JSONObject item = new JSONObject();
            item.put("topic", entry.getKey());
            item.put("count", entry.getValue());
            // Also add domain alias for topDomains compat
            item.put("domain", entry.getKey());
            result.put(item);
        }
        return result;
    }

    /**
     * Extract a JSON array field as string.
     * Handles both JSONArray and pre-stringified JSON array values.
     */
    private static String jsonArrayToString(JSONObject obj, String key) {
        // Try as JSONArray first
        JSONArray arr = obj.optJSONArray(key);
        if (arr != null) return arr.toString();
        // Might be a pre-stringified JSON array (e.g. "[\"culture\"]")
        String str = obj.optString(key, "[]");
        if (str.startsWith("[")) return str;
        return "[]";
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
