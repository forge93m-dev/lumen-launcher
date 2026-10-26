package dev.lumen.hud;

/** Look around without turning: while active, mouse movement turns the camera and leaves the player alone. */
public final class Freelook {
    private static boolean active;
    private static float yaw;
    private static float pitch;

    private Freelook() {}

    public static boolean active() {
        return active;
    }

    public static void begin(float playerYaw, float playerPitch) {
        active = true;
        yaw = playerYaw;
        pitch = playerPitch;
    }

    public static void end() {
        active = false;
    }

    /** Mouse movement in the units the game passes to Entity.turn. */
    public static void look(double dx, double dy) {
        yaw += (float) dx * 0.15f;
        pitch = Math.max(-90f, Math.min(90f, pitch + (float) dy * 0.15f));
    }

    public static float yaw() {
        return yaw;
    }

    public static float pitch() {
        return pitch;
    }
}
