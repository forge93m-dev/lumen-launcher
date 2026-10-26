package dev.lumen.hud;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.gui.DrawContext;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import net.minecraft.entity.EquipmentSlot;
import net.minecraft.item.ItemStack;
import net.minecraft.util.hit.BlockHitResult;
import net.minecraft.util.hit.EntityHitResult;
import net.minecraft.util.hit.HitResult;
import net.minecraft.util.math.Direction;
import org.lwjgl.glfw.GLFW;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class HudRenderer {
    public record Rect(int x, int y, int w, int h) {
        public boolean contains(double px, double py) {
            return px >= x && py >= y && px < x + w && py < y + h;
        }
    }

    /** Screen-space bounds of every element drawn in the last frame (used by the editor). */
    public static final Map<String, Rect> RECTS = new LinkedHashMap<>();
    private static final int KEY = 22;
    private static final int GAP = 2;
    private static final int ROW = 17;

    private HudRenderer() {}

    public static void render(DrawContext ctx, boolean editing) {
        render(ctx, editing, false);
    }

    /** The live HUD drawn behind the menu (the normal checks that hide it do not apply there). */
    public static void preview(DrawContext ctx) {
        render(ctx, false, true);
    }

    private static void render(DrawContext ctx, boolean editing, boolean force) {
        MinecraftClient c = MinecraftClient.getInstance();
        HudConfig cfg = HudConfig.get();
        Anim.frame();
        LumenHud.zoomFrame(c);
        if (!editing && !force) {
            if (c.options.hudHidden || c.player == null || c.currentScreen instanceof EditScreen) return;
            if (cfg.hideInDebug && c.getDebugHud().shouldShowDebugHud()) return;
        }
        RECTS.clear();
        int sw = ctx.getScaledWindowWidth();
        int sh = ctx.getScaledWindowHeight();
        for (String id : HudConfig.IDS) {
            HudConfig.Element el = cfg.el(id);
            if (!el.enabled && !editing) continue;
            int[] size = size(id, c, cfg, editing);
            if (size == null) continue;
            float s = (float) clamp(el.scale, 0.5, 3);
            int w = Math.round(size[0] * s);
            int h = Math.round(size[1] * s);
            int x = place(el.ax, el.x, sw, w);
            int y = place(el.ay, el.y, sh, h);
            Matrices.push(ctx);
            Matrices.translate(ctx, x, y);
            Matrices.scale(ctx, s, s);
            draw(id, ctx, c, cfg, size[0], size[1], editing);
            Matrices.pop(ctx);
            RECTS.put(id, new Rect(x, y, w, h));
        }
    }

    /** Converts an anchor + inward offset into a top-left coordinate, kept on screen. */
    static int place(double anchor, double offset, int screen, int size) {
        double a = anchor >= 0.75 ? 1 : anchor >= 0.25 ? 0.5 : 0;
        double pos = a * (screen - size) + (a == 1 ? -offset : offset);
        return (int) Math.round(clamp(pos, 0, Math.max(0, screen - size)));
    }

    static double clamp(double v, double lo, double hi) {
        return Math.max(lo, Math.min(hi, v));
    }

    // ---------------- sizing ----------------

    private static int[] size(String id, MinecraftClient c, HudConfig cfg, boolean editing) {
        TextRenderer tr = c.textRenderer;
        return switch (id) {
            case "fps" -> new int[]{tr.getWidth(c.getCurrentFps() + " FPS") + 8, 15};
            case "cps" -> new int[]{tr.getWidth(cpsText() + " CPS") + 8, 15};
            case "coords" -> {
                List<String[]> lines = coordLines(c, cfg);
                int w = 0;
                for (String[] l : lines) w = Math.max(w, tr.getWidth(l[0] + " " + l[1]));
                yield new int[]{w + 8, lines.size() * 10 + 4};
            }
            case "keystrokes" -> new int[]{3 * KEY + 2 * GAP, 3 * KEY + 2 * GAP + (cfg.keystrokesSpace ? GAP + 10 : 0)};
            case "armor" -> {
                List<ItemStack> items = armorItems(c, cfg);
                if (items.isEmpty()) yield editing ? new int[]{tr.getWidth("Armor") + 8, 15} : null;
                int w = 0;
                for (ItemStack st : items) w = Math.max(w, tr.getWidth(itemText(st, cfg)));
                yield new int[]{20 + w + (w > 0 ? 4 : 0), items.size() * ROW + 2};
            }
            case "ping" -> new int[]{tr.getWidth(pingText(c) + " ms") + 8, 15};
            case "speed" -> new int[]{tr.getWidth(SpeedTracker.text() + " b/s") + 8, 15};
            case "reach" -> new int[]{tr.getWidth(ReachTracker.text() + " blocks") + 8, 15};
            case "combo" -> new int[]{tr.getWidth(ComboTracker.text() + " combo") + 8, 15};
            case "clock" -> new int[]{tr.getWidth(clockText(cfg)) + 8, 15};
            case "compass" -> new int[]{Compass.WIDTH, Compass.HEIGHT};
            case "death" -> {
                String d = DeathTracker.last();
                if (d == null) yield editing ? new int[]{tr.getWidth("Last death") + 8, 15} : null;
                yield new int[]{tr.getWidth("Death  " + d) + 8, 15};
            }
            case "alert" -> {
                String a = alertText(c, cfg);
                if (a == null) yield editing ? new int[]{tr.getWidth("Durability alert") + 8, 15} : null;
                yield new int[]{tr.getWidth(a) + 8, 15};
            }
            case "memory" -> new int[]{tr.getWidth(Stats.memory(cfg.memoryShowMax) + " MB") + 8, 15};
            case "session" -> new int[]{tr.getWidth(Stats.session()) + 8, 15};
            case "server" -> new int[]{tr.getWidth(serverText(c)) + 8, 15};
            case "sprint" -> {
                if (!cfg.toggleSprint && !editing) yield null;
                yield new int[]{tr.getWidth(sprintText(c)) + 8, 15};
            }
            case "items" -> {
                List<Object[]> rows = itemRows(c, cfg);
                if (rows.isEmpty()) yield editing ? new int[]{tr.getWidth("Items") + 8, 15} : null;
                int w = 0;
                for (Object[] r : rows) w = Math.max(w, tr.getWidth(String.valueOf(r[1])));
                yield new int[]{20 + w + 4, rows.size() * ROW + 2};
            }
            case "target" -> {
                String[] t = target(c);
                if (t == null) yield editing ? new int[]{tr.getWidth("Target") + 8, 15} : null;
                yield new int[]{tr.getWidth(t[0] + (t[1].isEmpty() ? "" : "  " + t[1])) + 8, t[2].isEmpty() ? 15 : 19};
            }
            case "effects" -> {
                List<String[]> lines = effectLines(c);
                if (lines.isEmpty()) yield editing ? new int[]{tr.getWidth("Effects") + 8, 15} : null;
                int w = 0;
                for (String[] l : lines) w = Math.max(w, tr.getWidth(l[0] + " " + l[1]));
                yield new int[]{w + 8, lines.size() * 10 + 4};
            }
            default -> null;
        };
    }

    // ---------------- drawing ----------------

    private static void draw(String id, DrawContext ctx, MinecraftClient c, HudConfig cfg, int w, int h, boolean editing) {
        TextRenderer tr = c.textRenderer;
        switch (id) {
            case "fps" -> valueBox(ctx, tr, cfg, String.valueOf(c.getCurrentFps()), " FPS", w, h);
            case "cps" -> valueBox(ctx, tr, cfg, cpsText(), " CPS", w, h);
            case "coords" -> {
                panel(ctx, cfg, w, h);
                int y = 3;
                for (String[] l : coordLines(c, cfg)) {
                    text(ctx, tr, cfg, l[0], 4, y, cfg.accent());
                    text(ctx, tr, cfg, l[1], 4 + tr.getWidth(l[0] + " "), y, cfg.text());
                    y += 10;
                }
            }
            case "keystrokes" -> keystrokes(ctx, c, tr, cfg);
            case "armor" -> {
                panel(ctx, cfg, w, h);
                List<ItemStack> items = armorItems(c, cfg);
                if (items.isEmpty()) {
                    text(ctx, tr, cfg, "Armor", 4, 4, cfg.text());
                    return;
                }
                int y = 1;
                for (ItemStack st : items) {
                    ctx.drawItem(st, 2, y);
                    if (!cfg.armorDurability) Items.overlay(ctx, tr, st, 2, y);
                    String t = itemText(st, cfg);
                    if (!t.isEmpty()) text(ctx, tr, cfg, t, 20, y + 4, durabilityColor(st, cfg));
                    y += ROW;
                }
            }
            case "ping" -> valueBox(ctx, tr, cfg, pingText(c), " ms", w, h);
            case "speed" -> valueBox(ctx, tr, cfg, SpeedTracker.text(), " b/s", w, h);
            case "reach" -> valueBox(ctx, tr, cfg, ReachTracker.text(), " blocks", w, h);
            case "combo" -> valueBox(ctx, tr, cfg, ComboTracker.text(), " combo", w, h);
            case "clock" -> {
                panel(ctx, cfg, w, h);
                text(ctx, tr, cfg, clockText(cfg), 4, 4, cfg.text());
            }
            case "compass" -> {
                var pl = c.player;
                String dim = c.world == null ? "" : Stats.dimension(c.world.getRegistryKey().getValue().getPath());
                double yaw = Freelook.active() ? Freelook.yaw() : pl == null ? 0 : pl.getYaw();
                Compass.draw(new GfxImpl(ctx, tr), cfg, yaw, pl == null ? 0 : pl.getX(), pl == null ? 0 : pl.getZ(), Waypoints.in(dim));
            }
            case "death" -> {
                panel(ctx, cfg, w, h);
                String d = DeathTracker.last();
                if (d == null) {
                    text(ctx, tr, cfg, "Last death", 4, 4, cfg.text());
                    return;
                }
                text(ctx, tr, cfg, "Death", 4, 4, cfg.accent());
                text(ctx, tr, cfg, d, 4 + tr.getWidth("Death  "), 4, cfg.text());
            }
            case "alert" -> {
                panel(ctx, cfg, w, h);
                String a = alertText(c, cfg);
                if (a == null) {
                    text(ctx, tr, cfg, "Durability alert", 4, 4, cfg.text());
                    return;
                }
                text(ctx, tr, cfg, a, 4, 4, Stats.blink() ? 0xFFFF5555 : 0xFFFFAA55);
            }
            case "memory" -> valueBox(ctx, tr, cfg, Stats.memory(cfg.memoryShowMax), " MB", w, h);
            case "session" -> {
                panel(ctx, cfg, w, h);
                text(ctx, tr, cfg, Stats.session(), 4, 4, cfg.text());
            }
            case "server" -> {
                panel(ctx, cfg, w, h);
                text(ctx, tr, cfg, serverText(c), 4, 4, cfg.text());
            }
            case "sprint" -> {
                panel(ctx, cfg, w, h);
                text(ctx, tr, cfg, sprintText(c), 4, 4, cfg.accent());
            }
            case "items" -> {
                panel(ctx, cfg, w, h);
                List<Object[]> rows = itemRows(c, cfg);
                if (rows.isEmpty()) {
                    text(ctx, tr, cfg, "Items", 4, 4, cfg.text());
                    return;
                }
                int y = 1;
                for (Object[] r : rows) {
                    ctx.drawItem((ItemStack) r[0], 2, y);
                    text(ctx, tr, cfg, String.valueOf(r[1]), 20, y + 4, cfg.text());
                    y += ROW;
                }
            }
            case "target" -> {
                panel(ctx, cfg, w, h);
                String[] t = target(c);
                if (t == null) {
                    text(ctx, tr, cfg, "Target", 4, 4, cfg.text());
                    return;
                }
                text(ctx, tr, cfg, t[0], 4, 4, cfg.text());
                if (!t[1].isEmpty()) text(ctx, tr, cfg, t[1], 4 + tr.getWidth(t[0] + "  "), 4, cfg.accent());
                if (!t[2].isEmpty()) {
                    double ratio = Double.parseDouble(t[2]);
                    ctx.fill(4, 14, w - 4, 16, 0x66000000);
                    ctx.fill(4, 14, 4 + (int) Math.round((w - 8) * ratio), 16, Look.mix(0xFFE84545, 0xFF45D45B, ratio));
                }
            }
            case "effects" -> {
                panel(ctx, cfg, w, h);
                List<String[]> lines = effectLines(c);
                if (lines.isEmpty()) {
                    text(ctx, tr, cfg, "Effects", 4, 4, cfg.text());
                    return;
                }
                int y = 3;
                for (String[] l : lines) {
                    text(ctx, tr, cfg, l[0], 4, y, cfg.accent());
                    text(ctx, tr, cfg, l[1], 4 + tr.getWidth(l[0] + " "), y, cfg.text());
                    y += 10;
                }
            }
            default -> {}
        }
    }

    private static void valueBox(DrawContext ctx, TextRenderer tr, HudConfig cfg, String value, String suffix, int w, int h) {
        panel(ctx, cfg, w, h);
        text(ctx, tr, cfg, value, 4, 4, cfg.text());
        text(ctx, tr, cfg, suffix, 4 + tr.getWidth(value), 4, cfg.accent());
    }

    private static void panel(DrawContext ctx, HudConfig cfg, int w, int h) {
        Look.panel(new GfxImpl(ctx, MinecraftClient.getInstance().textRenderer), cfg, w, h);
    }

    private static void text(DrawContext ctx, TextRenderer tr, HudConfig cfg, String s, int x, int y, int color) {
        ctx.drawText(tr, s, x, y, color, cfg.shadow);
    }

    private static String cpsText() {
        return ClickTracker.left() + " | " + ClickTracker.right();
    }

    private static List<String[]> coordLines(MinecraftClient c, HudConfig cfg) {
        List<String[]> out = new ArrayList<>();
        if (c.player == null) {
            out.add(new String[]{"XYZ", "0 64 0"});
            return out;
        }
        out.add(new String[]{"XYZ", (int) Math.floor(c.player.getX()) + " " + (int) Math.floor(c.player.getY()) + " " + (int) Math.floor(c.player.getZ())});
        if (cfg.coordsFacing) {
            Direction d = c.player.getHorizontalFacing();
            String axis = switch (d) {
                case NORTH -> "-Z";
                case SOUTH -> "+Z";
                case WEST -> "-X";
                case EAST -> "+X";
                default -> "";
            };
            out.add(new String[]{"Facing", d.asString() + " (" + axis + ")"});
        }
        if (cfg.coordsBiome && c.world != null) {
            String biome = c.world.getBiome(c.player.getBlockPos()).getKey()
                    .map(k -> k.getValue().getPath().replace('_', ' ')).orElse("unknown");
            out.add(new String[]{"Biome", biome});
        }
        return out;
    }

    private static List<ItemStack> armorItems(MinecraftClient c, HudConfig cfg) {
        List<ItemStack> out = new ArrayList<>();
        if (c.player == null) return out;
        for (EquipmentSlot slot : new EquipmentSlot[]{EquipmentSlot.HEAD, EquipmentSlot.CHEST, EquipmentSlot.LEGS, EquipmentSlot.FEET}) {
            ItemStack st = c.player.getEquippedStack(slot);
            if (!st.isEmpty()) out.add(st);
        }
        if (cfg.armorHeldItem && !c.player.getMainHandStack().isEmpty()) out.add(c.player.getMainHandStack());
        return out;
    }

    private static String itemText(ItemStack st, HudConfig cfg) {
        if (st.isDamageable() && cfg.armorDurability) return String.valueOf(st.getMaxDamage() - st.getDamage());
        if (st.getCount() > 1) return String.valueOf(st.getCount());
        return "";
    }

    private static int durabilityColor(ItemStack st, HudConfig cfg) {
        if (!st.isDamageable()) return cfg.text();
        double r = (st.getMaxDamage() - st.getDamage()) / (double) st.getMaxDamage();
        return r > 0.5 ? 0xFF55FF55 : r > 0.2 ? 0xFFFFFF55 : 0xFFFF5555;
    }

    private static void keystrokes(DrawContext ctx, MinecraftClient c, TextRenderer tr, HudConfig cfg) {
        var o = c.options;
        int step = KEY + GAP;
        key(ctx, tr, cfg, label(o.forwardKey), step, 0, KEY, KEY, o.forwardKey.isPressed(), null);
        key(ctx, tr, cfg, label(o.leftKey), 0, step, KEY, KEY, o.leftKey.isPressed(), null);
        key(ctx, tr, cfg, label(o.backKey), step, step, KEY, KEY, o.backKey.isPressed(), null);
        key(ctx, tr, cfg, label(o.rightKey), 2 * step, step, KEY, KEY, o.rightKey.isPressed(), null);
        int half = (3 * KEY + 2 * GAP - GAP) / 2;
        key(ctx, tr, cfg, "LMB", 0, 2 * step, half, KEY, o.attackKey.isPressed(), cfg.keystrokesCps ? ClickTracker.left() + " CPS" : null);
        key(ctx, tr, cfg, "RMB", half + GAP, 2 * step, half, KEY, o.useKey.isPressed(), cfg.keystrokesCps ? ClickTracker.right() + " CPS" : null);
        if (cfg.keystrokesSpace) {
            int y = 3 * step;
            int w = 3 * KEY + 2 * GAP;
            double a = Anim.ease("key:space", o.jumpKey.isPressed(), 9);
            Look.key(new GfxImpl(ctx, tr), cfg, 0, y, w, 10, a);
            ctx.fill(w / 2 - 12, y + 4, w / 2 + 12, y + 5, cfg.text());
        }
    }

    private static void key(DrawContext ctx, TextRenderer tr, HudConfig cfg, String label, int x, int y, int w, int h, boolean pressed, String sub) {
        Look.key(new GfxImpl(ctx, tr), cfg, x, y, w, h, Anim.ease("key:" + label + x + y, pressed, 9));
        if (sub == null) {
            text(ctx, tr, cfg, label, x + (w - tr.getWidth(label)) / 2, y + (h - 8) / 2, cfg.text());
            return;
        }
        text(ctx, tr, cfg, label, x + (w - tr.getWidth(label)) / 2, y + 3, cfg.text());
        Matrices.push(ctx);
        Matrices.translate(ctx, x + w / 2f, y + 13);
        Matrices.scale(ctx, 0.6f, 0.6f);
        ctx.drawText(tr, sub, -tr.getWidth(sub) / 2, 0, cfg.text(), false);
        Matrices.pop(ctx);
    }

    private static String label(KeyBinding k) {
        // Latin letters regardless of keyboard layout (glfwGetKeyName follows the OS layout).
        InputUtil.Key key = KeyBindingHelper.getBoundKeyOf(k);
        int code = key.getCode();
        if (key.getCategory() == InputUtil.Type.KEYSYM && code >= GLFW.GLFW_KEY_A && code <= GLFW.GLFW_KEY_Z) return String.valueOf((char) code);
        String s = k.getBoundKeyLocalizedText().getString().toUpperCase();
        return s.length() > 3 ? s.substring(0, 3) : s;
    }

    /** "Low durability: Iron Helmet 8%" for the worst worn piece or held tool at or below the limit, else null. */
    private static String alertText(MinecraftClient c, HudConfig cfg) {
        if (c.player == null) return null;
        ItemStack worst = null;
        int worstPct = cfg.durabilityPercent + 1;
        for (EquipmentSlot slot : new EquipmentSlot[]{EquipmentSlot.HEAD, EquipmentSlot.CHEST, EquipmentSlot.LEGS, EquipmentSlot.FEET, EquipmentSlot.MAINHAND}) {
            ItemStack st = c.player.getEquippedStack(slot);
            if (st.isEmpty() || !st.isDamageable()) continue;
            int pct = Stats.durabilityPercent(st.getDamage(), st.getMaxDamage());
            if (pct <= cfg.durabilityPercent && pct < worstPct) {
                worst = st;
                worstPct = pct;
            }
        }
        return worst == null ? null : "Low durability: " + worst.getName().getString() + " " + worstPct + "%";
    }

    private static String serverText(MinecraftClient c) {
        if (c.getCurrentServerEntry() != null) return c.getCurrentServerEntry().address;
        return c.isInSingleplayer() ? "Singleplayer" : "Offline";
    }

    private static String sprintText(MinecraftClient c) {
        return c.player != null && c.player.isSprinting() ? "Sprinting (toggled)" : "Sprint (toggled)";
    }

    /** Stack icon + count for the PvP consumables that are in the inventory (offhand included). */
    private static List<Object[]> itemRows(MinecraftClient c, HudConfig cfg) {
        List<Object[]> out = new ArrayList<>();
        if (c.player == null) return out;
        var inv = c.player.getInventory();
        add(out, inv, net.minecraft.item.Items.TOTEM_OF_UNDYING, cfg.itemsTotems);
        add(out, inv, net.minecraft.item.Items.GOLDEN_APPLE, cfg.itemsGapples);
        add(out, inv, net.minecraft.item.Items.ENDER_PEARL, cfg.itemsPearls);
        add(out, inv, net.minecraft.item.Items.END_CRYSTAL, cfg.itemsCrystals);
        return out;
    }

    private static void add(List<Object[]> out, net.minecraft.entity.player.PlayerInventory inv, net.minecraft.item.Item item, boolean on) {
        if (!on) return;
        int n = 0;
        for (int i = 0; i < inv.size(); i++) {
            ItemStack st = inv.getStack(i);
            if (st.isOf(item)) n += st.getCount();
        }
        if (n > 0) out.add(new Object[]{new ItemStack(item), n});
    }

    /** What the crosshair points at: {name, detail} (health for living things), or null. */
    private static String[] target(MinecraftClient c) {
        HitResult hit = c.crosshairTarget;
        if (hit == null || c.world == null) return null;
        if (hit instanceof EntityHitResult e) {
            var en = e.getEntity();
            String hp = en instanceof net.minecraft.entity.LivingEntity l ? Stats.health(l.getHealth(), l.getMaxHealth()) : "";
            String ratio = en instanceof net.minecraft.entity.LivingEntity l2 && l2.getMaxHealth() > 0 ? String.valueOf(Math.max(0, Math.min(1, l2.getHealth() / l2.getMaxHealth()))) : "";
            return new String[]{en.getName().getString(), hp, ratio};
        }
        if (hit instanceof BlockHitResult b && hit.getType() == HitResult.Type.BLOCK) {
            return new String[]{c.world.getBlockState(b.getBlockPos()).getBlock().getName().getString(), "", ""};
        }
        return null;
    }

    private static String clockText(HudConfig cfg) {
        return java.time.LocalTime.now().format(java.time.format.DateTimeFormatter.ofPattern(cfg.clock24 ? "HH:mm" : "h:mm a", java.util.Locale.ROOT));
    }

    private static String duration(int ticks) {
        int s = Math.max(0, ticks) / 20;
        return String.format(java.util.Locale.ROOT, "%d:%02d", s / 60, s % 60);
    }

    private static String pingText(MinecraftClient c) {
        if (c.getNetworkHandler() == null || c.player == null) return "0";
        var e = c.getNetworkHandler().getPlayerListEntry(c.player.getUuid());
        return e == null ? "-" : String.valueOf(e.getLatency());
    }

    private static List<String[]> effectLines(MinecraftClient c) {
        List<String[]> out = new ArrayList<>();
        if (c.player == null) return out;
        for (var e : c.player.getStatusEffects()) {
            String n = e.getEffectType().value().getName().getString();
            if (e.getAmplifier() > 0) n += " " + (e.getAmplifier() + 1);
            out.add(new String[]{n, e.isInfinite() ? "inf" : duration(e.getDuration())});
        }
        return out;
    }
}
