package dev.lumen.hud;

import java.util.ArrayList;
import java.util.List;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;
import java.util.function.DoubleConsumer;
import java.util.function.DoubleSupplier;
import java.util.function.IntConsumer;
import java.util.function.IntSupplier;
import java.util.function.Supplier;

/**
 * The in-game Lumen menu: a list of modules on the left, the selected module's settings on the right.
 * All drawing goes through {@link Gfx} and input arrives as plain numbers, so one copy serves every Minecraft version.
 */
public final class LumenMenu {
    // ---------------- data ----------------

    public static final class Setting {
        enum Kind { SWITCH, SLIDER, CHOICE, SWATCHES, ACTIONS }

        final Kind kind;
        final String label;
        BooleanSupplier getBool;
        Consumer<Boolean> setBool;
        DoubleSupplier getNum;
        DoubleConsumer setNum;
        double min, max, step;
        String suffix = "";
        boolean percent;
        String[] options;
        IntSupplier getIdx;
        IntConsumer setIdx;
        String[] colors;
        String[] actions;
        IntConsumer onAction;
        Supplier<String> getColor;
        Consumer<String> setColor;

        Setting(Kind kind, String label) {
            this.kind = kind;
            this.label = label;
        }

        static Setting sw(String label, BooleanSupplier get, Consumer<Boolean> set) {
            Setting s = new Setting(Kind.SWITCH, label);
            s.getBool = get;
            s.setBool = set;
            return s;
        }

        static Setting slider(String label, double min, double max, double step, String suffix, DoubleSupplier get, DoubleConsumer set) {
            Setting s = new Setting(Kind.SLIDER, label);
            s.min = min;
            s.max = max;
            s.step = step;
            s.suffix = suffix;
            s.getNum = get;
            s.setNum = set;
            return s;
        }

        Setting asPercent() {
            percent = true;
            return this;
        }

        static Setting choice(String label, String[] options, IntSupplier get, IntConsumer set) {
            Setting s = new Setting(Kind.CHOICE, label);
            s.options = options;
            s.getIdx = get;
            s.setIdx = set;
            return s;
        }

        static Setting swatches(String label, String[] colors, Supplier<String> get, Consumer<String> set) {
            Setting s = new Setting(Kind.SWATCHES, label);
            s.colors = colors;
            s.getColor = get;
            s.setColor = set;
            return s;
        }

        static Setting actions(String label, String[] actions, IntConsumer on) {
            Setting s = new Setting(Kind.ACTIONS, label);
            s.actions = actions;
            s.onAction = on;
            return s;
        }

        int height() {
            return switch (kind) {
                case SLIDER -> 27;
                case SWATCHES, ACTIONS -> 29;
                default -> 18;
            };
        }
    }

    public static final class Module {
        final String group;
        final String name;
        final String desc;
        final BooleanSupplier on; // null: no switch
        final Consumer<Boolean> setOn;
        final List<Setting> settings = new ArrayList<>();

        Module(String group, String name, String desc, BooleanSupplier on, Consumer<Boolean> setOn) {
            this.group = group;
            this.name = name;
            this.desc = desc;
            this.on = on;
            this.setOn = setOn;
        }

        Module with(Setting s) {
            settings.add(s);
            return this;
        }
    }

    private static final String[] PALETTE = {"#FFFFFF", "#8B5CF6", "#3B82F6", "#06B6D4", "#10B981", "#F59E0B", "#EF4444", "#EC4899"};

    private static HudConfig.Element el(String id) {
        return HudConfig.get().el(id);
    }

    private static Module element(String id, String desc) {
        String name = HudConfig.NAMES[java.util.Arrays.asList(HudConfig.IDS).indexOf(id)];
        Module m = new Module("OVERLAY", name, desc, () -> el(id).enabled, v -> el(id).enabled = v);
        m.with(Setting.slider("Size", 0.5, 3, 0.1, "%", () -> el(id).scale, v -> el(id).scale = v).asPercent());
        return m;
    }

