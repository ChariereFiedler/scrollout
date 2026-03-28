package com.lab.echa;

import android.graphics.Rect;
import android.util.Log;
import android.view.accessibility.AccessibilityNodeInfo;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Tracks which Instagram posts are visible on screen,
 * measures dwell time per post, and extracts structured post data.
 */
public class PostTracker {

    private static final String TAG = "ECHA_TRACK";

    // Currently visible post ID (username + first desc hash)
    private String currentPostId = "";
    private long currentPostStartTime = 0;

    // Session history: postId -> cumulative dwell time in ms
    private final Map<String, Long> dwellTimes = new LinkedHashMap<>();
    // Post metadata cache: postId -> structured data
    private final Map<String, JSONObject> postMetadata = new LinkedHashMap<>();

    /**
     * Detect which post is currently focused (center of screen)
     * and track time transitions.
     * @param updateDwell true pour CONTENT_CHANGED/STATE_CHANGED, false pour SCROLLED
     *                    (pendant le scroll, l'état visuel est transitoire)
     */
    public JSONObject analyzeScreen(AccessibilityNodeInfo root, int screenHeight) {
        return analyzeScreen(root, screenHeight, true);
    }

    public JSONObject analyzeScreen(AccessibilityNodeInfo root, int screenHeight, boolean updateDwell) {
        JSONObject result = new JSONObject();
        List<PostInfo> visiblePosts = findVisiblePosts(root, screenHeight);

        try {
            // Find the post closest to center of screen
            int centerY = screenHeight / 2;
            PostInfo centerPost = null;
            int minDist = Integer.MAX_VALUE;

            for (PostInfo post : visiblePosts) {
                int postCenterY = (post.bounds.top + post.bounds.bottom) / 2;
                int dist = Math.abs(postCenterY - centerY);
                if (dist < minDist) {
                    minDist = dist;
                    centerPost = post;
                }
            }

            // Track dwell time — seulement sur CONTENT_CHANGED/STATE_CHANGED
            // SCROLLED est ignoré car l'état visuel est transitoire pendant le scroll
            long now = System.currentTimeMillis();
            String newPostId = centerPost != null ? centerPost.postId : "";

            if (updateDwell && !newPostId.equals(currentPostId)) {
                // Post changed - record dwell time for previous post
                if (!currentPostId.isEmpty() && currentPostStartTime > 0) {
                    long elapsed = now - currentPostStartTime;
                    dwellTimes.merge(currentPostId, elapsed, Long::sum);
                }
                currentPostId = newPostId;
                currentPostStartTime = now;
            }

            // Build result
            JSONArray postsArray = new JSONArray();
            for (PostInfo post : visiblePosts) {
                postsArray.put(post.toJSON());
            }

            result.put("visiblePosts", postsArray);
            result.put("focusedPostId", newPostId);
            result.put("focusedPost", centerPost != null ? centerPost.toJSON() : JSONObject.NULL);

            // Dwell times snapshot — copie sans double-comptage
            JSONObject dwellSnapshot = new JSONObject();
            long currentElapsed = (!currentPostId.isEmpty() && currentPostStartTime > 0)
                    ? now - currentPostStartTime : 0;

            for (Map.Entry<String, Long> entry : dwellTimes.entrySet()) {
                dwellSnapshot.put(entry.getKey(), entry.getValue());
            }
            // Ajouter ou incrémenter le post actif avec le temps de la session en cours
            if (!currentPostId.isEmpty() && currentElapsed > 0) {
                long existing = dwellSnapshot.optLong(currentPostId, 0);
                dwellSnapshot.put(currentPostId, existing + currentElapsed);
            }
            result.put("dwellTimes", dwellSnapshot);

            // Store metadata for focused post
            if (centerPost != null) {
                postMetadata.put(centerPost.postId, centerPost.toJSON());
            }

            // Screen type detection
            result.put("screenType", detectScreenType(root));

        } catch (JSONException e) {
            Log.e(TAG, "JSON error: " + e.getMessage());
        }

        return result;
    }

    /**
     * Find all post containers visible on screen by looking for
     * Instagram's feed item patterns.
     */
    private List<PostInfo> findVisiblePosts(AccessibilityNodeInfo root, int screenHeight) {
        List<PostInfo> posts = new ArrayList<>();
        findPostsRecursive(root, posts, screenHeight, 0);
        return posts;
    }

