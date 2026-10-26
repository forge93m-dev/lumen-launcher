package dev.lumen.hud;

import net.minecraft.client.MinecraftClient;

/** Dev self-test helper (Minecraft 1.21 - 1.21.8). */
final class SkinHooks {
    private SkinHooks() {}

    static String describe(MinecraftClient c) {
        return describe(c.player);
    }

    static String describe(net.minecraft.client.network.AbstractClientPlayerEntity p) {
        var s = p.getSkinTextures();
        return s.texture() + " " + s.model() + " cape=" + s.capeTexture();
    }
}
