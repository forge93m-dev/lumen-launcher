package dev.lumen.hud.mixin;

import dev.lumen.hud.ClickTracker;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.Mouse;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(Mouse.class)
public class MouseMixin {
    @Inject(method = "onMouseButton", at = @At("HEAD"))
    private void lumenhud$countClick(long window, int button, int action, int mods, CallbackInfo ci) {
        if (action == 1 && MinecraftClient.getInstance().currentScreen == null) ClickTracker.click(button, 0, 1);
    }
}
