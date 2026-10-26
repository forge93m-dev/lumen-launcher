package dev.lumen.hud;

import net.minecraft.client.gui.Click;

/** Minecraft 1.21.9 and later: mouse callbacks take a Click. */
public class EditScreen extends EditScreenBase {
    @Override
    public boolean mouseClicked(Click click, boolean doubled) {
        return press(click.x(), click.y(), click.button()) || super.mouseClicked(click, doubled);
    }

    @Override
    public boolean mouseDragged(Click click, double dx, double dy) {
        return drag(click.x(), click.y()) || super.mouseDragged(click, dx, dy);
    }

    @Override
    public boolean mouseReleased(Click click) {
        release();
        return super.mouseReleased(click);
    }

    @Override
    public boolean mouseScrolled(double mx, double my, double horizontal, double vertical) {
        return scroll(mx, my, vertical);
    }
}
