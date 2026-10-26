// Lumen skin service as a Cloudflare Worker (free plan is enough). Same HTTP API as server/skin-service.js; the pictures
// and profiles live in a Workers KV namespace bound as SKINS. See server/README.md for the few commands to deploy it.
//
// Names are claimed by whoever uploads first, with a secret token only that launcher knows (kept hashed). This keeps
// friends from overwriting each other; it is not a login system.

const NAME = /^[A-Za-z0-9_]{3,16}$/;
const MAX_BODY = 160 * 1024;
const MAX_PNG = 48 * 1024;
const DEFAULT_REWRITE_MS = 2000; // a name can be changed at most once every 2 seconds (env.MIN_REWRITE_MS overrides it)

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const json = (status, body, extra = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff', ...extra } });

// ---------- helpers ----------

const b64decode = (s) => {
  const bin = atob(String(s));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

async function sha256hex(text) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function sameText(a, b) { // not quite constant time in theory, but both are fixed-length hex digests
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function inflate(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

const be32 = (a, o) => ((a[o] << 24) | (a[o + 1] << 16) | (a[o + 2] << 8) | a[o + 3]) >>> 0;

// Checks that these bytes are a w x h 8-bit PNG whose picture data is complete, and returns a copy that holds only the
// chunks needed to draw it (no text, no metadata). Throws HttpError for anything else.
async function cleanPng(b64, w, h, what) {
  let raw;
  try {
    raw = b64decode(b64);
  } catch {
    throw new HttpError(400, `${what} is not base64`);
  }
  if (raw.length === 0 || raw.length > MAX_PNG) throw new HttpError(413, `${what} picture is too large`);
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  if (raw.length < 33 || sig.some((v, i) => raw[i] !== v)) throw new HttpError(400, `${what}: this is not a PNG`);
  let pos = 8;
  let ihdr = null;
  const keep = [];
  const idat = [];
  while (pos + 12 <= raw.length) {
    const len = be32(raw, pos);
    const type = String.fromCharCode(raw[pos + 4], raw[pos + 5], raw[pos + 6], raw[pos + 7]);
    if (pos + 12 + len > raw.length) throw new HttpError(400, `${what}: the PNG is damaged`);
    const chunk = raw.subarray(pos, pos + 12 + len);
    const data = raw.subarray(pos + 8, pos + 8 + len);
    pos += 12 + len;
    if (type === 'IHDR') ihdr = { width: be32(data, 0), height: be32(data, 4), depth: data[8], color: data[9], interlace: data[12] };
    if (type === 'IHDR' || type === 'PLTE' || type === 'tRNS') keep.push(chunk);
    if (type === 'IDAT') { idat.push(data); keep.push(chunk); }
    if (type === 'IEND') { keep.push(chunk); break; }
  }
  if (!ihdr || idat.length === 0) throw new HttpError(400, `${what}: the PNG is damaged`);
  if (ihdr.width !== w || ihdr.height !== h) throw new HttpError(400, `${what} must be ${w}x${h} pixels`);
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ihdr.color];
  if (ihdr.depth !== 8 || ihdr.interlace || !channels) throw new HttpError(400, `${what} must be an 8-bit PNG without interlacing`);
  let total = 0;
  for (const d of idat) total += d.length;
  const joined = new Uint8Array(total);
  let o = 0;
  for (const d of idat) { joined.set(d, o); o += d.length; }
  let pixels;
  try {
    pixels = await inflate(joined);
  } catch {
    throw new HttpError(400, `${what}: the PNG is damaged`);
  }
  if (pixels.length !== (w * channels + 1) * h) throw new HttpError(400, `${what}: the PNG is damaged`);
  const out = new Uint8Array(8 + keep.reduce((n, c) => n + c.length, 0));
  out.set(sig, 0);
  let p = 8;
  for (const c of keep) { out.set(c, p); p += c.length; }
  return out;
}

async function readBody(request) {
  const text = await request.text();
  if (text.length > MAX_BODY) throw new HttpError(413, 'Request too large');
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new HttpError(400, 'Body must be JSON');
  }
}

// ---------- storage: p:<name> profile, s:<name> skin, c:<name> cape (names lower case) ----------

const keyOf = (kind, name) => `${kind}:${name.toLowerCase()}`;
const readMeta = async (env, name) => env.SKINS.get(keyOf('p', name), 'json');

const publicProfile = (m) => ({
  name: m.name,
  slim: !!m.slim,
  rev: m.rev,
  skin: m.hasSkin ? `/v1/skin/${m.name}` : null,
  cape: m.hasCape ? `/v1/cape/${m.name}` : null,
});

async function checkToken(meta, token) {
  if (typeof token !== 'string' || token.length < 16) throw new HttpError(401, 'A secret token of at least 16 characters is required');
  if (!sameText(meta.tokenHash, await sha256hex(token))) throw new HttpError(403, 'This name belongs to another launcher');
}

async function put(env, name, body) {
  if (!NAME.test(name)) throw new HttpError(400, 'A nickname is 3–16 letters, digits or _');
  let meta = await readMeta(env, name);
  const skin = body.skin === undefined ? undefined : body.skin === null ? null : await cleanPng(body.skin, 64, 64, 'The skin');
  const cape = body.cape === undefined ? undefined : body.cape === null ? null : await cleanPng(body.cape, 64, 32, 'The cape');
  if (meta) {
    await checkToken(meta, body.token);
    if (Date.now() - (meta.updated || 0) < Number(env.MIN_REWRITE_MS ?? DEFAULT_REWRITE_MS)) throw new HttpError(429, 'Slow down');
  } else {
    if (typeof body.token !== 'string' || body.token.length < 16) throw new HttpError(401, 'A secret token of at least 16 characters is required');
    meta = { name, tokenHash: await sha256hex(body.token), slim: false, rev: 0, hasSkin: false, hasCape: false };
    const count = Number((await env.SKINS.get('meta:count')) || 0);
    await env.SKINS.put('meta:count', String(count + 1));
  }
  if (skin) { await env.SKINS.put(keyOf('s', name), skin); meta.hasSkin = true; }
  if (skin === null) { await env.SKINS.delete(keyOf('s', name)); meta.hasSkin = false; }
  if (cape) { await env.SKINS.put(keyOf('c', name), cape); meta.hasCape = true; }
  if (cape === null) { await env.SKINS.delete(keyOf('c', name)); meta.hasCape = false; }
  if (body.slim !== undefined) meta.slim = !!body.slim;
  meta.name = name;
  meta.rev = (meta.rev || 0) + 1;
  meta.updated = Date.now();
  await env.SKINS.put(keyOf('p', name), JSON.stringify(meta));
  return publicProfile(meta);
}

async function handle(request, env) {
  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts[0] !== 'v1') throw new HttpError(404, 'Not found');

  if (parts[1] === 'health') return json(200, { ok: true, service: 'lumen-skins', profiles: Number((await env.SKINS.get('meta:count')) || 0) });

  if (parts[1] === 'lookup' && request.method === 'POST') {
    const body = await readBody(request);
    const names = Array.isArray(body.names) ? body.names.slice(0, 64) : [];
    const profiles = {};
    await Promise.all(names.map(async (n) => {
      if (typeof n !== 'string' || !NAME.test(n)) return;
      const m = await readMeta(env, n);
      if (m && (m.hasSkin || m.hasCape)) profiles[n] = publicProfile(m);
    }));
    return json(200, { profiles });
  }

  const name = parts[2];
  if (!name || !NAME.test(name)) throw new HttpError(400, 'A nickname is 3–16 letters, digits or _');

  if (parts[1] === 'profile') {
    if (request.method === 'GET') {
      const m = await readMeta(env, name);
      if (!m) throw new HttpError(404, 'No such player');
      return json(200, publicProfile(m));
    }
    if (request.method === 'PUT') return json(200, await put(env, name, await readBody(request)));
    if (request.method === 'DELETE') {
      const m = await readMeta(env, name);
      if (!m) throw new HttpError(404, 'No such player');
      await checkToken(m, (await readBody(request)).token);
      await Promise.all([env.SKINS.delete(keyOf('p', name)), env.SKINS.delete(keyOf('s', name)), env.SKINS.delete(keyOf('c', name))]);
      const count = Number((await env.SKINS.get('meta:count')) || 0);
      await env.SKINS.put('meta:count', String(Math.max(0, count - 1)));
      return json(200, { ok: true });
    }
  }
  if ((parts[1] === 'skin' || parts[1] === 'cape') && request.method === 'GET') {
    const bytes = await env.SKINS.get(keyOf(parts[1] === 'skin' ? 's' : 'c', name), 'arrayBuffer');
    if (!bytes) throw new HttpError(404, 'No such picture');
    return new Response(bytes, { status: 200, headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=300', 'X-Content-Type-Options': 'nosniff' } });
  }
  throw new HttpError(404, 'Not found');
}

export default {
  async fetch(request, env) {
    try {
      return await handle(request, env);
    } catch (e) {
      if (e instanceof HttpError) return json(e.status, { error: e.message });
      console.error(e);
      return json(500, { error: 'Something went wrong' });
    }
  },
};
