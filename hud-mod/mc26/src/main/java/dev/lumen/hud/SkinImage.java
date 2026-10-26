package dev.lumen.hud;

import com.mojang.blaze3d.platform.NativeImage;
import net.minecraft.client.Minecraft;
import net.minecraft.client.renderer.texture.DynamicTexture;
import net.minecraft.resources.Identifier;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;

/** The launcher's skin and cape as textures, loaded when their files appear or change. */
public final class SkinImage {
    private static final Identifier SKIN = Identifier.fromNamespaceAndPath("lumenhud", "player_skin");
    private static final Identifier CAPE = Identifier.fromNamespaceAndPath("lumenhud", "player_cape");
    private static boolean skinOk;
    private static boolean capeOk;

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
        Minecraft c = Minecraft.getInstance();
        if (skinOk) c.getTextureManager().release(SKIN);
        if (capeOk) c.getTextureManager().release(CAPE);
        skinOk = capeOk = false;
        if (SkinConfig.enabled) skinOk = load(SkinConfig.png(), SKIN, 64, 64);
        if (SkinConfig.cape) capeOk = load(SkinConfig.capePng(), CAPE, 64, 32);
    }

    private static boolean load(Path file, Identifier id, int w, int h) {
        try (InputStream in = Files.newInputStream(file)) {
            NativeImage img = NativeImage.read(in);
            if (img.getWidth() != w || img.getHeight() != h) {
                LumenHud.LOG.warn("{} must be {}x{}, it is {}x{}", file.getFileName(), w, h, img.getWidth(), img.getHeight());
                img.close();
                return false;
            }
            Minecraft.getInstance().getTextureManager().register(id, new DynamicTexture(() -> "lumenhud " + id.getPath(), img));
            return true;
        } catch (Exception e) {
            LumenHud.LOG.warn("Could not load {}", file.getFileName(), e);
            return false;
        }
    }

    /** Dev self-test helper. */
    static String describe(Minecraft c) {
        return describe(c.player);
    }

    static String describe(net.minecraft.client.player.AbstractClientPlayer p) {
        var s = p.getSkin();
        return s.body().texturePath() + " " + s.model() + " cape=" + (s.cape() == null ? "none" : s.cape().texturePath());
    }
}
