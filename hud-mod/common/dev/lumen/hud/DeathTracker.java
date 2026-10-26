package dev.lumen.hud;

/** Remembers where you died, so you can go back for your items. */
public final class DeathTracker {
    private static boolean wasDead;
    private static String last;

    private DeathTracker() {}

    /** Called every tick; returns a chat line once, right after respawning, otherwise null. */
    public static String tick(boolean dead, double x, double y, double z, String dimension) {
        String message = null;
        if (dead && !wasDead) last = (int) Math.floor(x) + " " + (int) Math.floor(y) + " " + (int) Math.floor(z) + (dimension.isEmpty() ? "" : " (" + dimension + ")");
        if (!dead && wasDead && last != null) message = "You died at " + last;
        wasDead = dead;
        return message;
    }

    /** "x y z (dimension)" of the last death this session, or null. */
    public static String last() {
        return last;
    }

    public static void reset() {
        wasDead = false;
    }
}
