package dev.lumen.hud.mixin;

import dev.lumen.hud.RemoteSkins;
import dev.lumen.hud.SkinImage;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.network.AbstractClientPlayerEntity;
import net.minecraft.entity.player.PlayerSkinType;
import net.minecraft.entity.player.SkinTextures;
import net.minecraft.util.AssetInfo;
import net.minecraft.util.Identifier;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Minecraft 1.21.9 and later: your own player wears the skin and cape chosen in the launcher. */
@Mixin(AbstractClientPlayerEntity.class)
public class PlayerSkinMixin {
    @Inject(method = "getSkin", at = @At("RETURN"), cancellable = true)
    private void lumenhud$skin(CallbackInfoReturnable<SkinTextures> cir) {
        AbstractClientPlayerEntity self = (AbstractClientPlayerEntity) (Object) this;
        SkinTextures o = cir.getReturnValue();
        if (self != MinecraftClient.getInstance().player) { // another Lumen player: the skin and cape they share through the service
            RemoteSkins.Look look = RemoteSkins.of(self.getGameProfile().name());
            if (look == null) return;
            AssetInfo.TextureAsset capeAsset = look.cape() != null ? new AssetInfo.TextureAssetInfo(look.cape(), look.cape()) : o.cape();
            cir.setReturnValue(new SkinTextures(look.skin() != null ? new AssetInfo.TextureAssetInfo(look.skin(), look.skin()) : o.body(), capeAsset,
                    look.cape() != null ? capeAsset : o.elytra(),
                    look.skin() != null ? (look.slim() ? PlayerSkinType.SLIM : PlayerSkinType.WIDE) : o.model(), o.secure()));
            return;
        }
        Identifier skin = SkinImage.skin();
        Identifier cape = SkinImage.cape();
        if (skin == null && cape == null) return;
        AssetInfo.TextureAsset capeAsset = cape != null ? new AssetInfo.TextureAssetInfo(cape, cape) : o.cape();
        cir.setReturnValue(new SkinTextures(skin != null ? new AssetInfo.TextureAssetInfo(skin, skin) : o.body(), capeAsset,
                cape != null ? capeAsset : o.elytra(),
                skin != null ? (SkinImage.slim() ? PlayerSkinType.SLIM : PlayerSkinType.WIDE) : o.model(), o.secure()));
    }
}
