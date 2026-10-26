package dev.lumen.hud;

/** Panel styles shared by the HUD and the menu: glass (rounded, accent edge), flat (plain box) and minimal (text only). */
public final class Look {
    public static final String[] THEMES = {"glass", "flat", "minimal"};

    private Look() {}

    public static int alpha(int argb, double factor) {
        int a = (int) Math.round(((argb >>> 24) & 0xFF) * Math.max(0, Math.min(1, factor)));
        return (a << 24) | (argb & 0x00FFFFFF);
    }

    public static int withAlpha(int argb, int a) {
        return (Math.max(0, Math.min(255, a)) << 24) | (argb & 0x00FFFFFF);
    }

    public static int mix(int from, int to, double t) {
        t = Math.max(0, Math.min(1, t));
        int a = (int) Math.round(((from >>> 24) & 0xFF) * (1 - t) + ((to >>> 24) & 0xFF) * t);
        int r = (int) Math.round(((from >> 16) & 0xFF) * (1 - t) + ((to >> 16) & 0xFF) * t);
        int g = (int) Math.round(((from >> 8) & 0xFF) * (1 - t) + ((to >> 8) & 0xFF) * t);
        int b = (int) Math.round((from & 0xFF) * (1 - t) + (to & 0xFF) * t);
        return (a << 24) | (r << 16) | (g << 8) | b;
    }

    /** A rectangle with rounded corners, drawn as stacked rows. */
    public static void round(Gfx g, int x, int y, int w, int h, int r, int color) {
        r = Math.max(0, Math.min(r, Math.min(w, h) / 2));
        if (r == 0) {
            g.fill(x, y, x + w, y + h, color);
            return;
        }
        for (int i = 0; i < r; i++) {
            double dy = r - i - 0.5;
            int inset = (int) Math.round(r - Math.sqrt(r * r - dy * dy));
            g.fill(x + inset, y + i, x + w - inset, y + i + 1, color);
            g.fill(x + inset, y + h - i - 1, x + w - inset, y + h - i, color);
        }
        g.fill(x, y + r, x + w, y + h - r, color);
    }

    /** A 1px rounded outline (drawn as a filled shape with the inside left out by the caller drawing over it). */
    public static void outline(Gfx g, int x, int y, int w, int h, int r, int color, int inner) {
        round(g, x, y, w, h, r, color);
        round(g, x + 1, y + 1, w - 2, h - 2, Math.max(0, r - 1), inner);
    }

    /** Background of an element box. */
    public static void panel(Gfx g, HudConfig cfg, int w, int h) {
        if (!cfg.background) return;
        int bg = cfg.bg();
        switch (cfg.theme) {
            case "minimal" -> {}
            case "flat" -> g.fill(0, 0, w, h, bg);
            default -> {
                round(g, 0, 0, w, h, 3, bg);
                g.fill(1, 3, 3, h - 3, withAlpha(cfg.accent(), 0xD0)); // accent edge
                g.fill(3, 0, w - 3, 1, 0x18FFFFFF); // soft highlight on top
            }
        }
    }

    /** A key or button of the keystrokes block; {@code pressed} is 0..1 so presses can fade. */
    public static void key(Gfx g, HudConfig cfg, int x, int y, int w, int h, double pressed) {
        int base = cfg.background ? cfg.bg() : 0x30000000;
        int color = mix(base, withAlpha(cfg.accent(), 0xC8), pressed);
        if ("flat".equals(cfg.theme)) g.fill(x, y, x + w, y + h, color);
        else round(g, x, y, w, h, 3, color);
    }
}
