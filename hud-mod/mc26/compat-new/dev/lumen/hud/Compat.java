package dev.lumen.hud;

import com.mojang.blaze3d.pipeline.RenderTarget;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.screens.Screen;

/** Minecraft 26.2+: screens and the HUD live on {@code Minecraft.gui}. */
public final class Compat {
    private Compat() {}

    public static Screen screen(Minecraft c) {
        return c.gui.screen();
    }

    public static void setScreen(Minecraft c, Screen s) {
        c.gui.setScreen(s);
    }

    public static boolean hudHidden(Minecraft c) {
        return c.gui.hud.isHidden();
    }

    public static RenderTarget mainTarget(Minecraft c) {
        return c.gameRenderer.mainRenderTarget();
    }
}
