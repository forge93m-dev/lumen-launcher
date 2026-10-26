package dev.lumen.hud;

/**
 * Dev check (-Dlumenhud.selftest=true): drags the FPS element in the open editor by replaying GLFW events through
 * Minecraft's own mouse handler, so the whole real input path (mouse -> Screen -> EditScreen) is exercised.
 */
public final class DragProbe {
    /** Feeds raw window-pixel mouse events into the game the way the OS would. */
    public interface Sink {
        void move(double x, double y);

        void button(int button, boolean pressed);
    }

    private static HudRenderer.Rect before;
    private static double cx;
    private static double cy;

    private DragProbe() {}

    /** Call once per tick while the editor is open; {@code t} counts ticks since it opened. */
    public static void tick(int t, Sink in, double scale) {
        HudRenderer.Rect r = HudRenderer.RECTS.get("fps");
        if (r == null) return;
        switch (t) {
            case 3 -> {
                before = r;
                cx = r.x() + r.w() / 2.0;
                cy = r.y() + r.h() / 2.0;
                in.move(cx * scale, cy * scale);
            }
            case 4 -> in.button(0, true);
            case 5 -> in.move((cx + 40) * scale, (cy + 25) * scale);
            case 6 -> in.move((cx + 90) * scale, (cy + 60) * scale);
            case 7 -> in.move((cx + 140) * scale, (cy + 80) * scale);
            case 8 -> in.button(0, false);
            case 12 -> {
                boolean moved = Math.abs(r.x() - before.x()) > 60 && Math.abs(r.y() - before.y()) > 40;
                LumenHud.LOG.info("selftest: drag {} (fps element {},{} -> {},{})", moved ? "OK" : "FAILED", before.x(), before.y(), r.x(), r.y());
            }
            default -> {}
        }
    }
}
