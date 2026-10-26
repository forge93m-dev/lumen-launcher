package dev.lumen.hud;

import com.mojang.blaze3d.pipeline.RenderTarget;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.screens.Screen;

/** Minecraft 26.1: screens are a field on {@code Minecraft}, the HUD toggle is an option. */
public final class Compat {
    private Compat() {}

    public static Screen screen(Minecraft c) {
        return c.screen;
    }

    public static void setScreen(Minecraft c, Screen s) {
        c.setScreen(s);
    }

    public static boolean hudHidden(Minecraft c) {
        return c.options.hideGui;
    }

    public static RenderTarget mainTarget(Minecraft c) {
        return c.getMainRenderTarget();
    }
}
