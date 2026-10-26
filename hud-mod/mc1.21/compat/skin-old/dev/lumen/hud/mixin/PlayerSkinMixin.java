package dev.lumen.hud.mixin;

import dev.lumen.hud.RemoteSkins;
import dev.lumen.hud.SkinImage;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.network.AbstractClientPlayerEntity;
import net.minecraft.client.util.SkinTextures;
import net.minecraft.util.Identifier;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Minecraft 1.21 - 1.21.8: your own player wears the skin and cape chosen in the launcher. */
@Mixin(AbstractClientPlayerEntity.class)
public class PlayerSkinMixin {
    @Inject(method = "getSkinTextures", at = @At("RETURN"), cancellable = true)
    private void lumenhud$skin(CallbackInfoReturnable<SkinTextures> cir) {
        AbstractClientPlayerEntity self = (AbstractClientPlayerEntity) (Object) this;
        SkinTextures o = cir.getReturnValue();
        if (self != MinecraftClient.getInstance().player) { // another Lumen player: the skin and cape they share through the service
            RemoteSkins.Look look = RemoteSkins.of(self.getGameProfile().getName());
            if (look == null) return;
            cir.setReturnValue(new SkinTextures(look.skin() != null ? look.skin() : o.texture(), look.skin() != null ? null : o.textureUrl(),
                    look.cape() != null ? look.cape() : o.capeTexture(), look.cape() != null ? look.cape() : o.elytraTexture(),
                    look.skin() != null ? (look.slim() ? SkinTextures.Model.SLIM : SkinTextures.Model.WIDE) : o.model(), o.secure()));
            return;
        }
        Identifier skin = SkinImage.skin();
        Identifier cape = SkinImage.cape();
        if (skin == null && cape == null) return;
        cir.setReturnValue(new SkinTextures(skin != null ? skin : o.texture(), skin != null ? null : o.textureUrl(),
                cape != null ? cape : o.capeTexture(), cape != null ? cape : o.elytraTexture(),
                skin != null ? (SkinImage.slim() ? SkinTextures.Model.SLIM : SkinTextures.Model.WIDE) : o.model(), o.secure()));
    }
}
