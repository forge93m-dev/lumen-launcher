// The launcher's own updates. A manifest (latest.json) on any https host says which version is newest and where the
// installer is; the installer is downloaded, its SHA-256 must match the manifest, and only then is it opened.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
const { fetchRetry, getJson } = require('./net');

// 1.2.3 or v1.2.3-beta: the numbers decide, a pre-release tag does not make a version newer
function parts(v) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(String(v || '').trim());
  return m ? [+m[1], +m[2], +m[3]] : null;
}

function isNewer(remote, local) {
  const a = parts(remote);
  const b = parts(local);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}

// What the manifest must contain; anything else is refused rather than half-trusted.
function validate(m) {
  if (!m || typeof m !== 'object') throw new Error('The update manifest is not valid');
  if (!parts(m.version)) throw new Error('The update manifest has no version');
  let u;
  try { u = new URL(m.url); } catch { throw new Error('The update manifest has no download address'); }
  if (u.protocol !== 'https:') throw new Error('Updates must be downloaded over https');
  if (!/^[0-9a-f]{64}$/i.test(String(m.sha256 || ''))) throw new Error('The update manifest has no SHA-256 checksum');
  const name = path.basename(u.pathname);
  if (!/\.(exe|msi|dmg|appimage|deb)$/i.test(name)) throw new Error('The update is not an installer');
  return { version: String(m.version).replace(/^v/, ''), url: u.href, sha256: m.sha256.toLowerCase(), notes: String(m.notes || '').slice(0, 2000), name };
}

async function check(currentVersion, url) {
  if (!url) return { configured: false, current: currentVersion, available: false };
  const info = validate(await getJson(url));
  return { configured: true, current: currentVersion, available: isNewer(info.version, currentVersion), ...info };
}

function sha256File(file) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash('sha256');
    fs.createReadStream(file).on('data', (d) => h.update(d)).on('end', () => resolve(h.digest('hex'))).on('error', reject);
  });
}

// Downloads the installer into dir and checks it; returns the file path. Nothing is left behind when the checksum is wrong.
async function fetchInstaller(info, dir, onProgress) {
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, info.name);
  const tmp = dest + '.part';
  const r = await fetchRetry(info.url);
  const total = +r.headers.get('content-length') || 0;
  let got = 0;
  const body = Readable.fromWeb(r.body);
  body.on('data', (d) => {
    got += d.length;
    if (onProgress && total) onProgress({ done: got, total });
  });
  await pipeline(body, fs.createWriteStream(tmp));
  const sum = await sha256File(tmp);
  if (sum !== info.sha256) {
    fs.rmSync(tmp, { force: true });
    throw new Error('The downloaded update does not match its checksum, so it was not opened');
  }
  fs.renameSync(tmp, dest);
  return dest;
}

module.exports = { isNewer, validate, check, fetchInstaller, sha256File };
