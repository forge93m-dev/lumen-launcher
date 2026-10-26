package dev.lumen.hud;

/** Small values the HUD shows that do not depend on the Minecraft version. */
public final class Stats {
    private static final long START = System.currentTimeMillis();

    private Stats() {}

    public static String memory(boolean showMax) {
        Runtime r = Runtime.getRuntime();
        long used = (r.totalMemory() - r.freeMemory()) >> 20;
        return showMax ? used + "/" + (r.maxMemory() >> 20) : String.valueOf(used);
    }

    /** Time since the game started, like 1:05:09 or 12:30. */
    public static String session() {
        long s = (System.currentTimeMillis() - START) / 1000;
        return s >= 3600 ? String.format(java.util.Locale.ROOT, "%d:%02d:%02d", s / 3600, s / 60 % 60, s % 60)
                : String.format(java.util.Locale.ROOT, "%d:%02d", s / 60, s % 60);
    }

    /** Health as hearts-like text, e.g. 14.5/20. */
    public static String health(float hp, float max) {
        return trim(hp) + "/" + trim(max);
    }

    private static String trim(float v) {
        return v == Math.floor(v) ? String.valueOf((int) v) : String.format(java.util.Locale.ROOT, "%.1f", v);
    }
}