    static List<Module> build() {
        List<Module> out = new ArrayList<>();
        out.add(element("fps", "Frames per second."));
        out.add(element("cps", "Clicks per second, left and right."));
        out.add(element("compass", "A heading strip with your waypoints. Add one with /lumen wp add <name>."));
        out.add(element("ping", "Your latency to the server."));
        out.add(element("coords", "Position, facing direction and biome.")
                .with(Setting.sw("Show facing", () -> HudConfig.get().coordsFacing, v -> HudConfig.get().coordsFacing = v))
                .with(Setting.sw("Show biome", () -> HudConfig.get().coordsBiome, v -> HudConfig.get().coordsBiome = v)));
        out.add(element("keystrokes", "WASD, mouse buttons and space, with fading presses.")
                .with(Setting.sw("CPS under mouse buttons", () -> HudConfig.get().keystrokesCps, v -> HudConfig.get().keystrokesCps = v))
                .with(Setting.sw("Space bar", () -> HudConfig.get().keystrokesSpace, v -> HudConfig.get().keystrokesSpace = v)));
        out.add(element("armor", "Worn armor and the held item with durability.")
                .with(Setting.sw("Durability numbers", () -> HudConfig.get().armorDurability, v -> HudConfig.get().armorDurability = v))
                .with(Setting.sw("Held item", () -> HudConfig.get().armorHeldItem, v -> HudConfig.get().armorHeldItem = v)));
        out.add(element("effects", "Active potion effects with time left."));
        out.add(element("items", "Totems, golden apples, pearls and crystals in your inventory.")
                .with(Setting.sw("Totems", () -> HudConfig.get().itemsTotems, v -> HudConfig.get().itemsTotems = v))
                .with(Setting.sw("Golden apples", () -> HudConfig.get().itemsGapples, v -> HudConfig.get().itemsGapples = v))
                .with(Setting.sw("Ender pearls", () -> HudConfig.get().itemsPearls, v -> HudConfig.get().itemsPearls = v))
                .with(Setting.sw("End crystals", () -> HudConfig.get().itemsCrystals, v -> HudConfig.get().itemsCrystals = v)));
        out.add(element("target", "Name and health of what your crosshair points at."));
        out.add(element("alert", "Warns when armor or your tool is about to break.")
                .with(Setting.slider("Warn below", 5, 50, 1, "%", () -> HudConfig.get().durabilityPercent, v -> HudConfig.get().durabilityPercent = (int) v)));
        out.add(element("death", "Where you died last, so you can fetch your items.")
                .with(Setting.sw("Say it in chat after respawn", () -> HudConfig.get().deathChat, v -> HudConfig.get().deathChat = v)));
        out.add(element("reach", "Distance of your last hit."));
        out.add(element("combo", "Hits in a row without being hurt."));
        out.add(element("speed", "How fast you move, in blocks per second."));
        out.add(element("clock", "Your real-world time.")
                .with(Setting.sw("24-hour format", () -> HudConfig.get().clock24, v -> HudConfig.get().clock24 = v)));
        out.add(element("session", "How long the game has been running."));
        out.add(element("memory", "Memory the game is using.")
                .with(Setting.sw("Show maximum", () -> HudConfig.get().memoryShowMax, v -> HudConfig.get().memoryShowMax = v)));
        out.add(element("server", "Address of the server you are on."));
        out.add(element("sprint", "Shows when toggle sprint is active."));

        out.add(new Module("CLIENT", "Toggle sprint", "Keeps you sprinting while you hold W.", () -> HudConfig.get().toggleSprint, v -> HudConfig.get().toggleSprint = v));
        out.add(new Module("CLIENT", "Toggle sneak", "Press the sneak key once to sneak, again to stop.", () -> HudConfig.get().toggleSneak, v -> HudConfig.get().toggleSneak = v));
        out.add(new Module("CLIENT", "Freelook", "Hold Left Alt and look around without turning your player.", () -> HudConfig.get().freelook, v -> HudConfig.get().freelook = v));
        out.add(new Module("CLIENT", "Fullbright", "Caves and nights are fully lit.", () -> HudConfig.get().fullbright, v -> HudConfig.get().fullbright = v));
        out.add(new Module("CLIENT", "Zoom", "Hold C to zoom in.", () -> HudConfig.get().zoom, v -> HudConfig.get().zoom = v)
                .with(Setting.slider("Field of view", 5, 60, 1, "°", () -> HudConfig.get().zoomFov, v -> HudConfig.get().zoomFov = (int) v))
                .with(Setting.sw("Smooth zoom", () -> HudConfig.get().smoothZoom, v -> HudConfig.get().smoothZoom = v)));

        out.add(new Module("STYLE", "Appearance", "How every overlay looks.", null, null)
                .with(Setting.actions("Preset", Presets.NAMES, Presets::apply))
                .with(Setting.choice("Theme", Look.THEMES, () -> Math.max(0, java.util.Arrays.asList(Look.THEMES).indexOf(HudConfig.get().theme)), i -> HudConfig.get().theme = Look.THEMES[i]))
                .with(Setting.swatches("Text colour", PALETTE, () -> HudConfig.get().textColor, v -> HudConfig.get().textColor = v))
                .with(Setting.swatches("Accent colour", PALETTE, () -> HudConfig.get().accentColor, v -> HudConfig.get().accentColor = v))
                .with(Setting.sw("Background", () -> HudConfig.get().background, v -> HudConfig.get().background = v))
                .with(Setting.slider("Background opacity", 0, 1, 0.05, "%", () -> HudConfig.get().bgOpacity, v -> HudConfig.get().bgOpacity = v).asPercent())
                .with(Setting.sw("Text shadow", () -> HudConfig.get().shadow, v -> HudConfig.get().shadow = v))
                .with(Setting.sw("Hide when F3 is open", () -> HudConfig.get().hideInDebug, v -> HudConfig.get().hideInDebug = v)));
        return out;
    }

