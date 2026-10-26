package dev.lumen.hud;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import net.fabricmc.loader.api.FabricLoader;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Stored in config/lumenhud.json. The Lumen launcher edits the same file, and the mod
 * reloads it whenever it changes on disk, so layout tweaks apply even while playing.
 */
public class HudConfig {
    public static class Element {
        public boolean enabled = true;
        /** Anchor per axis: 0 = left/top, 0.5 = centre, 1 = right/bottom. */
        public double ax;
        public double ay;
        /** Offset from the anchor in GUI-scaled pixels, pointing inwards. */
        public double x = 2;
        public double y = 2;
        public double scale = 1.0;

        public Element() {}

        Element(double ax, double ay, double x, double y) {
            this.ax = ax;
            this.ay = ay;
            this.x = x;
            this.y = y;
        }
    }

    public static final String[] IDS = {"fps", "cps", "coords", "keystrokes", "armor", "ping", "speed", "clock", "effects", "reach", "combo", "memory", "session", "items", "target", "server", "sprint"};

    public int version = 2;
    public String textColor = "#FFFFFF";
    public String accentColor = "#8B5CF6";
    public boolean background = true;
    public double bgOpacity = 0.45;
    public boolean shadow = true;
    public boolean hideInDebug = true;
    public boolean coordsFacing = true;
    public boolean coordsBiome = true;
    public boolean keystrokesCps = true;
    public boolean keystrokesSpace = true;
    public boolean armorDurability = true;
    public boolean armorHeldItem = true;
    public boolean clock24 = true;
    public boolean memoryShowMax = true;
    public boolean itemsTotems = true;
    public boolean itemsGapples = true;
    public boolean itemsPearls = true;
    public boolean itemsCrystals = true;
    /** Client features (not HUD elements): applied in-game, switched in the launcher. */
    public boolean toggleSprint = false;
    public boolean fullbright = false;
    public boolean zoom = true;
    /** Field of view while the zoom key (C) is held. */
    public int zoomFov = 30;
    public Map<String, Element> elements = new LinkedHashMap<>();

    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static HudConfig instance = new HudConfig();
    private static long lastModified;

    public static HudConfig get() {
        return instance;
    }

    private static Path file() {
        return FabricLoader.getInstance().getConfigDir().resolve("lumenhud.json");
    }

    public Element el(String id) {
        return elements.computeIfAbsent(id, HudConfig::defaultElement);
    }

    private static Element defaultElement(String id) {
        return switch (id) {
            case "fps" -> new Element(0, 0, 2, 2);
            case "cps" -> new Element(0, 0, 2, 19);
            case "coords" -> new Element(0, 0, 2, 36);
            case "keystrokes" -> new Element(1, 1, 2, 2);
            case "armor" -> new Element(1, 1, 76, 2);
            case "ping" -> new Element(0, 0, 2, 74);
            case "speed" -> {
                Element e = new Element(0, 0, 2, 91);
                e.enabled = false;
                yield e;
            }
            case "reach" -> {
                Element e = new Element(1, 0, 2, 19);
                e.enabled = false;
                yield e;
            }
            case "combo" -> {
                Element e = new Element(1, 0, 2, 36);
                e.enabled = false;
                yield e;
            }
            case "memory" -> disabled(1, 0, 2, 148);
            case "session" -> disabled(1, 0, 2, 130);
            case "server" -> disabled(0.5, 0, 0, 2);
            case "items" -> new Element(1, 0, 2, 53);
            case "target" -> new Element(0.5, 0, 0, 20);
            case "sprint" -> new Element(0, 1, 2, 40);
            case "clock" -> new Element(1, 0, 2, 2);
            case "effects" -> new Element(0, 0, 2, 110);
            default -> new Element(0, 0, 2, 2);
        };
    }

    private static Element disabled(double ax, double ay, double x, double y) {
        Element e = new Element(ax, ay, x, y);
        e.enabled = false;
        return e;
    }

    public static void load() {
        Path f = file();
        try {
            if (Files.exists(f)) {
                HudConfig c = GSON.fromJson(Files.readString(f, StandardCharsets.UTF_8), HudConfig.class);
                if (c != null) {
                    if (c.elements == null || c.version < 2) c.elements = new LinkedHashMap<>();
                    c.version = 2;
                    instance = c;
                }
                lastModified = Files.getLastModifiedTime(f).toMillis();
            } else {
                save();
            }
        } catch (Exception e) {
            LumenHud.LOG.warn("Could not read lumenhud.json, using defaults", e);
        }
        for (String id : IDS) instance.el(id);
    }

    public static void save() {
        Path f = file();
        try {
            for (String id : IDS) instance.el(id);
            Files.createDirectories(f.getParent());
            Files.writeString(f, GSON.toJson(instance), StandardCharsets.UTF_8);
            lastModified = Files.getLastModifiedTime(f).toMillis();
        } catch (IOException e) {
            LumenHud.LOG.warn("Could not save lumenhud.json", e);
        }
    }

    public static void reloadIfChanged() {
        try {
            Path f = file();
            if (Files.exists(f) && Files.getLastModifiedTime(f).toMillis() != lastModified) load();
        } catch (IOException ignored) {
        }
    }

    private static int parseColor(String hex, int fallback) {
        try {
            return 0xFF000000 | Integer.parseUnsignedInt(hex.replace("#", ""), 16);
        } catch (Exception e) {
            return fallback;
        }
    }

    public int text() {
        return parseColor(textColor, 0xFFFFFFFF);
    }

    public int accent() {
        return parseColor(accentColor, 0xFF8B5CF6);
    }

    public int bg() {
        int a = (int) Math.round(Math.max(0, Math.min(1, bgOpacity)) * 255);
        return a << 24;
    }
}
