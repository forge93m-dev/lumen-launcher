package dev.lumen.hud;

/** Minecraft 1.21 - 1.21.8: mouse callbacks take plain numbers. */
public class EditScreen extends EditScreenBase {
    public EditScreen() {
        this(false);
    }

    /** @param layout true to open straight in the drag-to-move layout editor */
    public EditScreen(boolean layout) {
        super(layout);
    }

    @Override
    public boolean mouseClicked(double mx, double my, int button) {
        return press(mx, my, button) || super.mouseClicked(mx, my, button);
    }

    @Override
    public boolean mouseDragged(double mx, double my, int button, double dx, double dy) {
        return drag(mx, my) || super.mouseDragged(mx, my, button, dx, dy);
    }

    @Override
    public boolean mouseReleased(double mx, double my, int button) {
        release();
        return super.mouseReleased(mx, my, button);
    }

    @Override
    public boolean mouseScrolled(double mx, double my, double horizontal, double vertical) {
        return scroll(mx, my, vertical);
    }
}
