package dev.lumen.hud;

import net.minecraft.text.Style;
import net.minecraft.text.Text;
import net.minecraft.util.Identifier;

/** The menu's own typeface (assets/lumenhud/font/ui.json) instead of the game's pixel font. (Minecraft 1.21 - 1.21.10) */
final class UiFont {
    private static final Style STYLE = Style.EMPTY.withFont(Identifier.of("lumenhud", "ui"));

    private UiFont() {}

    static Text of(String s) {
        return Text.literal(s).setStyle(STYLE);
    }
}
