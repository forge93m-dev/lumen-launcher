package dev.lumen.hud;

import net.minecraft.client.MinecraftClient;

/** Dev self-test helper (Minecraft 1.21.9 and later). */
final class SkinHooks {
    private SkinHooks() {}

    static String describe(MinecraftClient c) {
        var s = c.player.getSkin();
        return s.body().texturePath() + " " + s.model();
    }
}
