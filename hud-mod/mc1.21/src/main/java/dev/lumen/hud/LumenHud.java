package dev.lumen.hud;

import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientLifecycleEvents;
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
    private static KeyBinding zoomKey;
    private Integer savedFov;
    private int ticks;

    @Override
    public void onInitializeClient() {
        HudConfig.load();
        editKey = KeyBindingHelper.registerKeyBinding(Keys.editKey());
        zoomKey = KeyBindingHelper.registerKeyBinding(Keys.zoomKey());
        // options.txt must never keep the zoomed FOV
        ClientLifecycleEvents.CLIENT_STOPPING.register(client -> restore(client));

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
            features(client);
            if (SELFTEST && client.player != null) selfTest(client);
        });
        LOG.info("Lumen HUD ready — press Right Shift to edit the layout");
    }

    /** Toggle sprint, zoom and fullbright. Zoom borrows the FOV option and gives it back (fullbright is in GammaMixin). */
    private void features(MinecraftClient client) {
        HudConfig cfg = HudConfig.get();
        var o = client.options;
        if (client.player == null) {
            restore(client);
            return;
        }
        if (cfg.toggleSprint && client.currentScreen == null && o.forwardKey.isPressed() && !client.player.isSneaking()
                && !client.player.horizontalCollision && client.player.getHungerManager().getFoodLevel() > 6) {
            client.player.setSprinting(true);
        }
        boolean zooming = cfg.zoom && client.currentScreen == null && (zoomKey.isPressed() || (SELFTEST && forceZoom));
        if (zooming) {
            if (savedFov == null) savedFov = o.getFov().getValue();
            o.getFov().setValue((int) HudRenderer.clamp(cfg.zoomFov, 5, 110));
        } else if (savedFov != null) {
            o.getFov().setValue(savedFov);
            savedFov = null;
        }
    }

    private void restore(MinecraftClient client) {
        if (savedFov != null) client.options.getFov().setValue(savedFov);
        savedFov = null;
    }

    // Launcher/dev check: -Dlumenhud.selftest=true captures the HUD and the editor, then quits.
    private static final boolean SELFTEST = Boolean.getBoolean("lumenhud.selftest");
    private static final boolean HOLD = Boolean.getBoolean("lumenhud.hold");
    private int worldTicks;
    private boolean forceZoom;

    private void selfTest(MinecraftClient client) {
        worldTicks++;
        if (!HOLD) selfTestFeatures(client);
        if (HOLD) { // -Dlumenhud.hold=true: open the editor and report where the FPS element is, so a person (or a script driving the real mouse) can drag it
            if (worldTicks == 230) client.setScreen(new EditScreen());
            if (worldTicks > 230 && worldTicks % 20 == 0 && HudRenderer.RECTS.get("fps") != null) {
                var r = HudRenderer.RECTS.get("fps");
                LOG.info("selftest: hold fps {},{},{},{} scale={} editor={}", r.x(), r.y(), r.w(), r.h(), client.getWindow().getScaleFactor(), client.currentScreen instanceof EditScreen);
            }
            return;
        }
        if (worldTicks == 120) { // show the two opt-in elements and make three hits on the nearest entity
            HudConfig.get().el("reach").enabled = true;
            HudConfig.get().el("combo").enabled = true;
            for (String id : new String[]{"memory", "session", "server"}) HudConfig.get().el(id).enabled = true;
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
        } else if (worldTicks > 230 && worldTicks < 245 && client.currentScreen instanceof EditScreen) {
            long win = client.getWindow().getHandle();
            DragProbe.tick(worldTicks - 230, new DragProbe.Sink() {
                public void move(double x, double y) {
                    var cb = GLFW.glfwSetCursorPosCallback(win, null);
                    GLFW.glfwSetCursorPosCallback(win, cb);
                    if (cb != null) cb.invoke(win, x, y);
                }

                public void button(int b, boolean pressed) {
                    var cb = GLFW.glfwSetMouseButtonCallback(win, null);
                    GLFW.glfwSetMouseButtonCallback(win, cb);
                    if (cb != null) cb.invoke(win, b, pressed ? GLFW.GLFW_PRESS : GLFW.GLFW_RELEASE, 0);
                }
            }, client.getWindow().getScaleFactor());
        }
        if (worldTicks == 280) {
            client.scheduleStop();
        }
    }

    /** Switches the client features on for a moment and reports what the game actually did with them. */
    private void selfTestFeatures(MinecraftClient client) {
        HudConfig cfg = HudConfig.get();
        if (worldTicks == 60) {
            cfg.toggleSprint = true;
            cfg.fullbright = true;
            client.options.forwardKey.setPressed(true);
        } else if (worldTicks == 100) {
            LOG.info("selftest: sprint={} gamma={}", client.player.isSprinting(), client.options.getGamma().getValue());
            client.options.forwardKey.setPressed(false);
            cfg.toggleSprint = false;
            forceZoom = true;
        } else if (worldTicks == 110) {
            LOG.info("selftest: zoom fov={}", client.options.getFov().getValue());
            forceZoom = false;
            cfg.fullbright = false;
        } else if (worldTicks == 118) {
            LOG.info("selftest: restored fov={} gamma={}", client.options.getFov().getValue(), client.options.getGamma().getValue());
        }
    }
}
