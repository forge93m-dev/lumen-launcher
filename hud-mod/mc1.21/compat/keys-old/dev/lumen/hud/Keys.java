package dev.lumen.hud;

import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import org.lwjgl.glfw.GLFW;

/** Minecraft 1.21 - 1.21.8: a key category is a translation key. */
final class Keys {
    private Keys() {}

    static KeyBinding zoomKey() {
        return new KeyBinding("key.lumenhud.zoom", InputUtil.Type.KEYSYM, GLFW.GLFW_KEY_C, "category.lumenhud");
    }

    static KeyBinding freelookKey() {
        return new KeyBinding("key.lumenhud.freelook", InputUtil.Type.KEYSYM, GLFW.GLFW_KEY_LEFT_ALT, "category.lumenhud");
    }

    static KeyBinding editKey() {
        return new KeyBinding("key.lumenhud.edit", InputUtil.Type.KEYSYM, GLFW.GLFW_KEY_RIGHT_SHIFT, "category.lumenhud");
    }

    /** Whether the key is held on the keyboard right now, whatever the game thinks the binding's state is. */
    static boolean physicallyDown(net.minecraft.client.MinecraftClient c, int code) {
        return InputUtil.isKeyPressed(c.getWindow().getHandle(), code);
    }
}
