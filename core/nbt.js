// Minimal NBT (uncompressed, big-endian) reader/writer. Values keep their tag type so a file can be
// read, changed and written back without altering anything we did not touch.
const T = { END: 0, BYTE: 1, SHORT: 2, INT: 3, LONG: 4, FLOAT: 5, DOUBLE: 6, BYTE_ARRAY: 7, STRING: 8, LIST: 9, COMPOUND: 10, INT_ARRAY: 11, LONG_ARRAY: 12 };

class Reader {
  constructor(buf) { this.b = buf; this.i = 0; }
  need(n) { if (this.i + n > this.b.length) throw new Error('Unexpected end of NBT data'); }
  u8() { this.need(1); return this.b[this.i++]; }
  take(n) { if (n < 0) throw new Error('Corrupt NBT length'); this.need(n); const s = this.b.subarray(this.i, this.i + n); this.i += n; return s; }
  str() { return this.take(this.take(2).readUInt16BE(0)).toString('utf8'); }
}

function readPayload(r, type, depth) {
  if (depth > 64) throw new Error('NBT nested too deeply');
  switch (type) {
    case T.BYTE: return r.take(1).readInt8(0);
    case T.SHORT: return r.take(2).readInt16BE(0);
    case T.INT: return r.take(4).readInt32BE(0);
    case T.LONG: return r.take(8).readBigInt64BE(0);
    case T.FLOAT: return r.take(4).readFloatBE(0);
    case T.DOUBLE: return r.take(8).readDoubleBE(0);
    case T.BYTE_ARRAY: return Buffer.from(r.take(r.take(4).readInt32BE(0)));
    case T.STRING: return r.str();
    case T.INT_ARRAY: { const n = r.take(4).readInt32BE(0); return Array.from({ length: n }, () => r.take(4).readInt32BE(0)); }
    case T.LONG_ARRAY: { const n = r.take(4).readInt32BE(0); return Array.from({ length: n }, () => r.take(8).readBigInt64BE(0)); }
    case T.LIST: {
      const et = r.u8();
      const n = r.take(4).readInt32BE(0);
      if (n > 0 && et === T.END) throw new Error('Corrupt NBT list');
      return { elementType: et, items: Array.from({ length: Math.max(0, n) }, () => readPayload(r, et, depth + 1)) };
    }
    case T.COMPOUND: {
      const m = new Map();
      for (;;) {
        const t = r.u8();
        if (t === T.END) return m;
        const name = r.str();
        m.set(name, { type: t, value: readPayload(r, t, depth + 1) });
      }
    }
    default: throw new Error(`Unknown NBT tag ${type}`);
  }
}

// -> { name, value: Map } for the root compound
function parse(buf) {
  const r = new Reader(buf);
  const type = r.u8();
  if (type !== T.COMPOUND) throw new Error('NBT root is not a compound');
  const name = r.str();
  return { name, value: readPayload(r, type, 0) };
}

const num = (n, f) => { const b = Buffer.alloc(n); f(b); return b; };
const strBuf = (s) => { const d = Buffer.from(s, 'utf8'); return Buffer.concat([num(2, (b) => b.writeUInt16BE(d.length)), d]); };

function writePayload(type, v, out) {
  switch (type) {
    case T.BYTE: out.push(num(1, (b) => b.writeInt8(v))); break;
    case T.SHORT: out.push(num(2, (b) => b.writeInt16BE(v))); break;
    case T.INT: out.push(num(4, (b) => b.writeInt32BE(v))); break;
    case T.LONG: out.push(num(8, (b) => b.writeBigInt64BE(BigInt(v)))); break;
    case T.FLOAT: out.push(num(4, (b) => b.writeFloatBE(v))); break;
    case T.DOUBLE: out.push(num(8, (b) => b.writeDoubleBE(v))); break;
    case T.BYTE_ARRAY: out.push(num(4, (b) => b.writeInt32BE(v.length)), v); break;
    case T.STRING: out.push(strBuf(v)); break;
    case T.INT_ARRAY: out.push(num(4, (b) => b.writeInt32BE(v.length))); for (const x of v) out.push(num(4, (b) => b.writeInt32BE(x))); break;
    case T.LONG_ARRAY: out.push(num(4, (b) => b.writeInt32BE(v.length))); for (const x of v) out.push(num(8, (b) => b.writeBigInt64BE(BigInt(x)))); break;
    case T.LIST:
      out.push(Buffer.from([v.items.length ? v.elementType : T.END]), num(4, (b) => b.writeInt32BE(v.items.length)));
      for (const it of v.items) writePayload(v.elementType, it, out);
      break;
    case T.COMPOUND:
      for (const [name, { type: t, value }] of v) { out.push(Buffer.from([t]), strBuf(name)); writePayload(t, value, out); }
      out.push(Buffer.from([T.END]));
      break;
    default: throw new Error(`Unknown NBT tag ${type}`);
  }
}

function serialize({ name = '', value }) {
  const out = [Buffer.from([T.COMPOUND]), strBuf(name)];
  writePayload(T.COMPOUND, value, out);
  return Buffer.concat(out);
}

module.exports = { T, parse, serialize };
