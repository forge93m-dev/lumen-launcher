package dev.lumen.hud.mixin;

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

/** Minecraft 1.21.9 and later: your own player is drawn with the skin chosen in the launcher. */
@Mixin(AbstractClientPlayerEntity.class)
public class PlayerSkinMixin {
    @Inject(method = "getSkin", at = @At("RETURN"), cancellable = true)
    private void lumenhud$skin(CallbackInfoReturnable<SkinTextures> cir) {
        if ((Object) this != MinecraftClient.getInstance().player) return;
        Identifier id = SkinImage.id();
        if (id == null) return;
        SkinTextures o = cir.getReturnValue();
        cir.setReturnValue(new SkinTextures(new AssetInfo.TextureAssetInfo(id, id), o.cape(), o.elytra(),
                SkinImage.slim() ? PlayerSkinType.SLIM : PlayerSkinType.WIDE, o.secure()));
    }
}
