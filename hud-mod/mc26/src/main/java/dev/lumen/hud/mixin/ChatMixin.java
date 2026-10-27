package dev.lumen.hud.mixin;

import dev.lumen.hud.ChatTweaks;
import net.minecraft.ChatFormatting;
import net.minecraft.client.gui.components.ChatComponent;
import net.minecraft.network.chat.Component;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.ModifyVariable;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Every chat line, player or system, passes through ChatComponent.addMessage. */
@Mixin(ChatComponent.class)
public class ChatMixin {
    private static final String ADD = "addMessage(Lnet/minecraft/network/chat/Component;Lnet/minecraft/network/chat/MessageSignature;Lnet/minecraft/client/multiplayer/chat/GuiMessageSource;Lnet/minecraft/client/multiplayer/chat/GuiMessageTag;)V";

    @Inject(method = ADD, at = @At("HEAD"), cancellable = true, require = 0)
    private void lumenhud$hide(Component message, net.minecraft.network.chat.MessageSignature sig, net.minecraft.client.multiplayer.chat.GuiMessageSource source,
                               net.minecraft.client.multiplayer.chat.GuiMessageTag tag, CallbackInfo ci) {
        if (ChatTweaks.hide(message.getString())) ci.cancel();
    }

    @ModifyVariable(method = ADD, at = @At("HEAD"), argsOnly = true, ordinal = 0, require = 0)
    private Component lumenhud$stamp(Component message) {
        String stamp = ChatTweaks.stamp();
        return stamp == null ? message : Component.literal(stamp).withStyle(ChatFormatting.GRAY).append(message);
    }
}
