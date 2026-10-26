package dev.lumen.hud;

import com.mojang.blaze3d.pipeline.RenderTarget;
import com.mojang.blaze3d.platform.InputConstants;
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

    /** Dev self-test: feeds mouse events into the game's own mouse handler. */
    public static DragProbe.Sink mouseSink(Minecraft c) {
        long win = c.getWindow().handle();
        return new DragProbe.Sink() {
            private double lx;
            private double ly;

            public void move(double x, double y) {
                try { // 26.2 takes (window, x, y), 26.3 adds the relative movement
                    for (var m : net.minecraft.client.MouseHandler.class.getDeclaredMethods()) {
                        if (!m.getName().equals("onMove")) continue;
                        m.setAccessible(true);
                        if (m.getParameterCount() == 5) m.invoke(c.mouseHandler, win, x, y, x - lx, y - ly);
                        else m.invoke(c.mouseHandler, win, x, y);
                    }
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
}
