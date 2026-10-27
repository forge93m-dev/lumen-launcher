package dev.lumen.hud;

import net.minecraft.block.BlockState;
import net.minecraft.block.MapColor;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.world.ClientWorld;
import net.minecraft.entity.Entity;
import net.minecraft.entity.LivingEntity;
import net.minecraft.entity.decoration.ArmorStandEntity;
import net.minecraft.entity.mob.Monster;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.util.math.BlockPos;
import net.minecraft.world.Heightmap;

import java.util.List;

/** The minimap's view of the world on 1.21.x. */
final class MinimapSource implements Minimap.Source {
    static final MinimapSource INSTANCE = new MinimapSource();
    private final BlockPos.Mutable pos = new BlockPos.Mutable();

    private MinimapSource() {}

    private static ClientWorld world0() {
        return MinecraftClient.getInstance().world;
    }

    @Override
    public boolean ready() {
        MinecraftClient c = MinecraftClient.getInstance();
        return c.world != null && c.player != null;
    }

    @Override
    public Object world() {
        return world0();
    }

    @Override
    public boolean hasCeiling() {
        return world0().getDimension().hasCeiling();
    }

    @Override
    public boolean column(int x, int z, int fromY, int[] out) {
        ClientWorld w = world0();
        if (!w.getChunkManager().isChunkLoaded(x >> 4, z >> 4)) return false;
        int top = fromY == Integer.MAX_VALUE ? w.getTopY(Heightmap.Type.WORLD_SURFACE, x, z) : fromY;
        int bottom = w.getBottomY();
        out[0] = -1;
        out[1] = bottom;
        out[2] = 0;
        for (int y = top; y >= bottom; y--) {
            BlockState state = w.getBlockState(pos.set(x, y, z));
            if (state.isAir()) continue;
            MapColor color = state.getMapColor(w, pos);
            if (color == MapColor.CLEAR) continue;
            out[0] = color.color;
            out[1] = y;
            if (!state.getFluidState().isEmpty()) { // how deep the liquid goes
                int depth = 1;
                for (int d = y - 1; d >= bottom && depth < 12; d--) {
                    if (w.getBlockState(pos.set(x, d, z)).getFluidState().isEmpty()) break;
                    depth++;
                }
                out[2] = depth;
            }
            return true;
        }
        return true;
    }

    @Override
    public void entities(List<double[]> out, double px, double pz, double radius) {
        ClientWorld w = world0();
        PlayerEntity me = MinecraftClient.getInstance().player;
        double r2 = radius * radius;
        for (Entity e : w.getEntities()) {
            if (e == me || !(e instanceof LivingEntity) || e instanceof ArmorStandEntity || e.isInvisible()) continue;
            double dx = e.getX() - px, dz = e.getZ() - pz;
            if (dx * dx + dz * dz > r2) continue;
            out.add(new double[]{e.getX(), e.getZ(), e instanceof PlayerEntity ? 0 : e instanceof Monster ? 1 : 2});
            if (out.size() >= 96) return;
        }
    }
}
