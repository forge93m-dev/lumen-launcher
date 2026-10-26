package dev.lumen.hud;

/** Eases the field of view between normal and zoomed, once per frame. */
public final class ZoomAnim {
    private static double current = -1;
    private static long last = System.nanoTime();

    private ZoomAnim() {}

    /**
     * @param zooming  the zoom key is held
     * @param base     the player's normal FOV
     * @param zoomFov  the FOV while zoomed
     * @param smooth   ease instead of jumping
     * @return the FOV to set now, or -1 when the zoom is over and the base value should be restored
     */
    public static int step(boolean zooming, int base, int zoomFov, boolean smooth) {
        long now = System.nanoTime();
        double dt = Math.min(0.1, (now - last) / 1e9);
        last = now;
        if (current < 0) {
            if (!zooming) return -1;
            current = base;
        }
        double target = zooming ? zoomFov : base;
        current = smooth ? current + (target - current) * (1 - Math.exp(-dt * 14)) : target;
        if (!zooming && Math.abs(current - base) < 0.6) {
            current = -1;
            return -1;
        }
        return (int) Math.round(current);
    }

    public static boolean active() {
        return current >= 0;
    }

    public static void reset() {
        current = -1;
    }
}
