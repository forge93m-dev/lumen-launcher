package dev.lumen.hud.mixin;

import dev.lumen.hud.SkinImage;
import net.minecraft.client.Minecraft;
import net.minecraft.client.player.AbstractClientPlayer;
import net.minecraft.core.ClientAsset;
import net.minecraft.resources.Identifier;
import net.minecraft.world.entity.player.PlayerModelType;
import net.minecraft.world.entity.player.PlayerSkin;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Your own player is drawn with the skin chosen in the launcher. */
@Mixin(AbstractClientPlayer.class)
public class PlayerSkinMixin {
    @Inject(method = "getSkin", at = @At("RETURN"), cancellable = true)
    private void lumenhud$skin(CallbackInfoReturnable<PlayerSkin> cir) {
        if ((Object) this != Minecraft.getInstance().player) return;
        Identifier id = SkinImage.id();
        if (id == null) return;
        PlayerSkin o = cir.getReturnValue();
        cir.setReturnValue(new PlayerSkin(new ClientAsset.ResourceTexture(id, id), o.cape(), o.elytra(),
                SkinImage.slim() ? PlayerModelType.SLIM : PlayerModelType.WIDE, o.secure()));
    }
}
