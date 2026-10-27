package dev.lumen.hud;

import net.minecraft.network.chat.Component;
import net.minecraft.network.chat.FontDescription;
import net.minecraft.network.chat.Style;
import net.minecraft.resources.Identifier;

/** The menu's own typeface (assets/lumenhud/font/ui.json) instead of the game's pixel font. */
final class UiFont {
    private static final Style STYLE = Style.EMPTY.withFont(new FontDescription.Resource(Identifier.fromNamespaceAndPath("lumenhud", "ui")));

    private UiFont() {}

    static Component of(String s) {
        return Component.literal(s).withStyle(STYLE);
    }
}