    private void findPostsRecursive(AccessibilityNodeInfo node, List<PostInfo> posts,
                                     int screenHeight, int depth) {
        if (node == null || depth > 25) return;

        String resourceId = node.getViewIdResourceName() != null ? node.getViewIdResourceName() : "";

        // Instagram post username node - this marks a post container
        if (resourceId.contains("row_feed_photo_profile_name")) {
            PostInfo post = extractPostFromUsername(node, screenHeight);
            if (post != null) {
                posts.add(post);
            }
        }

        int childCount = node.getChildCount();
        for (int i = 0; i < childCount; i++) {
            AccessibilityNodeInfo child = node.getChild(i);
            if (child != null) {
                findPostsRecursive(child, posts, screenHeight, depth + 1);
                child.recycle();
            }
        }
    }

    /**
     * Given a username node, walk up/around the tree to extract full post data.
     */
    private PostInfo extractPostFromUsername(AccessibilityNodeInfo usernameNode, int screenHeight) {
        String username = usernameNode.getText() != null ? usernameNode.getText().toString().trim() : "";
        if (username.isEmpty()) return null;

        PostInfo post = new PostInfo();
        post.username = username;

        Rect bounds = new Rect();
        usernameNode.getBoundsInScreen(bounds);
        post.bounds = bounds;

        // Walk up to find the post container, then scan siblings
        AccessibilityNodeInfo parent = usernameNode.getParent();
        if (parent != null) {
            AccessibilityNodeInfo grandParent = parent.getParent();
            if (grandParent != null) {
                // Scan the post container for all content
                scanPostContainer(grandParent, post, 0);

                // Use grandparent bounds as post bounds
                Rect containerBounds = new Rect();
                grandParent.getBoundsInScreen(containerBounds);
                if (containerBounds.height() > 100) {
                    post.bounds = containerBounds;
                }
                grandParent.recycle();
            }
            parent.recycle();
        }

        // Generate stable post ID
        post.postId = username + "|" + post.imageDescription.hashCode();

        return post;
    }

    private void scanPostContainer(AccessibilityNodeInfo node, PostInfo post, int depth) {
        if (node == null || depth > 15) return;

        String text = node.getText() != null ? node.getText().toString() : "";
        String desc = node.getContentDescription() != null ? node.getContentDescription().toString() : "";
        String resourceId = node.getViewIdResourceName() != null ? node.getViewIdResourceName() : "";
        String className = node.getClassName() != null ? node.getClassName().toString() : "";

        // Caption
        if (resourceId.contains("row_feed_comment_textview") ||
            (text.contains(post.username) && text.length() > post.username.length() + 5 && post.caption.isEmpty())) {
            post.caption = text;
        }

        // Image description (the main photo/video description)
        if (resourceId.contains("row_feed_photo_imageview") && !desc.isEmpty()) {
            post.imageDescription = desc;
        }
        // Also catch DraweeView / ImageView with long descriptions
        if ((className.contains("ImageView") || className.contains("FrameLayout"))
                && desc.length() > 40 && post.imageDescription.isEmpty()) {
            post.imageDescription = desc;
        }

        // Likes
        if (resourceId.contains("row_feed_button_like") ||
            (desc.toLowerCase().contains("j'aime") && !desc.toLowerCase().contains("ajouter"))) {
            // The like count is usually a sibling text node
        }
        // Like count (standalone number near like button)
        if (text.matches("[\\d\\s]+") && !text.trim().isEmpty()) {
            Rect b = new Rect();
            node.getBoundsInScreen(b);
            // Heuristic: like counts are typically in the engagement row
            if (post.likeCount.isEmpty() && resourceId.isEmpty() && b.top > post.bounds.top) {
                post.likeCount = text.trim();
            }
        }

        // Comments
        if (resourceId.contains("row_feed_button_comment")) {
            post.hasComments = true;
        }

        // Date/time
        if (text.matches(".*\\d+.*") && (text.contains("mars") || text.contains("février") ||
            text.contains("janvier") || text.contains("avril") || text.contains("mai") ||
            text.contains("juin") || text.contains("juil") || text.contains("août") ||
            text.contains("sept") || text.contains("oct") || text.contains("nov") ||
            text.contains("déc") || text.contains("il y a") || text.contains("hier") ||
            text.contains("ago") || text.contains("hour") || text.contains("day"))) {
            post.date = text.trim();
        }
        if (desc.matches(".*\\d+.*") && (desc.contains("mars") || desc.contains("il y a") ||
            desc.contains("février") || desc.contains("hier"))) {
            if (post.date.isEmpty()) post.date = desc.trim();
        }

        // Media type from descriptions
        if (desc.contains("video") || desc.contains("Reel")) {
            post.mediaType = "video";
        } else if (desc.contains("carousel") || desc.contains("Photo 1 de")) {
            post.mediaType = "carousel";
            // Extract photo count
            java.util.regex.Matcher m = java.util.regex.Pattern.compile("Photo \\d+ de (\\d+)").matcher(desc);
            if (m.find()) post.carouselCount = Integer.parseInt(m.group(1));
        } else if (desc.contains("Photo de") || desc.contains("photo")) {
            post.mediaType = "photo";
        }

        // Sponsored
        if (text.equals("Sponsorisé") || desc.equals("Sponsorisé")) {
            post.isSponsored = true;
        }

        // Secondary label (e.g. "Suggestions")
        if (resourceId.contains("secondary_label")) {
            post.isSuggested = true;
        }

        int childCount = node.getChildCount();
        for (int i = 0; i < childCount; i++) {
            AccessibilityNodeInfo child = node.getChild(i);
            if (child != null) {
                scanPostContainer(child, post, depth + 1);
                child.recycle();
            }
        }
    }

