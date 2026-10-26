package dev.lumen.hud;

import net.minecraft.client.MinecraftClient;

/** Dev self-test helper (Minecraft 1.21.9 and later). */
final class SkinHooks {
    private SkinHooks() {}

    static String describe(MinecraftClient c) {
        return describe(c.player);
    }

    static String describe(net.minecraft.client.network.AbstractClientPlayerEntity p) {
        var s = p.getSkin();
        return s.body().texturePath() + " " + s.model() + " cape=" + (s.cape() == null ? "none" : s.cape().texturePath());
    }
}
