package dev.lumen.hud;

import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.item.ItemStack;

/** Minecraft 1.21 - 1.21.1. */
final class Items {
    private Items() {}

    /** The stack-count and durability-bar overlay on an item. */
    static void overlay(DrawContext ctx, TextRenderer tr, ItemStack stack, int x, int y) { ctx.drawItemInSlot(tr, stack, x, y); }
}
