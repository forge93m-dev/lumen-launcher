// Player skins: a small library next to the launcher's data, one of them active. The active skin is copied into every
// instance that has Lumen HUD (config/lumen-skin.png + lumen-skin.json); the mod draws your own player with it.
// Other players cannot see it: it only exists on this computer.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const paths = require('./paths');
const instances = require('./instances');
const png = require('./png');
const { writeFileAtomic } = require('./fsutil');
const { getJson, fetchRetry } = require('./net');

const dir = () => path.join(paths.root, 'skins');
const indexFile = () => path.join(dir(), 'index.json');
const fileOf = (id) => path.join(dir(), `${id}.png`);
const MODELS = ['classic', 'slim'];

// ---------- picture handling ----------

function pixel(buf, w, x, y) { return (y * w + x) * 4; }

// copyRect as the game does it when it upgrades an old 64x32 skin: copy a block, mirrored, to another place.
function copyRect(buf, sx, sy, ox, oy, w, h, flipX) {
  for (let i = 0; i < w; i++) {
    for (let j = 0; j < h; j++) {
      const from = pixel(buf, 64, sx + i, sy + j);
      const to = pixel(buf, 64, sx + ox + (flipX ? w - 1 - i : i), sy + oy + j);
      buf.copy(buf, to, from, from + 4);
    }
  }
}

function opaque(buf, x1, y1, x2, y2) {
  for (let y = y1; y < y2; y++) for (let x = x1; x < x2; x++) buf[pixel(buf, 64, x, y) + 3] = 255;
}

// Any 64x64 or old 64x32 skin (or the same drawn 2x, 4x... larger) becomes the 64x64 picture the game wants.
function normalize(rgba, w, h) {
  const legacy = w === h * 2;
  if (!((w === h || legacy) && w >= 64 && w % 64 === 0)) throw new Error('A skin picture is 64×64 (or the old 64×32) pixels');
  const k = w / 64;
  const out = Buffer.alloc(64 * 64 * 4);
  for (let y = 0; y < (legacy ? 32 : 64); y++) {
    for (let x = 0; x < 64; x++) {
      const from = pixel(rgba, w, x * k, y * k);
      rgba.copy(out, pixel(out, 64, x, y), from, from + 4);
    }
  }
  if (legacy) {
    for (const [sx, sy, ox, oy, rw, rh] of [[4, 16, 16, 32, 4, 4], [8, 16, 16, 32, 4, 4], [0, 20, 24, 32, 4, 12], [4, 20, 16, 32, 4, 12], [8, 20, 8, 32, 4, 12], [12, 20, 16, 32, 4, 12],
      [44, 16, -8, 32, 4, 4], [48, 16, -8, 32, 4, 4], [40, 20, 0, 32, 4, 12], [44, 20, -8, 32, 4, 12], [48, 20, -16, 32, 4, 12], [52, 20, -8, 32, 4, 12]]) {
      copyRect(out, sx, sy, ox, oy, rw, rh, true);
    }
  }
  // The body parts under the clothing layers are never see-through.
  opaque(out, 0, 0, 32, 16);
  opaque(out, 0, 16, 64, 32);
  opaque(out, 16, 48, 48, 64);
  return out;
}

function toSkinPng(buf) {
  const { width, height, rgba } = png.decode(buf);
  return png.encode(normalize(rgba, width, height), 64, 64);
}

// ---------- library ----------

function readIndex() {
  try {
    const j = JSON.parse(fs.readFileSync(indexFile(), 'utf8'));
    return { skins: Array.isArray(j.skins) ? j.skins.filter((s) => s && /^[a-z0-9-]+$/.test(s.id) && fs.existsSync(fileOf(s.id))) : [], active: j.active || null };
  } catch {
    return { skins: [], active: null };
  }
}

const writeIndex = (idx) => writeFileAtomic(indexFile(), JSON.stringify(idx, null, 2));

