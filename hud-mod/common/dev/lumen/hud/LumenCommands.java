package dev.lumen.hud;

import com.mojang.brigadier.arguments.StringArgumentType;
import com.mojang.brigadier.builder.LiteralArgumentBuilder;
import com.mojang.brigadier.builder.RequiredArgumentBuilder;

import java.util.List;

/**
 * The /lumen command: waypoints and the last death place. Built on plain Brigadier so one copy serves every
 * Minecraft version; {@link Host} gives it the few things that differ.
 */
public final class LumenCommands {
    /** What the command needs from the game. {@code S} is the version's client command source. */
    public interface Host<S> {
        void reply(S source, String message);

        /** x, y, z of the player. */
        int[] position();

        /** Friendly dimension name of the player's world. */
        String dimension();
    }

    private LumenCommands() {}

    public static <S> LiteralArgumentBuilder<S> build(Host<S> host) {
        return LiteralArgumentBuilder.<S>literal("lumen")
                .then(LiteralArgumentBuilder.<S>literal("wp")
                        .then(LiteralArgumentBuilder.<S>literal("add")
                                .then(RequiredArgumentBuilder.<S, String>argument("name", StringArgumentType.word()).executes(c -> {
                                    String name = StringArgumentType.getString(c, "name");
                                    int[] p = host.position();
                                    Waypoints.set(name, p[0], p[1], p[2], host.dimension());
                                    host.reply(c.getSource(), "Saved waypoint " + name + " at " + p[0] + " " + p[1] + " " + p[2]);
                                    return 1;
                                })))
                        .then(LiteralArgumentBuilder.<S>literal("remove")
                                .then(RequiredArgumentBuilder.<S, String>argument("name", StringArgumentType.word()).executes(c -> {
                                    String name = StringArgumentType.getString(c, "name");
                                    boolean ok = Waypoints.remove(name, host.dimension());
                                    host.reply(c.getSource(), ok ? "Removed waypoint " + name : "No waypoint called " + name + " here");
                                    return ok ? 1 : 0;
                                })))
                        .then(LiteralArgumentBuilder.<S>literal("list").executes(c -> {
                            List<Waypoints.Point> list = Waypoints.in(host.dimension());
                            if (list.isEmpty()) host.reply(c.getSource(), "No waypoints in this dimension. Use /lumen wp add <name>");
                            for (Waypoints.Point p : list) host.reply(c.getSource(), p.name + ": " + p.x + " " + p.y + " " + p.z);
                            return list.size();
                        })))
                .then(LiteralArgumentBuilder.<S>literal("death").executes(c -> {
                    String last = DeathTracker.last();
                    host.reply(c.getSource(), last == null ? "You have not died yet in this session" : "You died at " + last);
                    return last == null ? 0 : 1;
                }));
    }
}
