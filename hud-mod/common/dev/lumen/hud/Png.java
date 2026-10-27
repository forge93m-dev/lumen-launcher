package dev.lumen.hud;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.util.zip.CRC32;
import java.util.zip.DataFormatException;
import java.util.zip.Deflater;
import java.util.zip.Inflater;

/**
 * Just enough PNG for skins and capes (the same subset as the launcher's core/png.js): 8-bit pictures in, ARGB out and back.
 * Written by hand so the mod needs nothing from java.desktop.
 */
public final class Png {
    public static final class Image {
        public final int width;
        public final int height;
        /** 0xAARRGGBB, row by row. */
        public final int[] argb;

        public Image(int width, int height, int[] argb) {
            this.width = width;
            this.height = height;
            this.argb = argb;
        }
    }

    private static final byte[] SIGNATURE = {(byte) 137, 80, 78, 71, 13, 10, 26, 10};

    private Png() {}

    public static Image decode(byte[] buf) throws IOException {
        if (buf.length < 33) throw new IOException("This is not a PNG picture");
        for (int i = 0; i < 8; i++) if (buf[i] != SIGNATURE[i]) throw new IOException("This is not a PNG picture");
        ByteBuffer in = ByteBuffer.wrap(buf);
        int pos = 8;
        int width = -1, height = 0, depth = 0, color = 0, interlace = 0;
        byte[] palette = null;
        byte[] trns = null;
        ByteArrayOutputStream idat = new ByteArrayOutputStream();
        while (pos + 8 <= buf.length) {
            int len = in.getInt(pos);
            if (len < 0 || pos + 12L + len > buf.length) throw new IOException("This PNG is damaged");
            String type = new String(buf, pos + 4, 4, java.nio.charset.StandardCharsets.ISO_8859_1);
            int data = pos + 8;
            pos += 12 + len;
            switch (type) {
                case "IHDR" -> {
                    width = in.getInt(data);
                    height = in.getInt(data + 4);
                    depth = buf[data + 8] & 0xFF;
                    color = buf[data + 9] & 0xFF;
                    interlace = buf[data + 12] & 0xFF;
                }
                case "PLTE" -> palette = java.util.Arrays.copyOfRange(buf, data, data + len);
                case "tRNS" -> trns = java.util.Arrays.copyOfRange(buf, data, data + len);
                case "IDAT" -> idat.write(buf, data, len);
                default -> {
                }
            }
            if (type.equals("IEND")) break;
        }
        if (width <= 0 || height <= 0) throw new IOException("This PNG is damaged");
        if ((long) width * height > 4096L * 4096L) throw new IOException("This picture is too large for a skin");
        if (interlace != 0) throw new IOException("Interlaced PNGs are not supported, re-save the skin without interlacing");
        if (depth != 8) throw new IOException("Only 8-bit PNG skins are supported");
        int channels = switch (color) {
            case 0, 3 -> 1;
            case 2 -> 3;
            case 4 -> 2;
            case 6 -> 4;
            default -> throw new IOException("This PNG colour format is not supported");
        };
        int stride = width * channels;
        byte[] raw = new byte[(stride + 1) * height];
        Inflater inf = new Inflater();
        try {
            inf.setInput(idat.toByteArray());
            int got = 0;
            while (got < raw.length) {
                int n = inf.inflate(raw, got, raw.length - got);
                if (n == 0 && (inf.finished() || inf.needsInput() || inf.needsDictionary())) break;
                got += n;
            }
            if (got < raw.length) throw new IOException("This PNG is damaged");
        } catch (DataFormatException e) {
            throw new IOException("This PNG is damaged");
        } finally {
            inf.end();
        }
        byte[] px = new byte[stride * height];
        for (int y = 0; y < height; y++) {
            int filter = raw[y * (stride + 1)] & 0xFF;
            int src = y * (stride + 1) + 1;
            int dst = y * stride;
            for (int i = 0; i < stride; i++) {
                int a = i >= channels ? px[dst + i - channels] & 0xFF : 0;
                int b = y > 0 ? px[dst - stride + i] & 0xFF : 0;
                int c = y > 0 && i >= channels ? px[dst - stride + i - channels] & 0xFF : 0;
                int v = raw[src + i] & 0xFF;
                switch (filter) {
                    case 0 -> {
                    }
                    case 1 -> v += a;
                    case 2 -> v += b;
                    case 3 -> v += (a + b) >> 1;
                    case 4 -> {
                        int p = a + b - c;
                        int pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
                        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
                    }
                    default -> throw new IOException("This PNG is damaged");
                }
                px[dst + i] = (byte) v;
            }
        }
        int[] out = new int[width * height];
        for (int i = 0; i < out.length; i++) {
            int r, g, b, a = 255;
            switch (color) {
                case 6 -> {
                    r = px[i * 4] & 0xFF;
                    g = px[i * 4 + 1] & 0xFF;
                    b = px[i * 4 + 2] & 0xFF;
                    a = px[i * 4 + 3] & 0xFF;
                }
                case 2 -> {
                    r = px[i * 3] & 0xFF;
                    g = px[i * 3 + 1] & 0xFF;
                    b = px[i * 3 + 2] & 0xFF;
                }
                case 0 -> r = g = b = px[i] & 0xFF;
                case 4 -> {
                    r = g = b = px[i * 2] & 0xFF;
                    a = px[i * 2 + 1] & 0xFF;
                }
                default -> {
                    if (palette == null) throw new IOException("This PNG is damaged");
                    int k = px[i] & 0xFF;
                    if (k * 3 + 2 >= palette.length) throw new IOException("This PNG is damaged");
                    r = palette[k * 3] & 0xFF;
                    g = palette[k * 3 + 1] & 0xFF;
                    b = palette[k * 3 + 2] & 0xFF;
                    a = trns != null && k < trns.length ? trns[k] & 0xFF : 255;
                }
            }
            out[i] = a << 24 | r << 16 | g << 8 | b;
        }
        return new Image(width, height, out);
    }

