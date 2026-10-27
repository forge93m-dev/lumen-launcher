package dev.lumen.hud;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.texture.NativeImage;
import net.minecraft.client.texture.NativeImageBackedTexture;
import net.minecraft.util.Identifier;
import com.mojang.blaze3d.systems.RenderSystem;

/** Small white pictures (corners, icons) as textures, drawn tinted. (Minecraft 1.21 - 1.21.1) */
final class Tex {
    private Tex() {}

    static void register(String path, byte[] png) throws java.io.IOException {
        NativeImage img = NativeImage.read(new java.io.ByteArrayInputStream(png));
        MinecraftClient.getInstance().getTextureManager().registerTexture(Identifier.of("lumenhud", path), new NativeImageBackedTexture(img));
    }

    private static final java.util.Map<String, NativeImageBackedTexture> LIVE = new java.util.HashMap<>();

    /** A texture whose pixels are rewritten every frame. */
    static void live(String path, int w, int h) {
        NativeImageBackedTexture tex = new NativeImageBackedTexture(w, h, false);
        LIVE.put(path, tex);
        MinecraftClient.getInstance().getTextureManager().registerTexture(Identifier.of("lumenhud", path), tex);
    }

    static void update(String path, int[] argb, int w) {
        NativeImageBackedTexture tex = LIVE.get(path);
        if (tex == null) return;
        NativeImage img = tex.getImage();
        for (int i = 0; i < argb.length; i++) {
            int c = argb[i];
            img.setColor(i % w, i / w, (c & 0xFF00FF00) | ((c & 0xFF) << 16) | ((c >> 16) & 0xFF)); // the game wants ABGR
        }
        tex.upload();
    }

    static void blit(DrawContext ctx, String path, int x, int y, int w, int h, int tw, int th, int tint) {
        Identifier id = Identifier.of("lumenhud", path);
        ctx.setShaderColor(((tint >> 16) & 0xFF) / 255f, ((tint >> 8) & 0xFF) / 255f, (tint & 0xFF) / 255f, (tint >>> 24) / 255f);
        RenderSystem.enableBlend();
        ctx.drawTexture(id, x, y, w, h, 0f, 0f, tw, th, tw, th);
        ctx.setShaderColor(1f, 1f, 1f, 1f);
    }
}
