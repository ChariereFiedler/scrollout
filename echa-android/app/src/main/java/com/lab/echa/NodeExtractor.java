package com.lab.echa;

import android.graphics.Rect;
import android.util.Log;
import android.view.accessibility.AccessibilityNodeInfo;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Recursively traverses the accessibility node tree and extracts
 * all relevant data: text, content descriptions (image alt-text),
 * resource IDs, class names, and bounds.
 */
public class NodeExtractor {

    private static final String TAG = "ECHA_EXTRACT";
    private static final int MAX_DEPTH = 30;

    /**
     * Traverse the full accessibility tree from root and return a JSON array
     * of all nodes that contain useful content.
     */
    public static JSONObject extractTree(AccessibilityNodeInfo root) {
        JSONObject result = new JSONObject();
        JSONArray nodes = new JSONArray();
        JSONArray imageDescriptions = new JSONArray();
        JSONArray posts = new JSONArray();

        try {
            traverseNode(root, 0, nodes, imageDescriptions, posts);
            result.put("nodeCount", nodes.length());
            result.put("nodes", nodes);
            result.put("imageDescriptions", imageDescriptions);
            result.put("posts", posts);
        } catch (JSONException e) {
            Log.e(TAG, "JSON error: " + e.getMessage());
        }

        return result;
    }

    private static void traverseNode(
            AccessibilityNodeInfo node,
            int depth,
            JSONArray allNodes,
            JSONArray imageDescriptions,
            JSONArray posts
    ) throws JSONException {
        if (node == null || depth > MAX_DEPTH) return;

        String text = node.getText() != null ? node.getText().toString() : "";
        String desc = node.getContentDescription() != null ? node.getContentDescription().toString() : "";
        String className = node.getClassName() != null ? node.getClassName().toString() : "";
        String resourceId = node.getViewIdResourceName() != null ? node.getViewIdResourceName() : "";

        // Only record nodes that have content
        boolean hasContent = !text.isEmpty() || !desc.isEmpty();

        if (hasContent) {
            JSONObject nodeObj = new JSONObject();
            nodeObj.put("text", text);
            nodeObj.put("desc", desc);
            nodeObj.put("class", className);
            nodeObj.put("resourceId", resourceId);
            nodeObj.put("depth", depth);
            nodeObj.put("clickable", node.isClickable());
            nodeObj.put("scrollable", node.isScrollable());

            // Bounds
            Rect bounds = new Rect();
            node.getBoundsInScreen(bounds);
            nodeObj.put("bounds", bounds.flattenToString());

            allNodes.put(nodeObj);

            // Detect image descriptions
            if (isImageNode(className) && !desc.isEmpty()) {
                imageDescriptions.put(desc);
            }

            // Also capture long content descriptions as potential image alt-text
            if (!desc.isEmpty() && desc.length() > 30 && !isNavigationDesc(desc)) {
                // Check if not already added
                boolean alreadyAdded = false;
                for (int i = 0; i < imageDescriptions.length(); i++) {
                    if (imageDescriptions.getString(i).equals(desc)) {
                        alreadyAdded = true;
                        break;
                    }
                }
                if (!alreadyAdded) {
                    imageDescriptions.put(desc);
                }
            }
        }

        // Recurse into children
        int childCount = node.getChildCount();
        for (int i = 0; i < childCount; i++) {
            AccessibilityNodeInfo child = node.getChild(i);
            if (child != null) {
                traverseNode(child, depth + 1, allNodes, imageDescriptions, posts);
                child.recycle();
            }
        }
    }

    private static boolean isImageNode(String className) {
        return className.contains("ImageView")
                || className.contains("image")
                || className.contains("Photo")
                || className.contains("DraweeView"); // Fresco (used by Instagram)
    }

    private static boolean isNavigationDesc(String desc) {
        String lower = desc.toLowerCase();
        return lower.equals("home")
                || lower.equals("reels")
                || lower.equals("profil")
                || lower.equals("rechercher et explorer")
                || lower.contains("envoyer un message")
                || lower.contains("story de")
                || lower.contains("ajouter à la story")
                || lower.contains("modifier le profil")
                || lower.contains("partager le profil");
    }
}
