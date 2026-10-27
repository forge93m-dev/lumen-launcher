package dev.lumen.hud;

import java.util.HashMap;
import java.util.Map;

/**
 * Menu icons drawn as vector shapes on a 16x16 grid, so they stay smooth at any size. Each icon is a list of shapes in order:
 * {@code c x y r} disc, {@code o x y r w} ring, {@code r x y w h radius} rounded box, {@code l x1 y1 x2 y2 w} line with round
 * ends, {@code p x y x y ...} polygon. A leading minus ({@code -c ...}) cuts the shape out of what is already there.
 */
public final class Icons {
    private static final Map<String, String> ICONS = new HashMap<>();
    private static final Map<String, float[]> MASKS = new HashMap<>();

    static {
        def("grid", "r 2 2 5 5 1.6; r 9 2 5 5 1.6; r 2 9 5 5 1.6; r 9 9 5 5 1.6");
        def("palette", "c 8 8 6.6; -c 5.2 6.2 1.3; -c 8.8 4.8 1.3; -c 11.4 8 1.3; -c 7.4 11.4 1.9");
        def("hanger", "o 8 4.2 1.9 1.3; l 8 6 8 8 1.3; l 8 8 2 12.6 1.4; l 8 8 14 12.6 1.4; l 2 12.6 14 12.6 1.4");
        def("gear", "l 8 1.6 8 4 2.4; l 8 12 8 14.4 2.4; l 1.6 8 4 8 2.4; l 12 8 14.4 8 2.4; l 3.5 3.5 5.3 5.3 2.4; l 10.7 10.7 12.5 12.5 2.4; l 12.5 3.5 10.7 5.3 2.4; l 3.5 12.5 5.3 10.7 2.4; c 8 8 4.8; -c 8 8 2");
        def("bolt", "p 9.4 1 3.5 9 7.6 9 6.4 15 12.8 6.6 8.6 6.6");
        def("signal", "r 2 10 3 4 1; r 6.5 7 3 7 1; r 11 3 3 11 1");
        def("pin", "c 8 6 4.6; p 3.9 8.4 12.1 8.4 8 15; -c 8 6 1.8");
        def("compass", "o 8 8 6 1.4; p 8 3.6 9.8 8 8 12.4 6.2 8; -c 8 8 1");
        def("keys", "r 2 3 3.6 3.6 1; r 6.2 3 3.6 3.6 1; r 10.4 3 3.6 3.6 1; r 2 8 12 3.6 1; r 4.5 12.6 7 1.8 .9");
        def("shield", "p 8 1.5 13.8 3.5 13.8 8 8 14.6 2.2 8 2.2 3.5; -l 5.4 8 7.4 10 1.3; -l 7.4 10 10.6 5.8 1.3");
        def("flask", "p 6 1.5 10 1.5 10 6 14 12.8 13 14.5 3 14.5 2 12.8 6 6; -l 4.8 10.6 11.2 10.6 1");
        def("bag", "o 8 5.4 2.6 1.3; r 2.5 5.6 11 8.9 2; -c 8 10 1.2");
        def("target", "o 8 8 5.4 1.3; l 8 1 8 4.4 1.3; l 8 11.6 8 15 1.3; l 1 8 4.4 8 1.3; l 11.6 8 15 8 1.3; c 8 8 1.3");
        def("warn", "p 8 1.6 14.8 14 1.2 14; -l 8 6 8 9.6 1.4; -c 8 11.9 .9");
        def("skull", "c 8 7 5.6; r 5 10 6 4.6 1.5; -c 5.8 7.4 1.5; -c 10.2 7.4 1.5; -l 8 9.8 8 11.4 .8");
        def("ruler", "r 1.5 4.8 13 6.4 1.3; -l 4 4.8 4 7.6 1; -l 6.6 4.8 6.6 8.4 1; -l 9.2 4.8 9.2 7.6 1; -l 11.8 4.8 11.8 8.4 1");
        def("flame", "p 8 1 11.6 5.6 13 9.2 11.6 13.4 8 15 4.4 13.4 3 9.2 5 6.2 6.6 7.6; -c 8 11.6 2.1");
        def("arrow", "p 8 1.8 13.6 8 10 8 10 14 6 14 6 8 2.4 8");
        def("clock", "o 8 8 6.2 1.4; l 8 4.4 8 8 1.3; l 8 8 10.6 9.6 1.3");
        def("hourglass", "p 3.5 1.8 12.5 1.8 12.5 3.4 9 8 12.5 12.6 12.5 14.2 3.5 14.2 3.5 12.6 7 8 3.5 3.4");
        def("chip", "r 4 4 8 8 1.6; l 6.2 1.5 6.2 4 1.2; l 9.8 1.5 9.8 4 1.2; l 6.2 12 6.2 14.5 1.2; l 9.8 12 9.8 14.5 1.2; l 1.5 6.2 4 6.2 1.2; l 1.5 9.8 4 9.8 1.2; l 12 6.2 14.5 6.2 1.2; l 12 9.8 14.5 9.8 1.2; -c 8 8 1.4");
        def("server", "r 2 2.4 12 4.8 1.6; r 2 8.8 12 4.8 1.6; -c 4.8 4.8 .8; -c 4.8 11.2 .8");
        def("boot", "p 5 1.8 10.2 1.8 10.2 8.6 14.6 10.8 14.6 14.2 2.6 14.2 2.6 10.6 5 8.4");
        def("eye", "p 1 8 4.2 4.8 8 3.4 11.8 4.8 15 8 11.8 11.2 8 12.6 4.2 11.2; -c 8 8 2.8; c 8 8 1.4");
        def("sun", "c 8 8 3.3; l 8 1.6 8 3.4 1.4; l 8 12.6 8 14.4 1.4; l 1.6 8 3.4 8 1.4; l 12.6 8 14.4 8 1.4; l 3.5 3.5 4.8 4.8 1.4; l 11.2 11.2 12.5 12.5 1.4; l 12.5 3.5 11.2 4.8 1.4; l 3.5 12.5 4.8 11.2 1.4");
        def("zoom", "o 6.8 6.8 4.6 1.6; l 10.4 10.4 14 14 2");
        def("cursor", "p 3 1.8 3 13.2 6.2 10.2 8.4 14.6 10.6 13.6 8.4 9.4 12.4 9.4");
        def("sneak", "c 8.4 3 1.9; l 8.2 5.4 7.6 9.4 2.2; l 7.6 9.4 4.8 13.4 1.7; l 7.6 9.4 10.8 13.4 1.7; l 8 6.4 5 8.6 1.5; l 8 6.4 11 8.4 1.5");
        def("back", "l 12.8 8 3.6 8 1.9; l 3.6 8 7.8 3.8 1.9; l 3.6 8 7.8 12.2 1.9");
        def("check", "l 3 8.6 6.6 12.2 2.1; l 6.6 12.2 13 4.6 2.1");
        def("cape", "p 5.2 1.8 10.8 1.8 13.6 14.2 2.4 14.2; -r 6.4 1.2 3.2 2.2 1.1; -l 8 5 8 12 .8");
    }

