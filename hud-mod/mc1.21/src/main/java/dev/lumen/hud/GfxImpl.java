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
        ctx.drawText(tr, UiFont.of(s), x, y, argb, shadow);
    }

    @Override
    public int scale() {
        return Math.max(1, (int) Math.round(net.minecraft.client.MinecraftClient.getInstance().getWindow().getScaleFactor()));
    }

    @Override
    public void pixels(int[] argb, int w, int h, int x, int y) {
        int s = scale();
        Matrices.push(ctx);
        Matrices.scale(ctx, 1f / s, 1f / s);
        Smooth.emit(argb, w, h, x * s, y * s, (x1, y1, x2, y2, c) -> ctx.fill(x1, y1, x2, y2, c));
        Matrices.pop(ctx);
    }

    @Override
    public int width(String s) {
        return tr.getWidth(UiFont.of(s));
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
