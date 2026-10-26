package dev.lumen.hud;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Font;
import java.awt.FontMetrics;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.File;

/**
 * Draws the in-game menu into PNG files without Minecraft or any window (headless), and clicks through it.
 * Usage: MenuPreview <output folder> [width height]. Exits with an error when a click check fails.
 */
public final class MenuPreview {
    /** A {@link Gfx} that draws on an image. The pixel font is approximated by a monospaced one of similar width. */
    static final class ImageGfx implements Gfx {
        final BufferedImage img;
        final Graphics2D g;
        final FontMetrics fm;

        ImageGfx(BufferedImage img) {
            this.img = img;
            g = img.createGraphics();
            g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_OFF);
            g.setFont(new Font(Font.MONOSPACED, Font.PLAIN, 10));
            fm = g.getFontMetrics();
        }

        @Override
        public void fill(int x1, int y1, int x2, int y2, int argb) {
            g.setColor(new Color(argb, true));
            g.fillRect(x1, y1, x2 - x1, y2 - y1);
        }

        @Override
        public void text(String s, int x, int y, int argb, boolean shadow) {
            if (shadow) {
                g.setColor(new Color(0xCC000000, true));
                g.drawString(s, x + 1, y + 8);
            }
            g.setColor(new Color(argb, true));
            g.drawString(s, x, y + 7);
        }

        @Override
        public int width(String s) {
            return fm.stringWidth(s);
        }

        @Override
        public void clip(int x1, int y1, int x2, int y2) {
            g.setClip(x1, y1, x2 - x1, y2 - y1);
        }

        @Override
        public void unclip() {
            g.setClip(null);
        }
    }

    static BufferedImage scene(int w, int h) {
        BufferedImage img = new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = img.createGraphics();
        g.setColor(new Color(0x8CC4F5));
        g.fillRect(0, 0, w, h);
        g.setColor(new Color(0x5A9A3C));
        g.fillRect(0, h * 64 / 100, w, h);
        g.setColor(new Color(0xFFFFFF));
        g.fillRect(w / 2 - 4, h / 2 - 1, 9, 1);
        g.fillRect(w / 2, h / 2 - 5, 1, 9);
        g.dispose();
        return img;
    }

    static void save(BufferedImage img, File dir, String name, int zoom) throws Exception {
        BufferedImage big = new BufferedImage(img.getWidth() * zoom, img.getHeight() * zoom, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = big.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_NEAREST_NEIGHBOR);
        g.drawImage(img, 0, 0, big.getWidth(), big.getHeight(), null);
        g.dispose();
        ImageIO.write(big, "png", new File(dir, name + ".png"));
    }

    static BufferedImage draw(LumenMenu menu, int w, int h, int mx, int my) {
        BufferedImage img = scene(w, h);
        ImageGfx g = new ImageGfx(img);
        Skin.backdrop(g, w, h, false);
        menu.render(g, w, h, mx, my);
        return img;
    }

    static void check(boolean ok, String what) {
        if (!ok) {
            System.err.println("FAILED: " + what);
            System.exit(1);
        }
        System.out.println("ok: " + what);
    }

    public static void main(String[] args) throws Exception {
        File dir = new File(args[0]);
        dir.mkdirs();
        int w = args.length > 2 ? Integer.parseInt(args[1]) : 427;
        int h = args.length > 2 ? Integer.parseInt(args[2]) : 240;
        HudConfig cfg = HudConfig.get();
        for (String id : HudConfig.IDS) cfg.el(id);

        LumenMenu m = new LumenMenu();
        save(draw(m, w, h, 0, 0), dir, "1-modules", 3);
        m.show(0, "Zoom");
        save(draw(m, w, h, 0, 0), dir, "2-module-zoom", 3);
        m.show(1, null);
        save(draw(m, w, h, 0, 0), dir, "3-style", 3);
        m.show(2, null);
        save(draw(m, w, h, 0, 0), dir, "4-cosmetics", 3);
        m.show(3, null);
        save(draw(m, w, h, 0, 0), dir, "5-settings", 3);
        cfg.menuSkin = "light";
        m.show(0, null);
        save(draw(m, w, h, 0, 0), dir, "6-light", 3);
        cfg.menuSkin = "ocean";
        cfg.menuBackground = "gradient";
        save(draw(m, w, h, 0, 0), dir, "7-ocean-gradient", 3);
        cfg.menuSkin = "midnight";
        cfg.menuBackground = "dim";
        save(draw(m, 320, 180, 0, 0), dir, "8-small-window", 4);

        // clicking: the way a player uses it
        LumenMenu c = new LumenMenu();
        draw(c, w, h, 0, 0);
        int[] first = c.firstCardToggle();
        boolean before = HudConfig.get().el("fps").enabled;
        check(c.press(first[0], first[1], 0), "a click inside the menu is handled");
        check(HudConfig.get().el("fps").enabled != before, "the switch on the first card flips the module");
        draw(c, w, h, 0, 0);
        int[] body = c.firstCardBody();
        c.press(body[0], body[1], 0);
        draw(c, w, h, 0, 0);
        check(c.pageName().equals("Modules") && c.inDetail(), "a click on a card opens that module");
        int[] dock = c.dockSlot(1);
        c.press(dock[0], dock[1], 0);
        draw(c, w, h, 0, 0);
        check(c.pageName().equals("Style") && !c.inDetail(), "the dock switches the page");
        check(!c.press(2, 2, 0), "a click outside the menu is not taken");
        System.out.println("done");
    }
}
