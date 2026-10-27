package dev.lumen.hud;

import net.minecraft.client.Minecraft;
import net.minecraft.client.multiplayer.ClientLevel;
import net.minecraft.core.BlockPos;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.decoration.ArmorStand;
import net.minecraft.world.entity.monster.Enemy;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.levelgen.Heightmap;
import net.minecraft.world.level.material.MapColor;

import java.util.List;

/** The minimap's view of the world on 26.x. */
final class MinimapSource implements Minimap.Source {
    static final MinimapSource INSTANCE = new MinimapSource();
    private final BlockPos.MutableBlockPos pos = new BlockPos.MutableBlockPos();

    private MinimapSource() {}

    private static ClientLevel level() {
        return Minecraft.getInstance().level;
    }

    @Override
    public boolean ready() {
        Minecraft c = Minecraft.getInstance();
        return c.level != null && c.player != null;
    }

    @Override
    public Object world() {
        return level();
    }

    @Override
    public boolean hasCeiling() {
        return level().dimensionType().hasCeiling();
    }

    @Override
    public boolean column(int x, int z, int fromY, int[] out) {
        ClientLevel lv = level();
        if (!lv.getChunkSource().hasChunk(x >> 4, z >> 4)) return false;
        int top = fromY == Integer.MAX_VALUE ? lv.getHeight(Heightmap.Types.WORLD_SURFACE, x, z) : fromY;
        int bottom = lv.getMinY();
        out[0] = -1;
        out[1] = bottom;
        out[2] = 0;
        for (int y = top; y >= bottom; y--) {
            BlockState state = lv.getBlockState(pos.set(x, y, z));
            if (state.isAir()) continue;
            MapColor color = state.getMapColor(lv, pos);
            if (color == MapColor.NONE) continue;
            out[0] = color.col;
            out[1] = y;
            if (!state.getFluidState().isEmpty()) { // how deep the liquid goes
                int depth = 1;
                for (int d = y - 1; d >= bottom && depth < 12; d--) {
                    if (lv.getBlockState(pos.set(x, d, z)).getFluidState().isEmpty()) break;
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
        ClientLevel lv = level();
        Player me = Minecraft.getInstance().player;
        double r2 = radius * radius;
        for (Entity e : lv.entitiesForRendering()) {
            if (e == me || !(e instanceof LivingEntity) || e instanceof ArmorStand || e.isInvisible()) continue;
            double dx = e.getX() - px, dz = e.getZ() - pz;
            if (dx * dx + dz * dz > r2) continue;
            out.add(new double[]{e.getX(), e.getZ(), e instanceof Player ? 0 : e instanceof Enemy ? 1 : 2});
            if (out.size() >= 96) return;
        }
    }
}
