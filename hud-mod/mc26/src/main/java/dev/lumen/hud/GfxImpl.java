package dev.lumen.hud;

import com.mojang.blaze3d.platform.NativeImage;
import net.minecraft.client.Minecraft;
import net.minecraft.client.renderer.RenderPipelines;
import net.minecraft.client.renderer.texture.DynamicTexture;
import net.minecraft.resources.Identifier;
import net.minecraft.client.gui.Font;
import net.minecraft.client.gui.GuiGraphicsExtractor;

/** {@link Gfx} on top of the 26.x GuiGraphicsExtractor. */
final class GfxImpl implements Gfx {
    private final GuiGraphicsExtractor g;
    private final Font font;

    GfxImpl(GuiGraphicsExtractor g, Font font) {
        this.g = g;
        this.font = font;
    }

    @Override
    public void fill(int x1, int y1, int x2, int y2, int argb) {
        g.fill(x1, y1, x2, y2, argb);
    }

    @Override
    public void text(String s, int x, int y, int argb, boolean shadow) {
        g.text(font, UiFont.of(s), x, y, argb, shadow);
    }

    @Override
    public boolean player(int x1, int y1, int x2, int y2, double turn, boolean preview, int[] skin, boolean slim, int[] cape) {
        net.minecraft.client.player.LocalPlayer p = Minecraft.getInstance().player;
        if (p == null) return false;
        // an independent render state: nothing about the real player is turned, equipped or changed
        net.minecraft.world.entity.player.PlayerSkin look = SkinImage.look(p, preview, skin, slim, cape);
        net.minecraft.client.renderer.entity.state.AvatarRenderState state = new net.minecraft.client.renderer.entity.state.AvatarRenderState();
        state.entityType = p.getType(); // EntityType.PLAYER is called EntityTypes.PLAYER in later versions
        state.skin = look;
        state.boundingBoxWidth = 0.6f;
        state.boundingBoxHeight = 1.8f;
        state.eyeHeight = 1.62f;
        state.scale = state.ageScale = 1;
        state.pose = net.minecraft.world.entity.Pose.STANDING;
        state.bodyRot = 180;
        state.showHat = state.showJacket = state.showLeftPants = state.showRightPants = state.showLeftSleeve = state.showRightSleeve = true;
        state.showCape = look.cape() != null;
        state.capeFlap = 6;
        state.lightCoords = 0xF000F0;
        float scale = Math.min((y2 - y1) / 2.15f, (x2 - x1) / 1.25f);
        g.entity(state, scale, new org.joml.Vector3f(0, 0.9f, 0), new org.joml.Quaternionf().rotateZ((float) Math.PI).rotateY((float) turn),
                new org.joml.Quaternionf().rotateX((float) Math.toRadians(-5)), x1, y1, x2, y2);
        return true;
    }

    @Override
    public int texture(String key, java.util.function.Supplier<int[]> argb, int w, int h) {
        int known = UiTextures.lookup(key);
        if (known != UiTextures.UNKNOWN) return known;
        try {
            Identifier id = Identifier.fromNamespaceAndPath("lumenhud", UiTextures.path(UiTextures.count()));
            NativeImage img = NativeImage.read(new java.io.ByteArrayInputStream(Png.encode(argb.get(), w, h)));
            Minecraft.getInstance().getTextureManager().register(id, new DynamicTexture(() -> "lumenhud ui", img));
            return UiTextures.add(key, w, h);
        } catch (Exception e) {
            LumenHud.LOG.warn("Could not upload {}", key, e);
            UiTextures.failed(key);
            return -1;
        }
    }

    private static int nextHandle() {
        return UiTextures.count();
    }

    private static final java.util.Map<Integer, DynamicTexture> LIVE = new java.util.HashMap<>();

    @Override
    public int dynamicTexture(String key, int w, int h) {
        int known = UiTextures.lookup(key);
        if (known != UiTextures.UNKNOWN) return known;
        try {
            int handle = UiTextures.count();
            DynamicTexture tex = new DynamicTexture(() -> "lumenhud live", w, h, false);
            Minecraft.getInstance().getTextureManager().register(Identifier.fromNamespaceAndPath("lumenhud", UiTextures.path(handle)), tex);
            LIVE.put(handle, tex);
            return UiTextures.add(key, w, h);
        } catch (Exception e) {
            LumenHud.LOG.warn("Could not make the live texture {}", key, e);
            UiTextures.failed(key);
            return -1;
        }
    }

    @Override
    public void updateTexture(int handle, int[] argb) {
        DynamicTexture tex = LIVE.get(handle);
        if (tex == null) return;
        NativeImage img = tex.getPixels();
        int w = img.getWidth();
        for (int i = 0; i < argb.length; i++) img.setPixel(i % w, i / w, argb[i]);
        tex.upload();
    }

    @Override
    public void blit(int handle, int x, int y, int w, int h, int tint) {
        int[] size = UiTextures.size(handle);
        g.blit(RenderPipelines.GUI_TEXTURED, Identifier.fromNamespaceAndPath("lumenhud", UiTextures.path(handle)), x, y, 0f, 0f, w, h, size[0], size[1], size[0], size[1], tint);
    }

    @Override
    public int scale() {
        return Math.max(1, (int) Math.round(Minecraft.getInstance().getWindow().getGuiScale()));
    }

    @Override
    public void pixels(int[] argb, int w, int h, int x, int y) {
        int s = scale();
        org.joml.Matrix3x2fStack m = g.pose();
        m.pushMatrix();
        m.scale(1f / s, 1f / s);
        Smooth.emit(argb, w, h, x * s, y * s, (x1, y1, x2, y2, c) -> g.fill(x1, y1, x2, y2, c));
        m.popMatrix();
    }

    @Override
    public int width(String s) {
        return font.width(UiFont.of(s));
    }

    @Override
    public void clip(int x1, int y1, int x2, int y2) {
        g.enableScissor(x1, y1, x2, y2);
    }

    @Override
    public void unclip() {
        g.disableScissor();
    }
}
