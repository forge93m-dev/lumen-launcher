package dev.lumen.hud;

import java.util.HashMap;
import java.util.Map;

/** Per-frame easing for things that should fade instead of flip (pressed keys, ...). */
public final class Anim {
    private static final Map<String, Double> VALUES = new HashMap<>();
    private static long last = System.nanoTime();
    private static double dt;
    private static long frameStamp;

    private Anim() {}

    /** Call once per rendered frame so every animation sees the same time step. */
    public static void frame() {
        long now = System.nanoTime();
        dt = Math.min(0.1, (now - last) / 1e9);
        last = now;
        frameStamp++;
    }

    /** Moves the named value towards 1 (on) or 0 (off) at {@code perSecond} and returns it. */
    public static double ease(String key, boolean on, double perSecond) {
        double v = VALUES.getOrDefault(key, on ? 1.0 : 0.0);
        double target = on ? 1 : 0;
        double step = perSecond * dt;
        v = v < target ? Math.min(target, v + step) : Math.max(target, v - step);
        VALUES.put(key, v);
        return v;
    }
}
