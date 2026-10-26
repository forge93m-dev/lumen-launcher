package dev.lumen.hud;

import com.mojang.blaze3d.platform.InputConstants;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keymapping.v1.KeyMappingHelper;
import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElementRegistry;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.client.Screenshot;
import net.minecraft.resources.Identifier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class LumenHud implements ClientModInitializer {
    public static final Logger LOG = LoggerFactory.getLogger("Lumen HUD");
    private static KeyMapping editKey;
    private int ticks;

    @Override
    public void onInitializeClient() {
        HudConfig.load();
        KeyMapping.Category category = KeyMapping.Category.register(Identifier.fromNamespaceAndPath("lumenhud", "main"));
        editKey = KeyMappingHelper.registerKeyMapping(
                new KeyMapping("key.lumenhud.edit", InputConstants.KEY_RSHIFT, category));

        HudElementRegistry.addLast(Identifier.fromNamespaceAndPath("lumenhud", "hud"), (graphics, delta) -> HudRenderer.render(graphics, false));

        ClientTickEvents.END_CLIENT_TICK.register(client -> {
            while (editKey.consumeClick()) {
                if (Compat.screen(client) == null) Compat.setScreen(client, new EditScreen());
            }
            if (++ticks % 40 == 0 && !(Compat.screen(client) instanceof EditScreen)) HudConfig.reloadIfChanged();
            if (client.player != null) SpeedTracker.tick(client.player.getX(), client.player.getZ());
            else SpeedTracker.reset();
            if (SELFTEST && client.player != null) selfTest(client);
        });
        LOG.info("Lumen HUD ready — press Right Shift to edit the layout");
    }

    // Launcher/dev check: -Dlumenhud.selftest=true captures the HUD and the editor, then quits.
    private static final boolean SELFTEST = Boolean.getBoolean("lumenhud.selftest");
    private int worldTicks;

    private void selfTest(Minecraft client) {
        worldTicks++;
        if (worldTicks == 200 || worldTicks == 260) {
            Screenshot.grab(client.gameDirectory, Compat.mainTarget(client), msg -> LOG.info("selftest: {}", msg.getString()));
        } else if (worldTicks == 230) {
            Compat.setScreen(client, new EditScreen());
        } else if (worldTicks == 280) {
            client.stop();
        }
    }
}
