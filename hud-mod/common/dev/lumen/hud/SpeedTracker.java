package dev.lumen.hud;

import java.util.Locale;

/** Horizontal speed in blocks per second, smoothed over a few ticks. */
public final class SpeedTracker {
    private static double lastX;
    private static double lastZ;
    private static double speed;
    private static boolean ready;

    private SpeedTracker() {}

    public static void tick(double x, double z) {
        if (ready) {
            double dx = x - lastX;
            double dz = z - lastZ;
            double now = Math.sqrt(dx * dx + dz * dz) * 20;
            // Teleports and dimension changes would show up as absurd speeds.
            speed = now > 200 ? 0 : speed * 0.6 + now * 0.4;
        }
        lastX = x;
        lastZ = z;
        ready = true;
    }

    public static void reset() {
        ready = false;
        speed = 0;
    }

    public static String text() {
        return String.format(Locale.ROOT, "%.1f", speed);
    }
}
