package dev.lumen.hud;

import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.item.ItemStack;

/** Minecraft 1.21.2 and later (the method was renamed). */
final class Items {
    private Items() {}

    /** The stack-count and durability-bar overlay on an item. */
    static void overlay(DrawContext ctx, TextRenderer tr, ItemStack stack, int x, int y) { ctx.drawStackOverlay(tr, stack, x, y); }
}