    // ---------------- state ----------------

    private final List<Module> modules = build();
    private int selected;
    private double scroll;
    private double maxScroll;
    private Setting dragging;
    private int dragX;
    private int dragW;
    /** Set when the player clicked "Edit layout"; the screen reads and clears it. */
    public boolean wantsLayout;

    private record Hit(int x, int y, int w, int h, Runnable action, Setting slider, boolean inList) {
        Hit(int x, int y, int w, int h, Runnable action, Setting slider) {
            this(x, y, w, h, action, slider, false);
        }

        boolean at(double mx, double my) {
            return mx >= x && my >= y && mx < x + w && my < y + h;
        }
    }

    private final List<Hit> hits = new ArrayList<>();
    private int px, py, pw, ph, listX, listY, listW, listH;

    // ---------------- drawing ----------------

    private static final int PANEL = 0xF2101018;
    private static final int EDGE = 0xFF2B2B3D;
    private static final int DIM = 0xFF8A8AA3;
    private static final int TEXT = 0xFFEDEDF5;

    public void render(Gfx g, int sw, int sh, int mx, int my) {
        hits.clear();
        HudConfig cfg = HudConfig.get();
        int accent = cfg.accent();
        pw = Math.min(sw - 16, 500);
        ph = Math.min(sh - 16, 276);
        px = (sw - pw) / 2;
        py = (sh - ph) / 2;
        Look.outline(g, px, py, pw, ph, 5, EDGE, PANEL);

        // header
        g.fill(px + 8, py + 8, px + 11, py + 22, accent);
        g.text("Lumen", px + 16, py + 8, TEXT, true);
        g.text("Client", px + 16 + g.width("Lumen "), py + 8, DIM, false);
        g.text("Esc to close", px + 16, py + 18, DIM, false);
        String edit = "Edit layout";
        int bw = g.width(edit) + 14;
        int bx = px + pw - bw - 10;
        boolean hot = new Hit(bx, py + 8, bw, 16, null, null).at(mx, my);
        Look.round(g, bx, py + 8, bw, 16, 4, hot ? Look.withAlpha(accent, 0xFF) : Look.withAlpha(accent, 0x90));
        g.text(edit, bx + 7, py + 12, 0xFFFFFFFF, false);
        hits.add(new Hit(bx, py + 8, bw, 16, () -> wantsLayout = true, null));
        g.fill(px + 8, py + 30, px + pw - 8, py + 31, EDGE);

        // module list
        listX = px + 8;
        listY = py + 36;
        listW = (int) (pw * 0.5) - 8;
        listH = ph - 36 - 8;
        g.clip(listX, listY, listX + listW, listY + listH);
        int y = listY - (int) scroll;
        String group = "";
        int total = 0;
        for (int i = 0; i < modules.size(); i++) {
            Module m = modules.get(i);
            if (!m.group.equals(group)) {
                group = m.group;
                g.text(group, listX + 2, y + 3, DIM, false);
                y += 14;
                total += 14;
            }
            boolean sel = i == selected;
            boolean over = mx >= listX && mx < listX + listW && my >= y && my < y + 20 && my >= listY && my < listY + listH;
            if (sel) Look.round(g, listX, y, listW - 4, 20, 4, Look.withAlpha(accent, 0x38));
            else if (over) Look.round(g, listX, y, listW - 4, 20, 4, 0x18FFFFFF);
            g.text(m.name, listX + 8, y + 6, m.on != null && !m.on.getAsBoolean() ? DIM : TEXT, false);
            if (m.on != null) switchAt(g, listX + listW - 4 - 26, y + 5, m.on.getAsBoolean(), accent);
            final int idx = i;
            final Module mod = m;
            if (y + 20 > listY && y < listY + listH) {
                if (m.on != null) hits.add(new Hit(listX + listW - 4 - 30, y, 26, 20, () -> {
                    mod.setOn.accept(!mod.on.getAsBoolean());
                    selected = idx;
                }, null, true));
                hits.add(new Hit(listX, y, listW - 4, 20, () -> selected = idx, null, true));
            }
            y += 20;
            total += 20;
        }
        g.unclip();
        maxScroll = Math.max(0, total - listH);
        scroll = Math.max(0, Math.min(maxScroll, scroll));
        if (maxScroll > 0) { // scroll bar
            int th = Math.max(16, (int) (listH * (listH / (double) total)));
            int ty = listY + (int) ((listH - th) * (scroll / maxScroll));
            Look.round(g, listX + listW - 2, ty, 2, th, 1, 0x66FFFFFF);
        }

        // detail
        g.fill(px + pw / 2, py + 36, px + pw / 2 + 1, py + ph - 8, EDGE);
        if (selected >= modules.size()) selected = 0;
        Module m = modules.get(selected);
        int dx = px + pw / 2 + 10;
        int dw = pw / 2 - 18;
        int dy = py + 38;
        g.text(m.name, dx, dy, accent, true);
        dy += 12;
        for (String line : wrap(g, m.desc, dw)) {
            g.text(line, dx, dy, DIM, false);
            dy += 10;
        }
        dy += 6;
        for (Setting s : m.settings) {
            if (dy + s.height() > py + ph - 6) break;
            drawSetting(g, s, dx, dy, dw, accent, mx, my);
            dy += s.height();
        }
    }

