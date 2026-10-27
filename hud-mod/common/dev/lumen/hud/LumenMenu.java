package dev.lumen.hud;

import java.io.IOException;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;
import java.util.function.DoubleConsumer;
import java.util.function.DoubleSupplier;
import java.util.function.IntConsumer;
import java.util.function.IntSupplier;
import java.util.function.Supplier;

/**
 * The in-game Lumen menu: module cards with switches, a page for style, one for cosmetics and one for settings, and a
 * dock of page icons under the window.
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
        String icon = "grid";

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

        Module icon(String name) {
            icon = name;
            return this;
        }
    }

    private static final String[] PALETTE = {"#FFFFFF", "#8B5CF6", "#3B82F6", "#06B6D4", "#10B981", "#F59E0B", "#EF4444", "#EC4899"};

    private static HudConfig.Element el(String id) {
        return HudConfig.get().el(id);
    }

    private static final Map<String, String> ELEMENT_ICONS = Map.ofEntries(
            Map.entry("fps", "bolt"), Map.entry("ping", "signal"), Map.entry("coords", "pin"),
            Map.entry("armor", "shield"), Map.entry("effects", "flask"), Map.entry("items", "bag"),
            Map.entry("target", "target"), Map.entry("alert", "warn"), Map.entry("death", "skull"), Map.entry("reach", "ruler"),
            Map.entry("combo", "flame"), Map.entry("speed", "arrow"), Map.entry("clock", "clock"), Map.entry("session", "hourglass"),
            Map.entry("memory", "chip"), Map.entry("server", "server"), Map.entry("sprint", "boot"), Map.entry("compass", "compass"), Map.entry("minimap", "map"));

    private static Module element(String id, String desc) {
        String name = HudConfig.NAMES[java.util.Arrays.asList(HudConfig.IDS).indexOf(id)];
        Module m = new Module("OVERLAY", name, desc, () -> el(id).enabled, v -> el(id).enabled = v).icon(ELEMENT_ICONS.getOrDefault(id, "grid"));
        m.with(Setting.slider("Size", 0.5, 3, 0.1, "%", () -> el(id).scale, v -> el(id).scale = v).asPercent());
        return m;
    }

    static List<Module> build() {
        List<Module> out = new ArrayList<>();
        out.add(element("fps", "Shows how many frames the game draws every second. Higher is smoother; below 30 you will feel the lag."));
        out.add(element("compass", "A strip at the top that shows which way you face, with markers for your waypoints. Add one with /lumen wp add <name>."));
        out.add(element("ping", "How long the server takes to answer you, in milliseconds. Lower is better; it is empty in single player."));
        out.add(element("minimap", "A map of the blocks around you, drawn from above, with nearby players, mobs and your waypoints on it. Zoom shows how far it sees.")
                .with(Setting.slider("Zoom", 16, 64, 8, " blocks", () -> HudConfig.get().minimapZoom, v -> HudConfig.get().minimapZoom = (int) v))
                .with(Setting.choice("Shape", new String[]{"circle", "square"}, () -> "square".equals(HudConfig.get().minimapShape) ? 1 : 0, i -> HudConfig.get().minimapShape = i == 1 ? "square" : "circle"))
                .with(Setting.sw("Turn with you", () -> HudConfig.get().minimapRotate, v -> HudConfig.get().minimapRotate = v))
                .with(Setting.sw("Mobs", () -> HudConfig.get().minimapMobs, v -> HudConfig.get().minimapMobs = v))
                .with(Setting.sw("Players", () -> HudConfig.get().minimapPlayers, v -> HudConfig.get().minimapPlayers = v))
                .with(Setting.sw("Waypoints", () -> HudConfig.get().minimapWaypoints, v -> HudConfig.get().minimapWaypoints = v))
                .with(Setting.sw("Coordinates", () -> HudConfig.get().minimapCoords, v -> HudConfig.get().minimapCoords = v)));
        out.add(element("coords", "Your X, Y and Z, the direction you are facing and the biome you stand in, without opening the F3 screen.")
                .with(Setting.sw("Show facing", () -> HudConfig.get().coordsFacing, v -> HudConfig.get().coordsFacing = v))
                .with(Setting.sw("Show biome", () -> HudConfig.get().coordsBiome, v -> HudConfig.get().coordsBiome = v)));
        out.add(element("armor", "Draws your armor and the item in your hand with how much durability each has left.")
                .with(Setting.sw("Durability numbers", () -> HudConfig.get().armorDurability, v -> HudConfig.get().armorDurability = v))
                .with(Setting.sw("Held item", () -> HudConfig.get().armorHeldItem, v -> HudConfig.get().armorHeldItem = v)));
        out.add(element("effects", "Lists the potion effects on you with their level and the time left, so you know when to drink again."));
        out.add(element("items", "Counts the combat items in your inventory: totems, golden apples, ender pearls and end crystals.")
                .with(Setting.sw("Totems", () -> HudConfig.get().itemsTotems, v -> HudConfig.get().itemsTotems = v))
                .with(Setting.sw("Golden apples", () -> HudConfig.get().itemsGapples, v -> HudConfig.get().itemsGapples = v))
                .with(Setting.sw("Ender pearls", () -> HudConfig.get().itemsPearls, v -> HudConfig.get().itemsPearls = v))
                .with(Setting.sw("End crystals", () -> HudConfig.get().itemsCrystals, v -> HudConfig.get().itemsCrystals = v)));
        out.add(element("target", "Shows the name and health of the player or mob under your crosshair."));
        out.add(element("alert", "Flashes a warning when a piece of armor or your tool is about to break, before you lose it.")
                .with(Setting.slider("Warn below", 5, 50, 1, "%", () -> HudConfig.get().durabilityPercent, v -> HudConfig.get().durabilityPercent = (int) v)));
        out.add(element("death", "Remembers where you died last, with the dimension, so you can go and fetch your items.")
                .with(Setting.sw("Say it in chat after respawn", () -> HudConfig.get().deathChat, v -> HudConfig.get().deathChat = v)));

        out.add(new Module("CLIENT", "Toggle sprint", "Keeps you sprinting until you stop, so you do not have to hold the sprint key.", () -> HudConfig.get().toggleSprint, v -> HudConfig.get().toggleSprint = v).icon("boot"));
        out.add(new Module("CLIENT", "Toggle sneak", "Press the sneak key once to sneak and again to stop, instead of holding it.", () -> HudConfig.get().toggleSneak, v -> HudConfig.get().toggleSneak = v).icon("sneak"));
        out.add(new Module("CLIENT", "Freelook", "Hold Left Alt to look around your player without turning where you walk or aim.", () -> HudConfig.get().freelook, v -> HudConfig.get().freelook = v).icon("eye"));
        out.add(new Module("CLIENT", "Fullbright", "Makes everything fully bright, so caves and nights are as light as day.", () -> HudConfig.get().fullbright, v -> HudConfig.get().fullbright = v).icon("sun"));
        out.add(new Module("CLIENT", "Better chat", "Puts the time before every chat line and hides a line that repeats within a few seconds. Words that hide a line are set in the Lumen launcher (HUD Editor).", () -> HudConfig.get().chatTimestamps || HudConfig.get().chatHideRepeats, v -> HudConfig.get().chatTimestamps = HudConfig.get().chatHideRepeats = v).icon("chat")
                .with(Setting.sw("Timestamps", () -> HudConfig.get().chatTimestamps, v -> HudConfig.get().chatTimestamps = v))
                .with(Setting.sw("24-hour time", () -> HudConfig.get().clock24, v -> HudConfig.get().clock24 = v))
                .with(Setting.sw("Hide repeats", () -> HudConfig.get().chatHideRepeats, v -> HudConfig.get().chatHideRepeats = v)));
        out.add(new Module("CLIENT", "Hit feedback", "Shows how much damage each of your hits did as a number above the crosshair, and flashes a small marker when a hit lands.", () -> HudConfig.get().damageNumbers || HudConfig.get().hitMarker, v -> HudConfig.get().damageNumbers = HudConfig.get().hitMarker = v).icon("target")
                .with(Setting.sw("Damage numbers", () -> HudConfig.get().damageNumbers, v -> HudConfig.get().damageNumbers = v))
                .with(Setting.sw("Hit marker", () -> HudConfig.get().hitMarker, v -> HudConfig.get().hitMarker = v))
                .with(Setting.swatches("Hit colour", PALETTE, () -> HudConfig.get().hitColor, v -> HudConfig.get().hitColor = v)));
        out.add(new Module("CLIENT", "Zoom", "Hold C to zoom in on far things, like a spyglass. The field of view below sets how far.", () -> HudConfig.get().zoom, v -> HudConfig.get().zoom = v).icon("zoom")
                .with(Setting.slider("Field of view", 5, 60, 1, "°", () -> HudConfig.get().zoomFov, v -> HudConfig.get().zoomFov = (int) v))
                .with(Setting.sw("Smooth zoom", () -> HudConfig.get().smoothZoom, v -> HudConfig.get().smoothZoom = v)));

        out.add(new Module("STYLE", "Menu look", "The colours and the backdrop of this menu. A picture is chosen in the Lumen launcher (HUD Editor).", null, null)
                .with(Setting.choice("Skin", Skin.NAMES, () -> Skin.index(HudConfig.get().menuSkin), i -> HudConfig.get().menuSkin = Skin.NAMES[i]))
                .with(Setting.choice("Backdrop", Skin.BACKGROUNDS, () -> Math.max(0, java.util.Arrays.asList(Skin.BACKGROUNDS).indexOf(HudConfig.get().menuBackground)), i -> HudConfig.get().menuBackground = Skin.BACKGROUNDS[i]))
                .with(Setting.slider("Backdrop dimming", 0, 0.95, 0.05, "%", () -> HudConfig.get().menuDim, v -> HudConfig.get().menuDim = v).asPercent()));
        out.add(new Module("STYLE", "Appearance", "How every overlay looks.", null, null)
                .with(Setting.actions("Preset", Presets.NAMES, Presets::apply))
                .with(Setting.choice("Theme", Look.THEMES, () -> Math.max(0, java.util.Arrays.asList(Look.THEMES).indexOf(HudConfig.get().theme)), i -> HudConfig.get().theme = Look.THEMES[i]))
                .with(Setting.swatches("Text colour", PALETTE, () -> HudConfig.get().textColor, v -> HudConfig.get().textColor = v))
                .with(Setting.swatches("Accent colour", PALETTE, () -> HudConfig.get().accentColor, v -> HudConfig.get().accentColor = v))
                .with(Setting.sw("Background", () -> HudConfig.get().background, v -> HudConfig.get().background = v))
                .with(Setting.slider("Background opacity", 0, 1, 0.05, "%", () -> HudConfig.get().bgOpacity, v -> HudConfig.get().bgOpacity = v).asPercent())
                .with(Setting.sw("Text shadow", () -> HudConfig.get().shadow, v -> HudConfig.get().shadow = v)));
        return out;
    }

    // ---------------- state ----------------

    private static final String[] PAGE_TITLES = {"Modules", "Style", "Cosmetics", "Settings"};
    private static final String[] PAGE_ICONS = {"grid", "palette", "hanger", "gear"};
    private static final int[] TINTS = {0xFF8B5CF6, 0xFF06B6D4, 0xFFF59E0B, 0xFF10B981, 0xFFEC4899, 0xFF3B82F6};

    private final List<Module> modules = build();
    /** The page a new menu opens on; only the self-test changes it, to photograph the other pages. */
    static int startPage;
    private int page = startPage;
    private Module detail;
    private double scroll;
    private double maxScroll;
    private Setting dragging;
    private int dragX;
    private int dragW;
    /** Set when the player clicked "Edit layout"; the screen reads and clears it. */
    public boolean wantsLayout;

    private record Hit(int x, int y, int w, int h, Runnable action, Setting slider, boolean inContent) {
        boolean at(double mx, double my) {
            return mx >= x && my >= y && mx < x + w && my < y + h;
        }
    }

    private final List<Hit> hits = new ArrayList<>();
    private boolean inContent;
    private int px, py, pw, ph, contentTop, contentBottom;
    private int dockX, dockY, dockW, dockH;

    private void addHit(int x, int y, int w, int h, Runnable action, Setting slider) {
        hits.add(new Hit(x, y, w, h, action, slider, inContent));
    }

    /** For the dev preview and tests: jump to a page, optionally straight into one module. */
    void show(int newPage, String moduleName) {
        page = newPage;
        detail = null;
        scroll = 0;
        if (moduleName != null) for (Module m : modules) if (m.name.equals(moduleName)) detail = m;
    }

    // helpers for the dev preview and tests
    String pageName() {
        return PAGE_TITLES[page];
    }

    boolean inDetail() {
        return detail != null;
    }

    int[] dockSlot(int i) {
        return new int[]{dockX + 5 + i * 34 + 17, dockY + dockH / 2};
    }

    /** Centre of the first module switch on screen, from the hits of the last render. */
    int[] firstCardToggle() {
        for (Hit h : hits) if (h.inContent && h.h < 30 && h.w > 25 && h.w < 40) return new int[]{h.x + h.w / 2, h.y + h.h / 2};
        throw new IllegalStateException("no card switch");
    }

    void turnFigure() {
        bias = -bias;
    }

    void scrollTo(double to) {
        scroll = Math.max(0, Math.min(maxScroll, to));
    }

    /** Centres of the clickable rectangles of exactly this size on the page, in drawing order. */
    List<int[]> hitsOfSize(int w, int h) {
        List<int[]> out = new ArrayList<>();
        for (Hit hit : hits) if (hit.inContent && hit.w == w && hit.h == h) out.add(new int[]{hit.x + w / 2, hit.y + h / 2});
        return out;
    }

    int[] firstCardBody() {
        for (Hit h : hits) if (h.inContent && h.h >= 40 && h.w > 60) return new int[]{h.x + h.w / 2, h.y + 10};
        throw new IllegalStateException("no card");
    }

    private void goTo(int newPage) {
        page = newPage;
        detail = null;
        scroll = 0;
    }

    // ---------------- drawing ----------------

    private Skin skin = Skin.current();

    private final Motion anim = new Motion();
    /** The module card under the mouse this frame, and the screen size, for the little description that appears after a moment. */
    private Module tipModule;
    private int scrW, scrH;
    /** How far the menu has opened (0..1), which page or module is showing, and how far its change has got. */
    private double opened = Motion.frozen ? 1 : 0;
    private double changed = 1;
    private int lastView = -1;
    private double dockPos = page;

    /** Eased 0..1 hover amount of something on screen, so highlights fade instead of snapping. */
    private double hover(Object key, boolean over) {
        return anim.ease(key, over ? 1 : 0, 8);
    }

    private long frameNanos;
    private int frames;

    public void render(Gfx raw, int sw, int sh, int mx, int my) {
        long began = System.nanoTime();
        draw(raw, sw, sh, mx, my);
        if (SELFTEST && ++frames % 60 == 0) {
            System.out.println("selftest: menu frame " + (frameNanos / 60 / 1000) + " us on page " + PAGE_TITLES[page]);
            frameNanos = 0;
        }
        frameNanos += System.nanoTime() - began;
    }

    private static final boolean SELFTEST = Boolean.getBoolean("lumenhud.selftest");

    private void draw(Gfx raw, int sw, int sh, int mx, int my) {
        hits.clear();
        inContent = false;
        tipModule = null;
        scrW = sw;
        scrH = sh;
        skin = Skin.current();
        anim.tick();
        opened = Motion.frozen ? 1 : Math.min(1, opened + anim.dt / 0.22);
        int view = page * 1000 + (detail == null ? 0 : modules.indexOf(detail) + 1);
        if (view != lastView) {
            changed = lastView < 0 || Motion.frozen ? 1 : 0;
            lastView = view;
        }
        changed = Math.min(1, changed + anim.dt / 0.2);
        dockPos = Motion.frozen ? page : dockPos + (page - dockPos) * (1 - Math.exp(-anim.dt * 18));
        double open = Motion.smooth(opened);
        Gfx g = open >= 1 ? raw : new Motion.Fade(raw, open);
        final int EDGE = skin.edge, DIM = skin.dim, TEXT = skin.text;
        HudConfig cfg = HudConfig.get();
        int accent = cfg.accent();
        int gap = 6;
        dockH = 28;
        pw = Math.min(sw - 16, 470);
        ph = Math.min(sh - 16 - dockH - gap, 250);
        px = (sw - pw) / 2;
        py = (sh - (ph + gap + dockH)) / 2 + (int) Math.round((1 - open) * 8);
        Look.outline(g, px, py, pw, ph, 6, EDGE, skin.panel);

        // header: what this is, where you are, and the way into the layout editor
        g.fill(px + 8, py + 7, px + 10, py + 21, accent);
        g.text("Lumen", px + 15, py + 10, TEXT, true);
        int tx = px + 15 + g.width("Lumen ") + 4;
        g.text(PAGE_TITLES[page], tx, py + 10, DIM, false);
        String edit = "Edit layout";
        int bw = g.width(edit) + 14;
        int bx = px + pw - bw - 8;
        boolean hot = mx >= bx && mx < bx + bw && my >= py + 6 && my < py + 22;
        Look.round(g, bx, py + 6, bw, 16, 4, Look.mix(Look.withAlpha(accent, 0x90), Look.withAlpha(accent, 0xFF), hover("edit", hot)));
        g.text(edit, bx + 7, py + 10, 0xFFFFFFFF, false);
        addHit(bx, py + 6, bw, 16, () -> wantsLayout = true, null);
        g.fill(px + 8, py + 27, px + pw - 8, py + 28, EDGE);

        // content
        int cx = px + 10;
        int cw = pw - 20;
        contentTop = py + 32;
        contentBottom = py + ph - 6;
        g.clip(px + 4, contentTop, px + pw - 4, contentBottom);
        inContent = true;
        double shift = Motion.smooth(changed);
        Gfx c = shift >= 1 ? g : new Motion.Fade(g, shift); // a new page fades in while it settles up from a few pixels below
        int top = contentTop - (int) scroll + (int) Math.round((1 - shift) * 6);
        int shown = switch (page) {
            case 1 -> stylePage(c, cx, top, cw, accent, mx, my);
            case 2 -> cosmeticsPage(c, cx, top, cw, accent, mx, my);
            case 3 -> settingsPage(c, cx, top, cw, accent, mx, my);
            default -> detail != null ? detailPage(c, cx, top, cw, accent, mx, my) : modulesPage(c, cx, top, cw, accent, mx, my);
        };
        inContent = false;
        g.unclip();
        int viewH = contentBottom - contentTop;
        maxScroll = Math.max(0, shown - viewH);
        scroll = Math.max(0, Math.min(maxScroll, scroll));
        if (maxScroll > 0) { // scroll bar
            int th = Math.max(16, (int) (viewH * (viewH / (double) shown)));
            int ty = contentTop + (int) ((viewH - th) * (scroll / maxScroll));
            Look.round(g, px + pw - 7, ty, 2, th, 1, skin.track);
        }

        dock(g, sw, accent, mx, my);
        tooltip(g, mx, my);
    }

    /** What the module under the mouse does, shown after the mouse rests on its card for a moment. */
    private void tooltip(Gfx g, int mx, int my) {
        for (Module m : modules) {
            double t = anim.ease(java.util.List.of("tip", m), m == tipModule ? 1 : 0, 1.6);
            if (m != tipModule || t <= 0.5 || m.desc == null || m.desc.isEmpty()) continue;
            double fade = (t - 0.5) * 2;
            Gfx f = new Motion.Fade(g, fade);
            List<String> lines = wrap(f, m.desc, 150);
            int w = 8, h = 10 + lines.size() * 10 + 12;
            for (String l : lines) w = Math.max(w, g.width(l));
            w += 14;
            int tx = Math.min(scrW - w - 4, mx + 10);
            int ty = Math.min(scrH - h - 4, my + 14);
            Look.outline(f, tx, ty, w, h, 5, skin.edge, skin.panel);
            f.text(m.name, tx + 7, ty + 5, accentForTip(), true);
            int ly = ty + 17;
            for (String l : lines) {
                f.text(l, tx + 7, ly, skin.text, false);
                ly += 10;
            }
        }
    }

    private int accentForTip() {
        return HudConfig.get().accent();
    }

    /** The row of page icons under the window. */
    private void dock(Gfx g, int sw, int accent, int mx, int my) {
        int slot = 34;
        dockW = slot * PAGE_ICONS.length + 10;
        dockX = (sw - dockW) / 2;
        dockY = py + ph + 6;
        Look.outline(g, dockX, dockY, dockW, dockH, dockH / 2, skin.edge, skin.panel);
        Look.round(g, dockX + 5 + (int) Math.round(dockPos * slot) + 3, dockY + 3, slot - 6, dockH - 6, 10, Look.withAlpha(accent, 0x30)); // the marker glides to the page you picked
        for (int i = 0; i < PAGE_ICONS.length; i++) {
            int x = dockX + 5 + i * slot;
            boolean over = mx >= x && mx < x + slot && my >= dockY && my < dockY + dockH;
            double lit = hover("dock" + i, over && i != page);
            if (lit > 0) Look.round(g, x + 3, dockY + 3, slot - 6, dockH - 6, 10, Look.alpha(skin.hover, lit));
            Icons.draw(g, PAGE_ICONS[i], x + (slot - 16) / 2, dockY + (dockH - 16) / 2, i == page ? accent : over ? skin.text : skin.dim, 2);
            final int target = i;
            hits.add(new Hit(x, dockY, slot, dockH, () -> goTo(target), null, false));
        }
    }

    /** Overlay and client modules as cards. Returns the height used. */
    private int modulesPage(Gfx g, int x, int y, int cw, int accent, int mx, int my) {
        int cols = cw >= 330 ? 3 : 2;
        int gap = 6;
        int w = (cw - gap * (cols - 1)) / cols;
        int h = 50;
        int cy = y;
        String group = "";
        int col = 0;
        for (int i = 0; i < modules.size(); i++) {
            Module m = modules.get(i);
            if (m.group.equals("STYLE")) continue; // those live on the Style page
            if (!m.group.equals(group)) {
                if (col != 0) cy += h + gap;
                col = 0;
                group = m.group;
                g.text(group.charAt(0) + group.substring(1).toLowerCase(java.util.Locale.ROOT), x + 2, cy + 1, skin.dim, false);
                cy += 14;
            }
            int cx = x + col * (w + gap);
            card(g, m, TINTS[i % TINTS.length], cx, cy, w, h, accent, mx, my);
            col++;
            if (col == cols) {
                col = 0;
                cy += h + gap;
            }
        }
        if (col != 0) cy += h + gap;
        return cy - y + 2;
    }

    private void card(Gfx g, Module m, int tint, int x, int y, int w, int h, int accent, int mx, int my) {
        if (y + h < contentTop || y > contentBottom) return; // scrolled out of view: nothing to draw
        boolean over = mx >= x && mx < x + w && my >= y && my < y + h && my >= contentTop && my < contentBottom;
        if (over) tipModule = m;
        Look.round(g, x, y, w, h, 6, Look.mix(skin.card, skin.cardHover, hover(java.util.List.of("card", m), over)));
        Look.round(g, x + 6, y + 6, 16, 16, 4, Look.withAlpha(tint, 0x44));
        Icons.size(g, m.icon, x + 8, y + 8, tint, 12);
        if (!m.settings.isEmpty()) Icons.size(g, "gear", x + w - 15, y + 6, skin.dim, 10);
        boolean on = m.on == null || m.on.getAsBoolean();
        g.text(m.name, x + 7, y + 26, on ? skin.text : skin.dim, false);
        if (m.on != null) switchAt(g, m, x + 6, y + 37, on, accent, skin.off);
        addHit(x, y, w, h, () -> detail = m, null);
        if (m.on != null) addHit(x, y + 33, 34, h - 33, () -> m.setOn.accept(!m.on.getAsBoolean()), null);
    }

    /** One module: what it is, its switch and its settings. */
    private int detailPage(Gfx g, int x, int y, int cw, int accent, int mx, int my) {
        Module m = detail;
        int back = g.width("Back") + 24;
        boolean over = mx >= x && mx < x + back && my >= y && my < y + 14;
        Look.round(g, x, y, back, 14, 6, Look.mix(skin.card, skin.cardHover, hover("back", over)));
        Icons.draw(g, "back", x + 5, y + 3, skin.dim, 1);
        g.text("Back", x + 16, y + 3, skin.text, false);
        addHit(x, y, back, 14, () -> {
            detail = null;
            scroll = 0;
        }, null);

        int leftW = Math.max(110, cw * 36 / 100);
        int ly = y + 22;
        int tint = TINTS[modules.indexOf(m) % TINTS.length];
        Look.round(g, x, ly, 30, 30, 8, Look.withAlpha(tint, 0x44));
        Icons.size(g, m.icon, x + 6, ly + 6, tint, 18);
        g.text(m.name, x + 38, ly + 5, accent, true);
        if (m.on != null) {
            boolean on = m.on.getAsBoolean();
            switchAt(g, m, x + 38, ly + 18, on, accent, skin.off);
            g.text(on ? "On" : "Off", x + 64, ly + 19, on ? skin.text : skin.dim, false);
            addHit(x + 36, ly + 14, 60, 16, () -> m.setOn.accept(!m.on.getAsBoolean()), null);
        }
        int dy = ly + 38;
        for (String line : wrap(g, m.desc, leftW - 4)) {
            g.text(line, x, dy, skin.dim, false);
            dy += 10;
        }
        int rx = x + leftW + 14;
        int rw = cw - leftW - 14;
        g.fill(x + leftW + 6, y + 22, x + leftW + 7, y + 22 + Math.max(60, dy - y - 22), skin.edge);
        int sy = y + 22;
        if (m.settings.isEmpty()) g.text("No extra settings.", rx, sy + 2, skin.dim, false);
        for (Setting s : m.settings) {
            drawSetting(g, s, rx, sy, rw, accent, mx, my);
            sy += s.height();
        }
        return Math.max(dy, sy) - y + 6;
    }

    private Module named(String name) {
        for (Module m : modules) if (m.name.equals(name)) return m;
        throw new IllegalStateException(name);
    }

    /** Overlay look on the left, the menu's own look on the right. */
    private int stylePage(Gfx g, int x, int y, int cw, int accent, int mx, int my) {
        int colW = (cw - 14) / 2;
        int rx = x + colW + 14;
        g.text("Overlay", x, y, accent, true);
        g.text("This menu", rx, y, accent, true);
        g.fill(x + colW + 6, y, x + colW + 7, y + 150, skin.edge);
        int ly = y + 14;
        for (Setting s : named("Appearance").settings) {
            drawSetting(g, s, x, ly, colW, accent, mx, my);
            ly += s.height();
        }
        int ry = y + 14;
        for (Setting s : named("Menu look").settings) {
            drawSetting(g, s, rx, ry, colW, accent, mx, my);
            ry += s.height();
        }
        ry += 6;
        for (String line : wrap(g, "A picture for the backdrop is chosen in the Lumen launcher (HUD Editor).", colW)) {
            g.text(line, rx, ry, skin.dim, false);
            ry += 10;
        }
        return Math.max(ly, ry) - y + 4;
    }

    // ---------------- cosmetics: skins and capes, chosen right here ----------------

    private interface IoAction {
        void run() throws Exception;
    }

    private String notice = "";
    private boolean noticeError;
    private long noticeAt;

    private void say(String text, boolean error) {
        notice = text;
        noticeError = error;
        noticeAt = System.currentTimeMillis();
    }

    private void attempt(String done, IoAction action) {
        try {
            action.run();
            if (done != null) say(done, false);
        } catch (Exception e) {
            say(e.getMessage() == null ? "That did not work" : e.getMessage(), true);
        }
    }

    private void finishPick(FilePicker.Result r) {
        if (r.error() != null) {
            say(r.error(), true);
            return;
        }
        attempt(null, () -> {
            if (Files.size(r.file()) > 4_000_000) throw new IOException("That file is too big for a skin");
            byte[] bytes = Files.readAllBytes(r.file());
            if (r.purpose() == FilePicker.Purpose.SKIN) {
                String name = r.file().getFileName().toString().replaceFirst("\\.[^.]*$", "");
                SkinLibrary.add(bytes, name);
                say("Skin added and in use", false);
            } else {
                SkinLibrary.setCape(bytes);
                say("Cape set", false);
            }
        });
    }

    private static String fit(Gfx g, String s, int width) {
        if (g.width(s) <= width) return s;
        while (s.length() > 1 && g.width(s + "…") > width) s = s.substring(0, s.length() - 1);
        return s + "…";
    }

    private void tile(Gfx g, int x, int y, int w, int h, boolean selected, boolean over, int accent) {
        if (selected) Look.round(g, x - 1, y - 1, w + 2, h + 2, 7, accent);
        Look.round(g, x, y, w, h, 6, Look.mix(skin.card, skin.cardHover, hover(((long) x << 20) ^ (y + (long) scroll), over)));
    }

    private boolean over(int mx, int my, int x, int y, int w, int h) {
        return mx >= x && mx < x + w && my >= y && my < y + h && my >= contentTop && my < contentBottom;
    }

    private int pill(Gfx g, int x, int y, String label, boolean on, int accent, int mx, int my, Runnable action) {
        int w = g.width(label) + 12;
        boolean hot = over(mx, my, x, y, w, 14);
        Look.round(g, x, y, w, 14, 5, on ? accent : Look.mix(skin.hover, skin.cardHover, hover("pill" + label, hot)));
        g.text(label, x + 6, y + 3, on ? 0xFFFFFFFF : hot ? skin.text : skin.dim, false);
        addHit(x, y, w, 14, action, null);
        return w;
    }

    private void plus(Gfx g, int cx, int cy, int color) {
        g.fill(cx - 5, cy - 1, cx + 6, cy + 1, color);
        g.fill(cx - 1, cy - 5, cx + 1, cy + 6, color);
    }

    private static final String DEFAULT_SKIN = "\u0000default";
    /** What the player has picked in the wardrobe but not put on yet: null means "no change". */
    private String pendingSkin;
    private boolean pendingCapeSet;
    private int[] pendingCape;
    /** How far the players are turned (radians): a slow turntable, plus what the mouse dragged them to. */
    private double spin;
    private double bias;
    private boolean turning;
    private double turnX, pressX;

    /** Puts on what is picked in the wardrobe. */
    void equip() {
        attempt("Equipped", () -> {
            if (pendingSkin != null) SkinLibrary.use(DEFAULT_SKIN.equals(pendingSkin) ? null : pendingSkin);
            if (pendingCapeSet) {
                if (pendingCape == null) SkinLibrary.clearCape();
                else SkinLibrary.setCape(pendingCape);
            }
        });
        dropPending();
    }

    private void dropPending() {
        pendingSkin = null;
        pendingCapeSet = false;
        pendingCape = null;
    }

    /** The player in 3D on the left, as they look now and as they would look after the change, and the skins and capes to pick from on the right. */
    private int cosmeticsPage(Gfx g, int x, int y, int cw, int accent, int mx, int my) {
        FilePicker.Result picked = FilePicker.take();
        if (picked != null) {
            dropPending();
            finishPick(picked);
        }
        if (!turning) spin += anim.dt * 0.7;
        List<SkinLibrary.Entry> library = SkinLibrary.skins();
        SkinLibrary.Entry active = SkinLibrary.active();
        int[] cape = SkinLibrary.cape();
        SkinLibrary.Entry chosen = active;
        if (pendingSkin != null) {
            chosen = null;
            for (SkinLibrary.Entry e : library) if (e.id.equals(pendingSkin)) chosen = e;
        }
        int[] chosenCape = pendingCapeSet ? pendingCape : cape;
        boolean changed = (pendingSkin != null && (active == null ? chosen != null : chosen == null || !chosen.id.equals(active.id)))
                || (pendingCapeSet && !java.util.Arrays.equals(cape, pendingCape));

        // the stage: two turntables
        int stageW = 188;
        int stageH = 148;
        Look.round(g, x, y, stageW, stageH, 8, skin.card);
        int mw = 76, mh = 104;
        int s = g.scale();
        int left = x + 8;
        int right = x + stageW - 8 - mw;
        double turn = bias + spin;
        for (int i = 0; i < 2; i++) {
            SkinLibrary.Entry who = i == 0 ? active : chosen;
            int[] pixels = who == null ? null : SkinLibrary.pixels(who);
            boolean slim = who != null && who.slim();
            int[] worn = i == 0 ? cape : chosenCape;
            int mxp = i == 0 ? left : right;
            Look.round(g, mxp + 12, y + mh - 4, mw - 24, 6, 3, Look.withAlpha(0xFF000000, 0x40)); // the floor under the feet
            // the game draws its own player model: the left one as worn now, the right one in what is picked
            if (!g.player(mxp, y + 4, mxp + mw, y + 4 + mh, turn, i == 1, pixels, slim, worn)) {
                Figure.body(g, pixels, slim, worn, false, mxp + (mw - 48) / 2, y + 10, 3);
            }
            String label = i == 0 ? "Now" : "After";
            g.text(label, mxp + (mw - g.width(label)) / 2, y + mh + 3, i == 1 && changed ? accent : skin.dim, false);
        }
        g.text("›", x + stageW / 2 - g.width("›") / 2, y + 46, skin.dim, false);
        addHit(x, y, stageW, mh + 4, () -> {
            turning = true;
            turnX = pressX;
        }, null);
        int by = y + stageH - 21;
        int equipW = g.width("Equip") + 18;
        int cancelW = g.width("Revert") + 18;
        int bx = x + (stageW - equipW - cancelW - 6) / 2;
        boolean hotEquip = changed && over(mx, my, bx, by, equipW, 16);
        Look.round(g, bx, by, equipW, 16, 6, changed ? Look.mix(accent, 0xFFFFFFFF, hover("equip", hotEquip) * 0.25) : skin.hover);
        g.text("Equip", bx + 9, by + 4, changed ? 0xFFFFFFFF : skin.dim, false);
        if (changed) addHit(bx, by, equipW, 16, this::equip, null);
        boolean hotRevert = changed && over(mx, my, bx + equipW + 6, by, cancelW, 16);
        Look.round(g, bx + equipW + 6, by, cancelW, 16, 6, Look.mix(skin.hover, skin.cardHover, hover("revert", hotRevert)));
        g.text("Revert", bx + equipW + 15, by + 4, changed ? skin.text : skin.dim, false);
        if (changed) addHit(bx + equipW + 6, by, cancelW, 16, this::dropPending, null);

        // skins
        int rx = x + stageW + 12;
        int rw = cw - stageW - 12;
        int tileW = 44;
        int cols = Math.max(1, (rw + 4) / (tileW + 4));
        int ry = y;
        g.text("Skin", rx, ry, accent, true);
        if (!notice.isEmpty() && System.currentTimeMillis() - noticeAt < 6000) {
            String n = fit(g, notice, rw - 40);
            g.text(n, rx + rw - g.width(n), ry, noticeError ? 0xFFEF4444 : 0xFF10B981, false);
        } else if (FilePicker.busy()) {
            String n = "Choose a file in the window that opened…";
            g.text(n, rx + rw - g.width(n), ry, skin.dim, false);
        } else {
            String n = "Drag to turn the players";
            g.text(n, rx + rw - g.width(n), ry, skin.dim, false);
        }
        ry += 13;
        int slot = 0;
        int count = library.size() + 2;
        for (int i = 0; i < count; i++) {
            int tx = rx + (slot % cols) * (tileW + 4);
            int ty = ry + (slot / cols) * (tileW + 4);
            slot++;
            boolean hot = over(mx, my, tx, ty, tileW, tileW);
            if (i == 0) { // no custom skin
                tile(g, tx, ty, tileW, tileW, chosen == null, hot, accent);
                Figure.head(g, null, tx + (tileW - 24) / 2, ty + 5, 3);
                String n = "Default";
                g.text(n, tx + (tileW - g.width(n)) / 2, ty + 32, chosen == null ? skin.text : skin.dim, false);
                addHit(tx, ty, tileW, tileW, () -> pendingSkin = DEFAULT_SKIN, null);
            } else if (i == 1) { // add one
                tile(g, tx, ty, tileW, tileW, false, hot, accent);
                plus(g, tx + tileW / 2, ty + 18, hot ? accent : skin.dim);
                String n = "Add skin";
                g.text(n, tx + (tileW - g.width(n)) / 2, ty + 32, skin.dim, false);
                addHit(tx, ty, tileW, tileW, () -> FilePicker.open(FilePicker.Purpose.SKIN), null);
            } else {
                SkinLibrary.Entry e = library.get(i - 2);
                boolean sel = chosen != null && e.id.equals(chosen.id);
                tile(g, tx, ty, tileW, tileW, sel, hot, accent);
                Figure.head(g, SkinLibrary.pixels(e), tx + (tileW - 24) / 2, ty + 5, 3);
                String n = fit(g, e.name, tileW - 6);
                g.text(n, tx + (tileW - g.width(n)) / 2, ty + 32, sel ? skin.text : skin.dim, false);
                addHit(tx, ty, tileW, tileW, () -> pendingSkin = e.id, null);
            }
        }
        ry += ((slot + cols - 1) / cols) * (tileW + 4);
        final SkinLibrary.Entry shown = chosen;
        if (shown != null) {
            g.text("Arms", rx, ry + 3, skin.dim, false);
            int ax = rx + g.width("Arms") + 8;
            ax += pill(g, ax, ry, "Classic", !shown.slim(), accent, mx, my, () -> attempt(null, () -> SkinLibrary.setSlim(shown, false))) + 4;
            ax += pill(g, ax, ry, "Slim", shown.slim(), accent, mx, my, () -> attempt(null, () -> SkinLibrary.setSlim(shown, true))) + 10;
            pill(g, ax, ry, "Remove", false, accent, mx, my, () -> attempt("Skin removed", () -> {
                SkinLibrary.remove(shown);
                dropPending();
            }));
            ry += 20;
        }

        // capes
        ry += 6;
        g.text("Cape", rx, ry, accent, true);
        ry += 13;
        int capeH = 50;
        int selected = -2; // -1: none, 0..n-1: a preset, -2: a cape of your own
        if (chosenCape == null) selected = -1;
        else for (int i = 0; i < Capes.NAMES.length; i++) if (java.util.Arrays.equals(chosenCape, Capes.make(i))) selected = i;
        boolean custom = chosenCape != null && selected == -2;
        int total = 2 + (custom ? 1 : 0) + Capes.NAMES.length;
        slot = 0;
        for (int i = 0; i < total; i++) {
            int tx = rx + (slot % cols) * (tileW + 4);
            int ty = ry + (slot / cols) * (capeH + 4);
            slot++;
            boolean hot = over(mx, my, tx, ty, tileW, capeH);
            if (i == 0) {
                tile(g, tx, ty, tileW, capeH, selected == -1, hot, accent);
                Look.round(g, tx + tileW / 2 - 8, ty + 14, 16, 2, 1, skin.dim);
                String n = "None";
                g.text(n, tx + (tileW - g.width(n)) / 2, ty + 38, selected == -1 ? skin.text : skin.dim, false);
                addHit(tx, ty, tileW, capeH, () -> {
                    pendingCapeSet = true;
                    pendingCape = null;
                }, null);
            } else if (i == 1) {
                tile(g, tx, ty, tileW, capeH, false, hot, accent);
                plus(g, tx + tileW / 2, ty + 20, hot ? accent : skin.dim);
                String n = "Add cape";
                g.text(n, tx + (tileW - g.width(n)) / 2, ty + 38, skin.dim, false);
                addHit(tx, ty, tileW, capeH, () -> FilePicker.open(FilePicker.Purpose.CAPE), null);
            } else {
                boolean mine = custom && i == 2;
                int preset = i - 2 - (custom ? 1 : 0);
                int[] px = mine ? chosenCape : Capes.make(preset);
                boolean sel = mine || preset == selected;
                tile(g, tx, ty, tileW, capeH, sel, hot, accent);
                Figure.blit(g, px, 64, 1, 1, 10, 16, tx + (tileW - 20) / 2, ty + 4, 2, false);
                String n = mine ? "Yours" : Capes.NAMES[preset];
                g.text(n, tx + (tileW - g.width(n)) / 2, ty + 38, sel ? skin.text : skin.dim, false);
                if (!mine) addHit(tx, ty, tileW, capeH, () -> {
                    pendingCapeSet = true;
                    pendingCape = Capes.make(preset);
                }, null);
            }
        }
        ry += ((slot + cols - 1) / cols) * (capeH + 4);
        g.text(fit(g, "Other Lumen players see these too.", rw), rx, ry + 2, skin.dim, false);
        ry += 14;
        return Math.max(stageH, ry - y) + 6;
    }

    private int settingsPage(Gfx g, int x, int y, int cw, int accent, int mx, int my) {
        int colW = Math.min(cw, 230);
        int cy = y;
        String edit = "Edit the layout";
        int bw = g.width(edit) + 20;
        boolean over = mx >= x && mx < x + bw && my >= cy && my < cy + 18;
        Look.round(g, x, cy, bw, 18, 5, over ? Look.withAlpha(accent, 0xFF) : Look.withAlpha(accent, 0xA0));
        g.text(edit, x + 10, cy + 5, 0xFFFFFFFF, false);
        addHit(x, cy, bw, 18, () -> wantsLayout = true, null);
        g.text("Drag the overlay elements where you want them.", x + bw + 8, cy + 5, skin.dim, false);
        cy += 28;
        Setting f3 = Setting.sw("Hide the overlay when F3 is open", () -> HudConfig.get().hideInDebug, v -> HudConfig.get().hideInDebug = v);
        drawSetting(g, f3, x, cy, colW, accent, mx, my);
        cy += f3.height() + 8;
        g.text("Keys", x, cy, accent, true);
        cy += 13;
        for (String line : new String[]{"Right Shift   this menu", "C   zoom (hold)", "Left Alt   freelook (hold)", "Esc   close the menu"}) {
            g.text(line, x + 2, cy, skin.dim, false);
            cy += 11;
        }
        cy += 6;
        g.text("Lumen HUD 1.0.0", x, cy, skin.dim, false);
        return cy + 12 - y;
    }

    private void drawSetting(Gfx g, Setting s, int x, int y, int w, int accent, int mx, int my) {
        final int TEXT = skin.text, DIM = skin.dim;
        switch (s.kind) {
            case SWITCH -> {
                g.text(s.label, x, y + 4, TEXT, false);
                switchAt(g, s, x + w - 26, y + 4, s.getBool.getAsBoolean(), accent, skin.off);
                addHit(x, y, w, 18, () -> s.setBool.accept(!s.getBool.getAsBoolean()), null);
            }
            case SLIDER -> {
                double v = s.getNum.getAsDouble();
                String value = s.percent ? Math.round(v * 100) + "%" : (s.step < 1 ? String.format(java.util.Locale.ROOT, "%.1f", v) : String.valueOf((int) Math.round(v))) + s.suffix;
                g.text(s.label, x, y + 2, TEXT, false);
                g.text(value, x + w - g.width(value), y + 2, DIM, false);
                int ty = y + 16;
                Look.round(g, x, ty, w, 4, 2, skin.track);
                double t = (v - s.min) / (s.max - s.min);
                int kx = x + (int) Math.round(t * (w - 6));
                Look.round(g, x, ty, Math.max(4, kx - x + 3), 4, 2, accent);
                Look.round(g, kx, ty - 2, 6, 8, 3, 0xFFFFFFFF);
                addHit(x - 2, y + 12, w + 4, 14, null, s);
            }
            case CHOICE -> {
                g.text(s.label, x, y + 4, TEXT, false);
                String v = s.options[s.getIdx.getAsInt()];
                v = Character.toUpperCase(v.charAt(0)) + v.substring(1);
                int bw = g.width(v) + 14;
                Look.round(g, x + w - bw, y + 1, bw, 15, 4, Look.withAlpha(accent, 0x70));
                g.text(v, x + w - bw + 7, y + 5, 0xFFFFFFFF, false);
                addHit(x + w - bw, y + 1, bw, 15, () -> s.setIdx.accept((s.getIdx.getAsInt() + 1) % s.options.length), null);
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
                    addHit(ax, y + 12, bw, 14, () -> s.onAction.accept(idx), null);
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
                    if (on) Look.round(g, cx - 1, y + 12, 15, 15, 4, TEXT);
                    Look.round(g, cx, y + 13, 13, 13, 3, col);
                    final String chosen = hex;
                    addHit(cx, y + 12, 14, 15, () -> s.setColor.accept(chosen), null);
                    cx += 17;
                }
            }
        }
    }

    /** A switch whose knob slides and whose colour fades; {@code key} is what it belongs to, so the motion survives redraws. */
    private void switchAt(Gfx g, Object key, int x, int y, boolean on, int accent, int off) {
        double t = anim.ease(java.util.List.of("switch", key), on ? 1 : 0, 8);
        Look.round(g, x, y, 22, 10, 5, Look.mix(off, accent, t));
        Look.round(g, x + 1 + (int) Math.round(12 * t), y + 1, 8, 8, 4, 0xFFFFFFFF);
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

    private boolean inWindow(double mx, double my) {
        return (mx >= px && my >= py && mx < px + pw && my < py + ph) || (mx >= dockX && my >= dockY && mx < dockX + dockW && my < dockY + dockH);
    }

    /** @return true when the click was inside the menu */
    public boolean press(double mx, double my, int button) {
        pressX = mx;
        if (!inWindow(mx, my)) return false;
        if (button != 0) return true;
        for (int i = hits.size() - 1; i >= 0; i--) {
            Hit h = hits.get(i);
            if (!h.at(mx, my)) continue;
            if (h.inContent && (my < contentTop || my >= contentBottom)) continue; // the part scrolled out of view
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
        if (turning) {
            bias += (mx - turnX) * 0.03;
            turnX = mx;
            return true;
        }
        if (dragging == null) return false;
        setFromMouse(mx);
        return true;
    }

    public void release() {
        dragging = null;
        turning = false;
    }

    private void setFromMouse(double mx) {
        Setting s = dragging;
        double t = Math.max(0, Math.min(1, (mx - dragX - 3) / (dragW - 6)));
        double v = s.min + t * (s.max - s.min);
        v = Math.round(v / s.step) * s.step;
        s.setNum.accept(Math.max(s.min, Math.min(s.max, v)));
    }

    public boolean scroll(double mx, double my, double dy) {
        if (!inWindow(mx, my)) return false;
        scroll = Math.max(0, Math.min(maxScroll, scroll - Math.signum(dy) * 24));
        return true;
    }
}
