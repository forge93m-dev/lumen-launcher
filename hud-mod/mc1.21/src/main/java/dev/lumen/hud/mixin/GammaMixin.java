package dev.lumen.hud.mixin;

import dev.lumen.hud.HudConfig;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.option.SimpleOption;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Fullbright: the game only accepts brightness 0..1 in the options, so the value is raised where it is read. */
@Mixin(SimpleOption.class)
public class GammaMixin {
    @Inject(method = "getValue", at = @At("RETURN"), cancellable = true)
    private void lumenhud$fullbright(CallbackInfoReturnable<Object> cir) {
        MinecraftClient c = MinecraftClient.getInstance();
        if (c != null && c.options != null && HudConfig.get().fullbright && (Object) this == c.options.getGamma()) cir.setReturnValue(16.0);
    }
}
