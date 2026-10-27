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

    static void blit(DrawContext ctx, String path, int x, int y, int w, int h, int tw, int th, int tint) {
        Identifier id = Identifier.of("lumenhud", path);
        ctx.setShaderColor(((tint >> 16) & 0xFF) / 255f, ((tint >> 8) & 0xFF) / 255f, (tint & 0xFF) / 255f, (tint >>> 24) / 255f);
        RenderSystem.enableBlend();
        ctx.drawTexture(id, x, y, w, h, 0f, 0f, tw, th, tw, th);
        ctx.setShaderColor(1f, 1f, 1f, 1f);
    }
}
