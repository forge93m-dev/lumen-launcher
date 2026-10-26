package dev.lumen.hud.mixin;

import dev.lumen.hud.Freelook;
import net.minecraft.client.Minecraft;
import net.minecraft.world.entity.Entity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Freelook: while it is active the mouse turns the camera instead of the player. */
@Mixin(Entity.class)
public class EntityMixin {
    @Inject(method = "turn", at = @At("HEAD"), cancellable = true)
    private void lumenhud$freelook(double dx, double dy, CallbackInfo ci) {
        if (Freelook.active() && (Object) this == Minecraft.getInstance().player) {
            Freelook.look(dx, dy);
            ci.cancel();
        }
    }
}
