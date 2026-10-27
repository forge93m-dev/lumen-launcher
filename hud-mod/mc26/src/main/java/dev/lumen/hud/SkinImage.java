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
    private static final Identifier PREVIEW_SKIN = Identifier.fromNamespaceAndPath("lumenhud", "preview_skin");
    private static final Identifier PREVIEW_CAPE = Identifier.fromNamespaceAndPath("lumenhud", "preview_cape");
    private static boolean skinOk;
    private static boolean capeOk;
    private static boolean previewing;
    private static boolean previewSlim;
    private static boolean previewSkinOk;
    private static boolean previewCapeOk;
    private static int previewSkinHash;
    private static int previewCapeHash;

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

    /**
     * The skin set a wardrobe player wears. Not a preview: the local player's skin as worn now, or, for the "after" model,
     * the picked pictures on top of the game's own skin (null skin: the game's own, null cape: no cape).
     */
    public static net.minecraft.world.entity.player.PlayerSkin look(net.minecraft.client.player.AbstractClientPlayer p, boolean preview, int[] skin, boolean slim, int[] cape) {
        if (!preview) return p.getSkin();
        boolean was = previewing;
        previewing = true;
        previewSkinOk = false;
        previewCapeOk = false;
        net.minecraft.world.entity.player.PlayerSkin own = p.getSkin(); // the game's own, without the launcher's pictures
        previewing = was;
        Identifier s = skin != null && previewTexture(PREVIEW_SKIN, skin, 64, 64, true) ? PREVIEW_SKIN : null;
        Identifier c = cape != null && previewTexture(PREVIEW_CAPE, cape, 64, 32, false) ? PREVIEW_CAPE : null;
        net.minecraft.core.ClientAsset.Texture capeAsset = c == null ? null : new net.minecraft.core.ClientAsset.ResourceTexture(c, c);
        return new net.minecraft.world.entity.player.PlayerSkin(s == null ? own.body() : new net.minecraft.core.ClientAsset.ResourceTexture(s, s), capeAsset, capeAsset,
                s == null ? own.model() : slim ? net.minecraft.world.entity.player.PlayerModelType.SLIM : net.minecraft.world.entity.player.PlayerModelType.WIDE, own.secure());
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
            Minecraft.getInstance().getTextureManager().register(id, new DynamicTexture(() -> "lumenhud " + id.getPath(), img));
            if (isSkin) previewSkinHash = hash;
            else previewCapeHash = hash;
            return true;
        } catch (Exception e) {
            LumenHud.LOG.warn("Could not make the preview texture", e);
            return false;
        }
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
