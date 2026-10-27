package dev.lumen.hud;

/**
 * A small software renderer that turns a skin (and cape) into a picture of the player seen from any angle, with the
 * same box layout Minecraft uses. No textures or game classes are needed, so the menu can show a skin that is not worn yet.
 */
final class PlayerModel {
    private PlayerModel() {}

    /** One box of the model: minimum corner, size, where its pictures start in the skin, and how far it is swollen outwards. */
    private record Box(double x, double y, double z, double w, double h, double d, int u, int v, double grow, boolean overlay) {}

    /** The faces a ray can hit, flattened for speed: corner, the two edge directions, and the piece of the skin they show. */
    private static final class Face {
        double px, py, pz, ux, uy, uz, vx, vy, vz, nx, ny, nz;
        double lu, lv; // length of the edges
        int tu, tv, tw, th; // texture rectangle
        boolean overlay;
        int[] tex;
        int stride;
    }

    private static Box[] boxes(boolean slim) {
        double aw = slim ? 3 : 4;
        return new Box[]{
                new Box(-4, 24, -4, 8, 8, 8, 0, 0, 0, false), new Box(-4, 24, -4, 8, 8, 8, 32, 0, 0.5, true),
                new Box(-4, 12, -2, 8, 12, 4, 16, 16, 0, false), new Box(-4, 12, -2, 8, 12, 4, 16, 32, 0.25, true),
                new Box(-4 - aw, 12, -2, aw, 12, 4, 40, 16, 0, false), new Box(-4 - aw, 12, -2, aw, 12, 4, 40, 32, 0.25, true),
                new Box(4, 12, -2, aw, 12, 4, 32, 48, 0, false), new Box(4, 12, -2, aw, 12, 4, 48, 48, 0.25, true),
                new Box(-4, 0, -2, 4, 12, 4, 0, 16, 0, false), new Box(-4, 0, -2, 4, 12, 4, 0, 32, 0.25, true),
                new Box(0, 0, -2, 4, 12, 4, 16, 48, 0, false), new Box(0, 0, -2, 4, 12, 4, 0, 48, 0.25, true),
        };
    }

    private static void faces(Box b, int[] tex, int stride, java.util.List<Face> out) {
        double x0 = b.x - b.grow, y0 = b.y - b.grow, z0 = b.z - b.grow;
        double x1 = b.x + b.w + b.grow, y1 = b.y + b.h + b.grow, z1 = b.z + b.d + b.grow;
        int w = (int) b.w, h = (int) b.h, d = (int) b.d, u = b.u, v = b.v;
        // front (+z), back (-z), right side (-x), left side (+x), top, bottom
        add(out, tex, stride, b.overlay, x0, y1, z1, 1, 0, 0, x1 - x0, 0, -1, 0, y1 - y0, 0, 0, 1, u + d, v + d, w, h);
        add(out, tex, stride, b.overlay, x1, y1, z0, -1, 0, 0, x1 - x0, 0, -1, 0, y1 - y0, 0, 0, -1, u + d + w + d, v + d, w, h);
        add(out, tex, stride, b.overlay, x0, y1, z0, 0, 0, 1, z1 - z0, 0, -1, 0, y1 - y0, -1, 0, 0, u, v + d, d, h);
        add(out, tex, stride, b.overlay, x1, y1, z1, 0, 0, -1, z1 - z0, 0, -1, 0, y1 - y0, 1, 0, 0, u + d + w, v + d, d, h);
        add(out, tex, stride, b.overlay, x0, y1, z0, 1, 0, 0, x1 - x0, 0, 0, 1, z1 - z0, 0, 1, 0, u + d, v, w, d);
        add(out, tex, stride, b.overlay, x0, y0, z1, 1, 0, 0, x1 - x0, 0, 0, -1, z1 - z0, 0, -1, 0, u + d + w, v, w, d);
    }

    private static void add(java.util.List<Face> out, int[] tex, int stride, boolean overlay, double px, double py, double pz,
                            double ux, double uy, double uz, double lu, double vx, double vy, double vz, double lv,
                            double nx, double ny, double nz, int tu, int tv, int tw, int th) {
        Face f = new Face();
        f.px = px; f.py = py; f.pz = pz;
        f.ux = ux; f.uy = uy; f.uz = uz; f.lu = lu;
        f.vx = vx; f.vy = vy; f.vz = vz; f.lv = lv;
        f.nx = nx; f.ny = ny; f.nz = nz;
        f.tu = tu; f.tv = tv; f.tw = tw; f.th = th;
        f.overlay = overlay;
        f.tex = tex;
        f.stride = stride;
        out.add(f);
    }

