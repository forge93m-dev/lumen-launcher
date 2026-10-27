package dev.lumen.hud;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/** One-click looks: which elements are on, and the theme. Positions and sizes are left alone. */
public final class Presets {
    public static final String[] NAMES = {"Default", "PvP", "Survival", "Clean"};

    private Presets() {}

    public static void apply(int index) {
        HudConfig cfg = HudConfig.get();
        Set<String> on;
        switch (index) {
            case 1 -> {
                on = set("fps", "ping", "armor", "items", "reach", "combo", "target", "alert", "effects");
                cfg.theme = "flat";
            }
            case 2 -> {
                on = set("fps", "coords", "compass", "clock", "armor", "effects", "death", "alert", "target");
                cfg.theme = "glass";
            }
            case 3 -> {
                on = set("fps", "coords");
                cfg.theme = "minimal";
            }
            default -> {
                on = set("fps", "coords", "armor", "ping", "effects", "clock", "items", "target", "sprint", "death", "alert", "compass");
                cfg.theme = "glass";
            }
        }
        for (String id : HudConfig.IDS) cfg.el(id).enabled = on.contains(id);
    }

    private static Set<String> set(String... ids) {
        return new HashSet<>(Arrays.asList(ids));
    }
}
