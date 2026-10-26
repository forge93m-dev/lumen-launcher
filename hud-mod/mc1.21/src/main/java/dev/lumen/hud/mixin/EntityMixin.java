package dev.lumen.hud.mixin;

import dev.lumen.hud.Freelook;
import net.minecraft.client.MinecraftClient;
import net.minecraft.entity.Entity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Freelook: while it is active the mouse turns the camera instead of the player. */
@Mixin(Entity.class)
public class EntityMixin {
    @Inject(method = "changeLookDirection", at = @At("HEAD"), cancellable = true)
    private void lumenhud$freelook(double dx, double dy, CallbackInfo ci) {
        if (Freelook.active() && (Object) this == MinecraftClient.getInstance().player) {
            Freelook.look(dx, dy);
            ci.cancel();
        }
    }
}
