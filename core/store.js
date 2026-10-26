const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const paths = require('./paths');
const { writeFileAtomic } = require('./fsutil');

const DEFAULTS = {
  accounts: [],
  selectedAccount: null,
  selectedInstance: null,
  settings: {
    ram: 4096,
    width: 1280,
    height: 720,
    jvmArgs: '',
    javaPath: '',
    closeOnLaunch: false,
    fullscreen: false,
    language: 'auto', // 'auto' follows the system, or 'en' / 'ru'
    showSnapshots: false,
    accent: '#8b5cf6',
  },
  cloud: { url: '', share: true, others: true, token: '' }, // the Lumen skin service (core/cloud.js)
  servers: [
    { name: 'Hypixel', address: 'mc.hypixel.net' },
    { name: 'CubeCraft', address: 'play.cubecraft.net' },
  ],
};

let cfg;

function load() {
  if (cfg) return cfg;
  try {
    const raw = JSON.parse(fs.readFileSync(paths.config, 'utf8'));
    cfg = { ...DEFAULTS, ...raw, settings: { ...DEFAULTS.settings, ...(raw.settings || {}) } };
  } catch {
    cfg = JSON.parse(JSON.stringify(DEFAULTS));
  }
  return cfg;
}

function save() {
  fs.mkdirSync(path.dirname(paths.config), { recursive: true });
  writeFileAtomic(paths.config, JSON.stringify(cfg, null, 2));
}

function update(patch) {
  load();
  for (const [k, v] of Object.entries(patch)) {
    cfg[k] = k === 'settings' ? { ...cfg.settings, ...v } : v;
  }
  save();
  return cfg;
}

// Same UUID scheme vanilla servers use for offline players.
function offlineUuid(name) {
  const h = crypto.createHash('md5').update(`OfflinePlayer:${name}`).digest();
  h[6] = (h[6] & 0x0f) | 0x30;
  h[8] = (h[8] & 0x3f) | 0x80;
  const x = h.toString('hex');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}

function addOfflineAccount(name) {
  load();
  if (!/^[A-Za-z0-9_]{3,16}$/.test(name)) throw new Error('Nickname must be 3–16 letters, digits or _');
  const acc = { id: crypto.randomUUID(), type: 'offline', name, uuid: offlineUuid(name) };
  cfg.accounts.push(acc);
  cfg.selectedAccount = acc.id;
  save();
  return cfg;
}

function removeAccount(id) {
  load();
  cfg.accounts = cfg.accounts.filter((a) => a.id !== id);
  if (cfg.selectedAccount === id) cfg.selectedAccount = cfg.accounts[0] ? cfg.accounts[0].id : null;
  save();
  return cfg;
}

module.exports = { load, save, update, addOfflineAccount, removeAccount };
