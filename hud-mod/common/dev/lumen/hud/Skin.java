package dev.lumen.hud;

/** Colour sets for the in-game menu, and the backdrop drawn behind it. */
public final class Skin {
    public static final String[] NAMES = {"midnight", "graphite", "ocean", "rose", "forest", "light"};
    public static final String[] BACKGROUNDS = {"dim", "gradient", "image"};

    public final int panel;
    public final int edge;
    public final int text;
    public final int dim;
    /** Row hover, switch track, slider track and scroll bar. */
    public final int hover;
    public final int off;
    public final int track;
    /** Module cards and their hover colour. */
    public final int card;
    public final int cardHover;

    private Skin(int panel, int edge, int text, int dim, int hover, int off, int track) {
        this.card = Look.mix(panel, hover == 0x18000000 ? 0xFF000000 : 0xFFFFFFFF, hover == 0x18000000 ? 0.05 : 0.07);
        this.cardHover = Look.mix(panel, hover == 0x18000000 ? 0xFF000000 : 0xFFFFFFFF, hover == 0x18000000 ? 0.10 : 0.13);
        this.panel = panel;
        this.edge = edge;
        this.text = text;
        this.dim = dim;
        this.hover = hover;
        this.off = off;
        this.track = track;
    }

    private static final Skin[] ALL = {
            new Skin(0xF2101018, 0xFF2B2B3D, 0xFFEDEDF5, 0xFF8A8AA3, 0x18FFFFFF, 0xFF3A3A4D, 0x44FFFFFF),
            new Skin(0xF2161616, 0xFF343434, 0xFFEEEEEE, 0xFF9A9A9A, 0x18FFFFFF, 0xFF444444, 0x44FFFFFF),
            new Skin(0xF20B1622, 0xFF1D3B55, 0xFFE6F3FF, 0xFF7FA3C0, 0x1CFFFFFF, 0xFF27465F, 0x44CFE8FF),
            new Skin(0xF2190F16, 0xFF4A2340, 0xFFFFEAF5, 0xFFB58AA8, 0x1CFFFFFF, 0xFF4A2F44, 0x44FFD6EC),
            new Skin(0xF20E1A14, 0xFF254634, 0xFFE9FFF1, 0xFF80B08F, 0x1CFFFFFF, 0xFF2E4A3A, 0x44D2FFE2),
            new Skin(0xF2F4F4F8, 0xFFCFCFD9, 0xFF1B1B26, 0xFF6B6B80, 0x18000000, 0xFFB9B9C6, 0x44000000),
    };

    public static int index(String name) {
        for (int i = 0; i < NAMES.length; i++) if (NAMES[i].equals(name)) return i;
        return 0;
    }

    public static Skin current() {
        return ALL[index(HudConfig.get().menuSkin)];
    }

    /**
     * The layer behind the menu. {@code imageDrawn} says the custom picture is already on screen, so only a
     * dimming layer goes over it.
     */
    public static void backdrop(Gfx g, int w, int h, boolean imageDrawn) {
        HudConfig cfg = HudConfig.get();
        double dim = Math.max(0, Math.min(0.95, cfg.menuDim));
        Skin s = current();
        switch (cfg.menuBackground) {
            case "gradient" -> {
                int top = Look.withAlpha(Look.mix(0xFF000000, cfg.accent(), 0.4), (int) (0x90 + 0x60 * dim));
                int bottom = Look.withAlpha(s.panel, 0xE8);
                int bands = 48;
                for (int i = 0; i < bands; i++) {
                    int y1 = h * i / bands;
                    int y2 = h * (i + 1) / bands;
                    g.fill(0, y1, w, Math.max(y2, y1 + 1), Look.mix(top, bottom, i / (double) (bands - 1)));
                }
            }
            case "image" -> {
                if (imageDrawn) g.fill(0, 0, w, h, Look.withAlpha(s == ALL[5] ? 0xFFFFFFFF : 0xFF000000, (int) (dim * 0.8 * 255)));
                else g.fill(0, 0, w, h, Look.withAlpha(0xFF000000, (int) (dim * 255)));
            }
            default -> g.fill(0, 0, w, h, Look.withAlpha(0xFF000000, (int) (dim * 255)));
        }
    }
}
