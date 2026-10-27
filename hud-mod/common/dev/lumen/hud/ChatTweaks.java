package dev.lumen.hud;

import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

/** The rules behind the chat improvements: what to hide and what to put in front of a line. The game side only applies them. */
public final class ChatTweaks {
    private static final long REPEAT_MS = 8000;
    private static final DateTimeFormatter H24 = DateTimeFormatter.ofPattern("HH:mm", Locale.ROOT);
    private static final DateTimeFormatter H12 = DateTimeFormatter.ofPattern("h:mm a", Locale.ROOT);
    /** For the self-test: how many lines were stamped and hidden. */
    static int stamped;
    static int hidden;
    private static String last = "";
    private static long lastAt;

    private ChatTweaks() {}

    /** True when this line should not be shown: a word you muted, or the same line again within a few seconds. */
    public static boolean hide(String line) {
        HudConfig cfg = HudConfig.get();
        String plain = line == null ? "" : line.replaceFirst("^\\d{1,2}:\\d{2}( [AP]M)? ", "").trim();
        if (plain.isEmpty()) return false;
        String lower = plain.toLowerCase(Locale.ROOT);
        for (String word : cfg.chatMute.split(",")) {
            String w = word.trim().toLowerCase(Locale.ROOT);
            if (!w.isEmpty() && lower.contains(w)) {
                hidden++;
                return true;
            }
        }
        long now = System.currentTimeMillis();
        if (cfg.chatHideRepeats) {
            if (plain.equals(last) && now - lastAt < REPEAT_MS) {
                lastAt = now;
                hidden++;
                return true;
            }
        }
        last = plain;
        lastAt = now;
        return false;
    }

    public static String report() {
        return "stamped=" + stamped + " hidden=" + hidden;
    }

    /** The time to put in front of a line, or null when timestamps are off. */
    public static String stamp() {
        HudConfig cfg = HudConfig.get();
        if (!cfg.chatTimestamps) return null;
        stamped++;
        return LocalTime.now().format(cfg.clock24 ? H24 : H12) + " ";
    }
}
