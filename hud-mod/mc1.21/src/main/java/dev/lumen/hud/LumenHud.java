package dev.lumen.hud;

import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.command.v2.ClientCommandRegistrationCallback;
import net.fabricmc.fabric.api.client.command.v2.FabricClientCommandSource;
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
import net.minecraft.text.Text;
import org.lwjgl.glfw.GLFW;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class LumenHud implements ClientModInitializer {
    public static final Logger LOG = LoggerFactory.getLogger("Lumen HUD");
    private static KeyBinding editKey;
    private static KeyBinding zoomKey;
    private static KeyBinding freelookKey;
    private static net.minecraft.client.option.Perspective savedPerspective;
    private static Integer savedFov;
    private int ticks;

    @Override
    public void onInitializeClient() {
        HudConfig.load();
        editKey = KeyBindingHelper.registerKeyBinding(Keys.editKey());
        zoomKey = KeyBindingHelper.registerKeyBinding(Keys.zoomKey());
        freelookKey = KeyBindingHelper.registerKeyBinding(Keys.freelookKey());
        ClientTickEvents.START_CLIENT_TICK.register(client -> toggleSneak(client));
        ClientCommandRegistrationCallback.EVENT.register((dispatcher, registryAccess) -> dispatcher.register(LumenCommands.build(new LumenCommands.Host<FabricClientCommandSource>() {
            public void reply(FabricClientCommandSource source, String message) {
                source.sendFeedback(Text.literal("[Lumen] " + message));
            }

            public int[] position() {
                var p = MinecraftClient.getInstance().player;
                return new int[]{(int) Math.floor(p.getX()), (int) Math.floor(p.getY()), (int) Math.floor(p.getZ())};
            }

            public String dimension() {
                var w = MinecraftClient.getInstance().world;
                return w == null ? "" : Stats.dimension(w.getRegistryKey().getValue().getPath());
            }
        })));
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
        zoomFrame(client);
        boolean look = cfg.freelook && client.currentScreen == null && freelookKey.isPressed();
        if (look && !Freelook.active()) {
            Freelook.begin(client.player.getYaw(), client.player.getPitch());
            savedPerspective = o.getPerspective();
            o.setPerspective(net.minecraft.client.option.Perspective.THIRD_PERSON_BACK);
        } else if (!look && Freelook.active()) {
            endFreelook(client);
        }
        String dim = client.world == null ? "" : Stats.dimension(client.world.getRegistryKey().getValue().getPath());
        String msg = DeathTracker.tick(client.player.isDead(), client.player.getX(), client.player.getY(), client.player.getZ(), dim);
        if (msg != null && cfg.deathChat) client.player.sendMessage(Text.literal("[Lumen] " + msg), false);
    }

    /** Runs every frame (and every tick) so the zoom eases smoothly. Zoom borrows the FOV option and gives it back. */
    static void zoomFrame(MinecraftClient client) {
        HudConfig cfg = HudConfig.get();
        var o = client.options;
        boolean zooming = cfg.zoom && client.player != null && client.currentScreen == null && (zoomKey.isPressed() || (SELFTEST && forceZoom));
        if (savedFov == null) {
            if (!zooming) return;
            savedFov = o.getFov().getValue();
            ZoomAnim.reset();
        }
        int fov = ZoomAnim.step(zooming, savedFov, (int) HudRenderer.clamp(cfg.zoomFov, 5, 110), cfg.smoothZoom);
        if (fov < 0) {
            o.getFov().setValue(savedFov);
            savedFov = null;
        } else {
            o.getFov().setValue(fov);
        }
    }

    private static void endFreelook(MinecraftClient client) {
        Freelook.end();
        if (savedPerspective != null) client.options.setPerspective(savedPerspective);
        savedPerspective = null;
    }

    /** Keeps the sneak key held after it was pressed once; runs before the player's tick reads the keys. */
    private static void toggleSneak(MinecraftClient client) {
        HudConfig cfg = HudConfig.get();
        if (!cfg.toggleSneak || client.player == null || client.currentScreen != null) {
            ToggleSneak.reset();
            return;
        }
        var key = client.options.sneakKey;
        boolean physical = Keys.physicallyDown(client, KeyBindingHelper.getBoundKeyOf(key).getCode());
        if (ToggleSneak.update(physical)) key.setPressed(true);
    }

    private static void restore(MinecraftClient client) {
        if (Freelook.active()) endFreelook(client);
        if (savedFov != null) client.options.getFov().setValue(savedFov);
        savedFov = null;
    }

    // Launcher/dev check: -Dlumenhud.selftest=true captures the HUD and the editor, then quits.
    private static final boolean SELFTEST = Boolean.getBoolean("lumenhud.selftest");
    private static final boolean HOLD = Boolean.getBoolean("lumenhud.hold");
    private int worldTicks;
    private static boolean forceZoom;
    private net.minecraft.client.option.Perspective savedSelfPerspective;

    private void selfTest(MinecraftClient client) {
        worldTicks++;
        if (!HOLD) selfTestFeatures(client);
        if (HOLD) { // -Dlumenhud.hold=true: open the editor and report where the FPS element is, so a person (or a script driving the real mouse) can drag it
            if (worldTicks == 230) client.setScreen(new EditScreen(true));
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
        if (worldTicks == 175 || worldTicks == 185) { // other players, and the skin they share through the Lumen skin service
            for (var other : client.world.getPlayers()) {
                if (other != client.player) LOG.info("selftest: remote {} {} at {} {} {} (me {} {} {})", other.getName().getString(), SkinHooks.describe(other), (int) other.getX(), (int) other.getY(), (int) other.getZ(), (int) client.player.getX(), (int) client.player.getY(), (int) client.player.getZ());
            }
        }
        if (worldTicks == 170) {
            LOG.info("selftest: skin {}", SkinHooks.describe(client));
            savedSelfPerspective = client.options.getPerspective();
            client.options.setPerspective(net.minecraft.client.option.Perspective.THIRD_PERSON_BACK);
        } else if (worldTicks == 190) {
            ScreenshotRecorder.saveScreenshot(client.runDirectory, client.getFramebuffer(), msg -> LOG.info("selftest: {}", msg.getString()));
            
        } else if (worldTicks == 195) {
            client.options.setPerspective(savedSelfPerspective);
        }
        if (worldTicks == 200 || worldTicks == 330) {
            ScreenshotRecorder.saveScreenshot(client.runDirectory, client.getFramebuffer(), msg -> LOG.info("selftest: {}", msg.getString()));
        } else if (worldTicks == 230) {
            client.setScreen(new EditScreen(true));
        } else if (worldTicks > 230 && worldTicks < 320 && client.currentScreen instanceof EditScreen) {
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
        if (worldTicks == 345) { // the menu with a custom picture and the ocean skin, then with a gradient and the light skin
            HudConfig.get().menuSkin = "ocean";
            HudConfig.get().menuBackground = "image";
            client.setScreen(new EditScreen());
        } else if (worldTicks == 365) {
            ScreenshotRecorder.saveScreenshot(client.runDirectory, client.getFramebuffer(), msg -> LOG.info("selftest: {}", msg.getString()));
        } else if (worldTicks == 380) {
            HudConfig.get().menuSkin = "light";
            HudConfig.get().menuBackground = "gradient";
        } else if (worldTicks == 400) {
            ScreenshotRecorder.saveScreenshot(client.runDirectory, client.getFramebuffer(), msg -> LOG.info("selftest: {}", msg.getString()));
        }
        if (worldTicks == 420) {
            client.scheduleStop();
        }
    }

    /** Switches the client features on for a moment and reports what the game actually did with them. */
    private void selfTestFeatures(MinecraftClient client) {
        HudConfig cfg = HudConfig.get();
        if (worldTicks == 30 && client.player != null) {
            float before = client.player.getYaw();
            Freelook.begin(before, client.player.getPitch());
            client.player.changeLookDirection(100, 40);
            LOG.info("selftest: freelook player={} cam={} camPitch={}", client.player.getYaw() == before ? "unchanged" : "turned", Freelook.yaw() - before, Freelook.pitch());
            Freelook.end();
            boolean a = ToggleSneak.update(true);
            boolean b = ToggleSneak.update(false);
            boolean c = ToggleSneak.update(true);
            ToggleSneak.reset();
            LOG.info("selftest: sneak toggle {} {} {}", a, b, c);
        }
        if (worldTicks == 20) {
            DeathTracker.tick(false, 1, 2, 3, "");
            DeathTracker.tick(true, 10.5, 64, -20.2, "Nether");
            LOG.info("selftest: death message={} last={}", DeathTracker.tick(false, 0, 0, 0, ""), DeathTracker.last());
        } else if (worldTicks == 60) {
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
