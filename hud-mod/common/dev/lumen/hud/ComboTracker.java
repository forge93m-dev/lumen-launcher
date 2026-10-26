package dev.lumen.hud;

/** Hits in a row: it grows with every hit and ends when you are hurt or 3 seconds pass without a hit. */
public final class ComboTracker {
    private static final long WINDOW_MS = 3000;
    private static int combo;
    private static long lastHit;

    private ComboTracker() {}

    public static void hit() {
        long now = System.currentTimeMillis();
        combo = now - lastHit > WINDOW_MS ? 1 : combo + 1;
        lastHit = now;
    }

    public static void tick(boolean hurt) {
        if (hurt || (combo > 0 && System.currentTimeMillis() - lastHit > WINDOW_MS)) combo = 0;
    }

    public static String text() {
        return String.valueOf(combo);
    }
}
