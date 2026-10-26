package dev.lumen.hud;

import com.mojang.blaze3d.platform.InputConstants;
import net.fabricmc.fabric.api.client.keymapping.v1.KeyMappingHelper;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Font;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.core.Direction;
import net.minecraft.world.phys.BlockHitResult;
import net.minecraft.world.phys.EntityHitResult;
import net.minecraft.world.phys.HitResult;
import net.minecraft.world.entity.EquipmentSlot;
import net.minecraft.world.item.ItemStack;
import org.joml.Matrix3x2fStack;

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

    public static void render(GuiGraphicsExtractor g, boolean editing) {
        Minecraft c = Minecraft.getInstance();
        HudConfig cfg = HudConfig.get();
        if (!editing) {
            if (Compat.hudHidden(c) || c.player == null || Compat.screen(c) instanceof EditScreen) return;
            if (cfg.hideInDebug && c.getDebugOverlay().showDebugScreen()) return;
        }
        RECTS.clear();
        int sw = g.guiWidth();
        int sh = g.guiHeight();
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
            Matrix3x2fStack m = g.pose();
            m.pushMatrix();
            m.translate(x, y);
            m.scale(s, s);
            draw(id, g, c, cfg, size[0], size[1]);
            m.popMatrix();
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

    private static int[] size(String id, Minecraft c, HudConfig cfg, boolean editing) {
        Font f = c.font;
        return switch (id) {
            case "fps" -> new int[]{f.width(c.getFps() + " FPS") + 8, 15};
            case "cps" -> new int[]{f.width(cpsText() + " CPS") + 8, 15};
            case "coords" -> {
                List<String[]> lines = coordLines(c, cfg);
                int w = 0;
                for (String[] l : lines) w = Math.max(w, f.width(l[0] + " " + l[1]));
                yield new int[]{w + 8, lines.size() * 10 + 4};
            }
            case "keystrokes" -> new int[]{3 * KEY + 2 * GAP, 3 * KEY + 2 * GAP + (cfg.keystrokesSpace ? GAP + 10 : 0)};
            case "armor" -> {
                List<ItemStack> items = armorItems(c, cfg);
                if (items.isEmpty()) yield editing ? new int[]{f.width("Armor") + 8, 15} : null;
                int w = 0;
                for (ItemStack st : items) w = Math.max(w, f.width(itemText(st, cfg)));
                yield new int[]{20 + w + (w > 0 ? 4 : 0), items.size() * ROW + 2};
            }
            case "ping" -> new int[]{f.width(pingText(c) + " ms") + 8, 15};
            case "speed" -> new int[]{f.width(SpeedTracker.text() + " b/s") + 8, 15};
            case "reach" -> new int[]{f.width(ReachTracker.text() + " blocks") + 8, 15};
            case "combo" -> new int[]{f.width(ComboTracker.text() + " combo") + 8, 15};
            case "clock" -> new int[]{f.width(clockText(cfg)) + 8, 15};
            case "memory" -> new int[]{f.width(Stats.memory(cfg.memoryShowMax) + " MB") + 8, 15};
            case "session" -> new int[]{f.width(Stats.session()) + 8, 15};
            case "server" -> new int[]{f.width(serverText(c)) + 8, 15};
            case "sprint" -> {
                if (!cfg.toggleSprint && !editing) yield null;
                yield new int[]{f.width(sprintText(c)) + 8, 15};
            }
            case "items" -> {
                List<Object[]> rows = itemRows(c, cfg);
                if (rows.isEmpty()) yield editing ? new int[]{f.width("Items") + 8, 15} : null;
                int w = 0;
                for (Object[] r : rows) w = Math.max(w, f.width(String.valueOf(r[1])));
                yield new int[]{20 + w + 4, rows.size() * ROW + 2};
            }
            case "target" -> {
                String[] t = target(c);
                if (t == null) yield editing ? new int[]{f.width("Target") + 8, 15} : null;
                yield new int[]{f.width(t[0] + (t[1].isEmpty() ? "" : "  " + t[1])) + 8, 15};
            }
            case "effects" -> {
                List<String[]> lines = effectLines(c);
                if (lines.isEmpty()) yield editing ? new int[]{f.width("Effects") + 8, 15} : null;
                int w = 0;
                for (String[] l : lines) w = Math.max(w, f.width(l[0] + " " + l[1]));
                yield new int[]{w + 8, lines.size() * 10 + 4};
            }
            default -> null;
        };
    }

    // ---------------- drawing ----------------

    private static void draw(String id, GuiGraphicsExtractor g, Minecraft c, HudConfig cfg, int w, int h) {
        Font f = c.font;
        switch (id) {
            case "fps" -> valueBox(g, f, cfg, String.valueOf(c.getFps()), " FPS", w, h);
            case "cps" -> valueBox(g, f, cfg, cpsText(), " CPS", w, h);
            case "coords" -> {
                panel(g, cfg, w, h);
                int y = 3;
                for (String[] l : coordLines(c, cfg)) {
                    text(g, f, cfg, l[0], 4, y, cfg.accent());
                    text(g, f, cfg, l[1], 4 + f.width(l[0] + " "), y, cfg.text());
                    y += 10;
                }
            }
            case "keystrokes" -> keystrokes(g, c, f, cfg);
            case "armor" -> {
                panel(g, cfg, w, h);
                List<ItemStack> items = armorItems(c, cfg);
                if (items.isEmpty()) {
                    text(g, f, cfg, "Armor", 4, 4, cfg.text());
                    return;
                }
                int y = 1;
                for (ItemStack st : items) {
                    g.item(st, 2, y);
                    if (!cfg.armorDurability) g.itemDecorations(f, st, 2, y);
                    String t = itemText(st, cfg);
                    if (!t.isEmpty()) text(g, f, cfg, t, 20, y + 4, durabilityColor(st, cfg));
                    y += ROW;
                }
            }
            case "ping" -> valueBox(g, f, cfg, pingText(c), " ms", w, h);
            case "speed" -> valueBox(g, f, cfg, SpeedTracker.text(), " b/s", w, h);
            case "reach" -> valueBox(g, f, cfg, ReachTracker.text(), " blocks", w, h);
            case "combo" -> valueBox(g, f, cfg, ComboTracker.text(), " combo", w, h);
            case "clock" -> {
                panel(g, cfg, w, h);
                text(g, f, cfg, clockText(cfg), 4, 4, cfg.text());
            }
            case "memory" -> valueBox(g, f, cfg, Stats.memory(cfg.memoryShowMax), " MB", w, h);
            case "session" -> {
                panel(g, cfg, w, h);
                text(g, f, cfg, Stats.session(), 4, 4, cfg.text());
            }
            case "server" -> {
                panel(g, cfg, w, h);
                text(g, f, cfg, serverText(c), 4, 4, cfg.text());
            }
            case "sprint" -> {
                panel(g, cfg, w, h);
                text(g, f, cfg, sprintText(c), 4, 4, cfg.accent());
            }
            case "items" -> {
                panel(g, cfg, w, h);
                List<Object[]> rows = itemRows(c, cfg);
                if (rows.isEmpty()) {
                    text(g, f, cfg, "Items", 4, 4, cfg.text());
                    return;
                }
                int y = 1;
                for (Object[] r : rows) {
                    g.item((ItemStack) r[0], 2, y);
                    text(g, f, cfg, String.valueOf(r[1]), 20, y + 4, cfg.text());
                    y += ROW;
                }
            }
            case "target" -> {
                panel(g, cfg, w, h);
                String[] t = target(c);
                if (t == null) {
                    text(g, f, cfg, "Target", 4, 4, cfg.text());
                    return;
                }
                text(g, f, cfg, t[0], 4, 4, cfg.text());
                if (!t[1].isEmpty()) text(g, f, cfg, t[1], 4 + f.width(t[0] + "  "), 4, cfg.accent());
            }
            case "effects" -> {
                panel(g, cfg, w, h);
                List<String[]> lines = effectLines(c);
                if (lines.isEmpty()) {
                    text(g, f, cfg, "Effects", 4, 4, cfg.text());
                    return;
                }
                int y = 3;
                for (String[] l : lines) {
                    text(g, f, cfg, l[0], 4, y, cfg.accent());
                    text(g, f, cfg, l[1], 4 + f.width(l[0] + " "), y, cfg.text());
                    y += 10;
                }
            }
            default -> {}
        }
    }

    private static void valueBox(GuiGraphicsExtractor g, Font f, HudConfig cfg, String value, String suffix, int w, int h) {
        panel(g, cfg, w, h);
        text(g, f, cfg, value, 4, 4, cfg.text());
        text(g, f, cfg, suffix, 4 + f.width(value), 4, cfg.accent());
    }

    private static void panel(GuiGraphicsExtractor g, HudConfig cfg, int w, int h) {
        if (cfg.background) g.fill(0, 0, w, h, cfg.bg());
    }

    private static void text(GuiGraphicsExtractor g, Font f, HudConfig cfg, String s, int x, int y, int color) {
        g.text(f, s, x, y, color, cfg.shadow);
    }

    private static String cpsText() {
        return ClickTracker.left() + " | " + ClickTracker.right();
    }

    private static List<String[]> coordLines(Minecraft c, HudConfig cfg) {
        List<String[]> out = new ArrayList<>();
        if (c.player == null) {
            out.add(new String[]{"XYZ", "0 64 0"});
            return out;
        }
        out.add(new String[]{"XYZ", (int) Math.floor(c.player.getX()) + " " + (int) Math.floor(c.player.getY()) + " " + (int) Math.floor(c.player.getZ())});
        if (cfg.coordsFacing) {
            Direction d = c.player.getDirection();
            String axis = switch (d) {
                case NORTH -> "-Z";
                case SOUTH -> "+Z";
                case WEST -> "-X";
                case EAST -> "+X";
                default -> "";
            };
            out.add(new String[]{"Facing", d.getSerializedName() + " (" + axis + ")"});
        }
        if (cfg.coordsBiome && c.level != null) {
            String biome = c.level.getBiome(c.player.blockPosition()).unwrapKey()
                    .map(k -> k.identifier().getPath().replace('_', ' ')).orElse("unknown");
            out.add(new String[]{"Biome", biome});
        }
        return out;
    }

    private static List<ItemStack> armorItems(Minecraft c, HudConfig cfg) {
        List<ItemStack> out = new ArrayList<>();
        if (c.player == null) return out;
        for (EquipmentSlot slot : new EquipmentSlot[]{EquipmentSlot.HEAD, EquipmentSlot.CHEST, EquipmentSlot.LEGS, EquipmentSlot.FEET}) {
            ItemStack st = c.player.getItemBySlot(slot);
            if (!st.isEmpty()) out.add(st);
        }
        if (cfg.armorHeldItem && !c.player.getMainHandItem().isEmpty()) out.add(c.player.getMainHandItem());
        return out;
    }

    private static String itemText(ItemStack st, HudConfig cfg) {
        if (st.isDamageableItem() && cfg.armorDurability) return String.valueOf(st.getMaxDamage() - st.getDamageValue());
        if (st.getCount() > 1) return String.valueOf(st.getCount());
        return "";
    }

    private static int durabilityColor(ItemStack st, HudConfig cfg) {
        if (!st.isDamageableItem()) return cfg.text();
        double r = (st.getMaxDamage() - st.getDamageValue()) / (double) st.getMaxDamage();
        return r > 0.5 ? 0xFF55FF55 : r > 0.2 ? 0xFFFFFF55 : 0xFFFF5555;
    }

    private static void keystrokes(GuiGraphicsExtractor g, Minecraft c, Font f, HudConfig cfg) {
        var o = c.options;
        int step = KEY + GAP;
        key(g, f, cfg, label(o.keyUp), step, 0, KEY, KEY, o.keyUp.isDown(), null);
        key(g, f, cfg, label(o.keyLeft), 0, step, KEY, KEY, o.keyLeft.isDown(), null);
        key(g, f, cfg, label(o.keyDown), step, step, KEY, KEY, o.keyDown.isDown(), null);
        key(g, f, cfg, label(o.keyRight), 2 * step, step, KEY, KEY, o.keyRight.isDown(), null);
        int half = (3 * KEY + 2 * GAP - GAP) / 2;
        key(g, f, cfg, "LMB", 0, 2 * step, half, KEY, o.keyAttack.isDown(), cfg.keystrokesCps ? ClickTracker.left() + " CPS" : null);
        key(g, f, cfg, "RMB", half + GAP, 2 * step, half, KEY, o.keyUse.isDown(), cfg.keystrokesCps ? ClickTracker.right() + " CPS" : null);
        if (cfg.keystrokesSpace) {
            int y = 3 * step;
            int w = 3 * KEY + 2 * GAP;
            g.fill(0, y, w, y + 10, keyBg(cfg, o.keyJump.isDown()));
            g.fill(w / 2 - 12, y + 4, w / 2 + 12, y + 5, cfg.text());
        }
    }

    private static int keyBg(HudConfig cfg, boolean pressed) {
        if (pressed) return (cfg.accent() & 0x00FFFFFF) | 0xC8000000;
        return cfg.background ? cfg.bg() : 0x30000000;
    }

    private static void key(GuiGraphicsExtractor g, Font f, HudConfig cfg, String label, int x, int y, int w, int h, boolean pressed, String sub) {
        g.fill(x, y, x + w, y + h, keyBg(cfg, pressed));
        if (sub == null) {
            text(g, f, cfg, label, x + (w - f.width(label)) / 2, y + (h - 8) / 2, cfg.text());
            return;
        }
        text(g, f, cfg, label, x + (w - f.width(label)) / 2, y + 3, cfg.text());
        Matrix3x2fStack m = g.pose();
        m.pushMatrix();
        m.translate(x + w / 2f, y + 13);
        m.scale(0.6f, 0.6f);
        g.text(f, sub, -f.width(sub) / 2, 0, cfg.text(), false);
        m.popMatrix();
    }

    private static String label(KeyMapping k) {
        // 26.x binds physical scancodes (A = 4 … Z = 29); show Latin letters regardless of layout.
        InputConstants.Key key = KeyMappingHelper.getBoundKeyOf(k);
        int code = key.getValue();
        if (key.getName().startsWith("key.keyboard.") && code >= InputConstants.KEY_A && code <= InputConstants.KEY_Z) {
            return String.valueOf((char) ('A' + code - InputConstants.KEY_A));
        }
        String s = k.getTranslatedKeyMessage().getString().toUpperCase();
        return s.length() > 3 ? s.substring(0, 3) : s;
    }

    private static String serverText(Minecraft c) {
        if (c.getCurrentServer() != null) return c.getCurrentServer().ip;
        return c.isLocalServer() ? "Singleplayer" : "Offline";
    }

    private static String sprintText(Minecraft c) {
        return c.player != null && c.player.isSprinting() ? "Sprinting (toggled)" : "Sprint (toggled)";
    }

    /** Stack icon + count for the PvP consumables that are in the inventory (offhand included). */
    private static List<Object[]> itemRows(Minecraft c, HudConfig cfg) {
        List<Object[]> out = new ArrayList<>();
        if (c.player == null) return out;
        var inv = c.player.getInventory();
        add(out, inv, net.minecraft.world.item.Items.TOTEM_OF_UNDYING, cfg.itemsTotems);
        add(out, inv, net.minecraft.world.item.Items.GOLDEN_APPLE, cfg.itemsGapples);
        add(out, inv, net.minecraft.world.item.Items.ENDER_PEARL, cfg.itemsPearls);
        add(out, inv, net.minecraft.world.item.Items.END_CRYSTAL, cfg.itemsCrystals);
        return out;
    }

    private static void add(List<Object[]> out, net.minecraft.world.entity.player.Inventory inv, net.minecraft.world.item.Item item, boolean on) {
        if (!on) return;
        int n = 0;
        for (int i = 0; i < inv.getContainerSize(); i++) {
            ItemStack st = inv.getItem(i);
            if (st.is(item)) n += st.getCount();
        }
        if (n > 0) out.add(new Object[]{new ItemStack(item), n});
    }

    /** What the crosshair points at: {name, detail} (health for living things), or null. */
    private static String[] target(Minecraft c) {
        HitResult hit = c.hitResult;
        if (hit == null || c.level == null) return null;
        if (hit instanceof EntityHitResult e) {
            var en = e.getEntity();
            String hp = en instanceof net.minecraft.world.entity.LivingEntity l ? Stats.health(l.getHealth(), l.getMaxHealth()) : "";
            return new String[]{en.getName().getString(), hp};
        }
        if (hit instanceof BlockHitResult b && hit.getType() == HitResult.Type.BLOCK) {
            return new String[]{c.level.getBlockState(b.getBlockPos()).getBlock().getName().getString(), ""};
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

    private static String pingText(Minecraft c) {
        if (c.getConnection() == null || c.player == null) return "0";
        var e = c.getConnection().getPlayerInfo(c.player.getUUID());
        return e == null ? "-" : String.valueOf(e.getLatency());
    }

    private static List<String[]> effectLines(Minecraft c) {
        List<String[]> out = new ArrayList<>();
        if (c.player == null) return out;
        for (var e : c.player.getActiveEffects()) {
            String n = e.getEffect().value().getDisplayName().getString();
            if (e.getAmplifier() > 0) n += " " + (e.getAmplifier() + 1);
            out.add(new String[]{n, e.isInfiniteDuration() ? "inf" : duration(e.getDuration())});
        }
        return out;
    }
}
