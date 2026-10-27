package dev.lumen.hud;

import java.util.ArrayList;
import java.util.List;

/**
 * The minimap: a top-down picture of the blocks around you. The world is read column by column into a ring buffer a little at a
 * time (see {@link #tick}); every frame the picture is composed from it, which keeps the map smooth while you walk and lets it turn
 * with you. Nothing here knows about Minecraft: the game side supplies a {@link Source}.
 */
public final class Minimap {
    /** Side of the map in drawing units, without its frame. */
    public static final int SIDE = 84;
    private static final int PAD = 3;
    private static final int G = 192;

    /** What the game side tells the map about the world. */
    interface Source {
        boolean ready();

        /** Changes when you enter another world or dimension, so the old picture is thrown away. */
        Object world();

        boolean hasCeiling();

        /**
         * Reads one column: {@code out[0]} the colour (0xRRGGBB) of the topmost block that shows on a map, or -1 for none,
         * {@code out[1]} its height, {@code out[2]} how deep the liquid above it is. False while the chunk is not loaded.
         */
        boolean column(int x, int z, int fromY, int[] out);

        /** Nearby living things as {x, z, kind}: 0 another player, 1 hostile, 2 anything else. */
        void entities(List<double[]> out, double px, double pz, double radius);
    }

    private static final int[] COLOR = new int[G * G];
    private static final int[] HEIGHT = new int[G * G];
    private static final int[] CX = new int[G * G];
    private static final int[] CZ = new int[G * G];
    private static final int[] COLUMN = new int[3];
    private static Object world;
    private static int nearAt;
    private static int farAt;
    private static int[] picture = new int[0];

    private Minimap() {}

    private static int index(int x, int z) {
        return Math.floorMod(z, G) * G + Math.floorMod(x, G);
    }

    private static void forget() {
        java.util.Arrays.fill(CX, Integer.MIN_VALUE);
        java.util.Arrays.fill(CZ, Integer.MIN_VALUE);
        nearAt = farAt = 0;
    }

    /** Reads a few hundred columns around the player; called every client tick. */
    static void tick(Source s, double px, double py, double pz) {
        if (!s.ready()) return;
        if (s.world() != world) {
            world = s.world();
            forget();
        }
        int fromY = s.hasCeiling() ? (int) py + 3 : Integer.MAX_VALUE; // open sky: the height map tells where the top is
        int nx = (int) Math.floor(px) - 32, nz = (int) Math.floor(pz) - 32;
        for (int k = 0; k < 1100; k++) {
            int p = nearAt++ % 4096;
            sample(s, nx + p % 64, nz + p / 64, fromY);
        }
        int ox = (int) Math.floor(px) - G / 2, oz = (int) Math.floor(pz) - G / 2;
        for (int k = 0; k < 500; k++) {
            int p = farAt++ % (G * G);
            sample(s, ox + p % G, oz + p / G, fromY);
        }
    }

    private static void sample(Source s, int x, int z, int fromY) {
        if (!s.column(x, z, fromY, COLUMN)) return;
        int i = index(x, z);
        CX[i] = x;
        CZ[i] = z;
        int rgb = COLUMN[0];
        if (rgb < 0) {
            COLOR[i] = 0;
            HEIGHT[i] = COLUMN[1];
            return;
        }
        double m;
        if (COLUMN[2] > 0) {
            m = 0.95 - Math.min(COLUMN[2], 12) * 0.035; // deeper water is darker
        } else {
            int n = index(x, z - 1);
            int north = CX[n] == x && CZ[n] == z - 1 ? HEIGHT[n] : COLUMN[1];
            m = 0.88 + Math.max(-0.2, Math.min(0.14, (COLUMN[1] - north) * 0.07)); // slopes facing the light are brighter
        }
        int r = (int) Math.min(255, ((rgb >> 16) & 0xFF) * m);
        int g = (int) Math.min(255, ((rgb >> 8) & 0xFF) * m);
        int b = (int) Math.min(255, (rgb & 0xFF) * m);
        COLOR[i] = 0xFF000000 | (r << 16) | (g << 8) | b;
        HEIGHT[i] = COLUMN[1];
    }

    /** The map as pixels: {@code p}x{@code p}, covering {@code radius} blocks around the player, turned by {@code turn} radians. */
    static int[] compose(int p, double radius, double px, double pz, double turn, boolean circle) {
        if (picture.length != p * p) picture = new int[p * p];
        double cos = Math.cos(turn), sin = Math.sin(turn);
        double half = p / 2.0;
        double corner = p * 0.16;
        for (int j = 0; j < p; j++) {
            for (int i = 0; i < p; i++) {
                double dx = i + 0.5 - half, dy = j + 0.5 - half;
                double edge;
                if (circle) {
                    edge = half - Math.hypot(dx, dy);
                } else {
                    double qx = Math.abs(dx) - (half - corner), qy = Math.abs(dy) - (half - corner);
                    edge = -(Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - corner);
                }
                if (edge < -0.5) {
                    picture[j * p + i] = 0;
                    continue;
                }
                double u = dx / half * radius, v = dy / half * radius;
                double wx = px + u * cos - v * sin, wz = pz + u * sin + v * cos;
                int x = (int) Math.floor(wx), z = (int) Math.floor(wz);
                int c = index(x, z);
                int color = CX[c] == x && CZ[c] == z && COLOR[c] != 0 ? COLOR[c] : 0xFF14141C; // not read yet: dark
                double a = Math.max(0, Math.min(1, edge + 0.5));
                picture[j * p + i] = a >= 1 ? color : (Math.round(255 * (float) a) << 24) | (color & 0xFFFFFF);
            }
        }
        return picture;
    }

