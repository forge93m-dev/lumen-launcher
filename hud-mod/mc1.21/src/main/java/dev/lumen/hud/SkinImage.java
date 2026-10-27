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
    private static final Identifier PREVIEW_SKIN = Identifier.of("lumenhud", "preview_skin");
    private static final Identifier PREVIEW_CAPE = Identifier.of("lumenhud", "preview_cape");
    private static boolean skinOk;
    private static boolean capeOk;
    private static boolean previewing;
    private static boolean previewSlim;
    private static boolean previewSkinOk;
    private static boolean previewCapeOk;
    private static int previewSkinHash;
    private static int previewCapeHash;
    private static boolean skinRegistered;
    private static boolean capeRegistered;

    private SkinImage() {}

    private static void check() {
        if (SkinConfig.changed()) reload();
    }

    /** The texture to draw the local player with, or null for the normal skin. */
    public static Identifier skin() {
        if (previewing) return previewSkinOk ? PREVIEW_SKIN : null;
        check();
        return skinOk ? SKIN : null;
    }

    /** The local player's cape texture, or null for the normal cape. */
    public static Identifier cape() {
        if (previewing) return previewCapeOk ? PREVIEW_CAPE : null;
        check();
        return capeOk ? CAPE : null;
    }

    public static boolean slim() {
        return previewing ? previewSlim : SkinConfig.slim;
    }

    /** Until {@link #endPreview()}, the local player is drawn wearing these pictures (null: the game's own) instead of the chosen ones. */
    public static void preview(int[] skin, boolean slim, int[] cape) {
        previewSlim = slim;
        previewSkinOk = skin != null && previewTexture(PREVIEW_SKIN, skin, 64, 64, true);
        previewCapeOk = cape != null && previewTexture(PREVIEW_CAPE, cape, 64, 32, false);
        previewing = true;
    }

    public static void endPreview() {
        previewing = false;
    }

    private static boolean previewTexture(Identifier id, int[] pixels, int w, int h, boolean isSkin) {
        int hash = java.util.Arrays.hashCode(pixels);
        if ((isSkin ? previewSkinHash : previewCapeHash) == hash) return true;
        try {
            NativeImage img = NativeImage.read(new java.io.ByteArrayInputStream(Png.encode(pixels, w, h)));
            SkinTexture.register(id, img);
            if (isSkin) previewSkinHash = hash;
            else previewCapeHash = hash;
            return true;
        } catch (Exception e) {
            LumenHud.LOG.warn("Could not make the preview texture", e);
            return false;
        }
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