    public static byte[] encode(int[] argb, int width, int height) {
        byte[] raw = new byte[(width * 4 + 1) * height];
        for (int y = 0; y < height; y++) {
            int o = y * (width * 4 + 1) + 1;
            for (int x = 0; x < width; x++) {
                int p = argb[y * width + x];
                raw[o++] = (byte) (p >> 16);
                raw[o++] = (byte) (p >> 8);
                raw[o++] = (byte) p;
                raw[o++] = (byte) (p >>> 24);
            }
        }
        Deflater def = new Deflater(6);
        def.setInput(raw);
        def.finish();
        ByteArrayOutputStream z = new ByteArrayOutputStream();
        byte[] chunk = new byte[8192];
        while (!def.finished()) z.write(chunk, 0, def.deflate(chunk));
        def.end();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.writeBytes(SIGNATURE);
        ByteBuffer ihdr = ByteBuffer.allocate(13);
        ihdr.putInt(width).putInt(height).put((byte) 8).put((byte) 6).put((byte) 0).put((byte) 0).put((byte) 0);
        chunk(out, "IHDR", ihdr.array());
        chunk(out, "IDAT", z.toByteArray());
        chunk(out, "IEND", new byte[0]);
        return out.toByteArray();
    }

    private static void chunk(ByteArrayOutputStream out, String type, byte[] data) {
        byte[] t = type.getBytes(java.nio.charset.StandardCharsets.ISO_8859_1);
        CRC32 crc = new CRC32();
        crc.update(t);
        crc.update(data);
        out.writeBytes(ByteBuffer.allocate(4).putInt(data.length).array());
        out.writeBytes(t);
        out.writeBytes(data);
        out.writeBytes(ByteBuffer.allocate(4).putInt((int) crc.getValue()).array());
    }
}
