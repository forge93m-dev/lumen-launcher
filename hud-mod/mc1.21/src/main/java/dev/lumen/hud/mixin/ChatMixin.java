package dev.lumen.hud.mixin;

import dev.lumen.hud.ChatTweaks;
import net.minecraft.client.gui.hud.ChatHud;
import net.minecraft.client.gui.hud.MessageIndicator;
import net.minecraft.network.message.MessageSignatureData;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.ModifyVariable;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Every chat line, player or system, passes through ChatHud.addMessage. */
@Mixin(ChatHud.class)
public class ChatMixin {
    private static final String ADD = "addMessage(Lnet/minecraft/text/Text;Lnet/minecraft/network/message/MessageSignatureData;Lnet/minecraft/client/gui/hud/MessageIndicator;)V";

    @Inject(method = ADD, at = @At("HEAD"), cancellable = true, require = 0)
    private void lumenhud$hide(Text message, MessageSignatureData sig, MessageIndicator indicator, CallbackInfo ci) {
        if (ChatTweaks.hide(message.getString())) ci.cancel();
    }

    @ModifyVariable(method = ADD, at = @At("HEAD"), argsOnly = true, ordinal = 0, require = 0)
    private Text lumenhud$stamp(Text message) {
        String stamp = ChatTweaks.stamp();
        return stamp == null ? message : Text.literal(stamp).formatted(Formatting.GRAY).append(message);
    }
}
