package dev.lumen.hud;

import com.mojang.blaze3d.platform.InputConstants;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.command.v2.ClientCommandRegistrationCallback;
import net.fabricmc.fabric.api.client.command.v2.FabricClientCommandSource;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientLifecycleEvents;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keymapping.v1.KeyMappingHelper;
import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElementRegistry;
import net.fabricmc.fabric.api.event.player.AttackEntityCallback;
import net.minecraft.world.InteractionResult;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.client.Screenshot;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.Identifier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class LumenHud implements ClientModInitializer {
    public static final Logger LOG = LoggerFactory.getLogger("Lumen HUD");
    private static KeyMapping editKey;
    private static KeyMapping zoomKey;
    private static KeyMapping freelookKey;
    private static net.minecraft.client.CameraType savedPerspective;
    private static Integer savedFov;
    private int ticks;

    @Override
    public void onInitializeClient() {
        HudConfig.load();
        KeyMapping.Category category = KeyMapping.Category.register(Identifier.fromNamespaceAndPath("lumenhud", "main"));
        editKey = KeyMappingHelper.registerKeyMapping(
                new KeyMapping("key.lumenhud.edit", InputConstants.KEY_RSHIFT, category));
        zoomKey = KeyMappingHelper.registerKeyMapping(new KeyMapping("key.lumenhud.zoom", InputConstants.KEY_C, category));
        freelookKey = KeyMappingHelper.registerKeyMapping(new KeyMapping("key.lumenhud.freelook", InputConstants.KEY_LALT, category));
        ClientTickEvents.START_CLIENT_TICK.register(client -> toggleSneak(client));
        ClientCommandRegistrationCallback.EVENT.register((dispatcher, registryAccess) -> dispatcher.register(LumenCommands.build(new LumenCommands.Host<FabricClientCommandSource>() {
            public void reply(FabricClientCommandSource source, String message) {
                source.sendFeedback(Component.literal("[Lumen] " + message));
            }

            public int[] position() {
                var p = Minecraft.getInstance().player;
                return new int[]{(int) Math.floor(p.getX()), (int) Math.floor(p.getY()), (int) Math.floor(p.getZ())};
            }

            public String dimension() {
                var w = Minecraft.getInstance().level;
                return w == null ? "" : Stats.dimension(w.dimension().identifier().getPath());
            }
        })));
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
        zoomFrame(client);
        boolean look = cfg.freelook && Compat.screen(client) == null && freelookKey.isDown();
        if (look && !Freelook.active()) {
            Freelook.begin(client.player.getYRot(), client.player.getXRot());
            savedPerspective = o.getCameraType();
            o.setCameraType(net.minecraft.client.CameraType.THIRD_PERSON_BACK);
        } else if (!look && Freelook.active()) {
            endFreelook(client);
        }
        String dim = client.level == null ? "" : Stats.dimension(client.level.dimension().identifier().getPath());
        String msg = DeathTracker.tick(client.player.isDeadOrDying(), client.player.getX(), client.player.getY(), client.player.getZ(), dim);
        if (msg != null && cfg.deathChat) client.player.sendSystemMessage(Component.literal("[Lumen] " + msg));
    }

    /** Runs every frame (and every tick) so the zoom eases smoothly. Zoom borrows the FOV option and gives it back. */
    static void zoomFrame(Minecraft client) {
        HudConfig cfg = HudConfig.get();
        var o = client.options;
        boolean zooming = cfg.zoom && client.player != null && Compat.screen(client) == null && (zoomKey.isDown() || (SELFTEST && forceZoom));
        if (savedFov == null) {
            if (!zooming) return;
            savedFov = o.fov().get();
            ZoomAnim.reset();
        }
        int fov = ZoomAnim.step(zooming, savedFov, (int) HudRenderer.clamp(cfg.zoomFov, 5, 110), cfg.smoothZoom);
        if (fov < 0) {
            o.fov().set(savedFov);
            savedFov = null;
        } else {
            o.fov().set(fov);
        }
    }

    private static void endFreelook(Minecraft client) {
        Freelook.end();
        if (savedPerspective != null) client.options.setCameraType(savedPerspective);
        savedPerspective = null;
    }

    /** Keeps the sneak key held after it was pressed once; runs before the player's tick reads the keys. */
    private static void toggleSneak(Minecraft client) {
        HudConfig cfg = HudConfig.get();
        if (!cfg.toggleSneak || client.player == null || Compat.screen(client) != null) {
            ToggleSneak.reset();
            return;
        }
        var key = client.options.keyShift;
        if (ToggleSneak.update(Compat.physicallyDown(key))) key.setDown(true);
    }

    private static void restore(Minecraft client) {
        if (Freelook.active()) endFreelook(client);
        if (savedFov != null) client.options.fov().set(savedFov);
        savedFov = null;
    }

    // Launcher/dev check: -Dlumenhud.selftest=true captures the HUD and the editor, then quits.
    private static final boolean SELFTEST = Boolean.getBoolean("lumenhud.selftest");
    private static final boolean HOLD = Boolean.getBoolean("lumenhud.hold");
    private int worldTicks;
    private static boolean forceZoom;
    private net.minecraft.client.CameraType savedSelfPerspective;

    private void selfTest(Minecraft client) {
        worldTicks++;
        if (!HOLD) selfTestFeatures(client);
        if (HOLD) { // -Dlumenhud.hold=true: open the editor and report where the FPS element is, so a person (or a script driving the real mouse) can drag it
            if (worldTicks == 230) Compat.setScreen(client, new EditScreen(true));
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
        if (worldTicks == 175 || worldTicks == 185) { // other players, and the skin they share through the Lumen skin service
            for (var other : client.level.players()) {
                if (other != client.player) LOG.info("selftest: remote {} {} at {} {} {} (me {} {} {})", other.getName().getString(), SkinImage.describe(other), (int) other.getX(), (int) other.getY(), (int) other.getZ(), (int) client.player.getX(), (int) client.player.getY(), (int) client.player.getZ());
            }
        }
        if (worldTicks == 170) {
            LOG.info("selftest: skin {}", SkinImage.describe(client));
            savedSelfPerspective = client.options.getCameraType();
            client.options.setCameraType(net.minecraft.client.CameraType.THIRD_PERSON_BACK);
        } else if (worldTicks == 190) {
            Screenshot.grab(client.gameDirectory, Compat.mainTarget(client), msg -> LOG.info("selftest: {}", msg.getString()));
            
        } else if (worldTicks == 195) {
            client.options.setCameraType(savedSelfPerspective);
        }
        if (worldTicks == 200 || worldTicks == 330) {
            Screenshot.grab(client.gameDirectory, Compat.mainTarget(client), msg -> LOG.info("selftest: {}", msg.getString()));
        } else if (worldTicks == 230) {
            Compat.setScreen(client, new EditScreen(true));
        } else if (worldTicks > 230 && worldTicks < 320 && Compat.screen(client) instanceof EditScreen) {
            DragProbe.tick(worldTicks - 230, Compat.mouseSink(client), client.getWindow().getGuiScale());
        }
        if (worldTicks == 345) { // the menu with a custom picture and the ocean skin, then with a gradient and the light skin
            HudConfig.get().menuSkin = "ocean";
            HudConfig.get().menuBackground = "image";
            Compat.setScreen(client, new EditScreen());
        } else if (worldTicks == 365) {
            Screenshot.grab(client.gameDirectory, Compat.mainTarget(client), msg -> LOG.info("selftest: {}", msg.getString()));
        } else if (worldTicks == 380) {
            HudConfig.get().menuSkin = "light";
            HudConfig.get().menuBackground = "gradient";
        } else if (worldTicks == 400) {
            Screenshot.grab(client.gameDirectory, Compat.mainTarget(client), msg -> LOG.info("selftest: {}", msg.getString()));
        }
        if (worldTicks == 420) {
            client.stop();
        }
    }

    /** Switches the client features on for a moment and reports what the game actually did with them. */
    private void selfTestFeatures(Minecraft client) {
        HudConfig cfg = HudConfig.get();
        if (worldTicks == 30 && client.player != null) {
            float before = client.player.getYRot();
            Freelook.begin(before, client.player.getXRot());
            client.player.turn(100, 40);
            LOG.info("selftest: freelook player={} cam={} camPitch={}", client.player.getYRot() == before ? "unchanged" : "turned", Freelook.yaw() - before, Freelook.pitch());
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
