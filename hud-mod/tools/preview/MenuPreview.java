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
        final Graphics2D raw;
        final FontMetrics fm;

        ImageGfx(BufferedImage img) {
            this.img = img;
            raw = img.createGraphics();
            g = img.createGraphics();
            g.scale(S, S);
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
        public int scale() {
            return S;
        }

        @Override
        public void pixels(int[] argb, int w, int h, int x, int y) {
            for (int j = 0; j < h; j++) {
                for (int i = 0; i < w; i++) {
                    if ((argb[j * w + i] >>> 24) == 0) continue;
                    int px = x * S + i, py = y * S + j;
                    if (px < 0 || py < 0 || px >= img.getWidth() || py >= img.getHeight()) continue;
                    java.awt.Shape clip = g.getClip();
                    if (clip != null && !clip.contains((px + 0.5) / S, (py + 0.5) / S)) continue;
                    raw.setColor(new Color(argb[j * w + i], true));
                    raw.fillRect(px, py, 1, 1);
                }
            }
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

    /** Screen pixels per drawing unit, like the game at GUI scale 3. */
    static final int S = 3;

    static BufferedImage scene(int w, int h) {
        BufferedImage img = new BufferedImage(w * S, h * S, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = img.createGraphics();
        g.scale(S, S);
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
        zoom = Math.max(1, zoom / S); // the pictures are already drawn at screen resolution
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

    static String diff(BufferedImage x, BufferedImage y) {
        int n = 0, fx = -1, fy = -1;
        for (int j = 0; j < x.getHeight(); j++) for (int i = 0; i < x.getWidth(); i++) if (x.getRGB(i, j) != y.getRGB(i, j) && n++ == 0) { fx = i; fy = j; }
        return n + " pixels differ, first at " + fx + "," + fy;
    }

    static boolean sameImage(BufferedImage x, BufferedImage y) {
        return java.util.Arrays.equals(x.getRGB(0, 0, x.getWidth(), x.getHeight(), null, 0, x.getWidth()), y.getRGB(0, 0, y.getWidth(), y.getHeight(), null, 0, y.getWidth()));
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
        Motion.frozen = true; // finished frames for the pictures; the motion checks further down switch it off
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
        String wornBefore = SkinLibrary.active() == null ? null : SkinLibrary.active().id;
        s.press(skinTiles.get(3)[0], skinTiles.get(3)[1], 0);
        check((SkinLibrary.active() == null ? null : SkinLibrary.active().id) == wornBefore || java.util.Objects.equals(wornBefore, SkinLibrary.active() == null ? null : SkinLibrary.active().id), "a click on a skin tile only previews it");
        draw(s, w, h, 0, 0);
        save(draw(s, w, h, 0, 0), dir, "9a-skin-previewed", 3);
        s.equip();
        check(SkinLibrary.active() != null && SkinLibrary.active().name.equals("Rosalind"), "a click on a skin tile puts that skin on");
        check(Files.exists(FabricLoader.getInstance().getConfigDir().resolve("lumen-skin.png")), "the skin is written into the instance config");
        check(Files.readString(FabricLoader.getInstance().getConfigDir().resolve("lumen-skin.json")).contains("\"enabled\":true"), "the config says the skin is enabled");
        draw(s, w, h, 0, 0);
        save(draw(s, w, h, 0, 0), dir, "9-skin-picked", 3);
        s.press(skinTiles.get(0)[0], skinTiles.get(0)[1], 0);
        s.equip();
        check(SkinLibrary.active() == null, "the Default tile goes back to the standard skin");
        draw(s, w, h, 0, 0);
        s.scrollTo(1000); // the capes are further down the page now
        draw(s, w, h, 0, 0);
        java.util.List<int[]> capeTiles = s.hitsOfSize(44, 50);
        check(capeTiles.size() == 2 + Capes.NAMES.length, "the page lists None, Add and the cape presets");
        s.press(capeTiles.get(4)[0], capeTiles.get(4)[1], 0);
        s.equip();
        check(java.util.Arrays.equals(SkinLibrary.cape(), Capes.make(2)), "a click on a cape preset sets that cape");
        draw(s, w, h, 0, 0);
        s.press(capeTiles.get(0)[0], capeTiles.get(0)[1], 0);
        s.equip();
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

        // motion: with a clock the test controls, the menu fades in, the page change fades, and a switch slides
        Motion.frozen = false;
        long[] now = {1000};
        Motion.clock = () -> now[0];
        LumenMenu settled = new LumenMenu();
        Motion.frozen = true;
        BufferedImage finished = draw(settled, w, h, 0, 0);
        Motion.frozen = false;
        LumenMenu a = new LumenMenu();
        BufferedImage opening = draw(a, w, h, 0, 0);
        BufferedImage frame = opening;
        for (int i = 0; i < 12; i++) {
            now[0] += 50;
            frame = draw(a, w, h, 0, 0);
        }
        check(!sameImage(opening, frame), "the menu starts transparent and fades in");
        check(sameImage(finished, frame), "after the fade the menu looks exactly like a finished frame " + diff(finished, frame));
        int[] knob = a.firstCardToggle();
        BufferedImage atRest = frame;
        a.press(knob[0], knob[1], 0);
        now[0] += 50;
        BufferedImage midway = draw(a, w, h, 0, 0);
        for (int i = 0; i < 12; i++) {
            now[0] += 50;
            frame = draw(a, w, h, 0, 0);
        }
        check(!sameImage(atRest, midway) && !sameImage(midway, frame), "a switch slides: its first frame differs from both ends");
        int[] dock2 = a.dockSlot(1);
        a.press(dock2[0], dock2[1], 0);
        now[0] += 50;
        BufferedImage turning = draw(a, w, h, 0, 0);
        for (int i = 0; i < 12; i++) {
            now[0] += 50;
            frame = draw(a, w, h, 0, 0);
        }
        check(!sameImage(turning, frame), "a new page fades in");
        LumenMenu hovered = new LumenMenu();
        BufferedImage away = draw(hovered, w, h, 2, 2);
        int[] cardAt = hovered.firstCardBody();
        BufferedImage early = draw(hovered, w, h, cardAt[0], cardAt[1]);
        for (int i = 0; i < 24; i++) {
            now[0] += 50;
            early = i == 0 ? draw(hovered, w, h, cardAt[0], cardAt[1]) : early;
            frame = draw(hovered, w, h, cardAt[0], cardAt[1]);
        }
        check(!sameImage(away, frame) && !sameImage(early, frame), "resting on a module card shows what it does");
        save(frame, dir, "10-tooltip", 3);
        Motion.frozen = true;
        Motion.clock = System::currentTimeMillis;

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
