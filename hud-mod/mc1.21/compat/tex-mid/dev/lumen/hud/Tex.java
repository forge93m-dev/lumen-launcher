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

    static void blit(DrawContext ctx, String path, int x, int y, int w, int h, int tw, int th, int tint) {
        Identifier id = Identifier.of("lumenhud", path);
        ctx.drawTexture(RenderLayer::getGuiTextured, id, x, y, 0f, 0f, w, h, tw, th, tw, th, tint);
    }
}
