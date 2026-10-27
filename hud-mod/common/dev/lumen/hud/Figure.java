package dev.lumen.hud;

/** A flat little player drawn from a skin (and cape) with plain rectangles, front or back. Used by the Cosmetics page. */
public final class Figure {
    private static int[] fallback;

    private Figure() {}

    /** Draws the 8x8 face (with the hat layer) at (x, y), each skin pixel being {@code scale} screen pixels. */
    public static void head(Gfx g, int[] skin, int x, int y, int scale) {
        if (skin == null) skin = fallback();
        blit(g, skin, 8, 8, 8, 8, x, y, scale, false);
        blit(g, skin, 40, 8, 8, 8, x, y, scale, true);
    }

    /** The whole player, 16 skin pixels wide and 32 tall. */
    public static void body(Gfx g, int[] skin, boolean slim, int[] cape, boolean back, int x, int y, int scale) {
        if (skin == null) skin = fallback();
        int aw = slim ? 3 : 4;
        // the player's right arm is on the viewer's left from the front and on the right from behind; a slim arm hugs the torso
        int leftOnScreen = x + (4 - aw) * scale;
        int rightOnScreen = x + 12 * scale;
        int rightArmX = back ? rightOnScreen : leftOnScreen;
        int leftArmX = back ? leftOnScreen : rightOnScreen;
        // head
        part(g, skin, back ? 24 : 8, 8, 8, 8, back ? 56 : 40, 8, x + 4 * scale, y, scale);
        // torso
        part(g, skin, back ? 32 : 20, 20, 8, 12, back ? 32 : 20, 36, x + 4 * scale, y + 8 * scale, scale);
        // arms: the player's right arm (texture 40,16), left arm (32,48)
        int rU = back ? (slim ? 51 : 52) : 44;
        int lU = back ? (slim ? 43 : 44) : 36;
        part(g, skin, rU, 20, aw, 12, back ? (slim ? 51 : 52) : 44, 36, rightArmX, y + 8 * scale, scale);
        part(g, skin, lU, 52, aw, 12, back ? (slim ? 59 : 60) : 52, 52, leftArmX, y + 8 * scale, scale);
        // legs: right leg (0,16), left leg (16,48)
        int rightLegX = x + (back ? 8 : 4) * scale;
        int leftLegX = x + (back ? 4 : 8) * scale;
        part(g, skin, back ? 12 : 4, 20, 4, 12, back ? 12 : 4, 36, rightLegX, y + 20 * scale, scale);
        part(g, skin, back ? 28 : 20, 52, 4, 12, back ? 12 : 4, 52, leftLegX, y + 20 * scale, scale);
        if (back && cape != null) blit(g, cape, 64, 1, 1, 10, 16, x + 3 * scale, y + 8 * scale, scale, false);
    }

    private static void part(Gfx g, int[] skin, int u, int v, int w, int h, int ou, int ov, int dx, int dy, int scale) {
        blit(g, skin, 64, u, v, w, h, dx, dy, scale, false);
        blit(g, skin, 64, ou, ov, w, h, dx, dy, scale, true);
    }

    private static void blit(Gfx g, int[] px, int u, int v, int w, int h, int dx, int dy, int scale, boolean overlay) {
        blit(g, px, 64, u, v, w, h, dx, dy, scale, overlay);
    }

    /** Draws a w*h piece of a picture; rows of equal colour become one rectangle. Overlay layers skip see-through pixels. */
    public static void blit(Gfx g, int[] px, int stride, int u, int v, int w, int h, int dx, int dy, int scale, boolean overlay) {
        for (int j = 0; j < h; j++) {
            int i = 0;
            while (i < w) {
                int c = px[(v + j) * stride + u + i];
                int a = c >>> 24;
                int k = i + 1;
                if (a < (overlay ? 40 : 1)) {
                    i = k;
                    continue;
                }
                while (k < w && px[(v + j) * stride + u + k] == c) k++;
                g.fill(dx + i * scale, dy + j * scale, dx + k * scale, dy + (j + 1) * scale, 0xFF000000 | c);
                i = k;
            }
        }
    }

    /** A plain stand-in for when no skin is chosen. */
    private static int[] fallback() {
        if (fallback != null) return fallback;
        int[] p = new int[64 * 64];
        fill(p, 0, 0, 32, 16, 0xFFC69C6D); // head
        fill(p, 8, 8, 16, 10, 0xFF4B2E1A); // hair on the front
        fill(p, 0, 0, 32, 8, 0xFF4B2E1A);
        fill(p, 16, 16, 40, 32, 0xFF1AA6A6); // torso and arms
        fill(p, 40, 16, 56, 32, 0xFFC69C6D);
        fill(p, 44, 16, 52, 24, 0xFF1AA6A6);
        fill(p, 0, 16, 16, 32, 0xFF3A3AA0); // right leg
        fill(p, 16, 48, 32, 64, 0xFF3A3AA0); // left leg
        fill(p, 32, 48, 48, 64, 0xFFC69C6D); // left arm
        fill(p, 36, 48, 44, 56, 0xFF1AA6A6);
        return fallback = p;
    }

    private static void fill(int[] p, int x1, int y1, int x2, int y2, int c) {
        for (int y = y1; y < y2; y++) for (int x = x1; x < x2; x++) p[y * 64 + x] = c;
    }
}
