package dev.lumen.hud;

import com.google.gson.Gson;
import net.fabricmc.loader.api.FabricLoader;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * The player skin the Lumen launcher puts next to the HUD config: lumen-skin.png (64x64) and lumen-skin.json.
 * Only your own player is drawn with it; other players keep their own skins.
 */
public final class SkinConfig {
    private static final class Json {
        boolean enabled = true;
        boolean slim = false;
        boolean cape = false;
    }

    private static long lastCheck;
    private static long lastStamp = -1;

    public static boolean enabled;
    public static boolean slim;
    public static boolean cape;

    private SkinConfig() {}

    public static Path png() {
        return FabricLoader.getInstance().getConfigDir().resolve("lumen-skin.png");
    }

    public static Path capePng() {
        return FabricLoader.getInstance().getConfigDir().resolve("lumen-cape.png");
    }

    private static Path json() {
        return FabricLoader.getInstance().getConfigDir().resolve("lumen-skin.json");
    }

    /**
     * Looks at the files at most once a second; returns true when they changed since the last call that returned true.
     * The settings are read when that happens.
     */
    public static boolean changed() {
        long now = System.nanoTime();
        if (lastStamp != -1 && now - lastCheck < 1_000_000_000L) return false;
        lastCheck = now;
        long stamp = 0;
        try {
            if (Files.exists(png())) stamp += Files.getLastModifiedTime(png()).toMillis();
            if (Files.exists(capePng())) stamp += Files.getLastModifiedTime(capePng()).toMillis() * 17;
            if (Files.exists(json())) stamp += Files.getLastModifiedTime(json()).toMillis() * 31;
        } catch (Exception ignored) {
        }
        if (stamp == lastStamp) return false;
        lastStamp = stamp;
        enabled = false;
        slim = false;
        cape = false;
        try {
            if (Files.exists(json())) {
                Json j = new Gson().fromJson(Files.readString(json(), StandardCharsets.UTF_8), Json.class);
                if (j != null) {
                    enabled = j.enabled && Files.exists(png());
                    slim = j.slim;
                    cape = j.cape && Files.exists(capePng());
                }
            }
        } catch (Exception e) {
            LumenHud.LOG.warn("Could not read lumen-skin.json", e);
        }
        return true;
    }
}