    private void drawSetting(Gfx g, Setting s, int x, int y, int w, int accent, int mx, int my) {
        switch (s.kind) {
            case SWITCH -> {
                g.text(s.label, x, y + 4, TEXT, false);
                switchAt(g, x + w - 26, y + 4, s.getBool.getAsBoolean(), accent);
                hits.add(new Hit(x, y, w, 18, () -> s.setBool.accept(!s.getBool.getAsBoolean()), null));
            }
            case SLIDER -> {
                double v = s.getNum.getAsDouble();
                String value = s.percent ? Math.round(v * 100) + "%" : (s.step < 1 ? String.format(java.util.Locale.ROOT, "%.1f", v) : String.valueOf((int) Math.round(v))) + s.suffix;
                g.text(s.label, x, y + 2, TEXT, false);
                g.text(value, x + w - g.width(value), y + 2, DIM, false);
                int ty = y + 16;
                Look.round(g, x, ty, w, 4, 2, 0x44FFFFFF);
                double t = (v - s.min) / (s.max - s.min);
                int kx = x + (int) Math.round(t * (w - 6));
                Look.round(g, x, ty, Math.max(4, kx - x + 3), 4, 2, accent);
                Look.round(g, kx, ty - 2, 6, 8, 3, 0xFFFFFFFF);
                hits.add(new Hit(x - 2, y + 12, w + 4, 14, null, s));
            }
            case CHOICE -> {
                g.text(s.label, x, y + 4, TEXT, false);
                String v = s.options[s.getIdx.getAsInt()];
                v = Character.toUpperCase(v.charAt(0)) + v.substring(1);
                int bw = g.width(v) + 14;
                Look.round(g, x + w - bw, y + 1, bw, 15, 4, Look.withAlpha(accent, 0x70));
                g.text(v, x + w - bw + 7, y + 5, 0xFFFFFFFF, false);
                hits.add(new Hit(x + w - bw, y + 1, bw, 15, () -> s.setIdx.accept((s.getIdx.getAsInt() + 1) % s.options.length), null));
            }
            case ACTIONS -> {
                g.text(s.label, x, y + 2, TEXT, false);
                int ax = x;
                for (int i = 0; i < s.actions.length; i++) {
                    int bw = g.width(s.actions[i]) + 10;
                    boolean hot = mx >= ax && mx < ax + bw && my >= y + 12 && my < y + 26;
                    Look.round(g, ax, y + 12, bw, 14, 4, hot ? Look.withAlpha(accent, 0xB0) : Look.withAlpha(accent, 0x55));
                    g.text(s.actions[i], ax + 5, y + 15, 0xFFFFFFFF, false);
                    final int idx = i;
                    hits.add(new Hit(ax, y + 12, bw, 14, () -> s.onAction.accept(idx), null));
                    ax += bw + 4;
                }
            }
            case SWATCHES -> {
                g.text(s.label, x, y + 2, TEXT, false);
                int cx = x;
                String cur = s.getColor.get();
                for (String hex : s.colors) {
                    int col = 0xFF000000 | Integer.parseUnsignedInt(hex.substring(1), 16);
                    boolean on = hex.equalsIgnoreCase(cur);
                    if (on) Look.round(g, cx - 1, y + 12, 15, 15, 4, 0xFFFFFFFF);
                    Look.round(g, cx, y + 13, 13, 13, 3, col);
                    final String chosen = hex;
                    hits.add(new Hit(cx, y + 12, 14, 15, () -> s.setColor.accept(chosen), null));
                    cx += 17;
                }
            }
        }
    }

