package dev.lumen.hud;

/** Press the sneak key once to start sneaking, press again to stop. */
public final class ToggleSneak {
    private static boolean wasDown;
    private static boolean sneaking;

    private ToggleSneak() {}

    /**
     * @param physicalDown whether the player is holding the sneak key right now
     * @return true while sneaking should be kept on
     */
    public static boolean update(boolean physicalDown) {
        if (physicalDown && !wasDown) sneaking = !sneaking;
        wasDown = physicalDown;
        return sneaking;
    }

    public static boolean sneaking() {
        return sneaking;
    }

    public static void reset() {
        sneaking = false;
        wasDown = false;
    }
}
