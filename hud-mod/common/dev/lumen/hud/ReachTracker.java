package dev.lumen.hud;

import java.util.Locale;

/** Distance of the last hit: from your eyes to the nearest point of the target's hit box. */
public final class ReachTracker {
    private static double last = -1;

    private ReachTracker() {}

    public static void record(double ex, double ey, double ez, double minX, double minY, double minZ, double maxX, double maxY, double maxZ) {
        double dx = Math.max(Math.max(minX - ex, 0), ex - maxX);
        double dy = Math.max(Math.max(minY - ey, 0), ey - maxY);
        double dz = Math.max(Math.max(minZ - ez, 0), ez - maxZ);
        last = Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    public static String text() {
        return last < 0 ? "-" : String.format(Locale.ROOT, "%.2f", last);
    }
}
