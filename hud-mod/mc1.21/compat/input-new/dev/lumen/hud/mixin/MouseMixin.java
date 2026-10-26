package dev.lumen.hud.mixin;

import dev.lumen.hud.ClickTracker;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.Mouse;
import net.minecraft.client.input.MouseInput;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Minecraft 1.21.9 and later: the button arrives inside a MouseInput. */
@Mixin(Mouse.class)
public class MouseMixin {
    @Inject(method = "onMouseButton", at = @At("HEAD"))
    private void lumenhud$countClick(long window, MouseInput input, int action, CallbackInfo ci) {
        if (action == 1 && MinecraftClient.getInstance().currentScreen == null) ClickTracker.click(input.button(), 0, 1);
    }
}
