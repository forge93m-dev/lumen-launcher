package dev.lumen.hud;

import com.mojang.blaze3d.platform.InputConstants;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientLifecycleEvents;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keymapping.v1.KeyMappingHelper;
import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElementRegistry;
import net.fabricmc.fabric.api.event.player.AttackEntityCallback;
import net.minecraft.world.InteractionResult;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.client.Screenshot;
import net.minecraft.resources.Identifier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class LumenHud implements ClientModInitializer {
    public static final Logger LOG = LoggerFactory.getLogger("Lumen HUD");
    private static KeyMapping editKey;
    private static KeyMapping zoomKey;
    private Integer savedFov;
    private int ticks;

    @Override
    public void onInitializeClient() {
        HudConfig.load();
        KeyMapping.Category category = KeyMapping.Category.register(Identifier.fromNamespaceAndPath("lumenhud", "main"));
        editKey = KeyMappingHelper.registerKeyMapping(
                new KeyMapping("key.lumenhud.edit", InputConstants.KEY_RSHIFT, category));
        zoomKey = KeyMappingHelper.registerKeyMapping(new KeyMapping("key.lumenhud.zoom", InputConstants.KEY_C, category));
        // options.txt must never keep the zoomed FOV
        ClientLifecycleEvents.CLIENT_STOPPING.register(client -> restore(client));

        HudElementRegistry.addLast(Identifier.fromNamespaceAndPath("lumenhud", "hud"), (graphics, delta) -> HudRenderer.render(graphics, false));
        // Reach and combo: the client-side attack event fires for every hit the player makes.
        AttackEntityCallback.EVENT.register((player, level, hand, entity, hit) -> {
            if (player == Minecraft.getInstance().player) {
                var eye = player.getEyePosition();
                var b = entity.getBoundingBox();
                ReachTracker.record(eye.x, eye.y, eye.z, b.minX, b.minY, b.minZ, b.maxX, b.maxY, b.maxZ);
                ComboTracker.hit();
            }
            return InteractionResult.PASS;
        });

        ClientTickEvents.END_CLIENT_TICK.register(client -> {
            while (editKey.consumeClick()) {
                if (Compat.screen(client) == null) Compat.setScreen(client, new EditScreen());
            }
            if (++ticks % 40 == 0 && !(Compat.screen(client) instanceof EditScreen)) HudConfig.reloadIfChanged();
            if (client.player != null) SpeedTracker.tick(client.player.getX(), client.player.getZ());
            else SpeedTracker.reset();
            ComboTracker.tick(client.player != null && client.player.hurtTime > 0);
            features(client);
            if (SELFTEST && client.player != null) selfTest(client);
        });
        LOG.info("Lumen HUD ready — press Right Shift to edit the layout");
    }

    /** Toggle sprint, zoom and fullbright. Zoom borrows the FOV option and gives it back (fullbright is in GammaMixin). */
    private void features(Minecraft client) {
        HudConfig cfg = HudConfig.get();
        var o = client.options;
        if (client.player == null) {
            restore(client);
            return;
        }
        if (cfg.toggleSprint && Compat.screen(client) == null && o.keyUp.isDown() && !client.player.isShiftKeyDown()
                && !client.player.horizontalCollision && client.player.getFoodData().getFoodLevel() > 6) {
            client.player.setSprinting(true);
        }
        boolean zooming = cfg.zoom && Compat.screen(client) == null && (zoomKey.isDown() || (SELFTEST && forceZoom));
        if (zooming) {
            if (savedFov == null) savedFov = o.fov().get();
            o.fov().set((int) HudRenderer.clamp(cfg.zoomFov, 5, 110));
        } else if (savedFov != null) {
            o.fov().set(savedFov);
            savedFov = null;
        }
    }

    private void restore(Minecraft client) {
        if (savedFov != null) client.options.fov().set(savedFov);
        savedFov = null;
    }

    // Launcher/dev check: -Dlumenhud.selftest=true captures the HUD and the editor, then quits.
    private static final boolean SELFTEST = Boolean.getBoolean("lumenhud.selftest");
    private static final boolean HOLD = Boolean.getBoolean("lumenhud.hold");
    private int worldTicks;
    private boolean forceZoom;

    private void selfTest(Minecraft client) {
        worldTicks++;
        if (!HOLD) selfTestFeatures(client);
        if (HOLD) { // -Dlumenhud.hold=true: open the editor and report where the FPS element is, so a person (or a script driving the real mouse) can drag it
            if (worldTicks == 230) Compat.setScreen(client, new EditScreen());
            if (worldTicks > 230 && worldTicks % 20 == 0 && HudRenderer.RECTS.get("fps") != null) {
                var r = HudRenderer.RECTS.get("fps");
                LOG.info("selftest: hold fps {},{},{},{} scale={} editor={}", r.x(), r.y(), r.w(), r.h(), client.getWindow().getGuiScale(), Compat.screen(client) instanceof EditScreen);
            }
            if (worldTicks > 230 && worldTicks % 20 == 0) LOG.info("selftest: window active={} mouse={},{}", client.isWindowActive(), client.mouseHandler.getScaledXPos(client.getWindow()), client.mouseHandler.getScaledYPos(client.getWindow()));
            if (worldTicks == 240) LOG.info("selftest: screen after open = {}", Compat.screen(client));
            return;
        }
        if (worldTicks == 120) { // show the two opt-in elements and make three hits on the nearest entity
            HudConfig.get().el("reach").enabled = true;
            HudConfig.get().el("combo").enabled = true;
            for (String id : new String[]{"memory", "session", "server"}) HudConfig.get().el(id).enabled = true;
        } else if (worldTicks == 150 && client.level != null && client.gameMode != null) {
            for (net.minecraft.world.entity.Entity e : client.level.entitiesForRendering()) {
                if (e == client.player) continue;
                for (int i = 0; i < 3; i++) client.gameMode.attack(client.player, e);
                break;
            }
        }
        if (worldTicks == 200 || worldTicks == 260) {
            Screenshot.grab(client.gameDirectory, Compat.mainTarget(client), msg -> LOG.info("selftest: {}", msg.getString()));
        } else if (worldTicks == 230) {
            Compat.setScreen(client, new EditScreen());
        } else if (worldTicks > 230 && worldTicks < 245 && Compat.screen(client) instanceof EditScreen) {
            DragProbe.tick(worldTicks - 230, Compat.mouseSink(client), client.getWindow().getGuiScale());
        }
        if (worldTicks == 280) {
            client.stop();
        }
    }

    /** Switches the client features on for a moment and reports what the game actually did with them. */
    private void selfTestFeatures(Minecraft client) {
        HudConfig cfg = HudConfig.get();
        if (worldTicks == 60) {
            cfg.toggleSprint = true;
            cfg.fullbright = true;
            client.options.keyUp.setDown(true);
        } else if (worldTicks == 100) {
            LOG.info("selftest: sprint={} gamma={}", client.player.isSprinting(), client.options.gamma().get());
            client.options.keyUp.setDown(false);
            cfg.toggleSprint = false;
            forceZoom = true;
        } else if (worldTicks == 110) {
            LOG.info("selftest: zoom fov={}", client.options.fov().get());
            forceZoom = false;
            cfg.fullbright = false;
        } else if (worldTicks == 118) {
            LOG.info("selftest: restored fov={} gamma={}", client.options.fov().get(), client.options.gamma().get());
        }
    }
}
