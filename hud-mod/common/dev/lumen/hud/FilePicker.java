package dev.lumen.hud;

import java.lang.reflect.Method;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * The system's "open file" window, for choosing a skin or cape picture. It uses the tiny file dialog that Minecraft
 * already ships with LWJGL (found by name, so nothing here depends on it), on its own thread because it waits for the player.
 */
public final class FilePicker {
    public enum Purpose { SKIN, CAPE }

    public record Result(Purpose purpose, Path file, String error) {}

    private static volatile boolean busy;
    private static volatile Result done;

    private FilePicker() {}

    public static boolean busy() {
        return busy;
    }

    /** The finished choice, once, or null while there is none. */
    public static Result take() {
        Result r = done;
        done = null;
        return r;
    }

    public static void open(Purpose purpose) {
        if (busy) return;
        busy = true;
        Thread t = new Thread(() -> {
            try {
                String home = System.getProperty("user.home", "");
                Path downloads = Path.of(home, "Downloads");
                String start = (Files.isDirectory(downloads) ? downloads.toString() : home) + java.io.File.separator;
                String title = purpose == Purpose.SKIN ? "Choose a skin picture (PNG)" : "Choose a cape picture (PNG)";
                String picked = ask(title, start);
                done = picked == null ? null : new Result(purpose, Path.of(picked), null);
            } catch (Throwable e) {
                LumenHud.LOG.warn("Could not open the file window", e);
                done = new Result(purpose, null, "The file window is not available here");
            } finally {
                busy = false;
            }
        }, "Lumen file picker");
        t.setDaemon(true);
        t.start();
    }

    private static String ask(String title, String start) throws Exception {
        Class<?> c = Class.forName("org.lwjgl.util.tinyfd.TinyFileDialogs");
        Class<?> pointers = Class.forName("org.lwjgl.PointerBuffer");
        Method m = c.getMethod("tinyfd_openFileDialog", CharSequence.class, CharSequence.class, pointers, CharSequence.class, boolean.class);
        Object r = m.invoke(null, title, start, null, "PNG pictures", false);
        return r == null ? null : r.toString();
    }
}
