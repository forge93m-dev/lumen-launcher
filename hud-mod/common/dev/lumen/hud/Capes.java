package dev.lumen.hud;

/** A few capes made in code, so there is something nice to pick before you draw or download your own. */
public final class Capes {
    public static final String[] NAMES = {"Lumen", "Ember", "Ocean", "Forest", "Rose", "Night"};

    private static final int[][] COLORS = { // top, bottom, accent
            {0xFF9B72F8, 0xFF4C1D95, 0xFFE9DDFF},
            {0xFFF59E0B, 0xFFB91C1C, 0xFFFFE08A},
            {0xFF22D3EE, 0xFF1D4ED8, 0xFFCFF6FF},
            {0xFF34D399, 0xFF14532D, 0xFFD1FAE5},
            {0xFFF472B6, 0xFF9D174D, 0xFFFFE0F0},
            {0xFF334155, 0xFF0B1020, 0xFFF8E9A1},
    };

    private static final int[][] CACHE = new int[NAMES.length][];

    private Capes() {}

    /** The 64x32 picture of preset {@code i}. */
    public static int[] make(int i) {
        if (CACHE[i] != null) return CACHE[i];
        int[] c = COLORS[i];
        int[] px = new int[64 * 32];
        // the faces of the cape: outer 10x16 at (1,1), inner 10x16 at (12,1), top, bottom and sides
        for (int y = 0; y < 17; y++) {
            for (int x = 0; x < 22; x++) {
                int fy = Math.max(0, Math.min(15, y - 1));
                px[y * 64 + x] = Look.mix(c[0], c[1], fy / 15f);
            }
        }
        for (int y = 0; y < 16; y++) {
            for (int x = 0; x < 10; x++) {
                int col = Look.mix(c[0], c[1], y / 15f);
                if (x == 0 || x == 9 || y == 0 || y == 15) col = Look.mix(col, c[2], 0.45f);
                else if (pattern(i, x, y)) col = c[2];
                px[(1 + y) * 64 + 1 + x] = col;
                px[(1 + y) * 64 + 12 + x] = Look.mix(c[0], c[1], y / 15f); // the inside, plain
            }
        }
        return CACHE[i] = px;
    }

    private static boolean pattern(int style, int x, int y) {
        return switch (style) {
            case 0 -> Math.abs(x - 4.5) + Math.abs(y - 7.5) <= 3; // diamond
            case 1 -> y >= 5 && y <= 12 && (x + y) % 3 == 0; // flame ticks
            case 2 -> y >= 4 && y % 4 == 0 && Math.sin((x + y) * 1.2) > -0.3; // waves
            case 3 -> (x == 4 || x == 5) && y > 2 && y < 13 || y == 7 || y == 8 && x > 2 && x < 7; // a tree-ish cross
            case 4 -> y > 3 && y < 12 && (x + y) % 2 == 0 && x > 1 && x < 8; // dots
            default -> (x * 7 + y * 13) % 11 == 0; // stars
        };
    }
}
