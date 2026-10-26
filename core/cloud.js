// The Lumen skin service: lets Lumen players see each other's skins and capes (see server/skin-service.js).
// The launcher uploads the active skin and cape of the selected account; the mod, told the service address in
// config/lumen-cloud.json, downloads the ones of the players around you.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const store = require('./store');
const instances = require('./instances');
const skins = require('./skins');
const { writeFileAtomic } = require('./fsutil');
const { fetchRetry } = require('./net');

const DEFAULTS = { url: '', share: true, others: true, token: '' };

// Only http(s) addresses; a trailing slash is dropped. An empty string means "not set up".
function cleanUrl(u) {
  const s = String(u || '').trim();
  if (!s) return '';
  let url;
  try { url = new URL(s); } catch { throw new Error('This is not a web address'); }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('The service address must start with https:// (or http://)');
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
}

function get() {
  const cfg = store.load();
  const c = { ...DEFAULTS, ...(cfg.cloud || {}) };
  if (!c.token) {
    c.token = crypto.randomBytes(24).toString('hex'); // the secret that proves a name is yours on the service
    store.update({ cloud: c });
  }
  return c;
}

const accountName = () => {
  const cfg = store.load();
  const a = cfg.accounts.find((x) => x.id === cfg.selectedAccount);
  return a ? a.name : null;
};

// What the UI shows: never the token.
function view() {
  const { url, share, others } = get();
  return { url, share, others, name: accountName() };
}

function set(patch) {
  const c = get();
  if (patch.url !== undefined) c.url = cleanUrl(patch.url);
  if (patch.share !== undefined) c.share = !!patch.share;
  if (patch.others !== undefined) c.others = !!patch.others;
  store.update({ cloud: c });
  syncAll();
  return view();
}

// Tells the mod in one instance where the service is (or that it should not ask).
function sync(instId) {
  const inst = instances.read(instId);
  if (!inst.content['lumen-hud']) return;
  const c = get();
  const file = path.join(instances.dirOf(instId), 'config', 'lumen-cloud.json');
  if (!c.url && !fs.existsSync(file)) return;
  writeFileAtomic(file, JSON.stringify({ enabled: !!c.url && c.others, url: c.url }));
}

function syncAll() {
  for (const i of instances.list()) {
    try { sync(i.id); } catch {}
  }
}

async function request(c, method, route, body) {
  const r = await fetchRetry(`${c.url}${route}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }, 1);
  return r.json();
}

// Is there a Lumen skin service at this address?
async function check(url) {
  const base = cleanUrl(url === undefined ? get().url : url);
  if (!base) throw new Error('Enter the service address first');
  let r;
  try {
    r = await request({ url: base }, 'GET', '/v1/health');
  } catch (e) {
    throw new Error(`Could not reach the service: ${e.message}`);
  }
  if (!r || r.service !== 'lumen-skins') throw new Error('That address is not a Lumen skin service');
  return { ok: true, profiles: r.profiles };
}

// Uploads the active skin and cape of the selected account. Does nothing when sharing is off or there is no service.
async function push() {
  const c = get();
  const name = accountName();
  if (!c.url || !c.share || !name || !/^[A-Za-z0-9_]{3,16}$/.test(name)) return false;
  const skin = skins.activeSkin();
  const cape = skins.capeBytes();
  await request(c, 'PUT', `/v1/profile/${name}`, {
    token: c.token,
    slim: !!skin && skin.model === 'slim',
    skin: skin ? skin.png.toString('base64') : null,
    cape: cape ? cape.toString('base64') : null,
  });
  return true;
}

// For callers that must not fail because the service is down: the error is returned, not thrown.
async function pushQuietly() {
  try { return { ok: await push() }; } catch (e) { return { ok: false, error: e.message }; }
}

module.exports = { get, view, set, sync, syncAll, check, push, pushQuietly, cleanUrl };
