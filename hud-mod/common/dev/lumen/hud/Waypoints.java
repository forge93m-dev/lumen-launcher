package dev.lumen.hud;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;
import net.fabricmc.loader.api.FabricLoader;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

/** Named places saved in config/lumen-waypoints.json, shown on the compass bar. */
public final class Waypoints {
    public static final class Point {
        public String name;
        public int x;
        public int y;
        public int z;
        public String dim = "";
        /** ARGB colour of the marker. */
        public int color = 0xFFFFFFFF;
    }

    private static final int[] COLORS = {0xFF8B5CF6, 0xFF3B82F6, 0xFF06B6D4, 0xFF10B981, 0xFFF59E0B, 0xFFEF4444, 0xFFEC4899};
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static List<Point> points;

    private Waypoints() {}

    private static Path file() {
        return FabricLoader.getInstance().getConfigDir().resolve("lumen-waypoints.json");
    }

    private static List<Point> all() {
        if (points == null) {
            points = new ArrayList<>();
            try {
                if (Files.exists(file())) {
                    List<Point> read = GSON.fromJson(Files.readString(file(), StandardCharsets.UTF_8), new TypeToken<List<Point>>() {}.getType());
                    if (read != null) points.addAll(read);
                }
            } catch (Exception e) {
                LumenHud.LOG.warn("Could not read lumen-waypoints.json", e);
            }
        }
        return points;
    }

    private static void save() {
        try {
            Files.createDirectories(file().getParent());
            Files.writeString(file(), GSON.toJson(all()), StandardCharsets.UTF_8);
        } catch (IOException e) {
            LumenHud.LOG.warn("Could not save lumen-waypoints.json", e);
        }
    }

    /** Waypoints in one dimension. */
    public static List<Point> in(String dim) {
        List<Point> out = new ArrayList<>();
        for (Point p : all()) if (p.dim.equals(dim)) out.add(p);
        return out;
    }

    public static List<Point> everything() {
        return new ArrayList<>(all());
    }

    /** Adds or moves a waypoint with this name (case-insensitive) in the dimension. */
    public static Point set(String name, int x, int y, int z, String dim) {
        Point p = null;
        for (Point q : all()) if (q.name.equalsIgnoreCase(name) && q.dim.equals(dim)) p = q;
        if (p == null) {
            p = new Point();
            p.name = name;
            p.dim = dim;
            p.color = COLORS[all().size() % COLORS.length];
            all().add(p);
        }
        p.x = x;
        p.y = y;
        p.z = z;
        save();
        return p;
    }

    public static boolean remove(String name, String dim) {
        boolean removed = all().removeIf(p -> p.name.equalsIgnoreCase(name) && p.dim.equals(dim));
        if (removed) save();
        return removed;
    }
}
