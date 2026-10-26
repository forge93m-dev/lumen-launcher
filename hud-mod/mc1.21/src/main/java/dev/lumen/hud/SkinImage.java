package dev.lumen.hud;

import net.minecraft.client.texture.NativeImage;
import net.minecraft.util.Identifier;

import java.io.InputStream;
import java.nio.file.Files;

/** The launcher's skin as a texture, loaded when its files appear or change. */
public final class SkinImage {
    private static final Identifier ID = Identifier.of("lumenhud", "player_skin");
    private static boolean ok;
    private static boolean registered;

    private SkinImage() {}

    /** The texture to draw the local player with, or null for the normal skin. */
    public static Identifier id() {
        if (SkinConfig.changed()) reload();
        return ok && SkinConfig.enabled ? ID : null;
    }

    public static boolean slim() {
        return SkinConfig.slim;
    }

    private static void reload() {
        if (registered) {
            SkinTexture.release(ID);
            registered = false;
        }
        ok = false;
        if (!SkinConfig.enabled) return;
        try (InputStream in = Files.newInputStream(SkinConfig.png())) {
            NativeImage img = NativeImage.read(in);
            if (img.getWidth() != 64 || img.getHeight() != 64) {
                LumenHud.LOG.warn("lumen-skin.png must be 64x64, it is {}x{}", img.getWidth(), img.getHeight());
                img.close();
                return;
            }
            SkinTexture.register(ID, img);
            registered = true;
            ok = true;
        } catch (Exception e) {
            LumenHud.LOG.warn("Could not load lumen-skin.png", e);
        }
    }
}
