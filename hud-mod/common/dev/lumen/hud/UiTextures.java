package dev.lumen.hud;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Remembers which small pictures (corners, icons) the game already has as textures. Pure bookkeeping, no game classes. */
final class UiTextures {
    static final int UNKNOWN = -2;
    static final int FAILED = -1;

    private static final Map<String, Integer> KEYS = new HashMap<>();
    private static final List<int[]> SIZES = new ArrayList<>();

    private UiTextures() {}

    static int lookup(String key) {
        return KEYS.getOrDefault(key, UNKNOWN);
    }

    static int add(String key, int w, int h) {
        SIZES.add(new int[]{w, h});
        KEYS.put(key, SIZES.size() - 1);
        return SIZES.size() - 1;
    }

    static int count() {
        return SIZES.size();
    }

    static void failed(String key) {
        KEYS.put(key, FAILED);
    }

    static int[] size(int handle) {
        return SIZES.get(handle);
    }

    static String path(int handle) {
        return "ui/t" + handle;
    }
}
