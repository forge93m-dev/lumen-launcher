package dev.lumen.hud;

import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.text.Text;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Drag elements to move, scroll to resize, right-click to hide/show. Esc saves.
 * The mouse callbacks have different signatures across Minecraft versions, so they live in EditScreen (one per
 * generation, in compat/); this class only has the logic they call.
 */
public abstract class EditScreenBase extends Screen {
    private static final String[] NAMES = HudConfig.NAMES;
    private String dragging;
    private double offX;
    private double offY;

    private final LumenMenu menu = new LumenMenu();
    /** false: the module menu; true: dragging elements around. */
    private boolean layout;

    protected EditScreenBase(boolean layout) {
        super(Text.literal("Lumen"));
        this.layout = layout;
    }

    @Override
    public void renderBackground(DrawContext ctx, int mouseX, int mouseY, float delta) {
        ctx.fill(0, 0, width, height, 0x88000000);
    }

    @Override
    public void render(DrawContext ctx, int mouseX, int mouseY, float delta) {
        super.render(ctx, mouseX, mouseY, delta);
        int accent = HudConfig.get().accent();
        if (!layout) {
            menu.render(new GfxImpl(ctx, textRenderer), width, height, mouseX, mouseY);
            if (menu.wantsLayout) {
                menu.wantsLayout = false;
                layout = true;
            }
            return;
        }
        backButton(ctx, mouseX, mouseY, accent);
        // centre guides
        ctx.fill(width / 2, 0, width / 2 + 1, height, 0x22FFFFFF);
        ctx.fill(0, height / 2, width, height / 2 + 1, 0x22FFFFFF);

        HudRenderer.render(ctx, true);
        String hover = hovered(mouseX, mouseY);
        for (Map.Entry<String, HudRenderer.Rect> e : HudRenderer.RECTS.entrySet()) {
            HudRenderer.Rect r = e.getValue();
            boolean on = HudConfig.get().el(e.getKey()).enabled;
            if (!on) ctx.fill(r.x(), r.y(), r.x() + r.w(), r.y() + r.h(), 0xAA200000);
            int color = !on ? 0xFFAA3333 : e.getKey().equals(dragging) || e.getKey().equals(hover) ? accent : 0x88FFFFFF;
            outline(ctx, r, color);
            if (e.getKey().equals(hover) || e.getKey().equals(dragging)) {
                String name = name(e.getKey()) + (on ? "" : " (hidden)") + "  " + Math.round(HudConfig.get().el(e.getKey()).scale * 100) + "%";
                int ty = r.y() > 12 ? r.y() - 11 : r.y() + r.h() + 3;
                ctx.drawTextWithShadow(textRenderer, name, r.x(), ty, 0xFFFFFFFF);
            }
        }
        ctx.drawCenteredTextWithShadow(textRenderer, Text.literal("Lumen HUD Editor"), width / 2, height / 2 - 30, accent);
        ctx.drawCenteredTextWithShadow(textRenderer, Text.literal("Drag to move · Scroll to resize · Right-click to hide · Esc to save"), width / 2, height / 2 - 18, 0xFFCCCCCC);
    }

    private int backX() {
        return width / 2 - 46;
    }

    private void backButton(DrawContext ctx, int mx, int my, int accent) {
        boolean hot = mx >= backX() && mx < backX() + 92 && my >= 6 && my < 22;
        Look.round(new GfxImpl(ctx, textRenderer), backX(), 6, 92, 16, 4, hot ? accent : Look.withAlpha(accent, 0x90));
        ctx.drawCenteredTextWithShadow(textRenderer, Text.literal("Back to menu"), width / 2, 10, 0xFFFFFFFF);
    }

    private static void outline(DrawContext ctx, HudRenderer.Rect r, int c) {
        ctx.fill(r.x() - 1, r.y() - 1, r.x() + r.w() + 1, r.y(), c);
        ctx.fill(r.x() - 1, r.y() + r.h(), r.x() + r.w() + 1, r.y() + r.h() + 1, c);
        ctx.fill(r.x() - 1, r.y(), r.x(), r.y() + r.h(), c);
        ctx.fill(r.x() + r.w(), r.y(), r.x() + r.w() + 1, r.y() + r.h(), c);
    }

    private static String name(String id) {
        for (int i = 0; i < HudConfig.IDS.length; i++) if (HudConfig.IDS[i].equals(id)) return NAMES[i];
        return id;
    }

    private String hovered(double mx, double my) {
        List<String> ids = new ArrayList<>(HudRenderer.RECTS.keySet());
        for (int i = ids.size() - 1; i >= 0; i--) {
            if (HudRenderer.RECTS.get(ids.get(i)).contains(mx, my)) return ids.get(i);
        }
        return null;
    }

    /** Returns true when the click was on an element (and handled). */
    protected boolean press(double mx, double my, int button) {
        if (!layout) return menu.press(mx, my, button);
        if (button == 0 && mx >= backX() && mx < backX() + 92 && my >= 6 && my < 22) {
            layout = false;
            return true;
        }
        String id = hovered(mx, my);
        if (id == null) return false;
        if (button == 1) {
            HudConfig.Element el = HudConfig.get().el(id);
            el.enabled = !el.enabled;
        } else if (button == 0) {
            HudRenderer.Rect r = HudRenderer.RECTS.get(id);
            dragging = id;
            offX = mx - r.x();
            offY = my - r.y();
        }
        return true;
    }

    protected boolean drag(double mx, double my) {
        if (!layout) return menu.drag(mx, my);
        if (dragging == null) return false;
        HudRenderer.Rect r = HudRenderer.RECTS.get(dragging);
        HudConfig.Element el = HudConfig.get().el(dragging);
        double[] h = anchor(mx - offX, width, r.w());
        double[] v = anchor(my - offY, height, r.h());
        el.ax = h[0];
        el.x = h[1];
        el.ay = v[0];
        el.y = v[1];
        return true;
    }

    /** Picks the nearest edge (or centre) as anchor so layouts survive resolution and GUI scale changes. */
    private static double[] anchor(double pos, int screen, int size) {
        pos = HudRenderer.clamp(pos, 0, Math.max(0, screen - size));
        double centre = pos + size / 2.0;
        double free = screen - size;
        if (Math.abs(centre - screen / 2.0) < 4) return new double[]{0.5, 0}; // snap to centre
        if (centre < screen / 3.0) return new double[]{0, Math.round(pos)};
        if (centre > screen * 2 / 3.0) return new double[]{1, Math.round(free - pos)};
        return new double[]{0.5, Math.round(pos - free / 2)};
    }

    protected void release() {
        menu.release();
        dragging = null;
    }

    protected boolean scroll(double mx, double my, double vertical) {
        if (!layout) return menu.scroll(mx, my, vertical);
        String id = hovered(mx, my);
        if (id == null) return false;
        HudConfig.Element el = HudConfig.get().el(id);
        el.scale = Math.round(HudRenderer.clamp(el.scale + Math.signum(vertical) * 0.1, 0.5, 3) * 10) / 10.0;
        return true;
    }

    @Override
    public void close() {
        HudConfig.save();
        super.close();
    }

    @Override
    public boolean shouldPause() {
        return false;
    }
}
