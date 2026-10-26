package dev.lumen.hud;

import net.minecraft.client.gui.DrawContext;

/** Minecraft 1.21.6 and later: the GUI matrix is a 2D JOML stack. */
final class Matrices {
    private Matrices() {}

    static void push(DrawContext ctx) { ctx.getMatrices().pushMatrix(); }
    static void translate(DrawContext ctx, float x, float y) { ctx.getMatrices().translate(x, y); }
    static void scale(DrawContext ctx, float x, float y) { ctx.getMatrices().scale(x, y); }
    static void pop(DrawContext ctx) { ctx.getMatrices().popMatrix(); }
}
