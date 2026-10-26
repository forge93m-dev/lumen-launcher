package dev.lumen.hud;

import java.util.List;

/** The compass bar: a strip that scrolls with your heading, with waypoint markers on it. */
public final class Compass {
    public static final int WIDTH = 180;
    public static final int HEIGHT = 22;
    private static final double PX_PER_DEG = 1.5;
    private static final String[] POINTS = {"N", "NE", "E", "SE", "S", "SW", "W", "NW"};

    private Compass() {}

    /** Compass bearing (0 = north, 90 = east) of a Minecraft yaw (0 = south, 90 = west). */
    public static double bearing(double yaw) {
        return wrap(yaw + 180, 0, 360);
    }

    private static double wrap(double v, double lo, double hi) {
        double span = hi - lo;
        return ((v - lo) % span + span) % span + lo;
    }

    /** Bearing from (x, z) towards (tx, tz). */
    public static double bearingTo(double x, double z, double tx, double tz) {
        return wrap(Math.toDegrees(Math.atan2(tx - x, -(tz - z))), 0, 360);
    }

    public static void draw(Gfx g, HudConfig cfg, double yaw, double px, double pz, List<Waypoints.Point> wps) {
        Look.panel(g, cfg, WIDTH, HEIGHT);
        double facing = bearing(yaw);
        int cx = WIDTH / 2;
        g.clip(3, 0, WIDTH - 3, HEIGHT);
        for (int deg = (int) (Math.floor((facing - 62) / 15) * 15); deg <= facing + 62; deg += 15) {
            int x = cx + (int) Math.round((deg - facing) * PX_PER_DEG);
            int norm = (int) wrap(deg, 0, 360);
            if (norm % 45 == 0) {
                String label = POINTS[norm / 45];
                boolean cardinal = norm % 90 == 0;
                g.text(label, x - g.width(label) / 2, 3, cardinal ? cfg.accent() : cfg.text(), cfg.shadow);
            } else {
                g.fill(x, 6, x + 1, 9, Look.withAlpha(cfg.text(), 0x90));
            }
        }
        Waypoints.Point near = null;
        double nearDiff = 360;
        for (Waypoints.Point p : wps) {
            double rel = wrap(bearingTo(px, pz, p.x + 0.5, p.z + 0.5) - facing, -180, 180);
            if (Math.abs(rel) > 62) continue;
            int x = cx + (int) Math.round(rel * PX_PER_DEG);
            Look.round(g, x - 2, 13, 5, 5, 2, p.color);
            if (Math.abs(rel) < nearDiff) {
                nearDiff = Math.abs(rel);
                near = p;
            }
        }
        g.unclip();
        // heading marker and the name of the marker you are facing
        g.fill(cx, 10, cx + 1, 12, cfg.accent());
        if (near != null && nearDiff < 14) {
            int dist = (int) Math.round(Math.hypot(near.x + 0.5 - px, near.z + 0.5 - pz));
            String t = near.name + " " + dist + "m";
            int tw = g.width(t);
            Look.round(g, cx - tw / 2 - 3, 1, tw + 6, 11, 3, 0xF0101018);
            g.text(t, cx - tw / 2, 3, near.color | 0xFF000000, false);
        }
    }
}
