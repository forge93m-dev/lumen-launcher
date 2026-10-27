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
    public boolean player(int x1, int y1, int x2, int y2, double turn, boolean preview, int[] skin, boolean slim, int[] cape) {
        net.minecraft.client.network.ClientPlayerEntity p = net.minecraft.client.MinecraftClient.getInstance().player;
        if (p == null) return false;
        if (preview) SkinImage.preview(skin, slim, cape);
        try {
            int cx = (x1 + x2) / 2;
            net.minecraft.client.gui.screen.ingame.InventoryScreen.drawEntity(ctx, x1, y1, x2, y2, (y2 - y1) * 5 / 11, 0.0625F, (float) (cx - 40 * Math.tan(Math.sin(turn) * 1.1)), (y1 + y2) / 2f - 6, p);
        } finally {
            if (preview) SkinImage.endPreview();
        }
        return true;
    }

    @Override
    public int texture(String key, java.util.function.Supplier<int[]> argb, int w, int h) {
        int known = UiTextures.lookup(key);
        if (known != UiTextures.UNKNOWN) return known;
        try {
            Tex.register(UiTextures.path(UiTextures.count()), Png.encode(argb.get(), w, h));
            return UiTextures.add(key, w, h);
        } catch (Exception e) {
            LumenHud.LOG.warn("Could not upload {}", key, e);
            UiTextures.failed(key);
            return -1;
        }
    }

    @Override
    public void blit(int handle, int x, int y, int w, int h, int tint) {
        int[] size = UiTextures.size(handle);
        Tex.blit(ctx, UiTextures.path(handle), x, y, w, h, size[0], size[1], tint);
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
