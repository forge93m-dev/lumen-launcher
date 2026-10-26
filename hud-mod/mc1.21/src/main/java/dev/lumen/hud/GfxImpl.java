package dev.lumen.hud;

import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.gui.DrawContext;

/** {@link Gfx} on top of Yarn's DrawContext. */
final class GfxImpl implements Gfx {
    private final DrawContext ctx;
    private final TextRenderer tr;

    GfxImpl(DrawContext ctx, TextRenderer tr) {
        this.ctx = ctx;
        this.tr = tr;
    }

    @Override
    public void fill(int x1, int y1, int x2, int y2, int argb) {
        ctx.fill(x1, y1, x2, y2, argb);
    }

    @Override
    public void text(String s, int x, int y, int argb, boolean shadow) {
        ctx.drawText(tr, s, x, y, argb, shadow);
    }

    @Override
    public int width(String s) {
        return tr.getWidth(s);
    }

    @Override
    public void clip(int x1, int y1, int x2, int y2) {
        ctx.enableScissor(x1, y1, x2, y2);
    }

    @Override
    public void unclip() {
        ctx.disableScissor();
    }
}
