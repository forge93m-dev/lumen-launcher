package dev.lumen.hud;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import net.fabricmc.loader.api.FabricLoader;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Pattern;

/**
 * Skins and capes of the other Lumen players, from the Lumen skin service whose address the launcher writes to
 * config/lumen-cloud.json. Everything here runs off the render thread; the pictures are handed over as bytes and
 * turned into textures by the version-specific code.
 */
public final class CloudSkins {
    public static final class Entry {
        public final String name;
        public volatile boolean ready;
        public volatile boolean slim;
        public volatile long rev = -1;
        public volatile byte[] skin;
        public volatile byte[] cape;
        volatile long checked;
        volatile boolean busy;
        volatile boolean missing;

        Entry(String name) {
            this.name = name;
        }
    }

    private static final Pattern NAME = Pattern.compile("^[A-Za-z0-9_]{3,16}$");
    private static final int MAX_PNG = 64 * 1024;
    private static final long REFRESH_MS = 5 * 60_000;
    private static final long RETRY_MS = 60_000;

    private static final Map<String, Entry> ENTRIES = new ConcurrentHashMap<>();
    private static final ExecutorService POOL = Executors.newFixedThreadPool(2, r -> {
        Thread t = new Thread(r, "Lumen skins");
        t.setDaemon(true);
        return t;
    });
    private static final HttpClient HTTP = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    private static final Gson GSON = new Gson();

    private static long cfgChecked;
    private static long cfgStamp = -1;
    private static boolean enabled;
    private static String base = "";

    private CloudSkins() {}

    private static Path file() {
        return FabricLoader.getInstance().getConfigDir().resolve("lumen-cloud.json");
    }

    private static void readConfig() {
        long now = System.nanoTime();
        if (cfgStamp != -1 && now - cfgChecked < 2_000_000_000L) return;
        cfgChecked = now;
        long stamp = 0;
        try {
            if (Files.exists(file())) stamp = Files.getLastModifiedTime(file()).toMillis();
        } catch (IOException ignored) {
        }
        if (stamp == cfgStamp) return;
        cfgStamp = stamp;
        enabled = false;
        base = "";
        try {
            if (stamp != 0) {
                JsonObject j = GSON.fromJson(Files.readString(file(), StandardCharsets.UTF_8), JsonObject.class);
                if (j != null && j.has("url") && j.has("enabled")) {
                    base = j.get("url").getAsString().replaceAll("/+$", "");
                    enabled = j.get("enabled").getAsBoolean() && (base.startsWith("https://") || base.startsWith("http://"));
                }
            }
        } catch (Exception e) {
            LumenHud.LOG.warn("Could not read lumen-cloud.json", e);
        }
        ENTRIES.clear(); // a new address means new answers
    }

    /**
     * What is known about a player, or null when the service is off or has nothing (yet). Asking again is cheap:
     * the first call starts a download in the background, later calls return what arrived.
     */
    public static Entry of(String name) {
        readConfig();
        if (!enabled || name == null || !NAME.matcher(name).matches()) return null;
        String key = name.toLowerCase();
        Entry e = ENTRIES.get(key);
        long now = System.currentTimeMillis();
        if (e == null) {
            if (ENTRIES.size() > 300) ENTRIES.clear();
            e = new Entry(name);
            ENTRIES.put(key, e);
        }
        if (!e.busy && now - e.checked > (e.ready ? REFRESH_MS : e.missing ? RETRY_MS : 0)) {
            e.busy = true;
            e.checked = now;
            final Entry fe = e;
            final String url = base;
            POOL.execute(() -> {
                try {
                    refresh(fe, url);
                } catch (Exception ex) {
                    LumenHud.LOG.debug("Lumen skin service: {}", ex.toString());
                } finally {
                    fe.busy = false;
                }
            });
        }
        return e.ready ? e : null;
    }

    private static byte[] get(String url, boolean limit) throws IOException, InterruptedException {
        HttpResponse<byte[]> r = HTTP.send(HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(8)).GET().build(), HttpResponse.BodyHandlers.ofByteArray());
        if (r.statusCode() == 404) return null;
        if (r.statusCode() != 200) throw new IOException("HTTP " + r.statusCode());
        if (limit && r.body().length > MAX_PNG) throw new IOException("picture too large");
        return r.body();
    }

    private static void refresh(Entry e, String url) throws IOException, InterruptedException {
        byte[] body = get(url + "/v1/profile/" + e.name, false);
        if (body == null) {
            e.missing = true;
            e.ready = false;
            return;
        }
        e.missing = false;
        JsonObject j = GSON.fromJson(new String(body, StandardCharsets.UTF_8), JsonObject.class);
        long rev = j.has("rev") ? j.get("rev").getAsLong() : 0;
        if (e.ready && rev == e.rev) return;
        byte[] skin = null;
        byte[] cape = null;
        if (j.has("skin") && !j.get("skin").isJsonNull() && j.get("skin").getAsString().startsWith("/v1/")) skin = get(url + j.get("skin").getAsString(), true);
        if (j.has("cape") && !j.get("cape").isJsonNull() && j.get("cape").getAsString().startsWith("/v1/")) cape = get(url + j.get("cape").getAsString(), true);
        e.slim = j.has("slim") && j.get("slim").getAsBoolean();
        e.skin = skin;
        e.cape = cape;
        e.rev = rev;
        e.ready = skin != null || cape != null;
    }
}
