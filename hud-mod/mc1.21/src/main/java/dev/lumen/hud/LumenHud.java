package dev.lumen.hud;

import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.fabricmc.fabric.api.client.rendering.v1.HudRenderCallback;
import net.fabricmc.fabric.api.event.player.AttackEntityCallback;
import net.minecraft.util.ActionResult;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.ScreenshotRecorder;
import net.minecraft.client.util.InputUtil;
import org.lwjgl.glfw.GLFW;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class LumenHud implements ClientModInitializer {
    public static final Logger LOG = LoggerFactory.getLogger("Lumen HUD");
    private static KeyBinding editKey;
    private int ticks;

    @Override
    public void onInitializeClient() {
        HudConfig.load();
        editKey = KeyBindingHelper.registerKeyBinding(Keys.editKey());

        HudRenderCallback.EVENT.register((ctx, tickCounter) -> HudRenderer.render(ctx, false));
        // Reach and combo: the client-side attack event fires for every hit the player makes.
        AttackEntityCallback.EVENT.register((player, world, hand, entity, hit) -> {
            if (player == MinecraftClient.getInstance().player) {
                var eye = player.getEyePos();
                var b = entity.getBoundingBox();
                ReachTracker.record(eye.x, eye.y, eye.z, b.minX, b.minY, b.minZ, b.maxX, b.maxY, b.maxZ);
                ComboTracker.hit();
            }
            return ActionResult.PASS;
        });

        ClientTickEvents.END_CLIENT_TICK.register(client -> {
            while (editKey.wasPressed()) {
                if (client.currentScreen == null) client.setScreen(new EditScreen());
            }
            if (++ticks % 40 == 0 && !(client.currentScreen instanceof EditScreen)) HudConfig.reloadIfChanged();
            if (client.player != null) SpeedTracker.tick(client.player.getX(), client.player.getZ());
            else SpeedTracker.reset();
            ComboTracker.tick(client.player != null && client.player.hurtTime > 0);
            if (SELFTEST && client.player != null) selfTest(client);
        });
        LOG.info("Lumen HUD ready — press Right Shift to edit the layout");
    }

    // Launcher/dev check: -Dlumenhud.selftest=true captures the HUD and the editor, then quits.
    private static final boolean SELFTEST = Boolean.getBoolean("lumenhud.selftest");
    private int worldTicks;

    private void selfTest(MinecraftClient client) {
        worldTicks++;
        if (worldTicks == 120) { // show the two opt-in elements and make three hits on the nearest entity
            HudConfig.get().el("reach").enabled = true;
            HudConfig.get().el("combo").enabled = true;
        } else if (worldTicks == 150 && client.world != null && client.interactionManager != null) {
            for (net.minecraft.entity.Entity e : client.world.getEntities()) {
                if (e == client.player) continue;
                for (int i = 0; i < 3; i++) client.interactionManager.attackEntity(client.player, e);
                break;
            }
        }
        if (worldTicks == 200 || worldTicks == 260) {
            ScreenshotRecorder.saveScreenshot(client.runDirectory, client.getFramebuffer(), msg -> LOG.info("selftest: {}", msg.getString()));
        } else if (worldTicks == 230) {
            client.setScreen(new EditScreen());
        } else if (worldTicks == 280) {
            client.scheduleStop();
        }
    }
}
