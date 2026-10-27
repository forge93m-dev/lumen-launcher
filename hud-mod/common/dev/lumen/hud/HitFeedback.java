package dev.lumen.hud;

import java.util.Locale;

/**
 * What the last hit did: the target's health is watched for a moment after you attack it, and a drop shows as a number rising
 * from the crosshair and a small marker in a colour of your choice.
 */
public final class HitFeedback {
    private static final long WATCH_MS = 1500;
    private static final long MARKER_MS = 260;
    private static final long NUMBER_MS = 1100;

    private static Object watched;
    private static float health;
    private static long attackedAt;
    private static float damage;
    private static long hitAt;

    private HitFeedback() {}

    /** You attacked this entity, which has {@code healthNow} health. */
    public static void attacked(Object entity, float healthNow) {
        watched = entity;
        health = healthNow;
        attackedAt = System.currentTimeMillis();
    }

    /** The entity being watched, or null once it is no longer worth watching. */
    public static Object watching() {
        if (watched != null && System.currentTimeMillis() - attackedAt > WATCH_MS) watched = null;
        return watched;
    }

    /** Called every tick with the watched entity's current health. */
    public static void health(float now, boolean dead) {
        if (watched == null) return;
        float drop = dead ? Math.max(health, 0) : health - now;
        if (drop > 0.05f) {
            damage = drop;
            hitAt = System.currentTimeMillis();
            attackedAt = hitAt; // keep watching: the next hit often follows
        }
        health = dead ? 0 : now;
        if (dead) watched = null;
    }

    static void reset() {
        watched = null;
        hitAt = 0;
    }

    /** Draws the marker and the number around the crosshair at (cx, cy). */
    static void draw(Gfx g, HudConfig cfg, int cx, int cy, long now) {
        int color = cfg.hit();
        long age = now - hitAt;
        if (hitAt == 0 || age < 0) return;
        if (cfg.hitMarker && age < MARKER_MS) {
            double fade = 1 - age / (double) MARKER_MS;
            int c = Look.alpha(color, fade);
            int gap = 3 + (int) (age * 4 / MARKER_MS); // the ticks drift outwards as they fade
            for (int k = gap; k < gap + 5; k++) {
                for (int sx = -1; sx <= 1; sx += 2) {
                    for (int sy = -1; sy <= 1; sy += 2) g.fill(cx + sx * k - (sx > 0 ? 0 : 1), cy + sy * k - (sy > 0 ? 0 : 1), cx + sx * k + (sx > 0 ? 1 : 0), cy + sy * k + (sy > 0 ? 1 : 0), c);
                }
            }
        }
        if (cfg.damageNumbers && age < NUMBER_MS) {
            double t = age / (double) NUMBER_MS;
            String text = "-" + (damage == Math.floor(damage) ? String.valueOf((int) damage) : String.format(Locale.ROOT, "%.1f", damage));
            int rise = (int) Math.round(Math.sin(Math.min(1, t * 1.6) * Math.PI / 2) * 16);
            g.text(text, cx + 12, cy - 6 - rise, Look.alpha(color, t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4), true);
        }
    }

    /** Draws against the real clock; the game side calls this once a frame. */
    public static void draw(Gfx g, HudConfig cfg, int cx, int cy) {
        if (cfg.damageNumbers || cfg.hitMarker) draw(g, cfg, cx, cy, System.currentTimeMillis());
    }
}
