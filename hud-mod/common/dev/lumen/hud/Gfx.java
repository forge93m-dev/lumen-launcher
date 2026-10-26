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
}
