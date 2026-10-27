package dev.lumen.hud;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Font;
import net.minecraft.client.gui.GuiGraphicsExtractor;

/** {@link Gfx} on top of the 26.x GuiGraphicsExtractor. */
final class GfxImpl implements Gfx {
    private final GuiGraphicsExtractor g;
    private final Font font;

    GfxImpl(GuiGraphicsExtractor g, Font font) {
        this.g = g;
        this.font = font;
    }

    @Override
    public void fill(int x1, int y1, int x2, int y2, int argb) {
        g.fill(x1, y1, x2, y2, argb);
    }

    @Override
    public void text(String s, int x, int y, int argb, boolean shadow) {
        g.text(font, UiFont.of(s), x, y, argb, shadow);
    }

    @Override
    public int scale() {
        return Math.max(1, (int) Math.round(Minecraft.getInstance().getWindow().getGuiScale()));
    }

    @Override
    public void pixels(int[] argb, int w, int h, int x, int y) {
        int s = scale();
        org.joml.Matrix3x2fStack m = g.pose();
        m.pushMatrix();
        m.scale(1f / s, 1f / s);
        Smooth.emit(argb, w, h, x * s, y * s, (x1, y1, x2, y2, c) -> g.fill(x1, y1, x2, y2, c));
        m.popMatrix();
    }

    @Override
    public int width(String s) {
        return font.width(UiFont.of(s));
    }

    @Override
    public void clip(int x1, int y1, int x2, int y2) {
        g.enableScissor(x1, y1, x2, y2);
    }

    @Override
    public void unclip() {
        g.disableScissor();
    }
}
