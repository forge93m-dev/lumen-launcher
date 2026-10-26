package dev.lumen.hud.mixin;

import dev.lumen.hud.RemoteSkins;
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

/** Your own player wears the skin and cape chosen in the launcher. */
@Mixin(AbstractClientPlayer.class)
public class PlayerSkinMixin {
    @Inject(method = "getSkin", at = @At("RETURN"), cancellable = true)
    private void lumenhud$skin(CallbackInfoReturnable<PlayerSkin> cir) {
        AbstractClientPlayer self = (AbstractClientPlayer) (Object) this;
        PlayerSkin o = cir.getReturnValue();
        if (self != Minecraft.getInstance().player) { // another Lumen player: the skin and cape they share through the service
            RemoteSkins.Look look = RemoteSkins.of(self.getGameProfile().name());
            if (look == null) return;
            ClientAsset.Texture capeAsset = look.cape() != null ? new ClientAsset.ResourceTexture(look.cape(), look.cape()) : o.cape();
            cir.setReturnValue(new PlayerSkin(look.skin() != null ? new ClientAsset.ResourceTexture(look.skin(), look.skin()) : o.body(), capeAsset,
                    look.cape() != null ? capeAsset : o.elytra(),
                    look.skin() != null ? (look.slim() ? PlayerModelType.SLIM : PlayerModelType.WIDE) : o.model(), o.secure()));
            return;
        }
        Identifier skin = SkinImage.skin();
        Identifier cape = SkinImage.cape();
        if (skin == null && cape == null) return;
        ClientAsset.Texture capeAsset = cape != null ? new ClientAsset.ResourceTexture(cape, cape) : o.cape();
        cir.setReturnValue(new PlayerSkin(skin != null ? new ClientAsset.ResourceTexture(skin, skin) : o.body(), capeAsset,
                cape != null ? capeAsset : o.elytra(),
                skin != null ? (SkinImage.slim() ? PlayerModelType.SLIM : PlayerModelType.WIDE) : o.model(), o.secure()));
    }
}
