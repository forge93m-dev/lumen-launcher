package dev.lumen.hud;

import com.google.gson.Gson;
import net.fabricmc.loader.api.FabricLoader;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * The skins and the cape you can pick in the menu. They live in the launcher's library (skins/ next to instances/), the
 * same files the launcher's Skin page edits, so a change made here shows up there and the other way round. Picking one
 * also writes it into this instance's config/ right away (see {@link SkinConfig}); the launcher notices the change in
 * the library and shares it with the other Lumen players.
 */
public final class SkinLibrary {
    public static final class Entry {
        public String id;
        public String name;
        public String model = "classic";
        public long added;

        public boolean slim() {
            return "slim".equals(model);
        }
    }

    private static final class Index {
        List<Entry> skins = new ArrayList<>();
        String active;
    }

    private static final Gson GSON = new Gson();
    private static final Map<String, int[]> PIXELS = new HashMap<>();

    private static Index index = new Index();
    private static long indexStamp = -2;
    private static long lastCheck;
    private static int[] cape;
    private static long capeStamp = -2;
    /** Bumps whenever the library changed, so the menu knows to redraw cached things. */
    public static int version;

    private SkinLibrary() {}

    /** The library folder: the launcher's skins/ when this is one of its instances, else a folder in config/. */
    public static Path dir() {
        String set = System.getProperty("lumen.skins");
        if (set != null && !set.isEmpty()) return Path.of(set);
        Path cfg = FabricLoader.getInstance().getConfigDir().toAbsolutePath();
        Path inst = cfg.getParent();
        Path instances = inst == null ? null : inst.getParent();
        if (instances != null && instances.getFileName() != null && instances.getFileName().toString().equals("instances") && instances.getParent() != null) {
            return instances.getParent().resolve("skins");
        }
        return cfg.resolve("lumen-library");
    }

    private static Path indexFile() {
        return dir().resolve("index.json");
    }

    private static Path skinFile(String id) {
        return dir().resolve(id + ".png");
    }

    private static Path capeFile() {
        return dir().resolve("cape.png");
    }

    private static long stamp(Path p) {
        try {
            return Files.exists(p) ? Files.getLastModifiedTime(p).toMillis() : 0;
        } catch (IOException e) {
            return 0;
        }
    }

    /** Re-reads the library when it changed on disk (checked at most about once a second). */
    private static void refresh() {
        long now = System.nanoTime();
        if (indexStamp != -2 && now - lastCheck < 1_000_000_000L) return;
        lastCheck = now;
        long s = stamp(indexFile());
        if (s != indexStamp) {
            indexStamp = s;
            index = new Index();
            try {
                if (s != 0) {
                    Index read = GSON.fromJson(Files.readString(indexFile(), StandardCharsets.UTF_8), Index.class);
                    if (read != null && read.skins != null) {
                        index = read;
                        index.skins.removeIf(e -> e == null || e.id == null || !e.id.matches("[a-z0-9-]+") || !Files.exists(skinFile(e.id)));
                    }
                }
            } catch (Exception e) {
                LumenHud.LOG.warn("Could not read the skin library", e);
            }
            version++;
        }
        long c = stamp(capeFile());
        if (c != capeStamp) {
            capeStamp = c;
            cape = null;
            if (c != 0) {
                try {
                    cape = Png.decode(Files.readAllBytes(capeFile())).argb;
                } catch (Exception e) {
                    LumenHud.LOG.warn("Could not read the cape", e);
                }
            }
            version++;
        }
    }

    public static List<Entry> skins() {
        refresh();
        return index.skins;
    }

    public static Entry active() {
        refresh();
        for (Entry e : index.skins) if (e.id.equals(index.active)) return e;
        return null;
    }

    /** The 64x64 picture of a library skin, or null. */
    public static int[] pixels(Entry e) {
        int[] p = PIXELS.get(e.id);
        if (p == null) {
            try {
                Png.Image img = Png.decode(Files.readAllBytes(skinFile(e.id)));
                if (img.width == 64 && img.height == 64) p = img.argb;
            } catch (Exception ex) {
                LumenHud.LOG.warn("Could not read skin {}", e.id, ex);
            }
            if (p == null) p = new int[64 * 64];
            PIXELS.put(e.id, p);
        }
        return p;
    }

    /** The cape picture (64x32), or null when none is set. */
    public static int[] cape() {
        refresh();
        return cape;
    }

    // ---------------- changes ----------------