    /**
     * The player as a {@code w}x{@code h} picture (ARGB, see-through background).
     * @param skin 64x64 pixels, or null for the stand-in skin
     * @param cape 64x32 pixels, or null for none
     * @param yaw  degrees the player is turned: 0 shows the front
     */
    static int[] render(int[] skin, boolean slim, int[] cape, double yaw, int w, int h) {
        if (skin == null) skin = Figure.fallback();
        java.util.List<Face> faces = new java.util.ArrayList<>();
        for (Box b : boxes(slim)) faces(b, skin, 64, faces);
        if (cape != null) {
            // the cape hangs just behind the body: its outer side shows (1,1) of the cape picture, its inner side (12,1)
            add(faces, cape, 64, false, 5, 24, -3, -1, 0, 0, 10, 0, -1, 0, 16, 0, 0, -1, 1, 1, 10, 16);
            add(faces, cape, 64, false, -5, 24, -2, 1, 0, 0, 10, 0, -1, 0, 16, 0, 0, 1, 12, 1, 10, 16);
        }
        int[] out = new int[w * h];
        float[] depth = new float[w * h];
        java.util.Arrays.fill(depth, Float.MAX_VALUE);

        double yawRad = Math.toRadians(yaw), pitch = Math.toRadians(9);
        double cy = Math.cos(yawRad), sy = Math.sin(yawRad), cp = Math.cos(pitch), sp = Math.sin(pitch);
        double dist = 90;
        double unit = h * 0.9 / 34; // screen pixels per model unit at the centre
        double focal = unit * dist;
        double lx = -0.35, ly = 0.7, lz = 0.62; // where the light comes from, in view space
        double ll = Math.sqrt(lx * lx + ly * ly + lz * lz);
        lx /= ll; ly /= ll; lz /= ll;

        for (Face f : faces) {
            // model space -> view space: turn around the vertical axis through the middle, tip forward a little, push away from the camera
            double[] p = view(f.px, f.py - 16, f.pz, cy, sy, cp, sp, dist);
            double[] uv = rot(f.ux * f.lu, f.uy * f.lu, f.uz * f.lu, cy, sy, cp, sp);
            double[] vv = rot(f.vx * f.lv, f.vy * f.lv, f.vz * f.lv, cy, sy, cp, sp);
            double[] n = rot(f.nx, f.ny, f.nz, cy, sy, cp, sp);
            // a face that points away from the camera cannot be seen
            double facing = n[0] * p[0] + n[1] * p[1] + n[2] * p[2];
            if (facing >= 0) continue;
            double shade = 0.58 + 0.42 * Math.max(0, n[0] * lx + n[1] * ly + n[2] * lz);
            // screen box of the four corners
            double minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
            for (int c = 0; c < 4; c++) {
                double qx = p[0] + ((c & 1) != 0 ? uv[0] : 0) + ((c & 2) != 0 ? vv[0] : 0);
                double qy = p[1] + ((c & 1) != 0 ? uv[1] : 0) + ((c & 2) != 0 ? vv[1] : 0);
                double qz = p[2] + ((c & 1) != 0 ? uv[2] : 0) + ((c & 2) != 0 ? vv[2] : 0);
                double sx = w / 2.0 + focal * qx / -qz;
                double sY = h / 2.0 - focal * qy / -qz;
                minX = Math.min(minX, sx); maxX = Math.max(maxX, sx);
                minY = Math.min(minY, sY); maxY = Math.max(maxY, sY);
            }
            int x0 = Math.max(0, (int) Math.floor(minX)), x1 = Math.min(w - 1, (int) Math.ceil(maxX));
            int y0 = Math.max(0, (int) Math.floor(minY)), y1 = Math.min(h - 1, (int) Math.ceil(maxY));
            double uu = uv[0] * uv[0] + uv[1] * uv[1] + uv[2] * uv[2];
            double vvv = vv[0] * vv[0] + vv[1] * vv[1] + vv[2] * vv[2];
            double nd = n[0] * p[0] + n[1] * p[1] + n[2] * p[2];
            for (int py = y0; py <= y1; py++) {
                for (int px = x0; px <= x1; px++) {
                    double dx = (px + 0.5 - w / 2.0) / focal, dy = -(py + 0.5 - h / 2.0) / focal, dz = -1;
                    double den = n[0] * dx + n[1] * dy + n[2] * dz;
                    if (den >= -1e-9) continue;
                    double t = nd / den;
                    if (t <= 0 || t >= depth[py * w + px]) continue;
                    double hx = t * dx - p[0], hy = t * dy - p[1], hz = t * dz - p[2];
                    double a = (hx * uv[0] + hy * uv[1] + hz * uv[2]) / uu;
                    double b = (hx * vv[0] + hy * vv[1] + hz * vv[2]) / vvv;
                    if (a < 0 || a >= 1 || b < 0 || b >= 1) continue;
                    int tx = f.tu + (int) (a * f.tw), ty = f.tv + (int) (b * f.th);
                    int c = f.tex[ty * f.stride + tx];
                    int alpha = c >>> 24;
                    if (alpha < (f.overlay ? 40 : 1)) continue;
                    depth[py * w + px] = (float) t;
                    int r = (int) (((c >> 16) & 0xFF) * shade), gg = (int) (((c >> 8) & 0xFF) * shade), bl = (int) ((c & 0xFF) * shade);
                    out[py * w + px] = 0xFF000000 | (Math.min(255, r) << 16) | (Math.min(255, gg) << 8) | Math.min(255, bl);
                }
            }
        }
        return out;
    }

    private static double[] rot(double x, double y, double z, double cy, double sy, double cp, double sp) {
        double rx = x * cy + z * sy, rz = -x * sy + z * cy; // around the vertical axis
        double ry = y * cp - rz * sp, rz2 = y * sp + rz * cp; // tipped towards the camera
        return new double[]{rx, ry, rz2};
    }

    private static double[] view(double x, double y, double z, double cy, double sy, double cp, double sp, double dist) {
        double[] r = rot(x, y, z, cy, sy, cp, sp);
        r[2] -= dist;
        return r;
    }
}