    private String detectScreenType(AccessibilityNodeInfo root) {
        // Quick scan for screen type indicators
        return scanForScreenType(root, 0);
    }

    private String scanForScreenType(AccessibilityNodeInfo node, int depth) {
        if (node == null || depth > 10) return "unknown";

        String resourceId = node.getViewIdResourceName() != null ? node.getViewIdResourceName() : "";

        if (resourceId.contains("profile_header")) return "profile";
        if (resourceId.contains("row_feed_photo_profile_name")) return "feed";
        if (resourceId.contains("clips_tab") && depth < 5) return "reels";

        int childCount = node.getChildCount();
        for (int i = 0; i < childCount; i++) {
            AccessibilityNodeInfo child = node.getChild(i);
            if (child != null) {
                String result = scanForScreenType(child, depth + 1);
                child.recycle();
                if (!"unknown".equals(result)) return result;
            }
        }
        return "unknown";
    }

    /**
     * Get session summary with all dwell times.
     */
    public JSONObject getSessionSummary() {
        JSONObject summary = new JSONObject();
        try {
            long now = System.currentTimeMillis();

            // Finalize current post timing
            if (!currentPostId.isEmpty() && currentPostStartTime > 0) {
                dwellTimes.merge(currentPostId, now - currentPostStartTime, Long::sum);
                currentPostStartTime = now;
            }

            JSONArray postSummaries = new JSONArray();
            for (Map.Entry<String, Long> entry : dwellTimes.entrySet()) {
                JSONObject ps = new JSONObject();
                ps.put("postId", entry.getKey());
                ps.put("dwellTimeMs", entry.getValue());
                ps.put("dwellTimeSec", entry.getValue() / 1000.0);
                if (postMetadata.containsKey(entry.getKey())) {
                    ps.put("metadata", postMetadata.get(entry.getKey()));
                }
                postSummaries.put(ps);
            }

            summary.put("totalPostsViewed", dwellTimes.size());
            summary.put("posts", postSummaries);

        } catch (JSONException e) {
            Log.e(TAG, "Summary error: " + e.getMessage());
        }
        return summary;
    }

    static class PostInfo {
        String postId = "";
        String username = "";
        String caption = "";
        String imageDescription = "";
        String likeCount = "";
        String commentCount = "";
        String date = "";
        String mediaType = "photo";
        int carouselCount = 0;
        boolean hasComments = false;
        boolean isSponsored = false;
        boolean isSuggested = false;
        Rect bounds = new Rect();

        JSONObject toJSON() throws JSONException {
            JSONObject obj = new JSONObject();
            obj.put("postId", postId);
            obj.put("username", username);
            obj.put("caption", caption);
            obj.put("imageDescription", imageDescription);
            obj.put("likeCount", likeCount);
            obj.put("date", date);
            obj.put("mediaType", mediaType);
            if (carouselCount > 0) obj.put("carouselCount", carouselCount);
            obj.put("isSponsored", isSponsored);
            obj.put("isSuggested", isSuggested);
            obj.put("boundsTop", bounds.top);
            obj.put("boundsBottom", bounds.bottom);
            return obj;
        }
    }
}
