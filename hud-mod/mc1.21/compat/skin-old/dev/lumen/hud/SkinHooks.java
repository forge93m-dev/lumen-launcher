package dev.lumen.hud;

import net.minecraft.client.MinecraftClient;

/** Dev self-test helper (Minecraft 1.21 - 1.21.8). */
final class SkinHooks {
    private SkinHooks() {}

    static String describe(MinecraftClient c) {
        var s = c.player.getSkinTextures();
        return s.texture() + " " + s.model();
    }
}
