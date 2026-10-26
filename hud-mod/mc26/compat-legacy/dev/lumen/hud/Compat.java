package dev.lumen.hud;

import com.mojang.blaze3d.pipeline.RenderTarget;
import com.mojang.blaze3d.platform.InputConstants;
import net.fabricmc.fabric.api.client.keymapping.v1.KeyMappingHelper;
import net.minecraft.client.KeyMapping;
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

    /** Dev self-test: feeds mouse events into the game's own mouse handler. */
    public static DragProbe.Sink mouseSink(Minecraft c) {
        long win = c.getWindow().handle();
        return new DragProbe.Sink() {
            private double lx;
            private double ly;

            public void move(double x, double y) {
                try {
                    var m = net.minecraft.client.MouseHandler.class.getDeclaredMethod("onMove", long.class, double.class, double.class);
                    m.setAccessible(true);
                    m.invoke(c.mouseHandler, win, x, y);
                } catch (ReflectiveOperationException e) {
                    throw new IllegalStateException(e);
                }
                lx = x;
                ly = y;
            }

            public void button(int b, boolean pressed) {
                var info = new net.minecraft.client.input.MouseButtonInfo(b == 0 ? InputConstants.MOUSE_BUTTON_LEFT : b, 0);
                try {
                    var m = net.minecraft.client.MouseHandler.class.getDeclaredMethod("onButton", long.class, net.minecraft.client.input.MouseButtonInfo.class, int.class);
                    m.setAccessible(true);
                    m.invoke(c.mouseHandler, win, info, pressed ? 1 : 0);
                } catch (ReflectiveOperationException e) {
                    throw new IllegalStateException(e);
                }
            }
        };
    }

    /** Whether the key is held on the keyboard right now, whatever the game thinks the binding's state is. */
    public static boolean physicallyDown(KeyMapping k) {
        Minecraft c = Minecraft.getInstance();
        return InputConstants.isKeyDown(c.getWindow(), KeyMappingHelper.getBoundKeyOf(k).getValue());
    }
}
