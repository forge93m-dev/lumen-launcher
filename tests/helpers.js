// Shared test helpers. Every test file runs in its own process (node --test), and calls sandbox() before it
// requires anything from core/, so the launcher's data folder is a throwaway temp directory, never the real one.
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');

function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lumen-test-'));
  process.env.APPDATA = dir; // Windows data root
  process.env.HOME = dir; // macOS / Linux data root
  process.env.USERPROFILE = dir;
  process.on('exit', () => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} });
  return dir;
}

// Makes every network call fail the way a dead connection does, without waiting for retries.
function offline() {
  global.fetch = () => Promise.resolve(new Response('{}', { status: 404 }));
}

// A zip with exactly the entry names given. adm-zip normalises "../" away when writing, which would hide the
// very thing a path-traversal test is about, so this writes the archive bytes directly (stored, no compression).
function rawZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const n = Buffer.from(name);
    const d = Buffer.from(data);
    const crc = zlib.crc32(d);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x21, 12); lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(d.length, 18); lh.writeUInt32LE(d.length, 22); lh.writeUInt16LE(n.length, 26);
    const local = Buffer.concat([lh, n, d]);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x21, 14); ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(d.length, 20); ch.writeUInt32LE(d.length, 24); ch.writeUInt16LE(n.length, 28); ch.writeUInt32LE(offset, 42);
    locals.push(local);
    centrals.push(Buffer.concat([ch, n]));
    offset += local.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

// A file with `bytes` bytes, creating parent folders.
function put(file, bytes = 1) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.alloc(bytes, 1));
}

module.exports = { sandbox, offline, rawZip, put };
