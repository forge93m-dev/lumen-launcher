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
     * Uploads a small white picture once (the supplier runs only the first time for this key) and returns a handle for
     * {@link #blit}, or -1 when this graphics cannot do textures; callers then fall back to {@link #pixels}.
     */
    default int texture(String key, java.util.function.Supplier<int[]> argb, int w, int h) {
        return -1;
    }

    /** A texture the caller rewrites every frame ({@link #updateTexture}); -1 when this graphics cannot do textures. */
    default int dynamicTexture(String key, int w, int h) {
        return -1;
    }

    default void updateTexture(int handle, int[] argb) {
    }

    /** Draws an uploaded picture into a box of drawing units, multiplying it by the colour {@code tint}. */
    default void blit(int handle, int x, int y, int w, int h, int tint) {
    }

    /**
     * Draws the real player model of the game inside the box, turned by {@code turn} radians. With {@code preview} it wears the
     * given skin (null: the standard one), arm shape and cape (null: none) instead of what the player has on. Returns false when
     * there is nothing to draw (no world yet).
     */
    default boolean player(int x1, int y1, int x2, int y2, double turn, boolean preview, int[] skin, boolean slim, int[] cape) {
        return false;
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
