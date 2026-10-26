package dev.lumen.hud.mixin;

import dev.lumen.hud.Freelook;
import net.minecraft.client.render.Camera;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.ModifyVariable;

/** Freelook: the camera takes its angles from the freelook state instead of the player. */
@Mixin(Camera.class)
public class CameraMixin {
    @ModifyVariable(method = "setRotation", at = @At("HEAD"), argsOnly = true, ordinal = 0)
    private float lumenhud$yaw(float yaw) {
        return Freelook.active() ? Freelook.yaw() : yaw;
    }

    @ModifyVariable(method = "setRotation", at = @At("HEAD"), argsOnly = true, ordinal = 1)
    private float lumenhud$pitch(float pitch) {
        return Freelook.active() ? Freelook.pitch() : pitch;
    }
}
