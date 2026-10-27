package dev.lumen.hud;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.texture.NativeImage;
import net.minecraft.client.texture.NativeImageBackedTexture;
import net.minecraft.util.Identifier;
import net.minecraft.client.render.RenderLayer;

/** Small white pictures (corners, icons) as textures, drawn tinted. (Minecraft 1.21.2 - 1.21.5) */
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
            img.setColorArgb(i % w, i / w, c);
        }
        tex.upload();
    }

    static void blit(DrawContext ctx, String path, int x, int y, int w, int h, int tw, int th, int tint) {
        Identifier id = Identifier.of("lumenhud", path);
        ctx.drawTexture(RenderLayer::getGuiTextured, id, x, y, 0f, 0f, w, h, tw, th, tw, th, tint);
    }
}
