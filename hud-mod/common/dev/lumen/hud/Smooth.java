package dev.lumen.hud;

import java.util.HashMap;
import java.util.Map;

/** Rounded shapes with soft edges, drawn at screen-pixel resolution (see {@link Gfx#scale()}) instead of in blocky GUI units. */
final class Smooth {
    private Smooth() {}

    /** Receives horizontal runs of one colour, in screen pixels. */
    interface Runs {
        void run(int x1, int y1, int x2, int y2, int argb);
    }

    /** Splits a picture into runs of equal colour, row by row, and skips see-through pixels. */
    static void emit(int[] argb, int w, int h, int ox, int oy, Runs out) {
        for (int j = 0; j < h; j++) {
            int i = 0;
            while (i < w) {
                int c = argb[j * w + i];
                int k = i + 1;
                if ((c >>> 24) == 0) {
                    i = k;
                    continue;
                }
                while (k < w && argb[j * w + k] == c) k++;
                out.run(ox + i, oy + j, ox + k, oy + j + 1, c);
                i = k;
            }
        }
    }

    private static final Map<Long, float[]> CORNERS = new HashMap<>();

    /** Coverage (0..1) of the top-left corner of a circle of radius {@code r} units, {@code s} pixels per unit. */
    private static float[] corner(int r, int s) {
        return CORNERS.computeIfAbsent(((long) r << 8) | s, k -> {
            int n = r * s;
            float[] cov = new float[n * n];
            for (int j = 0; j < n; j++) {
                for (int i = 0; i < n; i++) {
                    double d = n - Math.hypot(n - (i + 0.5), n - (j + 0.5));
                    cov[j * n + i] = (float) Math.max(0, Math.min(1, d + 0.5));
                }
            }
            return cov;
        });
    }

    /** A frame {@code t} units thick around a rounded box (a ring when {@code r} is half the size), as one soft-edged texture. */
    static void frame(Gfx g, int x, int y, int w, int h, int r, int t, int color) {
        int s = g.scale();
        int pw = w * s, ph = h * s;
        double radius = r * s, thick = t * s;
        java.util.function.Supplier<int[]> make = () -> {
            int[] px = new int[pw * ph];
            for (int j = 0; j < ph; j++) {
                for (int i = 0; i < pw; i++) {
                    double qx = Math.abs(i + 0.5 - pw / 2.0) - (pw / 2.0 - radius), qy = Math.abs(j + 0.5 - ph / 2.0) - (ph / 2.0 - radius);
                    double d = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius; // negative inside
                    double a = Math.max(0, Math.min(1, 0.5 - d)) * Math.max(0, Math.min(1, d + thick + 0.5));
                    px[j * pw + i] = (Math.round((float) (255 * a)) << 24) | 0xFFFFFF;
                }
            }
            return px;
        };
        int tex = g.texture("frame" + pw + "x" + ph + "r" + r + "t" + t, make, pw, ph);
        if (tex >= 0) {
            g.blit(tex, x, y, w, h, color);
            return;
        }
        int[] px = make.get();
        int alpha = color >>> 24, rgb = color & 0xFFFFFF;
        for (int i = 0; i < px.length; i++) px[i] = (Math.round(alpha * (px[i] >>> 24) / 255f) << 24) | rgb;
        g.pixels(px, pw, ph, x, y);
    }

    /** A rectangle with round corners: straight parts are plain fills, the four corners are anti-aliased pictures. */
    static void roundRect(Gfx g, int x, int y, int w, int h, int r, int color) {
        int s = g.scale();
        r = Math.max(0, Math.min(r, Math.min(w, h) / 2));
        if (r == 0) {
            g.fill(x, y, x + w, y + h, color);
            return;
        }
        g.fill(x, y + r, x + w, y + h - r, color);
        g.fill(x + r, y, x + w - r, y + r, color);
        g.fill(x + r, y + h - r, x + w - r, y + h, color);
        float[] cov = corner(r, s);
        int n = r * s;
        int alpha = color >>> 24;
        int rgb = color & 0xFFFFFF;
        for (int quadrant = 0; quadrant < 4; quadrant++) {
            boolean right = (quadrant & 1) != 0;
            boolean bottom = quadrant >= 2;
            int cx = right ? x + w - r : x, cy = bottom ? y + h - r : y;
            final int q = quadrant;
            int tex = g.texture("corner" + r + "x" + s + "q" + q, () -> {
                int[] white = new int[n * n];
                for (int j = 0; j < n; j++) {
                    for (int i = 0; i < n; i++) {
                        float c = cov[(bottom ? n - 1 - j : j) * n + (right ? n - 1 - i : i)];
                        white[j * n + i] = (Math.round(255 * c) << 24) | 0xFFFFFF;
                    }
                }
                return white;
            }, n, n);
            if (tex >= 0) {
                g.blit(tex, cx, cy, r, r, color);
                continue;
            }
            int[] px = new int[n * n];
            for (int j = 0; j < n; j++) {
                for (int i = 0; i < n; i++) {
                    float c = cov[(bottom ? n - 1 - j : j) * n + (right ? n - 1 - i : i)];
                    px[j * n + i] = c >= 1 ? color : c <= 0 ? 0 : (Math.round(alpha * c) << 24) | rgb;
                }
            }
            g.pixels(px, n, n, cx, cy);
        }
    }
}
