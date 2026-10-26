package dev.lumen.hud;

import net.minecraft.client.gui.DrawContext;

/** Minecraft 1.21 - 1.21.5: the GUI matrix is a MatrixStack. */
final class Matrices {
    private Matrices() {}

    static void push(DrawContext ctx) { ctx.getMatrices().push(); }
    static void translate(DrawContext ctx, float x, float y) { ctx.getMatrices().translate(x, y, 0); }
    static void scale(DrawContext ctx, float x, float y) { ctx.getMatrices().scale(x, y, 1); }
    static void pop(DrawContext ctx) { ctx.getMatrices().pop(); }
}
