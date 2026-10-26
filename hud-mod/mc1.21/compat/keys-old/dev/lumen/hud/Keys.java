package dev.lumen.hud;

import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import org.lwjgl.glfw.GLFW;

/** Minecraft 1.21 - 1.21.8: a key category is a translation key. */
final class Keys {
    private Keys() {}

    static KeyBinding editKey() {
        return new KeyBinding("key.lumenhud.edit", InputUtil.Type.KEYSYM, GLFW.GLFW_KEY_RIGHT_SHIFT, "category.lumenhud");
    }
}