const cleanName = (n) => String(n || '').replace(/[^\p{L}\p{N} _.'-]/gu, '').trim().slice(0, 32) || 'Skin';

function list() {
  const idx = readIndex();
  return idx.skins.map((s) => ({ ...s, active: s.id === idx.active }));
}

function read(id) {
  const s = readIndex().skins.find((x) => x.id === id);
  if (!s) throw new Error('No such skin');
  return fs.readFileSync(fileOf(id));
}

// Adds a skin from the bytes of a PNG and makes it the active one.
function add(pngBytes, { name, model } = {}) {
  const out = toSkinPng(pngBytes);
  const id = `${crypto.randomBytes(5).toString('hex')}`;
  writeFileAtomic(fileOf(id), out);
  const idx = readIndex();
  idx.skins.push({ id, name: cleanName(name), model: MODELS.includes(model) ? model : 'classic', added: Date.now() });
  idx.active = id;
  writeIndex(idx);
  return id;
}

function update(id, patch) {
  const idx = readIndex();
  const s = idx.skins.find((x) => x.id === id);
  if (!s) throw new Error('No such skin');
  if (patch.name !== undefined) s.name = cleanName(patch.name);
  if (patch.model !== undefined) {
    if (!MODELS.includes(patch.model)) throw new Error('A skin model is classic or slim');
    s.model = patch.model;
  }
  writeIndex(idx);
}

function setActive(id) {
  const idx = readIndex();
  if (id !== null && !idx.skins.some((s) => s.id === id)) throw new Error('No such skin');
  idx.active = id;
  writeIndex(idx);
}

function remove(id) {
  const idx = readIndex();
  idx.skins = idx.skins.filter((s) => s.id !== id);
  if (idx.active === id) idx.active = null;
  fs.rmSync(fileOf(id), { force: true });
  writeIndex(idx);
}

// ---------- the game side ----------

// Writes the active skin into one instance (or switches it off there). Only instances that have Lumen HUD need it.
function sync(instId) {
  const inst = instances.read(instId);
  if (!inst.content['lumen-hud']) return false;
  const cfg = path.join(instances.dirOf(instId), 'config');
  const idx = readIndex();
  const s = idx.skins.find((x) => x.id === idx.active);
  if (!s) {
    if (fs.existsSync(path.join(cfg, 'lumen-skin.json'))) writeFileAtomic(path.join(cfg, 'lumen-skin.json'), JSON.stringify({ enabled: false, slim: false }));
    return false;
  }
  writeFileAtomic(path.join(cfg, 'lumen-skin.png'), fs.readFileSync(fileOf(s.id)));
  writeFileAtomic(path.join(cfg, 'lumen-skin.json'), JSON.stringify({ enabled: true, slim: s.model === 'slim' }));
  return true;
}

function syncAll() {
  for (const i of instances.list()) {
    try { sync(i.id); } catch {}
  }
}

// ---------- somebody else's skin, by nickname ----------

const NAME = /^[A-Za-z0-9_]{3,16}$/;
const SKIN_URL = /^https:\/\/textures\.minecraft\.net\/texture\/[0-9a-f]+$/;

// Returns { name, url, slim } for a Minecraft account's skin. Only Mojang's own servers are asked.
async function fetchProfile(nickname, json = getJson) {
  if (!NAME.test(String(nickname))) throw new Error('A nickname is 3–16 letters, digits or _');
  let who;
  try {
    who = await json(`https://api.mojang.com/users/profiles/minecraft/${nickname}`);
  } catch (e) {
    if (/HTTP 404|HTTP 204/.test(e.message)) throw new Error(`No player called ${nickname}`);
    throw e;
  }
  if (!who || !/^[0-9a-f]{32}$/i.test(who.id || '')) throw new Error(`No player called ${nickname}`);
  const profile = await json(`https://sessionserver.mojang.com/session/minecraft/profile/${who.id}`);
  const prop = (profile.properties || []).find((p) => p.name === 'textures');
  const tex = prop && JSON.parse(Buffer.from(prop.value, 'base64').toString('utf8')).textures;
  const skin = tex && tex.SKIN;
  if (!skin || !SKIN_URL.test(skin.url)) throw new Error(`${profile.name || nickname} has no custom skin`);
  return { name: profile.name || who.name || nickname, url: skin.url, slim: !!(skin.metadata && skin.metadata.model === 'slim') };
}

async function addFromNickname(nickname, deps = {}) {
  const p = await fetchProfile(nickname, deps.json);
  const bytes = deps.bytes ? await deps.bytes(p.url) : Buffer.from(await (await fetchRetry(p.url)).arrayBuffer());
  return add(bytes, { name: p.name, model: p.slim ? 'slim' : 'classic' });
}

module.exports = { normalize, toSkinPng, list, read, add, update, setActive, remove, sync, syncAll, fetchProfile, addFromNickname, MODELS };