    public static int width(HudConfig cfg) {
        return SIDE + PAD * 2;
    }

    public static int height(HudConfig cfg) {
        return SIDE + PAD * 2 + (cfg.minimapCoords ? 12 : 0);
    }

    private static final List<double[]> THINGS = new ArrayList<>();

    /** Draws the map, its frame, the things on it and the arrow for you. {@code yaw} is Minecraft's (0 faces south). */
    static void draw(Gfx g, HudConfig cfg, Source s, double px, double py, double pz, double yaw, List<Waypoints.Point> wps) {
        boolean circle = !"square".equals(cfg.minimapShape);
        int radius = Math.max(16, Math.min(64, cfg.minimapZoom));
        double turn = cfg.minimapRotate ? Math.toRadians(yaw + 180) : 0;
        int sc = g.scale();
        int p = SIDE * sc;
        int x0 = PAD, y0 = PAD;
        int accent = cfg.accent();
        if (cfg.background) Look.round(g, 0, 0, SIDE + PAD * 2, SIDE + PAD * 2, circle ? (SIDE + PAD * 2) / 2 : 7, Look.withAlpha(0xFF0B0B12, (int) (255 * Math.min(1, cfg.bgOpacity + 0.2))));
        int[] img = compose(p, radius, px, pz, turn, circle);
        int tex = g.dynamicTexture("minimap" + p, p, p);
        if (tex >= 0) {
            g.updateTexture(tex, img);
            g.blit(tex, x0, y0, SIDE, SIDE, 0xFFFFFFFF);
        } else {
            g.pixels(img, p, p, x0, y0);
        }
        Smooth.frame(g, x0 - 1, y0 - 1, SIDE + 2, SIDE + 2, circle ? (SIDE + 2) / 2 : 7, 2, Look.withAlpha(accent, 0xE0));

        double scale = (SIDE / 2.0) / radius;
        double cx = x0 + SIDE / 2.0, cy = y0 + SIDE / 2.0;
        double cos = Math.cos(-turn), sin = Math.sin(-turn);
        double limit = SIDE / 2.0 - 3;
        if (cfg.minimapWaypoints && wps != null) {
            for (Waypoints.Point w : wps) {
                double dx = (w.x + 0.5 - px) * scale, dz = (w.z + 0.5 - pz) * scale;
                double sx = dx * cos - dz * sin, sy = dx * sin + dz * cos;
                double d = Math.hypot(sx, sy);
                if (d > limit) {
                    sx *= limit / d;
                    sy *= limit / d;
                }
                dot(g, cx + sx, cy + sy, 5, w.color, 0xFF000000);
            }
        }
        if (cfg.minimapMobs || cfg.minimapPlayers) {
            THINGS.clear();
            s.entities(THINGS, px, pz, radius * 1.05);
            for (double[] e : THINGS) {
                int kind = (int) e[2];
                if (kind == 0 ? !cfg.minimapPlayers : !cfg.minimapMobs) continue;
                double dx = (e[0] - px) * scale, dz = (e[1] - pz) * scale;
                double sx = dx * cos - dz * sin, sy = dx * sin + dz * cos;
                if (Math.hypot(sx, sy) > limit) continue;
                dot(g, cx + sx, cy + sy, kind == 0 ? 5 : 4, kind == 0 ? 0xFF60A5FA : kind == 1 ? 0xFFEF4444 : 0xFF86EFAC, 0xCC000000);
            }
        }
        // you: an arrow that points where you look
        double facing = cfg.minimapRotate ? 0 : Math.toDegrees(Math.toRadians(yaw + 180));
        Icons.rotated(g, "pointer", (int) Math.round(cx - 6), (int) Math.round(cy - 6), 12, 0xFFFFFFFF, facing);
        // north
        double nAngle = -turn;
        double nx = cx + Math.sin(nAngle) * (SIDE / 2.0 + 1), ny = cy - Math.cos(nAngle) * (SIDE / 2.0 + 1);
        int nw = g.width("N");
        Look.round(g, (int) Math.round(nx - nw / 2.0 - 3), (int) Math.round(ny - 6), nw + 6, 12, 6, Look.withAlpha(0xFF0B0B12, 0xE0));
        g.text("N", (int) Math.round(nx - nw / 2.0), (int) Math.round(ny - 4), accent, false);
        if (cfg.minimapCoords) {
            String t = (int) Math.floor(px) + "  " + (int) Math.floor(py) + "  " + (int) Math.floor(pz);
            g.text(t, (SIDE + PAD * 2 - g.width(t)) / 2, SIDE + PAD * 2 + 1, cfg.text(), cfg.shadow);
        }
    }

    private static void dot(Gfx g, double x, double y, int size, int color, int outline) {
        int ix = (int) Math.round(x - size / 2.0), iy = (int) Math.round(y - size / 2.0);
        Look.round(g, ix - 1, iy - 1, size + 2, size + 2, (size + 2) / 2, outline);
        Look.round(g, ix, iy, size, size, size / 2, color);
    }
}
