package dev.lumen.hud;

import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.input.MouseButtonEvent;
import net.minecraft.network.chat.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** Drag elements to move, scroll to resize, right-click to hide/show. Esc saves. */
public class EditScreen extends Screen {
    private static final String[] NAMES = {"FPS", "CPS", "Coordinates", "Keystrokes", "Armor", "Ping", "Speed", "Clock", "Effects", "Reach", "Combo"};
    private String dragging;
    private double offX;
    private double offY;

    public EditScreen() {
        super(Component.literal("Lumen HUD"));
    }

    @Override
    public void extractBackground(GuiGraphicsExtractor g, int mouseX, int mouseY, float a) {
        g.fill(0, 0, width, height, 0x88000000);
    }

    @Override
    public void extractRenderState(GuiGraphicsExtractor g, int mouseX, int mouseY, float a) {
        super.extractRenderState(g, mouseX, mouseY, a);
        int accent = HudConfig.get().accent();
        g.fill(width / 2, 0, width / 2 + 1, height, 0x22FFFFFF);
        g.fill(0, height / 2, width, height / 2 + 1, 0x22FFFFFF);

        HudRenderer.render(g, true);
        String hover = hovered(mouseX, mouseY);
        for (Map.Entry<String, HudRenderer.Rect> e : HudRenderer.RECTS.entrySet()) {
            HudRenderer.Rect r = e.getValue();
            boolean on = HudConfig.get().el(e.getKey()).enabled;
            if (!on) g.fill(r.x(), r.y(), r.x() + r.w(), r.y() + r.h(), 0xAA200000);
            int color = !on ? 0xFFAA3333 : e.getKey().equals(dragging) || e.getKey().equals(hover) ? accent : 0x88FFFFFF;
            outline(g, r, color);
            if (e.getKey().equals(hover) || e.getKey().equals(dragging)) {
                String name = name(e.getKey()) + (on ? "" : " (hidden)") + "  " + Math.round(HudConfig.get().el(e.getKey()).scale * 100) + "%";
                int ty = r.y() > 12 ? r.y() - 11 : r.y() + r.h() + 3;
                g.text(font, name, r.x(), ty, 0xFFFFFFFF, true);
            }
        }
        g.centeredText(font, "Lumen HUD Editor", width / 2, height / 2 - 30, accent);
        g.centeredText(font, "Drag to move · Scroll to resize · Right-click to hide · Esc to save", width / 2, height / 2 - 18, 0xFFCCCCCC);
    }

    private static void outline(GuiGraphicsExtractor g, HudRenderer.Rect r, int c) {
        g.fill(r.x() - 1, r.y() - 1, r.x() + r.w() + 1, r.y(), c);
        g.fill(r.x() - 1, r.y() + r.h(), r.x() + r.w() + 1, r.y() + r.h() + 1, c);
        g.fill(r.x() - 1, r.y(), r.x(), r.y() + r.h(), c);
        g.fill(r.x() + r.w(), r.y(), r.x() + r.w() + 1, r.y() + r.h(), c);
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

    @Override
    public boolean mouseClicked(MouseButtonEvent event, boolean doubleClick) {
        String id = hovered(event.x(), event.y());
        if (id == null) return super.mouseClicked(event, doubleClick);
        if (event.button() == 1) {
            HudConfig.Element el = HudConfig.get().el(id);
            el.enabled = !el.enabled;
        } else if (event.button() == 0) {
            HudRenderer.Rect r = HudRenderer.RECTS.get(id);
            dragging = id;
            offX = event.x() - r.x();
            offY = event.y() - r.y();
        }
        return true;
    }

    @Override
    public boolean mouseDragged(MouseButtonEvent event, double dx, double dy) {
        if (dragging == null) return super.mouseDragged(event, dx, dy);
        HudRenderer.Rect r = HudRenderer.RECTS.get(dragging);
        HudConfig.Element el = HudConfig.get().el(dragging);
        double[] h = anchor(event.x() - offX, width, r.w());
        double[] v = anchor(event.y() - offY, height, r.h());
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

    @Override
    public boolean mouseReleased(MouseButtonEvent event) {
        dragging = null;
        return super.mouseReleased(event);
    }

    @Override
    public boolean mouseScrolled(double mx, double my, double scrollX, double scrollY) {
        String id = hovered(mx, my);
        if (id == null) return false;
        HudConfig.Element el = HudConfig.get().el(id);
        el.scale = Math.round(HudRenderer.clamp(el.scale + Math.signum(scrollY) * 0.1, 0.5, 3) * 10) / 10.0;
        return true;
    }

    @Override
    public void onClose() {
        HudConfig.save();
        super.onClose();
    }

    @Override
    public boolean isPauseScreen() {
        return false;
    }
}
