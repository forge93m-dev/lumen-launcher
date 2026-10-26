package dev.lumen.hud;

import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import net.minecraft.util.Identifier;
import org.lwjgl.glfw.GLFW;

/** Minecraft 1.21.9 and later: key categories are registered objects. */
final class Keys {
    private Keys() {}

    static KeyBinding editKey() {
        KeyBinding.Category category = KeyBinding.Category.create(Identifier.of("lumenhud", "main"));
        return new KeyBinding("key.lumenhud.edit", InputUtil.Type.KEYSYM, GLFW.GLFW_KEY_RIGHT_SHIFT, category);
    }
}
