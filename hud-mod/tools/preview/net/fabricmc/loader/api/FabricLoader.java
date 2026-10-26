package net.fabricmc.loader.api;

import java.nio.file.Path;

/** Stand-in for Fabric Loader, so the shared code that reads config files runs outside Minecraft (preview and tests). */
public class FabricLoader {
    private static final FabricLoader INSTANCE = new FabricLoader();

    public static FabricLoader getInstance() {
        return INSTANCE;
    }

    public Path getConfigDir() {
        return Path.of(System.getProperty("java.io.tmpdir"), "lumen-preview-config");
    }
}