    private Icons() {}

    private static void def(String name, String shapes) {
        ICONS.put(name, shapes);
    }

    public static boolean has(String name) {
        return ICONS.containsKey(name);
    }

    /** Draws the icon with its top-left corner at (x, y); it is {@code 8 * scale} units wide. */
    public static void draw(Gfx g, String name, int x, int y, int color, int scale) {
        size(g, name, x, y, color, 8 * scale);
    }

    /** Draws the icon {@code units} drawing units wide. */
    public static void size(Gfx g, String name, int x, int y, int color, int units) {
        if (!ICONS.containsKey(name)) return;
        int s = g.scale();
        int size = units * s;
        float[] mask = MASKS.computeIfAbsent(name + "|" + size, k -> rasterize(ICONS.get(name), size));
        int alpha = color >>> 24;
        int rgb = color & 0xFFFFFF;
        int[] px = new int[size * size];
        for (int i = 0; i < px.length; i++) px[i] = mask[i] <= 0 ? 0 : (Math.round(alpha * mask[i]) << 24) | rgb;
        g.pixels(px, size, size, x, y);
    }

    private static float[] rasterize(String shapes, int size) {
        String[] parts = shapes.split(";");
        char[] kind = new char[parts.length];
        boolean[] cut = new boolean[parts.length];
        double[][] arg = new double[parts.length][];
        for (int i = 0; i < parts.length; i++) {
            String[] t = parts[i].trim().split("\\s+");
            int at = 0;
            if (t[0].startsWith("-")) {
                cut[i] = true;
                t[0] = t[0].substring(1);
            }
            kind[i] = t[0].charAt(0);
            arg[i] = new double[t.length - 1];
            for (int k = 1; k < t.length; k++) arg[i][k - 1] = Double.parseDouble(t[k]);
        }
        float[] out = new float[size * size];
        int n = 3; // samples per pixel side
        double unit = 16.0 / size;
        for (int py = 0; py < size; py++) {
            for (int px = 0; px < size; px++) {
                int hit = 0;
                for (int sy = 0; sy < n; sy++) {
                    for (int sx = 0; sx < n; sx++) {
                        double fx = (px + (sx + 0.5) / n) * unit;
                        double fy = (py + (sy + 0.5) / n) * unit;
                        boolean in = false;
                        for (int i = 0; i < parts.length; i++) if (covers(kind[i], arg[i], fx, fy)) in = !cut[i];
                        if (in) hit++;
                    }
                }
                out[py * size + px] = hit / (float) (n * n);
            }
        }
        return out;
    }

    private static boolean covers(char kind, double[] a, double x, double y) {
        switch (kind) {
            case 'c':
                return Math.hypot(x - a[0], y - a[1]) <= a[2];
            case 'o':
                return Math.abs(Math.hypot(x - a[0], y - a[1]) - a[2]) <= a[3] / 2;
            case 'r': {
                double cx = Math.max(a[0] + a[4], Math.min(a[0] + a[2] - a[4], x));
                double cy = Math.max(a[1] + a[4], Math.min(a[1] + a[3] - a[4], y));
                return x >= a[0] && x <= a[0] + a[2] && y >= a[1] && y <= a[1] + a[3] && Math.hypot(x - cx, y - cy) <= a[4];
            }
            case 'l': {
                double dx = a[2] - a[0], dy = a[3] - a[1];
                double len2 = dx * dx + dy * dy;
                double t = len2 == 0 ? 0 : Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / len2));
                return Math.hypot(x - (a[0] + t * dx), y - (a[1] + t * dy)) <= a[4] / 2;
            }
            case 'p': {
                boolean in = false;
                int m = a.length / 2;
                for (int i = 0, j = m - 1; i < m; j = i++) {
                    double xi = a[2 * i], yi = a[2 * i + 1], xj = a[2 * j], yj = a[2 * j + 1];
                    if ((yi > y) != (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) in = !in;
                }
                return in;
            }
            default:
                return false;
        }
    }
}