    private static void switchAt(Gfx g, int x, int y, boolean on, int accent) {
        Look.round(g, x, y, 22, 10, 5, on ? accent : 0xFF3A3A4D);
        Look.round(g, on ? x + 13 : x + 1, y + 1, 8, 8, 4, 0xFFFFFFFF);
    }

    private static List<String> wrap(Gfx g, String text, int width) {
        List<String> lines = new ArrayList<>();
        StringBuilder line = new StringBuilder();
        for (String word : text.split(" ")) {
            String next = line.length() == 0 ? word : line + " " + word;
            if (g.width(next) > width && line.length() > 0) {
                lines.add(line.toString());
                line = new StringBuilder(word);
            } else {
                line = new StringBuilder(next);
            }
        }
        if (line.length() > 0) lines.add(line.toString());
        return lines;
    }

    // ---------------- input ----------------

    /** @return true when the click was inside the menu */
    public boolean press(double mx, double my, int button) {
        if (!(mx >= px && my >= py && mx < px + pw && my < py + ph)) return false;
        if (button != 0) return true;
        for (int i = hits.size() - 1; i >= 0; i--) {
            Hit h = hits.get(i);
            if (!h.at(mx, my)) continue;
            if (h.inList && (my < listY || my >= listY + listH)) continue; // the part of a row scrolled out of view
            if (h.slider != null) {
                dragging = h.slider;
                dragX = h.x + 2;
                dragW = h.w - 4;
                setFromMouse(mx);
            } else if (h.action != null) {
                h.action.run();
            }
            return true;
        }
        return true;
    }

    public boolean drag(double mx, double my) {
        if (dragging == null) return false;
        setFromMouse(mx);
        return true;
    }

    public void release() {
        dragging = null;
    }

    private void setFromMouse(double mx) {
        Setting s = dragging;
        double t = Math.max(0, Math.min(1, (mx - dragX - 3) / (dragW - 6)));
        double v = s.min + t * (s.max - s.min);
        v = Math.round(v / s.step) * s.step;
        s.setNum.accept(Math.max(s.min, Math.min(s.max, v)));
    }

    public boolean scroll(double mx, double my, double dy) {
        if (!(mx >= px && my >= py && mx < px + pw && my < py + ph)) return false;
        scroll = Math.max(0, Math.min(maxScroll, scroll - Math.signum(dy) * 24));
        return true;
    }
}
