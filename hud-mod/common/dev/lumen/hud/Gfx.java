package dev.lumen.hud;

/** The few drawing calls the shared UI code needs; each Minecraft generation backs them with its own graphics class. */
public interface Gfx {
    /** Fills a rectangle; x2/y2 are exclusive. */
    void fill(int x1, int y1, int x2, int y2, int argb);

    void text(String s, int x, int y, int argb, boolean shadow);

    int width(String s);

    /** Restricts drawing to a rectangle until {@link #unclip()}. */
    void clip(int x1, int y1, int x2, int y2);

    void unclip();

    /** Screen pixels per drawing unit (the GUI scale). Curves and pictures are drawn at this finer resolution so they come out smooth. */
    default int scale() {
        return 1;
    }

    /**
     * Draws a picture of {@code w}x{@code h} screen pixels with its top-left corner at drawing unit (x, y). Pixels are ARGB and
     * may be translucent. Where {@link #scale()} is 1 this is one pixel per unit.
     */
    default void pixels(int[] argb, int w, int h, int x, int y) {
        for (int j = 0; j < h; j++) {
            for (int i = 0; i < w; i++) {
                int c = argb[j * w + i];
                if ((c >>> 24) != 0) fill(x + i, y + j, x + i + 1, y + j + 1, c);
            }
        }
    }
}
