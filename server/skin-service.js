#!/usr/bin/env node
// Lumen skin service: a tiny HTTP server that lets Lumen players see each other's skins and capes.
// Each launcher uploads the skin/cape of its player; each mod asks for the players around it. No dependencies.
//
//   node server/skin-service.js            (port 8787, data in ./skin-data)
//   PORT=80 DATA=/var/lib/lumen-skins node server/skin-service.js
//
// Names are claimed by whoever uploads first, with a secret token only that launcher knows; the token is stored
// hashed. This keeps friends from overwriting each other, it is not a login system: put the service behind your
// own rules (a private URL, a reverse proxy) if you need more.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const png = require('../core/png');

const NAME = /^[A-Za-z0-9_]{3,16}$/;
const MAX_BODY = 160 * 1024;
const MAX_PNG = 48 * 1024;

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();

function atomicWrite(file, data) {
  const tmp = `${file}.${process.pid}.${crypto.randomBytes(3).toString('hex')}.tmp`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
}

// Checks a PNG is exactly w x h and returns the bytes re-encoded from the pixels (so nothing but pixels is kept).
function cleanPng(b64, w, h, what) {
  const raw = Buffer.from(String(b64), 'base64');
  if (raw.length === 0 || raw.length > MAX_PNG) throw new HttpError(413, `${what} picture is too large`);
  let img;
  try {
    img = png.decode(raw);
  } catch (e) {
    throw new HttpError(400, `${what}: ${e.message}`);
  }
  if (img.width !== w || img.height !== h) throw new HttpError(400, `${what} must be ${w}x${h} pixels`);
  return png.encode(img.rgba, w, h);
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function createService({ data = path.join(process.cwd(), 'skin-data'), maxProfiles = 10000, trustProxy = false, readsPerMin = 600, writesPerMin = 20 } = {}) {
  fs.mkdirSync(data, { recursive: true });
  const dirOf = (name) => path.join(data, name.toLowerCase());
  const buckets = new Map();

  function limited(ip, kind, perMin) {
    const key = `${kind}:${ip}`;
    const now = Date.now();
    const b = buckets.get(key) || { t: now, n: 0 };
    if (now - b.t > 60000) { b.t = now; b.n = 0; }
    b.n++;
    buckets.set(key, b);
    if (buckets.size > 5000) for (const [k, v] of buckets) if (now - v.t > 60000) buckets.delete(k);
    return b.n > perMin;
  }

  const readMeta = (name) => {
    try { return JSON.parse(fs.readFileSync(path.join(dirOf(name), 'profile.json'), 'utf8')); } catch { return null; }
  };

  const publicProfile = (m) => ({
    name: m.name,
    slim: !!m.slim,
    rev: m.rev,
    skin: m.hasSkin ? `/v1/skin/${m.name}` : null,
    cape: m.hasCape ? `/v1/cape/${m.name}` : null,
  });

  function readBody(req) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      let size = 0;
      req.on('data', (c) => {
        size += c.length;
        if (size > MAX_BODY) { reject(new HttpError(413, 'Request too large')); req.destroy(); return; }
        chunks.push(c);
      });
      req.on('end', () => {
        try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch { reject(new HttpError(400, 'Body must be JSON')); }
      });
      req.on('error', reject);
    });
  }

  function checkToken(meta, token) {
    if (typeof token !== 'string' || token.length < 16) throw new HttpError(401, 'A secret token of at least 16 characters is required');
    const want = Buffer.from(meta.tokenHash, 'hex');
    if (!crypto.timingSafeEqual(want, sha(token))) throw new HttpError(403, 'This name belongs to another launcher');
  }

  function put(name, body) {
    if (!NAME.test(name)) throw new HttpError(400, 'A nickname is 3–16 letters, digits or _');
    let meta = readMeta(name);
    const skin = body.skin === undefined ? undefined : body.skin === null ? null : cleanPng(body.skin, 64, 64, 'The skin');
    const cape = body.cape === undefined ? undefined : body.cape === null ? null : cleanPng(body.cape, 64, 32, 'The cape');
    if (meta) {
      checkToken(meta, body.token);
    } else {
      if (typeof body.token !== 'string' || body.token.length < 16) throw new HttpError(401, 'A secret token of at least 16 characters is required');
      if (fs.readdirSync(data).length >= maxProfiles) throw new HttpError(507, 'This service is full');
      meta = { name, tokenHash: sha(body.token).toString('hex'), slim: false, rev: 0, hasSkin: false, hasCape: false };
    }
    const dir = dirOf(name);
    fs.mkdirSync(dir, { recursive: true });
    if (skin) { atomicWrite(path.join(dir, 'skin.png'), skin); meta.hasSkin = true; }
    if (skin === null) { fs.rmSync(path.join(dir, 'skin.png'), { force: true }); meta.hasSkin = false; }
    if (cape) { atomicWrite(path.join(dir, 'cape.png'), cape); meta.hasCape = true; }
    if (cape === null) { fs.rmSync(path.join(dir, 'cape.png'), { force: true }); meta.hasCape = false; }
    if (body.slim !== undefined) meta.slim = !!body.slim;
    meta.name = name;
    meta.rev = (meta.rev || 0) + 1;
    meta.updated = Date.now();
    atomicWrite(path.join(dir, 'profile.json'), JSON.stringify(meta));
    return publicProfile(meta);
  }

  const send = (res, status, body, type = 'application/json', extra = {}) => {
    const buf = Buffer.isBuffer(body) ? body : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
    res.writeHead(status, { 'Content-Type': type, 'Content-Length': buf.length, 'X-Content-Type-Options': 'nosniff', ...extra });
    res.end(buf);
  };

  async function handle(req, res) {
    const ip = (trustProxy && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || '?';
    const url = new URL(req.url, 'http://x');
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0] !== 'v1') throw new HttpError(404, 'Not found');
    const write = req.method !== 'GET' && req.method !== 'HEAD';
    if (limited(ip, write ? 'w' : 'r', write ? writesPerMin : readsPerMin)) throw new HttpError(429, 'Slow down');

    if (parts[1] === 'health') return send(res, 200, { ok: true, service: 'lumen-skins', profiles: fs.readdirSync(data).length });

    if (parts[1] === 'lookup' && req.method === 'POST') {
      const body = await readBody(req);
      const names = Array.isArray(body.names) ? body.names.slice(0, 64) : [];
      const out = {};
      for (const n of names) {
        if (typeof n !== 'string' || !NAME.test(n)) continue;
        const m = readMeta(n);
        if (m && (m.hasSkin || m.hasCape)) out[n] = publicProfile(m);
      }
      return send(res, 200, { profiles: out });
    }

    const name = parts[2];
    if (!name || !NAME.test(name)) throw new HttpError(400, 'A nickname is 3–16 letters, digits or _');

    if (parts[1] === 'profile') {
      if (req.method === 'GET') {
        const m = readMeta(name);
        if (!m) throw new HttpError(404, 'No such player');
        return send(res, 200, publicProfile(m));
      }
      if (req.method === 'PUT') return send(res, 200, put(name, await readBody(req)));
      if (req.method === 'DELETE') {
        const m = readMeta(name);
        if (!m) throw new HttpError(404, 'No such player');
        checkToken(m, (await readBody(req)).token);
        fs.rmSync(dirOf(name), { recursive: true, force: true });
        return send(res, 200, { ok: true });
      }
    }
    if ((parts[1] === 'skin' || parts[1] === 'cape') && req.method === 'GET') {
      const m = readMeta(name);
      const has = m && (parts[1] === 'skin' ? m.hasSkin : m.hasCape);
      if (!has) throw new HttpError(404, 'No such picture');
      return send(res, 200, fs.readFileSync(path.join(dirOf(name), `${parts[1]}.png`)), 'image/png', { 'Cache-Control': 'public, max-age=300' });
    }
    throw new HttpError(404, 'Not found');
  }

  return http.createServer((req, res) => {
    handle(req, res).catch((e) => {
      if (res.headersSent) return;
      if (!(e instanceof HttpError)) console.error(e);
      send(res, e.status || 500, { error: e instanceof HttpError ? e.message : 'Something went wrong' });
    });
  });
}

module.exports = { createService };

if (require.main === module) {
  const port = Number(process.env.PORT) || 8787;
  const dataDir = process.env.DATA || path.join(process.cwd(), 'skin-data');
  createService({ data: dataDir, trustProxy: process.env.TRUST_PROXY === '1' }).listen(port, process.env.HOST || '0.0.0.0', () => {
    console.log(`Lumen skin service on port ${port}, data in ${dataDir}`);
  });
}
