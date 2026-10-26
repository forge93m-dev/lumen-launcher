package dev.lumen.hud.mixin;

import dev.lumen.hud.HudConfig;
import net.minecraft.client.Minecraft;
import net.minecraft.client.OptionInstance;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Fullbright: the game only accepts brightness 0..1 in the options, so the value is raised where it is read. */
@Mixin(OptionInstance.class)
public class GammaMixin {
    @Inject(method = "get", at = @At("RETURN"), cancellable = true)
    private void lumenhud$fullbright(CallbackInfoReturnable<Object> cir) {
        Minecraft c = Minecraft.getInstance();
        if (c != null && c.options != null && HudConfig.get().fullbright && (Object) this == c.options.gamma()) cir.setReturnValue(16.0);
    }
}
