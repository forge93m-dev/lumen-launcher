package dev.lumen.hud;

import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import net.minecraft.util.Identifier;
import org.lwjgl.glfw.GLFW;

/** Minecraft 1.21.9 and later: key categories are registered objects. */
final class Keys {
    private Keys() {}

    private static KeyBinding.Category category;

    static KeyBinding zoomKey() {
        return new KeyBinding("key.lumenhud.zoom", InputUtil.Type.KEYSYM, GLFW.GLFW_KEY_C, category());
    }

    private static KeyBinding.Category category() {
        if (category == null) category = KeyBinding.Category.create(Identifier.of("lumenhud", "main"));
        return category;
    }

    static KeyBinding editKey() {
        return new KeyBinding("key.lumenhud.edit", InputUtil.Type.KEYSYM, GLFW.GLFW_KEY_RIGHT_SHIFT, category());
    }
}
