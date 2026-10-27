package dev.lumen.hud;

import java.util.HashMap;
import java.util.Map;
import java.util.function.LongSupplier;

/** Frame timing and eased values for the menu's small motions: opening, page changes, switches, hovers. */
final class Motion {
    /** Milliseconds; tests swap in their own clock. */
    static LongSupplier clock = System::currentTimeMillis;
    /** The dev preview and layout tests want finished frames: every value snaps to its target. */
    static boolean frozen;

    private final Map<Object, Double> values = new HashMap<>();
    private long last;
    double dt;

    /** Call once per frame. Long pauses (a stalled frame, a closed menu) count as a short one. */
    void tick() {
        long now = clock.getAsLong();
        dt = last == 0 || frozen ? 0 : Math.min(0.05, (now - last) / 1000.0);
        last = now;
    }

    /** Moves the value stored under {@code key} towards {@code target}, at most {@code perSecond} per second. A new key starts at its target. */
    double ease(Object key, double target, double perSecond) {
        double v = frozen ? target : values.getOrDefault(key, target);
        if (v < target) v = Math.min(target, v + perSecond * dt);
        else if (v > target) v = Math.max(target, v - perSecond * dt);
        values.put(key, v);
        return smooth(v);
    }

    static double smooth(double t) {
        t = Math.max(0, Math.min(1, t));
        return t * t * (3 - 2 * t);
    }

    /** Wraps a {@link Gfx} so everything drawn through it fades by {@code alpha}. */
    static final class Fade implements Gfx {
        private final Gfx base;
        private final double alpha;

        Fade(Gfx base, double alpha) {
            this.base = base;
            this.alpha = alpha;
        }

        @Override
        public void fill(int x1, int y1, int x2, int y2, int argb) {
            base.fill(x1, y1, x2, y2, Look.alpha(argb, alpha));
        }

        @Override
        public void text(String s, int x, int y, int argb, boolean shadow) {
            base.text(s, x, y, Look.alpha(argb, alpha), shadow);
        }

        @Override
        public int scale() {
            return base.scale();
        }

        @Override
        public void pixels(int[] argb, int w, int h, int x, int y) {
            int[] faded = new int[argb.length];
            for (int i = 0; i < faded.length; i++) faded[i] = Look.alpha(argb[i], alpha);
            base.pixels(faded, w, h, x, y);
        }

        @Override
        public int width(String s) {
            return base.width(s);
        }

        @Override
        public void clip(int x1, int y1, int x2, int y2) {
            base.clip(x1, y1, x2, y2);
        }

        @Override
        public void unclip() {
            base.unclip();
        }
    }
}