    private static void write(Path file, byte[] bytes) throws IOException {
        Files.createDirectories(file.getParent());
        Path tmp = file.resolveSibling(file.getFileName() + "." + UUID.randomUUID().toString().substring(0, 8) + ".tmp");
        Files.write(tmp, bytes);
        try {
            Files.move(tmp, file, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } catch (IOException e) {
            Files.move(tmp, file, StandardCopyOption.REPLACE_EXISTING);
        }
    }

    private static void saveIndex() throws IOException {
        write(indexFile(), GSON.toJson(index).getBytes(StandardCharsets.UTF_8));
        indexStamp = stamp(indexFile());
        lastCheck = System.nanoTime();
        version++;
    }

    private static String clean(String name) {
        String n = name == null ? "" : name.replaceAll("[^\\p{L}\\p{N} _.'-]", "").trim();
        if (n.length() > 32) n = n.substring(0, 32);
        return n.isEmpty() ? "Skin" : n;
    }

    /** Adds a skin from the bytes of a PNG file and makes it the one in use. */
    public static Entry add(byte[] pngBytes, String name) throws IOException {
        refresh();
        Png.Image img = Png.decode(pngBytes);
        int[] skin = normalizeSkin(img);
        Entry e = new Entry();
        e.id = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        e.name = clean(name);
        e.added = System.currentTimeMillis();
        write(skinFile(e.id), Png.encode(skin, 64, 64));
        PIXELS.put(e.id, skin);
        index.skins.add(e);
        index.active = e.id;
        saveIndex();
        apply();
        return e;
    }

    public static void use(String id) throws IOException {
        refresh();
        index.active = id;
        saveIndex();
        apply();
    }

    public static void setSlim(Entry e, boolean slim) throws IOException {
        e.model = slim ? "slim" : "classic";
        saveIndex();
        apply();
    }

    public static void remove(Entry e) throws IOException {
        refresh();
        index.skins.remove(e);
        if (e.id.equals(index.active)) index.active = null;
        Files.deleteIfExists(skinFile(e.id));
        PIXELS.remove(e.id);
        saveIndex();
        apply();
    }

    public static void setCape(byte[] pngBytes) throws IOException {
        Png.Image img = Png.decode(pngBytes);
        setCape(normalizeCape(img));
    }

    /** Sets the cape from a 64x32 picture. */
    public static void setCape(int[] pixels) throws IOException {
        write(capeFile(), Png.encode(pixels, 64, 32));
        capeStamp = stamp(capeFile());
        cape = pixels;
        version++;
        apply();
    }

    public static void clearCape() throws IOException {
        Files.deleteIfExists(capeFile());
        capeStamp = 0;
        cape = null;
        version++;
        apply();
    }

    /** Writes what is chosen into this instance's config/, where {@link SkinConfig} picks it up. */
    private static void apply() throws IOException {
        Path cfg = FabricLoader.getInstance().getConfigDir();
        Entry a = active();
        boolean hasCape = Files.exists(capeFile());
        if (a != null) write(cfg.resolve("lumen-skin.png"), Files.readAllBytes(skinFile(a.id)));
        if (hasCape) write(cfg.resolve("lumen-cape.png"), Files.readAllBytes(capeFile()));
        String json = String.format(Locale.ROOT, "{\"enabled\":%b,\"slim\":%b,\"cape\":%b}", a != null, a != null && a.slim(), hasCape);
        write(cfg.resolve("lumen-skin.json"), json.getBytes(StandardCharsets.UTF_8));
    }

    // ---------------- picture handling (the same rules as the launcher's core/skins.js) ----------------

    private static void copyRect(int[] px, int sx, int sy, int ox, int oy, int w, int h) {
        for (int i = 0; i < w; i++) {
            for (int j = 0; j < h; j++) {
                px[(sy + oy + j) * 64 + sx + ox + (w - 1 - i)] = px[(sy + j) * 64 + sx + i];
            }
        }
    }

    private static void opaque(int[] px, int x1, int y1, int x2, int y2) {
        for (int y = y1; y < y2; y++) for (int x = x1; x < x2; x++) px[y * 64 + x] |= 0xFF000000;
    }

    /** Any 64x64 or old 64x32 skin (or the same drawn larger) as the 64x64 picture the game wants. */
    static int[] normalizeSkin(Png.Image img) throws IOException {
        int w = img.width, h = img.height;
        boolean legacy = w == h * 2;
        if (!((w == h || legacy) && w >= 64 && w % 64 == 0)) throw new IOException("A skin picture is 64×64 (or the old 64×32) pixels");
        int k = w / 64;
        int[] out = new int[64 * 64];
        for (int y = 0; y < (legacy ? 32 : 64); y++) for (int x = 0; x < 64; x++) out[y * 64 + x] = img.argb[y * k * w + x * k];
        if (legacy) {
            int[][] moves = {{4, 16, 16, 32, 4, 4}, {8, 16, 16, 32, 4, 4}, {0, 20, 24, 32, 4, 12}, {4, 20, 16, 32, 4, 12}, {8, 20, 8, 32, 4, 12}, {12, 20, 16, 32, 4, 12},
                    {44, 16, -8, 32, 4, 4}, {48, 16, -8, 32, 4, 4}, {40, 20, 0, 32, 4, 12}, {44, 20, -8, 32, 4, 12}, {48, 20, -16, 32, 4, 12}, {52, 20, -8, 32, 4, 12}};
            for (int[] m : moves) copyRect(out, m[0], m[1], m[2], m[3], m[4], m[5]);
        }
        opaque(out, 0, 0, 32, 16);
        opaque(out, 0, 16, 64, 32);
        opaque(out, 16, 48, 48, 64);
        return out;
    }

    /** A cape is a 64x32 picture; the small 22x17 files some editors write are placed in its corner. */
    static int[] normalizeCape(Png.Image img) throws IOException {
        int[] out = new int[64 * 32];
        if (img.width == 22 && img.height == 17) {
            for (int y = 0; y < 17; y++) System.arraycopy(img.argb, y * 22, out, y * 64, 22);
            return out;
        }
        if (!(img.width == img.height * 2 && img.width >= 64 && img.width % 64 == 0)) throw new IOException("A cape picture is 64×32 (or 22×17) pixels");
        int k = img.width / 64;
        for (int y = 0; y < 32; y++) for (int x = 0; x < 64; x++) out[y * 64 + x] = img.argb[y * k * img.width + x * k];
        return out;
    }
}
