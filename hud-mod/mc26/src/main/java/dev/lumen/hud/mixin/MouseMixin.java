package dev.lumen.hud.mixin;

import dev.lumen.hud.ClickTracker;
import com.mojang.blaze3d.platform.InputConstants;
import dev.lumen.hud.Compat;
import net.minecraft.client.Minecraft;
import net.minecraft.client.MouseHandler;
import net.minecraft.client.input.MouseButtonInfo;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(MouseHandler.class)
public class MouseMixin {
    @Inject(method = "onButton", at = @At("HEAD"))
    private void lumenhud$countClick(long handle, MouseButtonInfo info, int action, CallbackInfo ci) {
        if (action == 1 && Compat.screen(Minecraft.getInstance()) == null) ClickTracker.click(info.button(), InputConstants.MOUSE_BUTTON_LEFT, InputConstants.MOUSE_BUTTON_RIGHT);
    }
}
