package dev.lumen.hud;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Font;
import java.awt.FontMetrics;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import net.fabricmc.loader.api.FabricLoader;

import java.io.File;
import java.nio.file.Files;

/**
 * Draws the in-game menu into PNG files without Minecraft or any window (headless), and clicks through it.
 * Usage: MenuPreview <output folder> [width height]. Exits with an error when a click check fails.
 */
public final class MenuPreview {
    /** The menu's typeface at the size the game's font file asks for (assets/lumenhud/font/ui.json). */
    static final Font FONT = loadFont();

    static Font loadFont() {
        try {
            return Font.createFont(Font.TRUETYPE_FONT, new File(System.getProperty("lumen.font"))).deriveFont(Font.PLAIN, 9.5f);
        } catch (Exception e) {
            return new Font(Font.SANS_SERIF, Font.PLAIN, 9);
        }
    }

    /** A {@link Gfx} that draws on an image. */
    static final class ImageGfx implements Gfx {
        final BufferedImage img;
        final Graphics2D g;
        final FontMetrics fm;

        ImageGfx(BufferedImage img) {
            this.img = img;
            g = img.createGraphics();
            g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
            g.setRenderingHint(RenderingHints.KEY_FRACTIONALMETRICS, RenderingHints.VALUE_FRACTIONALMETRICS_ON);
            g.setFont(FONT);
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
            return (int) Math.ceil(FONT.getStringBounds(s, g.getFontRenderContext()).getWidth());
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

    /** A plain test skin: skin-coloured head with hair, a shirt, dark legs. {@code h} is 64, or 32 for the old layout. */
    static int[] sampleSkin(int shirt, int hair, int h) {
        int[] p = new int[64 * h];
        java.util.function.IntConsumer unused = i -> { };
        int[][] rects = {{0, 0, 32, 16, 0xFFC69C6D}, {8, 8, 16, 10, hair}, {0, 0, 32, 8, hair}, {16, 16, 40, 32, shirt}, {40, 16, 56, 32, 0xFFC69C6D}, {44, 16, 52, 24, shirt}, {0, 16, 16, 32, 0xFF2B2B5E}};
        for (int[] r : rects) for (int y = r[1]; y < Math.min(h, r[3]); y++) for (int x = r[0]; x < r[2]; x++) p[y * 64 + x] = r[4];
        if (h == 64) {
            for (int y = 48; y < 64; y++) for (int x = 16; x < 32; x++) p[y * 64 + x] = 0xFF2B2B5E;
            for (int y = 48; y < 64; y++) for (int x = 32; x < 48; x++) p[y * 64 + x] = y < 56 ? shirt : 0xFFC69C6D;
        }
        return p;
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
        // a small library to pick from
        String[] names = {"Pilot", "Rosalind", "Forest runner with a long name"};
        int[][] palette = {{0xFF3B82F6, 0xFF4B2E1A}, {0xFFEC4899, 0xFFE9C46A}, {0xFF10B981, 0xFF111827}};
        for (int i = 0; i < 3; i++) SkinLibrary.add(Png.encode(sampleSkin(palette[i][0], palette[i][1], 64), 64, 64), names[i]);
        SkinLibrary.setCape(Capes.make(0));
        m.show(2, null);
        save(draw(m, w, h, 0, 0), dir, "4-cosmetics", 3);
        m.turnFigure();
        save(draw(m, w, h, 0, 0), dir, "4b-cosmetics-back", 3);
        m.turnFigure();
        m.scrollTo(1000);
        save(draw(m, w, h, 0, 0), dir, "4c-cosmetics-capes", 3);
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

        // skins and capes, chosen in the menu
        LumenMenu s = new LumenMenu();
        s.show(2, null);
        draw(s, w, h, 0, 0);
        java.util.List<int[]> skinTiles = s.hitsOfSize(44, 44);
        check(skinTiles.size() == 2 + 3, "the page lists Default, Add and the three library skins");
        s.press(skinTiles.get(3)[0], skinTiles.get(3)[1], 0);
        check(SkinLibrary.active() != null && SkinLibrary.active().name.equals("Rosalind"), "a click on a skin tile puts that skin on");
        check(Files.exists(FabricLoader.getInstance().getConfigDir().resolve("lumen-skin.png")), "the skin is written into the instance config");
        check(Files.readString(FabricLoader.getInstance().getConfigDir().resolve("lumen-skin.json")).contains("\"enabled\":true"), "the config says the skin is enabled");
        draw(s, w, h, 0, 0);
        save(draw(s, w, h, 0, 0), dir, "9-skin-picked", 3);
        s.press(skinTiles.get(0)[0], skinTiles.get(0)[1], 0);
        check(SkinLibrary.active() == null, "the Default tile goes back to the standard skin");
        draw(s, w, h, 0, 0);
        java.util.List<int[]> capeTiles = s.hitsOfSize(44, 50);
        check(capeTiles.size() == 2 + Capes.NAMES.length, "the page lists None, Add and the cape presets");
        s.press(capeTiles.get(4)[0], capeTiles.get(4)[1], 0);
        check(java.util.Arrays.equals(SkinLibrary.cape(), Capes.make(2)), "a click on a cape preset sets that cape");
        draw(s, w, h, 0, 0);
        s.press(capeTiles.get(0)[0], capeTiles.get(0)[1], 0);
        check(SkinLibrary.cape() == null, "the None tile takes the cape off");

        // old 64x32 skins are brought to 64x64, and the picture codec round-trips
        int[] old = sampleSkin(0xFF3B82F6, 0xFF4B2E1A, 32);
        SkinLibrary.Entry upgraded = SkinLibrary.add(Png.encode(old, 64, 32), "Old");
        check(SkinLibrary.pixels(upgraded).length == 64 * 64 && (SkinLibrary.pixels(upgraded)[52 * 64 + 22] >>> 24) == 255, "an old 64x32 skin becomes a 64x64 one");
        int[] back = Png.decode(Png.encode(old, 64, 32)).argb;
        check(java.util.Arrays.equals(old, back), "PNG encode and decode agree");
        boolean refused = false;
        try {
            SkinLibrary.add(new byte[]{1, 2, 3}, "Broken");
        } catch (java.io.IOException e) {
            refused = true;
        }
        check(refused, "something that is not a PNG is refused");

        // leave the library the mod wrote, so the launcher's own code can be tested against it
        SkinLibrary.setCape(Capes.make(1));
        File lib = new File(dir, "library");
        lib.mkdirs();
        try (java.util.stream.Stream<java.nio.file.Path> files = Files.list(SkinLibrary.dir())) {
            for (java.nio.file.Path f : (Iterable<java.nio.file.Path>) files::iterator) Files.copy(f, lib.toPath().resolve(f.getFileName().toString()), java.nio.file.StandardCopyOption.REPLACE_EXISTING);
        }
        System.out.println("done");
    }
}
