package dev.lumen.hud;

import java.util.ArrayDeque;
import java.util.Deque;

/** Counts mouse clicks within the last second. */
public final class ClickTracker {
    private static final Deque<Long> LEFT = new ArrayDeque<>();
    private static final Deque<Long> RIGHT = new ArrayDeque<>();

    private ClickTracker() {}

    /** The button numbers differ per Minecraft version (GLFW: 0/1, SDL in 26.x: 1/3), so the caller says which is which. */
    public static synchronized void click(int button, int leftButton, int rightButton) {
        if (button == leftButton) LEFT.addLast(System.currentTimeMillis());
        else if (button == rightButton) RIGHT.addLast(System.currentTimeMillis());
    }

    private static int count(Deque<Long> q) {
        long cutoff = System.currentTimeMillis() - 1000;
        while (!q.isEmpty() && q.peekFirst() < cutoff) q.removeFirst();
        return q.size();
    }

    public static synchronized int left() {
        return count(LEFT);
    }

    public static synchronized int right() {
        return count(RIGHT);
    }
}
