package dev.lumen.hud;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.texture.NativeImage;
import net.minecraft.client.texture.NativeImageBackedTexture;
import net.minecraft.util.Identifier;

/** Registers the skin picture as a texture. (Minecraft 1.21.6 and later) */
final class SkinTexture {
    private SkinTexture() {}

    static void register(Identifier id, NativeImage img) {
        MinecraftClient.getInstance().getTextureManager().registerTexture(id, new NativeImageBackedTexture(() -> "lumenhud player skin", img));
    }

    static void release(Identifier id) {
        MinecraftClient.getInstance().getTextureManager().destroyTexture(id);
    }
}
