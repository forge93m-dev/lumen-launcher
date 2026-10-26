package dev.lumen.hud;

import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.texture.NativeImage;
import net.minecraft.client.texture.NativeImageBackedTexture;

import net.minecraft.util.Identifier;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;

/** The picture behind the menu: config/lumen-menu-bg.png, drawn to cover the screen. (Minecraft 1.21 - 1.21.1) */
final class MenuImage {
    private static final Identifier ID = Identifier.of("lumenhud", "menu_background");
    private static long stamp = -1;
    private static int tw;
    private static int th;
    private static boolean ok;
    private static boolean registered;

    private MenuImage() {}

    static Path file() {
        return FabricLoader.getInstance().getConfigDir().resolve("lumen-menu-bg.png");
    }

    private static void reload() {
        Path f = file();
        long m = 0;
        try {
            m = Files.exists(f) ? Files.getLastModifiedTime(f).toMillis() : 0;
        } catch (Exception ignored) {
        }
        if (m == stamp) return;
        stamp = m;
        MinecraftClient c = MinecraftClient.getInstance();
        if (registered) {
            c.getTextureManager().destroyTexture(ID);
            registered = false;
        }
        ok = false;
        if (m == 0) return;
        try (InputStream in = Files.newInputStream(f)) {
            NativeImage img = NativeImage.read(in);
            tw = img.getWidth();
            th = img.getHeight();
            c.getTextureManager().registerTexture(ID, new NativeImageBackedTexture(img));
            registered = true;
            ok = true;
        } catch (Exception e) {
            LumenHud.LOG.warn("Could not load the menu background picture", e);
        }
    }

    /** @return false when there is no picture to draw */
    static boolean draw(DrawContext ctx, int w, int h) {
        reload();
        if (!ok) return false;
        double s = Math.max(w / (double) tw, h / (double) th);
        int rw = (int) Math.round(w / s);
        int rh = (int) Math.round(h / s);
        float u = (tw - rw) / 2f;
        float v = (th - rh) / 2f;
        ctx.drawTexture(ID, 0, 0, w, h, u, v, rw, rh, tw, th);
        return true;
    }
}
