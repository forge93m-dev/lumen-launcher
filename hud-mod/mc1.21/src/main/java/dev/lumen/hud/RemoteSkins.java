package dev.lumen.hud;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.texture.NativeImage;
import net.minecraft.util.Identifier;

import java.io.ByteArrayInputStream;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/** Textures of other Lumen players' skins and capes, made on the render thread when their pictures have arrived. */
public final class RemoteSkins {
    public record Look(Identifier skin, Identifier cape, boolean slim) {}

    private static final class Slot {
        long rev = -2;
        Identifier skin;
        Identifier cape;
        boolean slim;
    }

    private static final Map<String, Slot> SLOTS = new HashMap<>();

    private RemoteSkins() {}

    /** How to draw the player with this nickname, or null for the normal look. */
    public static Look of(String name) {
        if (!MinecraftClient.getInstance().isOnThread()) return null; // textures can only be made on the render thread
        CloudSkins.Entry e = CloudSkins.of(name);
        if (e == null) return null;
        String key = name.toLowerCase(Locale.ROOT);
        Slot s = SLOTS.computeIfAbsent(key, k -> new Slot());
        if (s.rev != e.rev) {
            release(s);
            s.rev = e.rev;
            s.slim = e.slim;
            byte[] skin = e.skin;
            byte[] cape = e.cape;
            if (skin != null) s.skin = make("remote/" + key + "_skin_" + e.rev, skin, 64, 64);
            if (cape != null) s.cape = make("remote/" + key + "_cape_" + e.rev, cape, 64, 32);
        }
        return s.skin == null && s.cape == null ? null : new Look(s.skin, s.cape, s.slim);
    }

    private static void release(Slot s) {
        if (s.skin != null) SkinTexture.release(s.skin);
        if (s.cape != null) SkinTexture.release(s.cape);
        s.skin = null;
        s.cape = null;
    }

    private static Identifier make(String path, byte[] png, int w, int h) {
        try {
            NativeImage img = NativeImage.read(new ByteArrayInputStream(png));
            if (img.getWidth() != w || img.getHeight() != h) {
                img.close();
                return null;
            }
            Identifier id = Identifier.of("lumenhud", path);
            SkinTexture.register(id, img);
            return id;
        } catch (Exception ex) {
            LumenHud.LOG.warn("Could not use a picture from the Lumen skin service", ex);
            return null;
        }
    }
}
