package dev.lumen.hud;

import net.minecraft.client.texture.NativeImage;
import net.minecraft.util.Identifier;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;

/** The launcher's skin and cape as textures, loaded when their files appear or change. */
public final class SkinImage {
    private static final Identifier SKIN = Identifier.of("lumenhud", "player_skin");
    private static final Identifier CAPE = Identifier.of("lumenhud", "player_cape");
    private static boolean skinOk;
    private static boolean capeOk;
    private static boolean skinRegistered;
    private static boolean capeRegistered;

    private SkinImage() {}

    private static void check() {
        if (SkinConfig.changed()) reload();
    }

    /** The texture to draw the local player with, or null for the normal skin. */
    public static Identifier skin() {
        check();
        return skinOk ? SKIN : null;
    }

    /** The local player's cape texture, or null for the normal cape. */
    public static Identifier cape() {
        check();
        return capeOk ? CAPE : null;
    }

    public static boolean slim() {
        return SkinConfig.slim;
    }

    private static void reload() {
        if (skinRegistered) SkinTexture.release(SKIN);
        if (capeRegistered) SkinTexture.release(CAPE);
        skinRegistered = capeRegistered = skinOk = capeOk = false;
        if (SkinConfig.enabled) skinOk = load(SkinConfig.png(), SKIN, 64, 64);
        skinRegistered = skinOk;
        if (SkinConfig.cape) capeOk = load(SkinConfig.capePng(), CAPE, 64, 32);
        capeRegistered = capeOk;
    }

    private static boolean load(Path file, Identifier id, int w, int h) {
        try (InputStream in = Files.newInputStream(file)) {
            NativeImage img = NativeImage.read(in);
            if (img.getWidth() != w || img.getHeight() != h) {
                LumenHud.LOG.warn("{} must be {}x{}, it is {}x{}", file.getFileName(), w, h, img.getWidth(), img.getHeight());
                img.close();
                return false;
            }
            SkinTexture.register(id, img);
            return true;
        } catch (Exception e) {
            LumenHud.LOG.warn("Could not load {}", file.getFileName(), e);
            return false;
        }
    }
}
